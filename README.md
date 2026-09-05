# MARYNEL v2 — Firebase LIMPIO

Versión consolidada de la página MARYNEL. Se conservó el diseño visual del HTML grande y se integró la lógica Firebase del paquete anterior, eliminando duplicaciones innecesarias.

## Archivos
- `index.html`: estructura y recursos visuales.
- `style.css`: estilos separados del HTML.
- `app.js`: Firebase, acceso, códigos, descuentos, administración y navegación.

## Funciones conservadas
- Llave maestra: `48271935`.
- Firebase Authentication anónima.
- Firestore en `marynel_codes`.
- Códigos de 8 dígitos.
- Consumo transaccional de códigos.
- Reemplazo automático al consumir un código.
- Objetivo de 20 códigos disponibles.
- Panel administrativo.
- Descuentos aplicados a productos.
- Menú, modal, productos desplegables y animaciones.

## Limpieza aplicada
- Se eliminó la carga duplicada de Anime.js.
- Se eliminó el JavaScript local de autenticación que duplicaba la función de acceso.
- Se centralizó la lógica en `app.js`.
- Se separó el CSS en `style.css`.
- Se eliminó la referencia visual de “Sin base de datos”.

## Nota de seguridad
La llave maestra está en el código del navegador y por sí sola no constituye seguridad de servidor. Para producción, el acceso administrativo debe protegerse con Firebase Authentication y reglas de Firestore adecuadas.


## Descuentos variables
Los códigos nuevos y los códigos de reemplazo reciben automáticamente un descuento entero aleatorio entre 5% y 50%. El botón de administración “ACTUALIZAR DESCUENTOS 5%–50%” permite convertir los códigos disponibles existentes a descuentos variables.


## Corrección v2.1 — generación y validación verificada
- La generación usa escritura por lote (`writeBatch`) para guardar los códigos de forma consistente.
- Cada código generado se vuelve a leer desde Firestore antes de considerarlo confirmado.
- Se evita reutilizar IDs que ya existan, incluidos códigos usados.
- Los códigos mantienen exactamente 8 dígitos, incluidos ceros iniciales (ej. `02755063`).
- El código maestro `48271935` no puede ser generado como código de descuento.
- Si un código no existe en Firestore, el sistema lo informa claramente en lugar de aceptar cualquier número de 8 dígitos.
- Al consumir un código disponible, se crea un reemplazo automático con descuento variable de 5%–50%.
