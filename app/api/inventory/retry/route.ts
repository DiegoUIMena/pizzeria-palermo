import { NextRequest, NextResponse } from 'next/server';
import { retryInventoryTransaction } from '@/lib/inventory-service';

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación (simplificado - normalmente usarías next-auth)
    // Esto debería implementarse adecuadamente según el sistema de autenticación
    
    // Obtener ID de la transacción del cuerpo de la solicitud
    const body = await req.json();
    const { transactionId } = body;
    
    if (!transactionId) {
      return NextResponse.json(
        { error: 'ID de transacción requerido' },
        { status: 400 }
      );
    }

    // Reintentar la transacción de inventario
    const result = await retryInventoryTransaction(transactionId);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Transacción reintentada con éxito',
        data: result.data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        message: 'Error al reintentar la transacción'
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error en API de reintento de inventario:', error);
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        message: error.message 
      },
      { status: 500 }
    );
  }
}