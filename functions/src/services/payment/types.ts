import { PaymentProviderType, PaymentStatus } from '../../types/orders';

export interface PaymentResponse {
  success: boolean;
  providerPaymentId: string;
  redirectUrl: string;
  paymentReference: string;
  rawResponse: Record<string, unknown>;
}

export interface VerifyPaymentResponse {
  success: boolean;
  providerStatus: string;
  amount: number;
  providerPaymentId: string;
  rawResponse: Record<string, unknown>;
}

export interface WebhookValidationResult {
  isValid: boolean;
  providerPaymentId: string;
  orderId: string;
  status: PaymentStatus;
  rawEvent: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly type: PaymentProviderType;
  
  createPayment(
    orderId: string, 
    amount: number, 
    returnUrl: string, 
    paymentReference: string
  ): Promise<PaymentResponse>;
  
  verifyPayment(providerPaymentId: string): Promise<VerifyPaymentResponse>;
  
  validateWebhook(
    payload: Record<string, unknown>, 
    headers: Record<string, string>
  ): Promise<WebhookValidationResult>;
}
