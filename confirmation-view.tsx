// Crear una modificación de la vista de confirmación para reemplazar la existente

// Vista de confirmación
if (currentView === "confirmation") {
  return (
    <div className="h-full flex flex-col bg-white p-6 text-center">
      <div className="flex-1 flex flex-col justify-center">
        {/* Icono de confirmación más grande y llamativo */}
        <div className="flex justify-center mb-8 animate-bounce">
          <div className="bg-green-100 p-6 rounded-full shadow-lg">
            <CheckCircle className="h-20 w-20 text-green-600" strokeWidth={1.5} />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6">¡Pedido Confirmado!</h2>
        
        {/* Número de pedido más prominente */}
        <div className="bg-pink-50 py-8 px-6 rounded-lg border-2 border-pink-300 mb-8 shadow-md">
          <h3 className="text-sm uppercase tracking-wider font-medium text-gray-600 mb-3">Número de Pedido</h3>
          <div className="text-6xl font-extrabold text-pink-600 mb-3">#{orderNumber}</div>
          <p className="text-sm text-gray-600">Guarda este número para seguir tu pedido</p>
        </div>
        
        {/* Nueva sección con instrucciones para seguimiento */}
        <div className="bg-blue-50 p-5 rounded-lg border border-blue-200 mb-6">
          <h3 className="font-medium text-gray-800 mb-2">Seguimiento de Pedido</h3>
          <p className="text-gray-700 mb-2">
            Sigue el estado de tu pedido en la sección de 
            <Link href="/pedidos" className="font-bold text-blue-600 hover:underline ml-1">
              "Mis Pedidos"
            </Link>
          </p>
          <p className="text-xs text-gray-500">Podrás ver el progreso en tiempo real y recibir notificaciones.</p>
        </div>
        
        <p className="text-gray-600 mb-4">Tu pedido ha sido recibido y está siendo preparado.</p>
        
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
          <h3 className="font-medium text-gray-800 mb-2">Tiempo Estimado</h3>
          <p className="text-xl font-bold text-pink-600">{estimatedTime}</p>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
          <h3 className="font-medium text-gray-800 mb-2">Total Pagado</h3>
          <p className="text-xl font-bold text-blue-600">${totalFinal.toLocaleString()}</p>
        </div>
        
        {isDelivery && deliveryInfo.zone && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Información de Delivery</h3>
            <p className="text-sm text-gray-600">Zona: {deliveryInfo.zone.nombre}</p>
            <p className="text-sm text-gray-600">Costo: ${deliveryInfo.tarifa.toLocaleString()}</p>
          </div>
        )}
        
        <Button 
          onClick={() => {
            clearCart();
            setAppliedDiscount(null);
            setDiscountCode("");
            setExpandedItems({});
            setCurrentView("cart");
          }}
          className="mt-4 bg-pink-600 hover:bg-pink-700 text-white"
        >
          Volver al Carrito
        </Button>
        
        <p className="text-xs text-gray-500 mt-4">El carrito se limpiará automáticamente en 10 segundos...</p>
      </div>
    </div>
  )
}
