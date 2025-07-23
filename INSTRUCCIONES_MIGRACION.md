# Reorganización de rutas de cliente y administrador

Se ha realizado una reorganización de las rutas de la aplicación para separar completamente los temas de cliente y administrador:

1. Se ha creado un grupo de rutas `(client)` para todas las páginas de cliente
2. Se ha creado un layout específico para el administrador con su propio ThemeProvider
3. Se ha eliminado el ThemeProvider global del layout raíz
4. Se ha creado un middleware para redirigir correctamente

## Próximos pasos

Para completar la migración, necesitarás:

1. Mover manualmente las siguientes carpetas a `app/(client)/`:
   - armar-pizza
   - confirmacion
   - direccion
   - menu
   - pago
   - pedidos
   - perfil
   - seguimiento

2. Actualizar las rutas de importación en estos archivos movidos

3. Reiniciar la aplicación después de completar estos movimientos

Esta estructura garantiza que el modo oscuro del administrador no afecte en absoluto a la vista del cliente.
