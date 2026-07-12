import * as logger from 'firebase-functions/logger';
import { PaymentProvider, PaymentResponse, VerifyPaymentResponse, WebhookValidationResult } from './types';
import { PaymentProviderType, PaymentStatus } from '../../types/orders';
import { 
  createWebpayTransaction, 
  confirmWebpayTransaction,
  getTransactionStatus 
} from '../webpay.service';

export class WebpayProvider implements PaymentProvider {
  public readonly type: PaymentProviderType = 'webpay';

  /**
   * Inicia una transacción de pago en Webpay Plus
   */
  public async createPayment(
    orderId: string,
    amount: number,
    returnUrl: string,
    paymentReference: string
  ): Promise<PaymentResponse> {
    logger.info('WebpayProvider.createPayment: Iniciando transaccion', { orderId, amount, paymentReference });

    try {
      // Nota: En Webpay la referencia del sistema (paymentReference) se mapea a buyOrder 
      // y orderId se mapea a sessionId
      const response = await createWebpayTransaction(
        paymentReference, // buyOrder
        orderId,          // sessionId
        amount,
        returnUrl
      );

      return {
        success: true,
        providerPaymentId: response.token,
        redirectUrl: response.url,
        paymentReference,
        rawResponse: response as unknown as Record<string, unknown>
      };
    } catch (error) {
      logger.error('WebpayProvider.createPayment: Error al crear transaccion', { orderId, error });
      throw error;
    }
  }

  /**
   * Confirma la transacción en Webpay Plus
   */
  public async verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResponse> {
    logger.info('WebpayProvider.verifyPayment: Verificando transaccion', { providerPaymentId });

    try {
      const response = await confirmWebpayTransaction(providerPaymentId);

      return {
        success: response.success,
        providerStatus: response.status || 'UNKNOWN',
        amount: response.amount,
        providerPaymentId,
        rawResponse: response as unknown as Record<string, unknown>
      };
    } catch (error) {
      logger.error('WebpayProvider.verifyPayment: Error al verificar transaccion', { providerPaymentId, error });
      throw error;
    }
  }

  /**
   * Valida un webhook/notificación (Para Webpay Plus tradicional esto se maneja vía redirección)
   */
  public async validateWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string>
  ): Promise<WebhookValidationResult> {
    logger.info('WebpayProvider.validateWebhook: Procesando notificacion/callback', { payload });

    const token = String(payload.token_ws || payload.token || '');
    if (!token) {
      return {
        isValid: false,
        providerPaymentId: '',
        orderId: '',
        status: 'failed',
        rawEvent: payload
      };
    }

    try {
      // En Webpay, la forma de validar la autenticidad del retorno/webhook es consultando el estado al commit de la API
      const statusResponse = await getTransactionStatus(token);
      const isApproved = statusResponse.success;
      
      const paymentStatus: PaymentStatus = isApproved ? 'paid' : 'failed';

      return {
        isValid: true,
        providerPaymentId: token,
        orderId: statusResponse.sessionId || '', // sessionId corresponde al orderId interno de Palermo
        status: paymentStatus,
        rawEvent: statusResponse as unknown as Record<string, unknown>
      };
    } catch (error) {
      logger.error('WebpayProvider.validateWebhook: Error al consultar estado de transaccion', { token, error });
      return {
        isValid: false,
        providerPaymentId: token,
        orderId: '',
        status: 'failed',
        rawEvent: { error: String(error) }
      };
    }
  }
}
