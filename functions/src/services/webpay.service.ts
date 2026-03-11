// Servicio de Webpay Plus usando el SDK oficial de Transbank
import {WebpayPlus} from "transbank-sdk";
import {Options, IntegrationApiKeys, IntegrationCommerceCodes, Environment} from "transbank-sdk";

// Configuración de Webpay según el ambiente
const getWebpayConfig = () => {
  // Por ahora usamos siempre el ambiente de integración (pruebas)
  // Cuando migres a producción, aquí usarías las credenciales reales
  // desde Firebase Config o variables de entorno
  
  return new Options(
    IntegrationCommerceCodes.WEBPAY_PLUS,
    IntegrationApiKeys.WEBPAY,
    Environment.Integration
  );
};

/**
 * Función auxiliar para retry con exponential backoff
 * @param fn - Función asíncrona a ejecutar
 * @param maxRetries - Número máximo de reintentos (default: 3)
 * @param baseDelay - Delay base en ms (default: 1000)
 * @returns Resultado de la función o lanza el último error
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        console.error(`Failed after ${maxRetries} retries:`, lastError);
        throw lastError;
      }

      // Calcular delay exponencial: 1s, 2s, 4s
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, lastError.message);
      
      // Esperar antes del próximo intento
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Iniciar una transacción con Webpay Plus
 * @param buyOrder - Número único de orden (ej: orderNumber del pedido)
 * @param sessionId - ID de sesión (ej: userId o orderId)
 * @param amount - Monto de la transacción en pesos chilenos
 * @param returnUrl - URL a la que Webpay redirigirá después del pago
 * @returns Objeto con token y url para redirección
 */
export const createWebpayTransaction = async (
  buyOrder: string,
  sessionId: string,
  amount: number,
  returnUrl: string
): Promise<{token: string; url: string}> => {
  try {
    const tx = new WebpayPlus.Transaction(getWebpayConfig());

    const response = await tx.create(
      buyOrder,
      sessionId,
      amount,
      returnUrl
    );

    return {
      token: response.token,
      url: response.url,
    };
  } catch (error) {
    console.error("Error creating Webpay transaction:", error);
    throw new Error("Error al crear transacción con Webpay");
  }
};

/**
 * Confirmar una transacción de Webpay Plus con retry automático
 * @param token - Token recibido en el callback de Webpay
 * @param maxRetries - Número máximo de reintentos (default: 3)
 * @returns Información de la transacción confirmada
 */
export const confirmWebpayTransaction = async (
  token: string,
  maxRetries = 3
) => {
  return retryWithBackoff(async () => {
    try {
      const tx = new WebpayPlus.Transaction(getWebpayConfig());
      const response = await tx.commit(token);

      return {
        success: response.response_code === 0, // 0 = transacción aprobada
        vci: response.vci,
        amount: response.amount,
        status: response.status,
        buyOrder: response.buy_order,
        sessionId: response.session_id,
        cardDetail: response.card_detail,
        accountingDate: response.accounting_date,
        transactionDate: response.transaction_date,
        authorizationCode: response.authorization_code,
        paymentTypeCode: response.payment_type_code,
        responseCode: response.response_code,
        installmentsAmount: response.installments_amount,
        installmentsNumber: response.installments_number,
      };
    } catch (error) {
      console.error("Error confirming Webpay transaction:", error);
      throw new Error("Error al confirmar transacción con Webpay");
    }
  }, maxRetries);
};

/**
 * Obtener el estado de una transacción
 * @param token - Token de la transacción
 * @returns Estado de la transacción
 */
export const getTransactionStatus = async (token: string) => {
  try {
    const tx = new WebpayPlus.Transaction(getWebpayConfig());
    const response = await tx.status(token);

    return {
      success: response.response_code === 0,
      vci: response.vci,
      amount: response.amount,
      status: response.status,
      buyOrder: response.buy_order,
      sessionId: response.session_id,
      cardDetail: response.card_detail,
      accountingDate: response.accounting_date,
      transactionDate: response.transaction_date,
      authorizationCode: response.authorization_code,
      paymentTypeCode: response.payment_type_code,
      responseCode: response.response_code,
    };
  } catch (error) {
    console.error("Error getting transaction status:", error);
    throw new Error("Error al obtener estado de transacción");
  }
};

/**
 * Reembolsar una transacción Webpay Plus (reversal o refund)
 * @param token - Token de la transacción
 * @param buyOrder - Número de orden
 * @param amount - Monto a reembolsar
 * @returns Resultado del reembolso
 */
export const refundWebpayTransaction = async (
  token: string,
  buyOrder: string,
  amount: number
) => {
  // 🔧 DETECTAR TOKENS DE PRUEBA (simulados o de desarrollo de Transbank)
  // Tokens simulados empiezan con 'test_'
  // Tokens de ambiente de integración de Transbank empiezan con '01ab'
  const isTestToken = token.startsWith('test_') || token.startsWith('01ab');
  
  if (isTestToken) {
    console.log('⚠️  TOKEN DE PRUEBA DETECTADO: Simulando reembolso exitoso');
    console.log('   Token:', token);
    console.log('   Amount:', amount);
    console.log('   Razón: Este es un token de prueba/desarrollo, no se conectará a Transbank real');
    
    // Simular respuesta exitosa de Transbank
    const simulatedResponse = {
      type: 0, // nullify_amount (anulación total)
      authorization_code: Math.floor(1000 + Math.random() * 9000).toString(),
      authorization_date: new Date().toISOString(),
      nullified_amount: amount,
      balance: 0,
      response_code: 0
    };
    
    return {
      refundType: "refund_simulated",
      response: simulatedResponse,
    };
  }
  
  // 🏦 MODO PRODUCCIÓN: Llamada real a Transbank
  try {
    const tx = new WebpayPlus.Transaction(getWebpayConfig());
    // Obtener estado actual
    const status = await tx.status(token);
    // Solo se permite refund en transbank-sdk
    if (status.status === "AUTHORIZED" && status.response_code === 0) {
      const response = await tx.refund(token, amount);
      return {
        refundType: "refund",
        response,
      };
    } else {
      throw new Error("No se puede reembolsar: estado de transacción inválido");
    }
  } catch (error) {
    // Si el error es por tiempo excedido (7 días), dar mensaje más claro
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('422') || errorMsg.includes('7 day')) {
      throw new Error(
        'La transacción tiene más de 7 días. Transbank solo permite reembolsos dentro de 7 días desde el pago.'
      );
    }
    throw error;
  }
};
