import * as logger from 'firebase-functions/logger';
import { PaymentProvider, PaymentResponse, VerifyPaymentResponse, WebhookValidationResult } from './types';
import { PaymentProviderType, PaymentStatus } from '../../types/orders';

/**
 * Helper para reintentar operaciones de red con exponential backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Si la respuesta es exitosa o es un error del cliente definitivo (como 400, 401, 403, 429), retornar
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408)) {
        return response;
      }

      // Si es un error del servidor (5xx) o timeout, arrojar error para reintentar
      throw new Error(`HTTP error! status: ${response.status}`);
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        logger.error(`fetchWithRetry: Falló después de ${maxRetries} reintentos:`, lastError);
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`fetchWithRetry: Reintento ${attempt + 1}/${maxRetries} en ${delay}ms debido a: ${lastError.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export class KhipuProvider implements PaymentProvider {
  public readonly type: PaymentProviderType = 'khipu';

  private getApiKey(): string {
    const apiKey = process.env.KHIPU_API_KEY;
    if (!apiKey) {
      logger.error('KhipuProvider: Variable de entorno KHIPU_API_KEY no configurada');
      throw new Error('Falta configuración de Khipu API Key');
    }
    return apiKey;
  }

  private getApiUrl(): string {
    return process.env.KHIPU_API_URL || 'https://khipu.com/api/3.0';
  }

  /**
   * Crea un pago en Khipu mediante una llamada a su API moderna
   */
  public async createPayment(
    orderId: string,
    amount: number,
    returnUrl: string,
    paymentReference: string
  ): Promise<PaymentResponse> {
    logger.info('KhipuProvider.createPayment: Iniciando pago', { orderId, amount, paymentReference });
    
    const apiKey = this.getApiKey();
    const apiUrl = this.getApiUrl();

    // Tiempo de expiración recomendado: 15 minutos en formato ISO
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const payload = {
      amount,
      subject: `Pedido #${paymentReference}`,
      currency: 'CLP',
      returnUrl,
      cancelUrl: returnUrl, // Se puede retornar a la misma URL para manejar la cancelación
      transactionId: paymentReference,
      body: `Pago de pedido Pizzería Palermo`,
      expiresAt
    };

    try {
      const response = await fetchWithRetry(`${apiUrl}/payments`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('KhipuProvider.createPayment: Respuesta de error de la API', { status: response.status, body: errorText });
        throw new Error(`Khipu API retornó error ${response.status}: ${errorText}`);
      }

      const responseData = await response.json() as Record<string, unknown>;
      
      const providerPaymentId = String(responseData.paymentId || '');
      const redirectUrl = String(responseData.paymentUrl || responseData.redirectUrl || '');

      if (!providerPaymentId || !redirectUrl) {
        throw new Error('Respuesta incompleta de la API de Khipu');
      }

      return {
        success: true,
        providerPaymentId,
        redirectUrl,
        paymentReference,
        rawResponse: responseData
      };
    } catch (error) {
      logger.error('KhipuProvider.createPayment: Excepcion al crear pago en Khipu', { orderId, error });
      throw error;
    }
  }

  /**
   * Verifica el estado del pago directamente en la API de Khipu
   */
  public async verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResponse> {
    logger.info('KhipuProvider.verifyPayment: Consultando estado del pago', { providerPaymentId });
    
    const apiKey = this.getApiKey();
    const apiUrl = this.getApiUrl();

    try {
      const response = await fetchWithRetry(`${apiUrl}/payments/${providerPaymentId}`, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('KhipuProvider.verifyPayment: Error consultando estado en Khipu', { status: response.status, body: errorText });
        throw new Error(`Khipu API retornó error ${response.status} en GET: ${errorText}`);
      }

      const responseData = await response.json() as Record<string, unknown>;
      
      // Mapear los estados nativos de Khipu a nuestro esquema común
      // Estados típicos de Khipu: 'pending', 'verifying', 'approved', 'rejected'
      const rawStatus = String(responseData.status || responseData.paymentStatus || 'UNKNOWN');
      const isApproved = rawStatus.toLowerCase() === 'approved' || rawStatus.toLowerCase() === 'paid';
      const amount = Number(responseData.amount || 0);

      return {
        success: isApproved,
        providerStatus: rawStatus,
        amount,
        providerPaymentId,
        rawResponse: responseData
      };
    } catch (error) {
      logger.error('KhipuProvider.verifyPayment: Excepcion al verificar pago', { providerPaymentId, error });
      throw error;
    }
  }

  /**
   * Valida un webhook enviado por Khipu.
   * La recomendación de Khipu en APIs modernas para asegurar autenticidad 
   * es hacer un GET /payments/{id} usando la API Key a partir del ID recibido.
   */
  public async validateWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<WebhookValidationResult> {
    logger.info('KhipuProvider.validateWebhook: Recibido webhook de Khipu', { payload });

    // La API moderna puede enviar el webhook con el ID del pago en 'paymentId' o 'id'
    const paymentId = String(payload.paymentId || payload.id || '');

    if (!paymentId) {
      logger.error('KhipuProvider.validateWebhook: Webhook no contiene paymentId', { payload });
      return {
        isValid: false,
        providerPaymentId: '',
        orderId: '',
        status: 'failed',
        rawEvent: payload
      };
    }

    try {
      // Validamos consultando directamente el estado verificado del pago a la API de Khipu
      const verification = await this.verifyPayment(paymentId);
      
      const transactionId = String(verification.rawResponse.transactionId || '');
      
      // Mapear estado
      let paymentStatus: PaymentStatus = 'pending';
      const statusLower = verification.providerStatus.toLowerCase();
      if (statusLower === 'approved' || statusLower === 'paid') {
        paymentStatus = 'paid';
      } else if (statusLower === 'rejected' || statusLower === 'failed') {
        paymentStatus = 'failed';
      } else if (statusLower === 'verifying') {
        paymentStatus = 'processing';
      }

      return {
        isValid: true,
        providerPaymentId: paymentId,
        orderId: transactionId, // El transactionId enviado mapea al paymentReference interno
        status: paymentStatus,
        rawEvent: verification.rawResponse
      };
    } catch (error) {
      logger.error('KhipuProvider.validateWebhook: Error validando webhook', { paymentId, error });
      return {
        isValid: false,
        providerPaymentId: paymentId,
        orderId: '',
        status: 'failed',
        rawEvent: { error: String(error) }
      };
    }
  }
}
