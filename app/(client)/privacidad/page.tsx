import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Política de Privacidad | Palermo Pizzas",
  description:
    "Consulte la política de privacidad y protección de datos personales que regula el uso del sitio web, la realización de pedidos y los servicios ofrecidos por Palermo Pizzas.",
}

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-transparent antialiased text-gray-800 dark:text-gray-200">
      <div className="max-w-4xl mx-auto flex flex-col items-center">
        {/* Contenedor del Documento Legal */}
        <article className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 sm:p-10 md:p-12 text-gray-700 dark:text-gray-300">
          
          {/* Título Principal */}
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white uppercase mb-4 text-center">
            Política de Privacidad y Protección de Datos Personales
          </h1>

          {/* Subtítulo Institucional */}
          <p className="text-gray-500 dark:text-gray-400 text-center mx-auto max-w-2xl text-sm sm:text-base leading-relaxed mb-8 font-semibold">
            Elaboradora de Alimentos Francisco Soto Hevia E.I.R.L., nombre de fantasía Palermo Pizzas.
          </p>

          {/* Fecha de vigencia y procedencia */}
          <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-8 text-xs sm:text-sm text-gray-400 dark:text-gray-500 flex justify-between items-center">
            <span>Última actualización: 5 de agosto de 2026</span>
            <span>Documento Oficial</span>
          </div>

          <div className="space-y-6 text-sm sm:text-base leading-relaxed text-justify">
            
            {/* I. Introducción */}
            <section>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                I. Introducción
              </h2>
              <p className="mb-4">
                La presente Política de Privacidad y Protección de Datos Personales tiene por finalidad informar a los usuarios del sitio web de Palermo Pizzas sobre la forma en que se recopilan, utilizan, almacenan, protegen y, cuando corresponda, comunican sus datos personales al utilizar nuestros servicios digitales.
              </p>
              <p className="mb-4">
                Palermo Pizzas reconoce la importancia de la privacidad de sus clientes y mantiene el compromiso permanente de proteger la información personal que estos proporcionan durante la utilización de nuestro sitio web, aplicaciones, plataformas tecnológicas y demás servicios asociados.
              </p>
              <p className="mb-4">
                La presente Política forma parte integrante de los Términos y Condiciones de Uso del sitio web de Palermo Pizzas y deberá interpretarse conjuntamente con dichos documentos.
              </p>
              <p className="mb-4">
                El acceso, navegación, registro y utilización del sitio web implica que el usuario declara haber leído, comprendido y aceptado íntegramente la presente Política de Privacidad.
              </p>
              <p className="mb-3">
                Palermo Pizzas tratará los datos personales conforme a la legislación vigente de la República de Chile, especialmente:
              </p>
              <ul className="list-disc pl-6 space-y-1 mb-4 text-gray-650 dark:text-gray-350">
                <li>Ley N.º 19.628 sobre Protección de la Vida Privada.</li>
                <li>Ley N.º 19.496 sobre Protección de los Derechos de los Consumidores.</li>
                <li>Demás normas legales y reglamentarias que resulten aplicables.</li>
              </ul>
              <p>
                Cuando corresponda, Palermo Pizzas podrá adaptar esta Política para cumplir nuevas obligaciones legales que entren en vigencia.
              </p>
            </section>

            {/* II. Definiciones */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                II. Definiciones
              </h2>
              <p className="mb-3">
                Para efectos de la presente Política se entenderá por:
              </p>
              
              <div className="space-y-4 pl-4 border-l-2 border-pink-500/20 dark:border-pink-500/10">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">1. Datos Personales</h3>
                  <p className="mb-2">Toda información relativa a una persona natural identificada o identificable.</p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Entre otros, podrán considerarse datos personales: nombre, apellidos, RUT, dirección, correo electrónico, número telefónico, dirección de despacho, historial de pedidos, información de la cuenta del usuario e identificadores técnicos asociados a la navegación.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">2. Datos Sensibles</h3>
                  <p className="mb-2">
                    Aquellos datos que se refieren a características físicas o morales de las personas o a hechos relacionados con su vida privada, tales como: estado de salud, creencias religiosas, orientación política, origen racial y vida sexual.
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Palermo Pizzas no solicita ni trata deliberadamente datos personales sensibles para la prestación normal de sus servicios.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">3. Titular de los datos</h3>
                  <p>Persona natural propietaria de los datos personales recopilados por Palermo Pizzas.</p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">4. Tratamiento de datos</h3>
                  <p>
                    Toda operación realizada sobre datos personales, incluyendo entre otras: recopilación, almacenamiento, organización, consulta, actualización, utilización, comunicación autorizada, eliminación, anonimización y destrucción.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">5. Responsable del tratamiento</h3>
                  <p>Palermo Pizzas será responsable del tratamiento de los datos personales recopilados mediante sus plataformas digitales.</p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">6. Usuario</h3>
                  <p>
                    Toda persona que navegue por el sitio web, cree una cuenta, realice pedidos, participe en promociones, utilice los servicios ofrecidos por Palermo Pizzas o interactúe con cualquiera de sus plataformas digitales.
                  </p>
                </div>
              </div>
            </section>

            {/* III. Responsable del Tratamiento de Datos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                III. Responsable del Tratamiento de Datos
              </h2>
              <p className="mb-3">
                Los datos personales recopilados mediante el sitio web serán administrados por Palermo Pizzas.
              </p>
              <p className="mb-3">
                Los usuarios podrán ejercer sus derechos o realizar consultas relacionadas con esta Política mediante los canales oficiales de atención publicados en el sitio web.
              </p>
              <p className="mb-3 font-semibold text-gray-900 dark:text-white">
                Correo electrónico: <a href="mailto:contacto@palermopizzas.cl" className="text-pink-600 dark:text-pink-400 hover:underline">contacto@palermopizzas.cl</a>
              </p>
              <p>
                Palermo Pizzas podrá actualizar esta información cuando resulte necesario sin que ello implique una modificación sustancial de la presente Política.
              </p>
            </section>

            {/* IV. Principios Aplicables al Tratamiento de Datos Personales */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                IV. Principios Aplicables al Tratamiento de Datos Personales
              </h2>
              <p className="mb-3">
                Palermo Pizzas desarrollará todas las actividades relacionadas con el tratamiento de datos personales respetando los siguientes principios:
              </p>
              
              <ul className="space-y-3 pl-4">
                <li>
                  <strong>a) Principio de licitud:</strong> Los datos serán tratados únicamente cuando exista una base legal que lo permita, especialmente el consentimiento del titular, la ejecución de un contrato o el cumplimiento de obligaciones legales.
                </li>
                <li>
                  <strong>b) Principio de transparencia:</strong> Los usuarios tendrán acceso a información clara respecto de: qué datos se recopilan; con qué finalidad; durante cuánto tiempo serán conservados; quiénes podrán acceder a ellos; y cómo ejercer sus derechos.
                </li>
                <li>
                  <strong>c) Principio de finalidad:</strong> Los datos personales únicamente serán utilizados para las finalidades informadas en esta Política y no serán tratados para fines incompatibles con aquellas.
                </li>
                <li>
                  <strong>d) Principio de minimización:</strong> Palermo Pizzas recopilará únicamente aquellos datos estrictamente necesarios para prestar correctamente sus servicios.
                </li>
                <li>
                  <strong>e) Principio de exactitud:</strong> Los usuarios podrán actualizar o corregir sus datos personales cuando estos sean inexactos, incompletos o hayan cambiado.
                </li>
                <li>
                  <strong>f) Principio de confidencialidad:</strong> Toda la información personal será tratada de manera confidencial. Únicamente tendrán acceso aquellas personas cuya intervención resulte necesaria para prestar correctamente los servicios ofrecidos por Palermo Pizzas.
                </li>
                <li>
                  <strong>g) Principio de seguridad:</strong> Palermo Pizzas implementará medidas técnicas, organizativas y administrativas razonables destinadas a prevenir: pérdida de información; alteración; acceso no autorizado; uso indebido; y divulgación accidental.
                </li>
                <li>
                  <strong>h) Principio de responsabilidad:</strong> Palermo Pizzas adoptará las medidas necesarias para asegurar el cumplimiento permanente de la presente Política y de la normativa vigente sobre protección de datos personales.
                </li>
              </ul>
            </section>

            {/* V. Datos Personales que recopila Palermo Pizzas */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                V. Datos Personales que recopila Palermo Pizzas
              </h2>
              <p className="mb-4">
                Palermo Pizzas recopila únicamente los datos personales necesarios para prestar correctamente sus servicios, mejorar la experiencia de los usuarios, cumplir obligaciones legales y mantener la seguridad de la plataforma.
              </p>
              <p className="mb-4">
                Dependiendo de la utilización que el usuario haga del sitio web, podrán recopilarse una o más de las siguientes categorías de información:
              </p>

              <div className="space-y-4 pl-4 border-l-2 border-pink-500/20 dark:border-pink-500/10">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">1. Datos de identificación</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Nombre, apellidos, RUT (cuando sea requerido para determinadas funcionalidades del sistema o programas de fidelización), correo electrónico y número telefónico.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">2. Datos de la cuenta del usuario</h3>
                  <p className="mb-1 text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Identificador interno del usuario, fecha de creación de la cuenta, fecha del último acceso, estado de la cuenta y preferencias generales del usuario.
                  </p>
                  <p className="text-xs text-gray-500">
                    La autenticación de usuarios es administrada mediante <strong>Firebase Authentication</strong>, servicio proporcionado por Google Cloud Platform. Las credenciales de acceso (contraseñas) no son almacenadas por Palermo Pizzas en texto legible.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">3. Datos relacionados con pedidos</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Productos adquiridos, cantidades, ingredientes seleccionados, personalizaciones, promociones utilizadas, cupones aplicados, monto total, fecha y hora del pedido, modalidad de entrega y estado del pedido.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">4. Datos para despacho</h3>
                  <p className="mb-1 text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Dirección de entrega, referencias del domicilio, comuna y observaciones entregadas por el cliente para facilitar el despacho.
                  </p>
                  <p className="text-xs text-gray-500">
                    Estos datos serán utilizados exclusivamente para preparar y entregar correctamente el pedido.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">5. Historial de compras</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Palermo Pizzas podrá mantener un historial de los pedidos realizados por el usuario con el propósito de facilitar nuevas compras, permitir repetir pedidos anteriores, entregar soporte postventa, gestionar devoluciones y administrar programas de fidelización.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">6. Productos favoritos</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Cuando el usuario utilice las funciones disponibles para guardar productos favoritos o realizar pedidos frecuentes, dicha información podrá almacenarse para facilitar futuras compras.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">7. Programa Puntos Palermo</h3>
                  <p className="mb-1 text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Puntos obtenidos, puntos utilizados, historial de movimientos, fecha de vencimiento de los puntos, productos canjeados y promociones asociadas al programa.
                  </p>
                  <p className="text-xs text-gray-500">
                    La información será utilizada únicamente para administrar el funcionamiento del programa.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">8. Datos de navegación</h3>
                  <p className="mb-1 text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Dirección IP, navegador utilizado, sistema operativo, resolución de pantalla, páginas visitadas, fecha y hora de acceso, duración aproximada de la sesión e identificadores técnicos generados por la plataforma.
                  </p>
                  <p className="text-xs text-gray-500">
                    Estos antecedentes serán utilizados para fines estadísticos, de seguridad y mejora del servicio.
                  </p>
                </div>
              </div>
            </section>

            {/* VI. Formas de Obtención de los Datos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                VI. Formas de Obtención de los Datos
              </h2>
              <p className="mb-3">
                Los datos personales podrán obtenerse mediante una o varias de las siguientes formas:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-650 dark:text-gray-350">
                <li><strong>a) Registro de usuarios:</strong> Cuando una persona crea una cuenta en el sitio web.</li>
                <li><strong>b) Compra de productos:</strong> Cuando el usuario realiza un pedido utilizando cualquiera de las funcionalidades disponibles.</li>
                <li><strong>c) Formularios de contacto:</strong> Cuando el usuario realiza consultas, solicitudes o reclamos mediante los formularios disponibles.</li>
                <li><strong>d) Comunicaciones por correo electrónico:</strong> Cuando el usuario envía consultas o responde comunicaciones emitidas por Palermo Pizzas.</li>
                <li><strong>e) Comunicaciones mediante WhatsApp:</strong> Cuando el usuario utiliza los canales oficiales de WhatsApp habilitados por Palermo Pizzas para consultas relacionadas con pedidos o servicios.</li>
                <li><strong>f) Participación en promociones:</strong> Cuando el usuario participa voluntariamente en promociones, campañas comerciales, concursos, sorteos o actividades similares organizadas por Palermo Pizzas.</li>
                <li><strong>g) Uso del sitio web:</strong> Mediante procesos automáticos necesarios para el funcionamiento de la plataforma.</li>
              </ul>
            </section>

            {/* VII. Finalidades del Tratamiento de Datos Personales */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                VII. Finalidades del Tratamiento de Datos Personales
              </h2>
              <p className="mb-3">
                Los datos personales recopilados podrán utilizarse para una o varias de las siguientes finalidades:
              </p>
              
              <ul className="space-y-3 pl-4">
                <li>
                  <strong>1. Administración de cuentas:</strong> Permitir crear cuentas, autenticar usuarios, recuperar contraseñas y administrar perfiles.
                </li>
                <li>
                  <strong>2. Procesamiento de pedidos:</strong> Gestionar todo el ciclo de una compra, incluyendo: recepción del pedido; preparación; despacho; retiro en local; y seguimiento del estado del pedido.
                </li>
                <li>
                  <strong>3. Atención al cliente:</strong> Responder consultas, reclamos, solicitudes, devoluciones y requerimientos relacionados con los servicios ofrecidos.
                </li>
                <li>
                  <strong>4. Programa de fidelización:</strong> Administrar Puntos Palermo, acumulación de puntos, canjes, beneficios, vencimientos y promociones especiales.
                </li>
                <li>
                  <strong>5. Promociones y campañas comerciales:</strong> Gestionar descuentos, cupones, promociones, combos, concursos, sorteos y campañas de marketing. Cuando la legislación lo requiera, dichas comunicaciones serán enviadas únicamente a usuarios que hayan otorgado su consentimiento o cuando exista una base legal que las permita.
                </li>
                <li>
                  <strong>6. Comunicaciones operacionales:</strong> Enviar información relacionada con: confirmación del pedido; cambios de estado; incidencias; recordatorios; recuperación de contraseña; y soporte técnico. Estas comunicaciones podrán efectuarse mediante correo electrónico, WhatsApp u otros medios habilitados por Palermo Pizzas.
                </li>
                <li>
                  <strong>7. Prevención de fraude:</strong> Los datos podrán utilizarse para detectar intentos de fraude, actividades sospechosas, utilización indebida de promociones y accesos no autorizados.
                </li>
                <li>
                  <strong>8. Cumplimiento de obligaciones legales:</strong> Cuando la legislación chilena así lo requiera, Palermo Pizzas podrá utilizar los datos para cumplir obligaciones tributarias, judiciales o administrativas.
                </li>
                <li>
                  <strong>9. Estadísticas y mejora continua:</strong> Palermo Pizzas podrá elaborar estadísticas internas utilizando información agregada o anonimizada con el propósito de mejorar el sitio web, optimizar procesos, conocer preferencias de consumo, mejorar tiempos de preparación y despacho, y desarrollar nuevos productos y servicios. Estas estadísticas no tendrán por finalidad identificar individualmente a los usuarios.
                </li>
              </ul>
            </section>

            {/* VIII. Base Legal para el Tratamiento */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                VIII. Base Legal para el Tratamiento
              </h2>
              <p className="mb-3">
                El tratamiento de datos personales realizado por Palermo Pizzas se fundamenta en una o más de las siguientes bases legales:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-3 text-gray-650 dark:text-gray-350">
                <li>El consentimiento otorgado por el titular de los datos.</li>
                <li>La ejecución de un contrato o de medidas precontractuales solicitadas por el usuario.</li>
                <li>El cumplimiento de obligaciones legales.</li>
                <li>El ejercicio legítimo de derechos derivados de la relación comercial con el cliente.</li>
                <li>Otras bases autorizadas por la legislación chilena vigente.</li>
              </ul>
              <p>
                Cuando el tratamiento requiera consentimiento, éste podrá ser revocado por el usuario en cualquier momento conforme al procedimiento establecido en la presente Política, sin afectar la licitud de los tratamientos realizados con anterioridad a dicha revocación.
              </p>
            </section>

            {/* IX. Plataformas Tecnológicas Utilizadas por Palermo Pizzas */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                IX. Plataformas Tecnológicas Utilizadas por Palermo Pizzas
              </h2>
              <p className="mb-3">
                Con el propósito de prestar un servicio seguro, estable y eficiente, Palermo Pizzas utiliza infraestructura tecnológica de terceros que cumple funciones esenciales para la operación del sitio web. Estas plataformas actúan como encargados del tratamiento de determinados datos personales y únicamente procesan la información necesaria para la prestación de sus respectivos servicios.
              </p>

              <div className="space-y-4 pl-4 border-l-2 border-pink-500/20 dark:border-pink-500/10">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">1. Firebase Authentication</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Servicio proporcionado por Google para administrar el proceso de autenticación de usuarios (creación de cuentas, inicio de sesión, recuperación de contraseña, verificación de identidad, administración segura de credenciales). Las contraseñas nunca son almacenadas por Palermo Pizzas en texto legible ni son accesibles para sus administradores.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">2. Cloud Firestore</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Base de datos proporcionada por Google para almacenar: datos del usuario, historial de pedidos, puntos Palermo, preferencias, direcciones registradas, pedidos pendientes, pedidos finalizados, cupones utilizados, promociones aplicadas y registros administrativos.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">3. Google Cloud Platform</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Infraestructura tecnológica utilizada para garantizar: disponibilidad del servicio, respaldo de información, continuidad operacional, seguridad de la plataforma y escalabilidad del sistema. Google procesa información únicamente conforme a las instrucciones de Palermo Pizzas.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">4. Otros proveedores tecnológicos</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Palermo Pizzas podrá incorporar nuevos proveedores tecnológicos cuando ello resulte necesario para mejorar la calidad del servicio. La incorporación de nuevos proveedores no modificará las finalidades para las cuales fueron recopilados los datos personales.
                  </p>
                </div>
              </div>
            </section>

            {/* X. Procesamiento de Pagos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                X. Procesamiento de Pagos
              </h2>
              <p className="mb-4">
                Palermo Pizzas ofrece distintos medios de pago con el propósito de facilitar la compra de sus productos:
              </p>

              <div className="space-y-4 pl-4 border-l-2 border-pink-500/20 dark:border-pink-500/10">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">1. Transbank Webpay</h3>
                  <p className="mb-1">Los pagos efectuados mediante tarjetas bancarias son procesados por <strong>Transbank S.A.</strong>, utilizando la plataforma Webpay.</p>
                  <p className="text-xs text-gray-500">
                    Palermo Pizzas <strong>no almacena</strong> números completos de tarjetas, códigos CVV, claves bancarias ni credenciales financieras. Toda la información financiera es procesada directamente por Transbank bajo sus propios protocolos de seguridad.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">2. Khipu</h3>
                  <p className="mb-1">Las transferencias electrónicas son procesadas mediante la plataforma <strong>Khipu</strong>. Al seleccionar este medio de pago, el usuario será redirigido al entorno seguro administrado por Khipu.</p>
                  <p className="text-xs text-gray-500">
                    Palermo Pizzas no accede ni almacena claves bancarias, credenciales de acceso o información privada de autenticación. Únicamente recibe información relacionada con el resultado de la transacción, necesaria para confirmar el pago del pedido.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">3. Pago en efectivo</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Cuando el usuario selecciona pago en efectivo únicamente serán registrados los antecedentes necesarios para administrar correctamente el pedido.
                  </p>
                </div>
              </div>
            </section>

            {/* XI. Destinatarios de los Datos Personales */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XI. Destinatarios de los Datos Personales
              </h2>
              <p className="mb-3">
                Palermo Pizzas no vende, arrienda ni comercializa datos personales de sus clientes. No obstante, determinados datos podrán comunicarse cuando ello resulte necesario para la correcta prestación de los servicios. Entre otros:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-650 dark:text-gray-350">
                <li><strong>a) Plataformas tecnológicas:</strong> Como Firebase, Google Cloud Platform y Firestore.</li>
                <li><strong>b) Plataformas de pago:</strong> Como Transbank, Webpay y Khipu.</li>
                <li><strong>c) Servicios de mensajería:</strong> Cuando resulte necesario para enviar confirmaciones, notificaciones, recuperación de contraseña e información relacionada con pedidos.</li>
                <li><strong>d) Empresas de soporte tecnológico:</strong> Proveedores encargados del mantenimiento de la plataforma informática.</li>
                <li><strong>e) Autoridades competentes:</strong> Cuando una autoridad administrativa o judicial solicite información conforme a la legislación vigente.</li>
                <li><strong>f) Obligaciones tributarias:</strong> Cuando sea necesario cumplir obligaciones legales relacionadas con la emisión de documentos tributarios o procesos contables.</li>
              </ul>
            </section>

            {/* XII. Conservación de los Datos Personales */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XII. Conservación de los Datos Personales
              </h2>
              <p className="mb-3">
                Los datos personales serán conservados únicamente durante el tiempo necesario para cumplir las finalidades descritas en la presente Política. Entre otros criterios podrán considerarse:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-3 text-gray-650 dark:text-gray-350">
                <li>Existencia de una relación comercial vigente.</li>
                <li>Cumplimiento de obligaciones legales o tributarias.</li>
                <li>Atención de reclamos y defensa de derechos.</li>
                <li>Requerimientos de autoridades competentes.</li>
              </ul>
              <p>
                Una vez cumplidas dichas finalidades, Palermo Pizzas podrá eliminar la información, anonimizar los datos o conservar únicamente aquella información exigida por la legislación vigente.
              </p>
            </section>

            {/* XIII. Seguridad de la Información */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XIII. Seguridad de la Información
              </h2>
              <p className="mb-3">
                Palermo Pizzas adopta medidas técnicas, organizativas y administrativas destinadas a proteger la información personal de sus usuarios, tales como: autenticación segura, conexiones cifradas mediante HTTPS, controles de acceso, respaldo periódico de información, registros de actividad, monitoreo de la plataforma y segmentación de privilegios administrativos.
              </p>
              <p className="mb-3">
                Estas medidas buscan prevenir la pérdida de información, modificación no autorizada, destrucción accidental, accesos indebidos o utilización fraudulenta.
              </p>
              <p>
                <strong>Confidencialidad:</strong> Toda persona que tenga acceso autorizado a datos personales deberá mantener estricta confidencialidad respecto de dicha información. Esta obligación continuará vigente incluso después de finalizar la relación laboral, contractual o comercial correspondiente.
              </p>
            </section>

            {/* XIV. Incidentes de Seguridad */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XIV. Incidentes de Seguridad
              </h2>
              <p className="mb-3">
                En caso de detectarse un incidente de seguridad que pudiera afectar significativamente la confidencialidad, integridad o disponibilidad de los datos personales, Palermo Pizzas adoptará las medidas razonables para: contener el incidente, investigar su origen, corregir las vulnerabilidades detectadas y minimizar sus efectos.
              </p>
              <p>
                Cuando la legislación vigente lo exija, los usuarios afectados y las autoridades competentes serán informados dentro de los plazos establecidos por la normativa aplicable.
              </p>
            </section>

            {/* XV. Transferencias Internacionales de Datos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XV. Transferencias Internacionales de Datos
              </h2>
              <p className="mb-3">
                Algunos proveedores tecnológicos utilizados por Palermo Pizzas podrán almacenar o procesar información en centros de datos ubicados fuera del territorio chileno. En dichos casos, Palermo Pizzas procurará que tales proveedores mantengan estándares adecuados de seguridad y protección de datos personales.
              </p>
              <p>
                La utilización de dichos servicios no modifica la titularidad de los datos personales, la cual continúa perteneciendo exclusivamente a sus respectivos titulares.
              </p>
            </section>

            {/* XVI. Derechos de los Titulares de los Datos Personales */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XVI. Derechos de los Titulares de los Datos Personales
              </h2>
              <p className="mb-3">
                Toda persona cuyos datos personales sean tratados por Palermo Pizzas podrá ejercer los derechos reconocidos por la legislación chilena vigente. En particular, podrá solicitar:
              </p>
              
              <ul className="space-y-3 pl-4">
                <li>
                  <strong>1. Derecho de Acceso:</strong> Conocer si Palermo Pizzas mantiene datos personales asociados a su persona y obtener información respecto de los datos almacenados, su origen, las finalidades de su tratamiento y el período estimado de conservación.
                </li>
                <li>
                  <strong>2. Derecho de Rectificación:</strong> Solicitar la actualización o corrección de aquellos datos personales que sean incorrectos, incompletos o desactualizados.
                </li>
                <li>
                  <strong>3. Derecho de Supresión:</strong> Solicitar la eliminación de sus datos personales cuando hayan dejado de ser necesarios para las finalidades que motivaron su recopilación. La eliminación no procederá cuando Palermo Pizzas deba conservar determinada información para cumplir obligaciones legales o contractuales.
                </li>
                <li>
                  <strong>4. Derecho de Oposición:</strong> Solicitar que determinados tratamientos de datos personales cesen cuando exista fundamento legal para ello.
                </li>
                <li>
                  <strong>5. Derecho de Revocar el Consentimiento:</strong> Cuando el tratamiento se base en el consentimiento del titular, éste podrá revocarlo en cualquier momento.
                </li>
                <li>
                  <strong>6. Derecho a Limitar el Tratamiento:</strong> El usuario podrá solicitar que determinados datos sean únicamente conservados, suspendiendo temporalmente su utilización.
                </li>
                <li>
                  <strong>7. Derecho a Presentar Consultas o Reclamos:</strong> Los usuarios podrán formular consultas, observaciones o reclamos relacionados con la protección de sus datos personales mediante los canales oficiales publicados por Palermo Pizzas.
                </li>
              </ul>
            </section>

            {/* XVII. Procedimiento para Ejercer los Derechos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XVII. Procedimiento para Ejercer los Derechos
              </h2>
              <p className="mb-3">
                Las solicitudes podrán presentarse mediante correo electrónico, el formulario de contacto del sitio web u otros canales oficiales habilitados por Palermo Pizzas.
              </p>
              <p className="mb-3">
                La solicitud deberá contener, al menos: nombre del titular, medio para responder la solicitud, identificación suficiente para verificar la identidad del solicitante y descripción clara del derecho que desea ejercer.
              </p>
              <p className="mb-3">
                Palermo Pizzas podrá solicitar antecedentes adicionales cuando ello resulte necesario para confirmar la identidad del solicitante y proteger la información de terceros.
              </p>
              <p>
                Las solicitudes serán respondidas dentro de los plazos establecidos por la legislación vigente.
              </p>
            </section>

            {/* XVIII. Comunicaciones Comerciales */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XVIII. Comunicaciones Comerciales
              </h2>
              <p className="mb-3">
                Cuando el usuario haya otorgado su consentimiento, Palermo Pizzas podrá enviar información relacionada con nuevos productos, promociones, descuentos, beneficios, campañas comerciales, concursos, sorteos y novedades del sitio web.
              </p>
              <p className="mb-3">
                Estas comunicaciones podrán realizarse mediante correo electrónico, WhatsApp, notificaciones del sitio web u otros medios autorizados.
              </p>
              <p>
                El usuario podrá solicitar dejar de recibir comunicaciones promocionales en cualquier momento, sin afectar las comunicaciones estrictamente necesarias para la gestión y seguimiento operacional de sus pedidos.
              </p>
            </section>

            {/* XIX. Programa de Fidelización "Puntos Palermo" */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XIX. Programa de Fidelización "Puntos Palermo"
              </h2>
              <p className="mb-3">
                El Programa Puntos Palermo tiene por finalidad premiar la preferencia de los clientes mediante la acumulación y canje de puntos conforme a las reglas publicadas por Palermo Pizzas. Para administrar este programa podrán tratarse datos como el historial de compras, puntos obtenidos, puntos utilizados, movimientos de puntos, fecha de vencimiento y productos canjeados.
              </p>
              <p>
                Esta información será utilizada exclusivamente para la correcta administración del programa y para resolver eventuales consultas o reclamos relacionados con el mismo.
              </p>
            </section>

            {/* XX. Promociones, Cupones, Combos, Concursos y Sorteos */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XX. Promociones, Cupones, Combos, Concursos y Sorteos
              </h2>
              <p className="mb-3">
                Palermo Pizzas podrá desarrollar campañas promocionales, concursos, sorteos, programas de beneficios y cupones de descuento. Cuando un usuario participe voluntariamente en alguna de estas actividades, Palermo Pizzas podrá tratar los datos necesarios para verificar el cumplimiento de los requisitos, identificar a los participantes, administrar la promoción, comunicar resultados, entregar premios y prevenir fraudes o usos indebidos.
              </p>
              <p>
                Cada promoción podrá contar con sus propias bases legales y condiciones particulares.
              </p>
            </section>

            {/* XXI. Política de Cookies */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXI. Política de Cookies
              </h2>
              
              <div className="space-y-3 pl-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">¿Qué son las Cookies?</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Las cookies son pequeños archivos de información que pueden almacenarse en el dispositivo del usuario cuando navega por un sitio web. Su finalidad es mejorar el funcionamiento de la plataforma, recordar determinadas preferencias y facilitar una experiencia de navegación más eficiente.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">Cookies utilizadas por Palermo Pizzas</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    Palermo Pizzas podrá utilizar cookies necesarias para mantener la sesión iniciada, recordar preferencias, mejorar la seguridad, optimizar el rendimiento y facilitar la navegación. Asimismo, podrán utilizarse herramientas de análisis que recopilen información estadística agregada.
                  </p>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">Gestión de Cookies</h3>
                  <p className="text-xs sm:text-sm text-gray-650 dark:text-gray-350">
                    El usuario podrá configurar su navegador para aceptar cookies, rechazarlas, eliminarlas o recibir notificaciones antes de su instalación. La desactivación de determinadas cookies podría afectar el correcto funcionamiento de algunas funcionalidades del sitio.
                  </p>
                </div>
              </div>
            </section>

            {/* XXII. Menores de Edad */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXII. Menores de Edad
              </h2>
              <p className="mb-3">
                Los servicios de Palermo Pizzas están dirigidos al público general. Palermo Pizzas no recopila deliberadamente datos personales de menores de edad sin la autorización correspondiente cuando ésta sea exigida por la legislación vigente.
              </p>
              <p>
                Si un padre, madre o representante legal estima que un menor ha proporcionado datos personales sin autorización, podrá solicitar su eliminación mediante los canales oficiales de contacto.
              </p>
            </section>

            {/* XXIII. Enlaces a Sitios de Terceros */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXIII. Enlaces a Sitios de Terceros
              </h2>
              <p className="mb-3">
                El sitio web podrá contener enlaces hacia plataformas externas. Palermo Pizzas no controla las políticas de privacidad ni el tratamiento de datos realizado por dichos terceros.
              </p>
              <p>
                Se recomienda revisar las políticas de privacidad correspondientes antes de proporcionar información personal en dichos sitios.
              </p>
            </section>

            {/* XXIV. Modificaciones de la Política de Privacidad */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXIV. Modificaciones de la Política de Privacidad
              </h2>
              <p className="mb-3">
                Palermo Pizzas podrá modificar la presente Política cuando resulte necesario debido a cambios legales, modificaciones tecnológicas, incorporación de nuevos servicios o mejoras operacionales.
              </p>
              <p className="mb-3">
                La versión vigente será siempre la publicada en el sitio web.
              </p>
              <p>
                Cuando las modificaciones afecten sustancialmente los derechos de los usuarios, Palermo Pizzas podrá comunicar dichos cambios mediante los medios que estime apropiados.
              </p>
            </section>

            {/* XXV. Legislación Aplicable y Jurisdicción */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXV. Legislación Aplicable y Jurisdicción
              </h2>
              <p className="mb-3">
                La presente Política de Privacidad se rige por la legislación de la República de Chile.
              </p>
              <p>
                Cualquier controversia relacionada con su interpretación o aplicación será conocida por los tribunales competentes conforme a la legislación chilena.
              </p>
            </section>

            {/* XXVI. Datos de Contacto */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXVI. Datos de Contacto
              </h2>
              <p className="mb-3">
                Para consultas relacionadas con esta Política de Privacidad o con el tratamiento de datos personales, los usuarios podrán comunicarse mediante los canales oficiales publicados por Palermo Pizzas.
              </p>
              <p className="mb-3 font-semibold text-gray-900 dark:text-white">
                Correo electrónico: <a href="mailto:contacto@palermopizzas.cl" className="text-pink-600 dark:text-pink-400 hover:underline">contacto@palermopizzas.cl</a>
              </p>
              <p>
                En caso de modificarse dichos canales, Palermo Pizzas actualizará oportunamente la información publicada en su sitio web.
              </p>
            </section>

            {/* XXVII. Vigencia */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXVII. Vigencia
              </h2>
              <p>
                La presente Política de Privacidad entrará en vigencia desde la fecha de su publicación en el sitio web de Palermo Pizzas y permanecerá vigente hasta que sea reemplazada por una nueva versión.
              </p>
            </section>

            {/* XXVIII. Aceptación */}
            <section className="pt-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-3 tracking-wide uppercase border-b border-gray-100 dark:border-gray-800 pb-1">
                XXVIII. Aceptación
              </h2>
              <p className="mb-3">
                Al registrarse, navegar o utilizar cualquiera de los servicios ofrecidos por Palermo Pizzas, el usuario declara haber leído, comprendido y aceptado íntegramente la presente Política de Privacidad y Protección de Datos Personales.
              </p>
              <p>
                Cuando la legislación vigente lo requiera, el consentimiento será solicitado mediante los mecanismos habilitados en la plataforma.
              </p>
            </section>

          </div>

          {/* Cierre del documento */}
          <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800 text-center text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <p>© {new Date().getFullYear()} Palermo Pizzas. Todos los derechos reservados.</p>
            <p className="mt-1">
              Si tiene dudas sobre esta política, por favor comuníquese a través de nuestro correo de soporte <a href="mailto:contacto@palermopizzas.cl" className="text-pink-600 dark:text-pink-400 hover:underline">contacto@palermopizzas.cl</a> o al WhatsApp <a href="https://wa.me/56971995481" target="_blank" rel="noopener noreferrer" className="text-pink-600 dark:text-pink-400 hover:underline">+56 9 7199 5481</a>.
            </p>
          </div>
        </article>
      </div>
    </main>
  )
}
