# DT-01: Sintaxis y casos de aceptación

Tarea [#14](https://github.com/agvor/mattermost/issues/14) de la historia [#5](https://github.com/agvor/mattermost/issues/5) (Mattermost [#38480](https://github.com/mattermost/mattermost/issues/38480)). Las referencias de código corresponden a `master` en `ecfbfaf2`; los archivos citados no cambiaron respecto de la base `53211e45`.

## 1. Recorrido del mensaje

### 1.1. Analizador y renderizadores

| Paso | Archivo | Función |
|---|---|---|
| Entrada | `webapp/channels/src/components/markdown/markdown.tsx:139` | Llama a `formatText` y pasa el HTML a `messageHtmlToComponent` (línea 141). |
| Formato | `webapp/channels/src/utils/text_formatting.tsx:257` | `formatText` aplica Markdown (línea 283) y luego menciones, emojis y resaltado (`doFormatText`, línea 346). |
| Analizador | `webapp/channels/src/utils/markdown/index.ts:24` | `formatWithRenderer` usa el fork `mattermost/marked` (`c211e4ca`) con `sanitize: true` (línea 31). |
| Renderizador | `webapp/channels/src/utils/markdown/renderer.tsx:13` | Genera el HTML. Los bloques especiales salen como marcadores con atributos `data-*`, por ejemplo `data-latex` (línea 36) y `data-codeblock-code` (línea 68). |
| Componentes | `webapp/channels/src/utils/message_html_to_component.tsx:74` | Convierte el HTML en React y reemplaza esos marcadores por componentes (`data-latex`, línea 272; `data-codeblock-code`, línea 299). |

### 1.2. Vistas del mensaje

Las tres vistas usan `PostMarkdown`, así que comparten el mismo recorrido:

| Vista | Archivo |
|---|---|
| Vista previa al escribir | `components/textbox/textbox.tsx:310`, dentro de `AdvancedTextEditor` (`advanced_text_editor.tsx:991`). |
| Mensaje publicado | `components/post_view/post_message_view/post_message_view.tsx:180`. |
| Edición | `components/edit_post/edit_post.tsx:34`: reutiliza `AdvancedTextEditor` y su vista previa. |

Las notificaciones, la búsqueda y los resúmenes de hilos usan `stripMarkdown` (`utils/markdown/index.ts`) con otro renderizador. No forman parte de este incremento.

### 1.3. Comportamiento actual

Con `sanitize: true`, la regla `html` del analizador toma todo el bloque `<details>…</details>` como un solo párrafo y lo escapa. El resultado se ve como texto, como registra la [evidencia base](../evidencia-base/issue-38480/README.md). Además, el contenido interno no se interpreta como Markdown: un bloque de código queda como `<code>` en línea y una lista se ve como texto. El script [`DT-01_comprobacion_marked.js`](DT-01_comprobacion_marked.js) lo muestra con los ejemplos de la sección 3.

Por eso, la sección debe reconocerse antes de esa regla y su cuerpo debe procesarse como Markdown aparte. El repositorio ya usa `<details>` y `<summary>` nativos en `components/analytics/system_analytics/system_analytics.tsx:554`.

## 2. Decisiones para acordar en la revisión

| ID | Pregunta | Opciones | Propuesta |
|---|---|---|---|
| D1 | ¿Qué sintaxis se admite? | Subconjunto de HTML como en GitHub; bloque propio `:::details`. | Subconjunto de HTML: es lo que pide #38480 y lo que describen la evidencia base y la variante `open`. El texto copiado de GitHub funciona sin cambios. |
| D2 | ¿Qué forma tiene el bloque? | Etiquetas en líneas propias; también en una sola línea. | `<details>` o `<details open>` al inicio de una línea, con `<summary>…</summary>` en la misma línea o en la siguiente. El cuerpo va en las líneas siguientes y `</details>` cierra en una línea propia. |
| D3 | ¿Qué atributos se admiten? | Solo `open`; cualquier atributo. | Solo `open`, sin valor. Cualquier otro atributo, en `details` o en `summary`, deja el bloque como texto. |
| D4 | ¿Qué admite el resumen? | Texto plano; Markdown en línea. | Markdown en línea (negrita, código, emojis, menciones). Es obligatorio y no puede quedar vacío. |
| D5 | ¿Se admiten secciones anidadas? | Sí; no. | No, según la historia DT. Si el cuerpo contiene otro `<details>`, el bloque completo queda como texto. |
| D6 | ¿Se conserva el estado abierto o cerrado? | Por usuario; no. | No. Cada vista empieza en el estado inicial del mensaje. Abrir la sección no modifica el mensaje ni afecta a otros usuarios. |
| D7 | ¿Dónde se reconoce la sección? | Antes de `Markdown.format`, fuera de los bloques de código; regla nueva en el fork de `marked`. | Antes de `Markdown.format`, para no modificar la dependencia externa. El resumen y el cuerpo se procesan con el mismo formato y el resultado sale como marcador `data-*`, igual que LaTeX. Lo decide DT-02. |

## 3. Ejemplos

### 3.1. Válidos

| ID | Ejemplo | Resultado esperado |
|---|---|---|
| V1 | `<details>` / `<summary>Registro del error</summary>` / párrafo y bloque de código / `</details>` | Sección contraída; al abrirla se ven el párrafo y el código con su formato normal. |
| V2 | `<details open>` / `<summary>Pasos</summary>` / lista / `</details>` | Sección abierta desde el inicio; se puede cerrar. |
| V3 | `<details><summary>Resumen</summary>` en una línea, cuerpo y `</details>` | Igual que V1. Es la forma más común al copiar de GitHub. |
| V4 | Resumen con `**Importante:**` o `` `código` `` | El resumen muestra el formato en línea. |
| V5 | Texto, dos secciones seguidas y más texto | Dos secciones independientes; el texto de alrededor no cambia. |
| V6 | Sección sin cuerpo | Se muestra el resumen; al abrirla no aparece contenido. |

### 3.2. Incompletos

Se muestran como texto, igual que hoy, sin perder contenido.

| ID | Ejemplo |
|---|---|
| I1 | `<details>` y `<summary>` sin `</details>`. |
| I2 | `<details>` sin `<summary>`. |
| I3 | `<summary></summary>` vacío. |
| I4 | `</details>` sin apertura. |

### 3.3. No admitidos

| ID | Ejemplo | Resultado esperado |
|---|---|---|
| N1 | Sección dentro de otra sección | Texto (D5). |
| N2 | Todo en una línea: `<details><summary>R</summary>Cuerpo</details>` | Texto. |
| N3 | Otros atributos: `<details class="x">`, `<details open="false">`, `<summary style="…">` | Texto (D3). |
| N4 | La sintaxis dentro de un bloque de código o de código en línea | Se muestra como código, igual que hoy. |
| N5 | La sintaxis dentro de una cita o de una lista | Texto. |
| N6 | Etiquetas `<p>` u otro HTML dentro del cuerpo | La sección funciona; ese HTML se escapa como hoy. |

### 3.4. Maliciosos

| ID | Ejemplo | Resultado esperado |
|---|---|---|
| M1 | `<details ontoggle="alert(1)">` | Texto; no se ejecuta nada (D3). |
| M2 | `<summary><img src=x onerror=alert(1)></summary>` | La sección funciona; el HTML del resumen se escapa. |
| M3 | `<script>` o `<iframe>` en el cuerpo | Se escapa como hoy. |
| M4 | Enlace `javascript:` en el resumen o en el cuerpo | Se filtra igual que fuera de la sección. |

## 4. Casos de aceptación

Los casos se prueban con dos usuarios del mismo canal, quien publica y quien lee, en la vista previa, el mensaje publicado y la edición.

### 4.1. Estado inicial y apertura

| ID | Escenario | Resultado esperado | Criterio |
|---|---|---|---|
| CA-DT-01 | Mensaje con V1 | Inicia contraída; solo se ven el resumen y el indicador. | DT-01 |
| CA-DT-02 | Se abre y se cierra con clic | Muestra y oculta el cuerpo; el resumen no cambia. | DT-01 |
| CA-DT-03 | Quien publica abre la sección | Quien lee la sigue viendo contraída; al recargar vuelve al estado inicial (D6). | DT-01 |

### 4.2. Contenido y vistas

| ID | Escenario | Resultado esperado | Criterio |
|---|---|---|---|
| CA-DT-04 | Cuerpo con párrafos, listas y código | Mismo formato que fuera de la sección, incluido el resaltado del código. | DT-02 |
| CA-DT-05 | El mismo mensaje en vista previa, publicado y en edición | Misma estructura y mismo estado inicial en las tres vistas y para ambos usuarios. | DT-02 |
| CA-DT-06 | Se edita un mensaje para agregar o quitar la sección | Al guardar se muestra el cambio; el editor conserva el texto original. | DT-02 |
| CA-DT-07 | Menciones, emojis y enlaces en el cuerpo y en el resumen | Funcionan igual que en el resto del mensaje. | DT-02 |

### 4.3. Variante abierta, teclado y accesibilidad

| ID | Escenario | Resultado esperado | Criterio |
|---|---|---|---|
| CA-DT-08 | Mensaje con V2 | Inicia abierta y se puede cerrar. | DT-03 |
| CA-DT-09 | Navegación con teclado | Tab llega al resumen; Enter y Espacio abren y cierran; el foco es visible. | DT-03 |
| CA-DT-10 | Lector de pantalla | Anuncia el resumen y si está expandida o contraída. | DT-03 |
| CA-DT-11 | Enter o Espacio sobre el resumen en la vista previa | Abre o cierra la sección y no envía el mensaje. | DT-03 |

### 4.4. Salida segura

| ID | Escenario | Resultado esperado | Criterio |
|---|---|---|---|
| CA-DT-12 | Ejemplos I1 a I4 | Texto, igual que hoy, sin perder contenido. | DT-04 |
| CA-DT-13 | Ejemplos N1 a N6 | Según la tabla 3.3. | DT-04 |
| CA-DT-14 | Ejemplos M1 a M4 | No se ejecuta código ni se agregan atributos o etiquetas distintos de `details` y `summary`. | DT-04 |

### 4.5. Regresión

| ID | Escenario | Resultado esperado | Criterio |
|---|---|---|---|
| CA-DT-15 | Mensajes sin sección | Misma salida que antes; las pruebas actuales de Markdown y formato pasan. | RG-01 |
| CA-DT-16 | Notificaciones, búsqueda y resúmenes de hilos | Sin cambios: muestran el texto del mensaje como hoy. | RG-01 |
| CA-DT-17 | Bloques de código y LaTeX con `<details>` en su interior | Sin cambios. | RG-01 |

## 5. Pruebas sugeridas para DT-02 a DT-04

| Tipo | Archivo | Qué cubrir |
|---|---|---|
| Unitaria web | `utils/text_formatting.test.ts` o una prueba nueva junto al reconocimiento | Ejemplos V, I, N y M de la sección 3. |
| Unitaria web | `utils/markdown/index.test.ts` | Que los bloques de código y LaTeX no cambien (CA-DT-17). |
| Unitaria web | `utils/message_html_to_component.test.tsx` | Conversión del marcador al componente, estado inicial y `open`. |
| Unitaria web | Componente nuevo de la sección | Clic, Enter, Espacio, foco y estado accesible. |
| Unitaria web | `components/post_markdown/post_markdown.test.tsx` | Misma salida para la vista previa y el mensaje publicado. |
| E2E | `e2e-tests/playwright/specs/functional/channels/messaging/` | Publicar, leer con otro usuario, editar y usar el teclado (CA-DT-01 a CA-DT-11). |

## 6. Comprobación en el ambiente local

El script [`DT-01_comprobacion_marked.js`](DT-01_comprobacion_marked.js) ejecuta el analizador actual con algunos ejemplos de la sección 3. Requiere las dependencias de `webapp` instaladas:

```bash
node pswe-07-grupo01/entregable02/DT-01_comprobacion_marked.js
```

| ID | Resultado en la base |
|---|---|
| V1 | Un solo párrafo escapado; el bloque de código queda como `<code>` en línea. |
| V2 | Un solo párrafo escapado; la lista no se interpreta. |
| V3 | Un solo párrafo escapado. |
| I1 | Tres párrafos escapados. |
| N2 | Un solo párrafo escapado. |
| N4 | Bloque de código, sin cambios. |
| M1 | Un solo párrafo escapado; el atributo no se ejecuta. |
