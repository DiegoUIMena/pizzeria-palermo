import * as logger from 'firebase-functions/logger';
import { PaymentProvider, PaymentResponse, VerifyPaymentResponse } from './types';
import { PaymentProviderType } from '../../types/orders';

export class PaymentService {
  private providers: Map<PaymentProviderType, PaymentProvider> = new Map();

  constructor(providers: PaymentProvider[]) {
    providers.forEach(provider => {
      this.providers.set(provider.type, provider);
      logger.info(`Proveedor de pagos registrado: ${provider.type}`);
    });
  }

  /**
   * Obtener un proveedor de pagos por su tipo
   */
  private getProvider(type: PaymentProviderType): PaymentProvider {
    const provider = this.providers.get(type);
    if (!provider) {
      logger.error(`Intento de usar proveedor no registrado: ${type}`);
      throw new Error(`Proveedor de pagos no registrado: ${type}`);
    }
    return provider;
  }

  /**
   * Iniciar una transacción de pago
   */
  public async initiatePayment(
    orderId: string,
    providerType: PaymentProviderType,
    amount: number,
    returnUrl: string,
    paymentReference: string
  ): Promise<PaymentResponse> {
    logger.info('initiatePayment started', { orderId, providerType, amount, paymentReference });
    
    const provider = this.getProvider(providerType);
    return await provider.createPayment(orderId, amount, returnUrl, paymentReference);
  }

  /**
   * Consultar y verificar el estado de un pago directamente con la pasarela
   */
  public async verifyPayment(
    providerPaymentId: string,
    providerType: PaymentProviderType
  ): Promise<VerifyPaymentResponse> {
    logger.info('verifyPayment started', { providerPaymentId, providerType });
    
    const provider = this.getProvider(providerType);
    return await provider.verifyPayment(providerPaymentId);
  }
}
