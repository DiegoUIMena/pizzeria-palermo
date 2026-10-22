/**
 * Servicio de integración oficial con Mercado Pago Point Smart 2 para Chile.
 * Documentación oficial: https://www.mercadopago.cl/developers/es/docs/point
 */

export interface PaymentIntentRequest {
  amount: number;
  description: string;
  externalReference: string;
}

export interface PaymentIntentResponse {
  id: string;
  deviceId: string;
  amount: number;
  description: string;
  state: 'OPEN' | 'FINISHED' | 'CANCELED' | 'ERROR';
  paymentId?: string;
  errorMessage?: string;
}

class MercadoPagoPointService {
  private accessToken: string | undefined;
  private deviceId: string | undefined;
  private isConfigured: boolean = false;

  constructor() {
    // Cargar credenciales desde variables de entorno del cliente en Next.js
    this.accessToken = process.env.NEXT_PUBLIC_MERCADO_PAGO_ACCESS_TOKEN;
    this.deviceId = process.env.NEXT_PUBLIC_MERCADO_PAGO_DEVICE_ID;
    
    if (this.accessToken && this.deviceId) {
      this.isConfigured = true;
      console.log('✅ Mercado Pago Point Smart 2 configurado correctamente para producción.');
    } else {
      console.warn('⚠️ Mercado Pago Point no está completamente configurado (Falta NEXT_PUBLIC_MERCADO_PAGO_ACCESS_TOKEN o NEXT_PUBLIC_MERCADO_PAGO_DEVICE_ID). Operando en modo SIMULACIÓN/QA.');
    }
  }

  /**
   * Indica si el servicio está configurado con credenciales reales.
   */
  public isRealIntegrationEnabled(): boolean {
    return this.isConfigured;
  }

  /**
   * Crea una intención de pago en el terminal físico Point Smart 2.
   * POST /point/integration-api/devices/{device_id}/payment-intents
   */
  public async createPaymentIntent(request: PaymentIntentRequest): Promise<{ id: string; success: boolean; error?: string }> {
    if (!this.isConfigured) {
      // Modo QA: Retornar ID simulado
      console.log(`[Mercado Pago Point MOCK] Creando intención de pago por $${request.amount} con referencia ${request.externalReference}`);
      return {
        id: `mock_intent_${Date.now()}`,
        success: true
      };
    }

    try {
      const url = `https://api.mercadopago.com/point/integration-api/devices/${this.deviceId}/payment-intents`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(request.amount),
          description: request.description,
          payment: {
            installments: 1,
            type: 'credit_card' // Cobro directo con tarjeta de débito o crédito
          },
          additional_info: {
            external_reference: request.externalReference
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error HTTP ${response.status} en la API de Mercado Pago`);
      }

      const data = await response.json();
      return {
        id: data.id,
        success: true
      };
    } catch (error: any) {
      console.error('❌ Error al crear intención de pago en Mercado Pago Point:', error);
      return {
        id: '',
        success: false,
        error: error.message || 'Error de conexión con la API de Mercado Pago'
      };
    }
  }

  /**
   * Consulta el estado de una intención de pago específica.
   * GET /point/integration-api/payment-intents/{payment_intent_id}
   */
  public async getPaymentIntentStatus(paymentIntentId: string): Promise<PaymentIntentResponse> {
    if (!this.isConfigured || paymentIntentId.startsWith('mock_intent_')) {
      // Retornará OPEN por defecto para que la UI de simulación decida el resultado interactivo
      return {
        id: paymentIntentId,
        deviceId: 'MOCK_DEVICE_ID',
        amount: 0,
        description: 'Mock Point Intent',
        state: 'OPEN'
      };
    }

    try {
      const url = `https://api.mercadopago.com/point/integration-api/payment-intents/${paymentIntentId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status} al consultar la intención de pago`);
      }

      const data = await response.json();
      
      // Mapeo oficial de estados de Mercado Pago Point:
      // - OPEN: Esperando pago del cliente
      // - FINISHED: Transacción exitosa
      // - CANCELED: Cancelada
      // - ERROR: Error en procesamiento/rechazado
      let state: 'OPEN' | 'FINISHED' | 'CANCELED' | 'ERROR' = 'OPEN';
      if (data.state === 'FINISHED') state = 'FINISHED';
      else if (data.state === 'CANCELED') state = 'CANCELED';
      else if (data.state === 'ERROR') state = 'ERROR';

      return {
        id: data.id,
        deviceId: data.device_id,
        amount: data.amount,
        description: data.description,
        state,
        paymentId: data.payment_created_id ? String(data.payment_created_id) : undefined
      };
    } catch (error: any) {
      console.error(`❌ Error al obtener estado de intención ${paymentIntentId}:`, error);
      return {
        id: paymentIntentId,
        deviceId: this.deviceId || '',
        amount: 0,
        description: '',
        state: 'ERROR',
        errorMessage: error.message || 'Error al obtener estado'
      };
    }
  }

  /**
   * Cancela una intención de pago activa en el dispositivo.
   * DELETE /point/integration-api/devices/{device_id}/payment-intents/{payment_intent_id}
   */
  public async cancelPaymentIntent(paymentIntentId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured || paymentIntentId.startsWith('mock_intent_')) {
      console.log(`[Mercado Pago Point MOCK] Cancelando intención de pago ${paymentIntentId}`);
      return { success: true };
    }

    try {
      const url = `https://api.mercadopago.com/point/integration-api/devices/${this.deviceId}/payment-intents/${paymentIntentId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Error HTTP ${response.status} al cancelar`);
      }

      return { success: true };
    } catch (error: any) {
      console.error(`❌ Error al cancelar intención ${paymentIntentId}:`, error);
      return {
        success: false,
        error: error.message || 'Error de conexión al cancelar'
      };
    }
  }
}

export const mercadoPagoPointService = new MercadoPagoPointService();
