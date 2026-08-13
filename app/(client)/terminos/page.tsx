import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Términos y Condiciones | Palermo Pizzas",
  description:
    "Consulte los términos y condiciones que regulan el uso del sitio web, la realización de pedidos y los servicios ofrecidos por Palermo Pizzas.",
}

export default function TerminosPage() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-transparent antialiased text-gray-800 dark:text-gray-200">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Contenedor del Documento Legal */}
        <article className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 sm:p-10 md:p-12 text-gray-700 dark:text-gray-300">
          
          {/* Título Principal */}
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase mb-4 text-center">
            Términos y Condiciones
          </h1>

          {/* Subtítulo Institucional */}
          <p className="text-gray-500 dark:text-gray-400 text-center mx-auto max-w-2xl text-sm sm:text-base leading-relaxed mb-8">
            Lea atentamente las condiciones que regulan el uso del sitio web, los pedidos realizados a través de nuestra plataforma y los servicios ofrecidos por Palermo Pizzas.
          </p>

          {/* Fecha de vigencia y procedencia */}
          <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-8 text-xs sm:text-sm text-gray-400 dark:text-gray-500 flex justify-between items-center">
            <span>Última actualización: 5 de agosto de 2026</span>
            <span>Documento Oficial</span>
          </div>

          <div className="space-y-6 text-sm sm:text-base leading-relaxed text-justify">
            
            <p>
              A través de su ingreso a la página web (sitio web), usted acepta y está de acuerdo con los presentes “Términos y Condiciones”. Estos términos y condiciones de uso podrán variar en cualquier momento, a discreción de <strong>Elaboradora de alimentos Francisco Soto Hevia E.I.R.L. Rut 77.621.812-k</strong>, en adelante <strong>“Palermo Pizzas”</strong>, actualizándose dichos cambios periódicamente en la presente página.
            </p>

            <p>
              Asimismo, usted podrá optar por registrarse en el sistema y aceptar así los términos y condiciones de inscripción. Para inscribirse, deberá proporcionar datos personales, específicamente nombre y correo electrónico válido (“datos del cliente”), los que serán almacenados guardando estricta confidencialidad y reserva de los mismos, mediante la restricción de su acceso sólo a personas autorizadas, quienes, a su vez, guardarán estricta confidencialidad y reserva de los mismos, no pudiendo utilizarlos para otros fines que los aquí establecidos. Al registrarte, usted acepta y nos autoriza expresamente a utilizar dicha información para fines estadísticos que se analizarán de forma agregada y para compartirla con nuestros colaboradores a objeto de proporcionarle publicidad de nuestros productos mediante correo electrónico especialmente enviados con dicho propósito, que podamos considerar de su interés. Dicha información será almacenada por el plazo que usted mantenga vigente la suscripción, la cual podrá cancelar en cualquier momento mediante el link denominado “cancelación” que se incorpora a cada correo electrónico enviado o mediante solicitud en dicho sentido mediante nuestro canal de servicio al cliente. Usted puede revocar la autorización otorgada, solicitar la eliminación de sus datos personales o la modificación de los mismos en cualquier tiempo, en este último caso enviando documentación que fundamente la solicitud de modificación, mediante nuestro canal de servicio al cliente. Se deja expresa constancia que nos reservamos el derecho a bloquear sus datos en caso que su contenido y/o vigencia sea dudoso.
            </p>

            {/* Cargos adicionales */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Cargos adicionales
              </h2>
              <p className="mb-3">
                Palermo Pizzas garantiza la entrega de los productos de acuerdo a la descripción de nuestro menú y en lo realizado por medio de nuestros canales de venta telefónica, presencial y/o por medio de nuestro sitio web <Link href="/" className="text-pink-600 dark:text-pink-400 hover:underline font-medium">www.palermopizzas.cl</Link>.
              </p>
              <p>
                <strong>Propina:</strong> Es parte de nuestra política. La propina es voluntaria y su pago queda sujeto exclusivamente a la decisión del cliente, conforme a la legislación vigente. No aplicamos ningún porcentaje de servicio en la facturación.
              </p>
            </section>

            {/* Zona de reparto */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Zona de reparto
              </h2>
              <p>
                Para garantizar la calidad de nuestro producto y la entrega rápida de su pedido, hemos delimitado nuestra zona de reparto. Si no está seguro si cubrimos el barrio donde vive, puede ingresar su dirección en la sección delivery (“dirección de entrega”) dentro del carrito de compras y el sistema le indicara si llegamos hasta la zona que necesita y la tarifa del reparto.
              </p>
            </section>

            {/* Dirección de entrega */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Dirección de entrega
              </h2>
              <p className="mb-3">
                Es responsabilidad del cliente proporcionar una dirección de entrega correcta, completa y con referencias suficientes para facilitar el despacho del pedido. En caso de que la dirección ingresada sea incorrecta, incompleta o dificulte la entrega, Palermo Pizzas podrá contactar al cliente para solicitar información adicional. Los retrasos o inconvenientes derivados de datos erróneos proporcionados por el cliente serán de su exclusiva responsabilidad.
              </p>
              <p>
                Si no fuese posible concretar la entrega por causas atribuibles al cliente, Palermo Pizzas podrá cancelar el despacho y coordinar una nueva entrega, la cual podrá estar sujeta al cobro de un nuevo servicio de delivery, según corresponda.
              </p>
            </section>

            {/* Mínimo de compra */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Mínimo de compra
              </h2>
              <p>
                No existe mínimo de compra requerido para el servicio Delivery. Nuestros precios incluyen impuesto.
              </p>
            </section>

            {/* Cargo por servicio de delivery */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Cargo por servicio de delivery
              </h2>
              <p>
                El servicio de delivery tiene un costo adicional al valor de los productos solicitados. El monto correspondiente al despacho se informa durante el proceso de compra, en el carrito, dentro de la sección <strong>"Dirección de entrega"</strong>, y se calcula de acuerdo con la ubicación del domicilio. Este cargo se suma al valor total de la compra antes de finalizar el pedido.
              </p>
            </section>

            {/* Tiempo de entrega */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Tiempo de entrega
              </h2>
              <p className="mb-3">
                Nos esforzamos por reducir al máximo los tiempos de entrega para que su pedido llegue en el menor tiempo posible. Sin embargo, estos pueden variar según distintos factores, como las condiciones climáticas, la demanda del momento o la cantidad de productos solicitados.
              </p>
              <p className="mb-3">
                Para conocer el tiempo estimado y el estado actualizado de su pedido, puede ingresar a <strong>"Mis compras"</strong>, seleccionar el pedido activo y revisar la sección <strong>"Seguimiento del pedido"</strong>.
              </p>
              <p>
                Además, el chatbot del sistema mantiene actualizado el estado de su pedido y le notificará cuando éste se encuentre listo para despacho o haya sido entregado al servicio de delivery.
              </p>
            </section>

            {/* Suspensión del servicio Delivery */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Suspensión del servicio Delivery
              </h2>
              <p>
                El servicio de Delivery puede suspenderse temporalmente por acontecimientos o circunstancias inesperadas de diversa índole o por condiciones climáticas. Nos reservamos el derecho de no realizar despachos a domicilio cuando a juicio de Palermo Pizzas las circunstancias imperantes causen impedimento del mismo, se encuentre en riesgo la seguridad de los repartidores, imposibilidad técnica de despacho en razón de imprevistos, relación horario-zona de reparto, u otros. Sin embargo, siempre será una opción que el cliente pueda recoger su pedido en local dentro del horario de funcionamiento del mismo.
              </p>
            </section>

            {/* Medios de pago */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Medios de pago
              </h2>
              <p className="mb-3">
                Los pedidos pueden ser pagados mediante efectivo, tarjetas de débito, tarjetas de crédito o transferencia bancaria, según la modalidad de compra seleccionada.
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-3 text-gray-650 dark:text-gray-350">
                <li><strong>Retiro en el local:</strong> El pago puede realizarse en efectivo (moneda nacional), con tarjeta de débito, tarjeta de crédito o mediante transferencia bancaria.</li>
                <li><strong>Servicio de delivery:</strong> El pago puede efectuarse en efectivo directamente al repartidor o de forma anticipada a través de los medios de pago digitales disponibles en el sitio web.</li>
                <li><strong>Pagos digitales:</strong> Los pagos realizados a través del sitio web pueden efectuarse mediante Webpay (tarjetas de débito y crédito compatibles) o mediante Khipu, utilizando una transferencia bancaria desde la cuenta bancaria del cliente.</li>
              </ul>
              <p>
                Todos los pagos están sujetos a la disponibilidad y correcto funcionamiento de las plataformas de pago al momento de realizar la compra.
              </p>
            </section>

            {/* Nuestro menú */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Nuestro menú
              </h2>
              <p>
                Como parte de nuestro proceso de mejora e innovación, los productos ofrecidos en nuestro menú podrán variar ocasionalmente en su disponibilidad, presentación o composición. Las imágenes publicadas en el sitio web tienen un carácter referencial e ilustrativo. En consecuencia, el producto entregado podrá presentar variaciones menores en su apariencia respecto de las fotografías exhibidas, sin afectar su calidad, cantidad, ingredientes principales o composición esencial.
              </p>
            </section>

            {/* Disponibilidad de productos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Disponibilidad de productos
              </h2>
              <p>
                Palermo Pizzas procura mantener actualizada la disponibilidad de los productos e ingredientes publicados en el sitio web. No obstante, debido a la demanda, quiebres de stock, inconvenientes con proveedores u otras circunstancias operativas, algunos productos o ingredientes podrían no encontrarse disponibles al momento de preparar el pedido. En estos casos, Palermo Pizzas se comunicará con el cliente para ofrecer un producto o ingrediente de reemplazo, modificar el pedido o gestionar la devolución del monto correspondiente a los productos no disponibles, según la alternativa que el cliente elija.
              </p>
            </section>

            {/* Pedidos personalizados */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Pedidos personalizados
              </h2>
              <p>
                Los productos configurados o personalizados por el cliente, tales como la selección o eliminación de ingredientes, pizzas mitad y mitad (Pizza Duo) u otras opciones de personalización disponibles en el sitio web, serán preparados conforme a la configuración seleccionada durante el proceso de compra. Es responsabilidad del cliente revisar cuidadosamente la configuración de su pedido antes de confirmar la compra. Lo anterior no limita el derecho del cliente a reclamar cuando el producto entregado no corresponda a la configuración efectivamente solicitada.
              </p>
            </section>

            {/* Promociones */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Promociones
              </h2>
              <p className="mb-3">
                Todas nuestras promociones son por tiempo limitado y pueden ser removidas de nuestro sitio sin previo aviso.
              </p>
              <p>
                Salvo que se indique expresamente lo contrario, las promociones, descuentos, cupones y códigos promocionales no son acumulables entre sí.
              </p>
            </section>

            {/* Códigos promocionales o de canje */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Códigos promocionales o de canje
              </h2>
              <p className="mb-3">
                Algunas promociones tendrán un código promocional, el cual deberá ser ingresado para poder ser agregado al carrito de compras, y hacer efectiva la promoción. Es probable que se presente algún error al ingresar el código; en caso de que eso suceda, usted debe comunicarse al correo <a href="mailto:contacto@palermopizzas.cl" className="text-pink-600 dark:text-pink-400 hover:underline">contacto@palermopizzas.cl</a> o en nuestras redes sociales (Palermo Pizzas en Facebook, palermopizzas.cl en Instagram). Responderemos a su solicitud dentro de 14 horas hábiles, contabilizadas de 10:00 am a 00:00 am.
              </p>
              <p>
                Cada código promocional podrá estar sujeto a condiciones particulares de uso, tales como vigencia, monto mínimo de compra, cantidad máxima de usos, productos participantes u otras restricciones, las cuales serán informadas al momento de su publicación.
              </p>
            </section>

            {/* Programa Palermo Puntos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Programa Palermo Puntos
              </h2>
              <p className="mb-3">
                Palermo Puntos es el programa de fidelización de Palermo Pizzas, diseñado para premiar la preferencia de nuestros clientes.
              </p>
              <p className="mb-3">
                El programa permite acumular puntos por las compras realizadas exclusivamente a través del sitio web <Link href="/" className="text-pink-600 dark:text-pink-400 hover:underline">www.palermopizzas.cl</Link>, independientemente del medio de pago utilizado. Los puntos acumulados podrán ser canjeados por los productos disponibles en el catálogo de Palermo Puntos.
              </p>
              <p className="mb-3">
                Se otorgará 1 Palermo Punto por cada $1.000 CLP del valor de la compra, sin límite de acumulación. Los puntos tendrán una vigencia de 3 meses contados desde la fecha en que fueron obtenidos.
              </p>
              <p className="mb-3">
                Los Palermo Puntos se acumularán únicamente respecto de compras que hayan sido pagadas y completadas satisfactoriamente. En caso de que un pedido sea cancelado, anulado, rechazado o reembolsado total o parcialmente, Palermo Pizzas podrá no acreditar o descontar los puntos correspondientes a dicha compra.
              </p>
              <p className="mb-3">
                Podrán participar en el programa todos los usuarios mayores de edad que se encuentren registrados en el sitio web de Palermo Pizzas.
              </p>
              <p className="mb-3">
                Los Palermo Puntos son personales e intransferibles, no tienen valor comercial, no pueden ser vendidos, cedidos, transferidos a otras cuentas, canjeados por dinero en efectivo ni utilizados fuera de las condiciones establecidas para el programa. Asimismo, los puntos solo podrán ser utilizados por el titular de la cuenta en la que fueron acumulados.
              </p>
              <p className="mb-3">
                Para utilizar los Palermo Puntos, el cliente deberá ingresar a su cuenta en <Link href="/" className="text-pink-600 dark:text-pink-400 hover:underline">www.palermopizzas.cl</Link>, acceder a la sección "Palermo Puntos", activar su cuenta de Palermo puntos por medio del ingreso de su número de Rut válido, una vez activada la cuenta, podrá revisar el catálogo de productos disponibles y la cantidad de puntos requerida para cada uno. Una vez seleccionado el producto, deberá presionar el botón "Canjear producto". El canje solo podrá efectuarse respecto de los productos disponibles en el catálogo publicado en el sitio web.
              </p>
              <p className="mb-3">
                Los productos obtenidos mediante canje de Palermo Puntos no generan una nueva acumulación de puntos.
              </p>
              <p className="mb-3">
                En caso de que el cliente solicite un producto canjeado mediante Palermo Puntos con servicio de delivery, deberá pagar el costo correspondiente al despacho. El servicio de delivery no forma parte del canje y su valor será calculado de acuerdo con la zona de entrega seleccionada, informándose durante el proceso de compra antes de la confirmación del pedido.
              </p>
              <p className="mb-3">
                Las condiciones de funcionamiento del programa Palermo Puntos, incluyendo la acumulación, vigencia, canje, utilización y demás aspectos relacionados con el programa, se encuentran disponibles para su consulta en la sección "Preguntas Frecuentes" ubicada al final del sitio web.
              </p>
              <p className="mb-3">
                Palermo Pizzas se reserva el derecho de modificar, suspender o finalizar el programa Palermo Puntos, así como de actualizar sus condiciones de funcionamiento, procurando informar dichos cambios a través de su sitio web con una antelación razonable cuando corresponda.
              </p>
              <p className="mb-3">
                Al participar en el programa, el cliente declara conocer y aceptar las condiciones publicadas. En caso de detectarse un uso fraudulento, indebido o contrario a estos Términos y Condiciones, Palermo Pizzas podrá suspender o anular los puntos acumulados y/o cancelar la participación del cliente en el programa, sin perjuicio de las demás acciones que pudieran corresponder.
              </p>
              <p>
                Los Palermo Puntos se eliminarán automáticamente una vez vencido su período de vigencia o cuando la cuenta del cliente sea eliminada o suspendida, sin que ello genere derecho a compensación alguna.
              </p>
            </section>

            {/* Precios publicados */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Precios publicados
              </h2>
              <p>
                Palermo Pizzas procura mantener permanentemente actualizados los precios publicados en el sitio web. En caso de producirse un error involuntario de publicación debido a fallas técnicas, errores de digitación u otras circunstancias similares, Palermo Pizzas respetará el precio informado al cliente al momento de confirmar su compra. Sin perjuicio de lo anterior, Palermo Pizzas podrá informar al cliente sobre el error detectado con el fin de mantener la transparencia respecto del incidente y adoptar las medidas necesarias para corregirlo y evitar su repetición.
              </p>
            </section>

            {/* Anulación de pedido y Retracto */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Anulación de pedido y Retracto
              </h2>
              <p>
                Dada la naturaleza del negocio el cliente podrá anular y/o retractarse de la compra, vía telefónica, durante el proceso de realización del pedido. Una vez que el pedido en línea se ha realizado y confirmado, se podrá anular parcial o en su totalidad el mismo, cuando haya transcurrido un lapso de tiempo no mayor a cinco minutos. Para poder anular el pedido el cliente deberá llamar directamente al local durante el proceso del pedido y se iniciará el proceso de anulación. Si el cliente incumpliese con el tiempo mínimo establecido para la anulación de un pedido, éste deberá honrar y asumir el monto indicado durante el proceso de compra. En los casos en que el cliente no acepta y cumple el compromiso de pago adquirido, Palermo pizzas se reserva el derecho de no admitir pedidos futuros de éste. La reincidencia de anulaciones fuera de tiempo mínimo establecido puede inclusive conllevar a la cancelación de la cuenta en el sitio web.
              </p>
            </section>

            {/* Servicio de post venta */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Servicio de post venta
              </h2>
              <p>
                Todos los temas relacionados con post venta son tratados por medio de nuestro servicio al cliente mediante los canales de comunicación formales correo electrónico <a href="mailto:contacto@palermopizzas.cl" className="text-pink-600 dark:text-pink-400 hover:underline">contacto@palermopizzas.cl</a> o escribiendo al WhatsApp <a href="https://wa.me/56971995481" target="_blank" rel="noopener noreferrer" className="text-pink-600 dark:text-pink-400 hover:underline">+56 9 7199 5481</a>.
              </p>
            </section>

            {/* Devolución de dinero */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Devolución de dinero
              </h2>
              <p>
                En caso que el cliente solicite la devolución de dinero por problemas de dobles cobros de transbank, productos incorrectos u otros casos gestionados por servicio al cliente, se deberán contactar por correo electrónico a <a href="mailto:contacto@palermopizzas.cl" className="text-pink-600 dark:text-pink-400 hover:underline">contacto@palermopizzas.cl</a> o escribiendo al WhatsApp <a href="https://wa.me/56971995481" target="_blank" rel="noopener noreferrer" className="text-pink-600 dark:text-pink-400 hover:underline">+56 9 7199 5481</a>.
              </p>
            </section>

            {/* Pedidos y/o datos falsos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Pedidos y/o datos falsos
              </h2>
              <p>
                Palermo Pizzas se reserva el derecho de no atender o no continuar atendiendo a clientes que brinden datos personales o realicen pedidos falsos, toda vez que éstos ocasionan daño o perjuicio a la empresa. Palermo Pizzas podrá eliminar una cuenta de usuario en cualquier momento y sin previo aviso una vez que se ha comprobado que se han entregado datos falsos o se ha realizado un pedido falso, lo que de todas formas será informado al cliente con posterioridad a la eliminación mediante envío de correo electrónico.
              </p>
            </section>

            {/* Pedidos en línea */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Pedidos en línea
              </h2>
              <p>
                El servicio de Delivery estará disponible únicamente para personas residentes en el área de cobertura; sin embargo, si usted está fuera de nuestra área de reparto, podrá realizar su pedido en la categoría “Retirar”, y recoger su pedido en mostrador del local.
              </p>
            </section>

            {/* Derechos de autor */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Derechos de autor
              </h2>
              <p className="mb-3">
                Todo el contenido incluido en este sitio tales como texto, gráficos o códigos es propiedad intelectual, de Palermo Pizzas. Todos los derechos reservados.
              </p>
              <p>
                Usted se compromete a no modificar o eliminar cualquier aviso de propiedad de los materiales descargados o accedidos desde este sitio.
              </p>
            </section>

            {/* Uso apropiado */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Uso apropiado
              </h2>
              <p className="mb-3">
                El usuario garantiza que no utilizará este sitio para cualquier propósito que sea ilegal o prohibido por estos términos y condiciones, o por cualquier otra normativa pública vigente.
              </p>
              <p>
                Usted no puede usar esta página web en cualquier forma que pudiera dañar, inutilizar, sobrecargar o deteriorar la misma o interferir con el uso y provecho de la misma. Usted no puede obtener o intentar obtener cualquier material o información mediante cualquier medio que no sea intencionalmente puesto a disposición o suministrado a través de este sitio web.
              </p>
            </section>

            {/* Reserva del servicio */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Reserva del servicio
              </h2>
              <p>
                Palermo Pizzas se reserva el derecho a permitir o restringir el uso de la presente página web y sus distintas opciones a cualquier persona, natural o jurídica, de acuerdo a sus políticas internas y determinaciones propias, excluyéndose de dichas políticas el irrestricto apego a lo estipulado en la ley N° 20.609. Ninguna persona puede reclamar o solicitar el resarcimiento de daños o perjuicios porque no se le haya permitido gozar de este servicio, sea cual sea el motivo y las circunstancias. Las políticas mencionadas en el presente documento pueden variar sin previo aviso.
              </p>
            </section>

            {/* Uso de la información */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Uso de la información
              </h2>
              <p>
                El manejo de la información de los usuarios y sus compras se realizará de acuerdo a lo descrito en las Políticas de Privacidad.
              </p>
            </section>

            {/* Protección de datos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Protección de datos
              </h2>
              <p>
                Palermo Pizzas adopta medidas de seguridad razonables para proteger la información personal de sus clientes frente a accesos no autorizados, pérdida, alteración o divulgación indebida, de conformidad con la normativa chilena vigente.
              </p>
            </section>

            {/* Igualdad ante la Ley */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Igualdad ante la Ley
              </h2>
              <p>
                Todos los usuarios y clientes son tratados con igualdad, sin importar diferencia de sexo, edad, origen, raza, capacidad física o cualquier otra condición personal.
              </p>
            </section>

            {/* Condiciones de devolución */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Condiciones de devolución
              </h2>
              <p className="mb-3">
                En caso de existir algún problema o disconformidad en relación al producto entregado, el cliente deberá devolver el producto al personal de Palermo Pizzas para poder ser analizado por el personal y efectuar cualquier cambio o compensación. El producto será retirado por un repartidor o personal de Palermo Pizzas para dicho efecto al domicilio que señale el cliente o al cual fue repartido, según corresponda. En aquellos casos en que la devolución no resulte razonablemente posible, la evaluación podrá realizarse mediante fotografías u otros antecedentes que permitan verificar la situación.
              </p>
              <p>
                El canal formal para estos casos es nuestro servicio al cliente teléfono <a href="https://wa.me/56971995481" target="_blank" rel="noopener noreferrer" className="text-pink-600 dark:text-pink-400 hover:underline">+56 9 7199 5481</a> o personalmente al local.
              </p>
            </section>

            {/* Limitaciones a la responsabilidad */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Limitaciones a la responsabilidad
              </h2>
              <p>
                Palermo Pizzas no será responsable de ningún daño indirecto, consecuente o especial que pueda sufrir el usuario del sitio por el uso y contenido del sitio web, en la máxima extensión permitida por la ley.
              </p>
            </section>

            {/* Ley de protección al consumidor */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Ley de protección al consumidor
              </h2>
              <p>
                Los presentes Términos y Condiciones se interpretarán conforme a la Ley N.º 19.496 sobre Protección de los Derechos de los Consumidores y demás normativa chilena aplicable.
              </p>
            </section>

            {/* Jurisdicción aplicable */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                Jurisdicción aplicable
              </h2>
              <p>
                Los presentes Términos y Condiciones se regirán por las leyes de la República de Chile. Cualquier controversia derivada de la utilización del sitio web o de las compras realizadas a través de éste será resuelta por los tribunales competentes de la República de Chile, sin perjuicio de los derechos que la legislación vigente reconoce a los consumidores.
              </p>
            </section>

          </div>

          {/* Cierre del documento */}
          <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <p>© {new Date().getFullYear()} Palermo Pizzas. Todos los derechos reservados.</p>
            <p className="mt-1">
              Si tiene dudas sobre estas condiciones, por favor comuníquese a través de nuestro correo de soporte <a href="mailto:contacto@palermopizzas.cl" className="text-pink-600 dark:text-pink-400 hover:underline">contacto@palermopizzas.cl</a> o al WhatsApp <a href="https://wa.me/56971995481" target="_blank" rel="noopener noreferrer" className="text-pink-600 dark:text-pink-400 hover:underline">+56 9 7199 5481</a>.
            </p>
          </div>
        </article>
      </div>
    </main>
  )
}
