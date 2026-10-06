# Generar el PDF del entregable 2

Desde esta carpeta:

```bash
bash generar-pdf.sh
```

El script también puede ejecutarse desde otra carpeta indicando su ruta. Genera `Entregable_2_Mattermost.pdf` y actualiza las imágenes en `diagramas/`.

Requiere Pandoc 3 o posterior, XeLaTeX, Python 3, Graphviz (`dot`), MuPDF (`mutool`), los paquetes LaTeX `standalone` y `pgfgantt`, y las fuentes Latin Modern Roman, TeX Gyre Heros y Latin Modern Mono. Se comprobó con Pandoc 3.1.3 y TeX Live 2023. No descarga herramientas, fuentes ni imágenes durante la generación.

El script primero compila `plan-gantt.tex` en una carpeta temporal y convierte su PDF a `diagramas/plan-gantt.png` mediante `mutool`. Después ejecuta el siguiente comando desde esta carpeta:

```bash
pandoc Entregable_2_Mattermost.md \
  --from=gfm \
  --lua-filter=pdf-layout.lua \
  --pdf-engine=xelatex \
  -V geometry:margin=2cm \
  -V papersize:a4 \
  -V fontsize=10pt \
  -V colorlinks=true \
  -V urlcolor='blue!60!black' \
  -V linkcolor='blue!60!black' \
  -V mainfont='Latin Modern Roman' \
  -V monofont='Latin Modern Mono' \
  -o Entregable_2_Mattermost.pdf
```

El filtro asigna proporciones a las columnas según cada tabla y permite ajustar sus párrafos al ancho disponible. Las tablas usan texto de 9 puntos y pueden continuar en la página siguiente con su encabezado repetido; el cuerpo conserva 10 puntos. También permite dividir visualmente el SHA entre líneas, sin cambiar su contenido.

Pandoc no renderiza los bloques Mermaid por sí solo. El filtro llama a `render-diagramas.py`, que genera una representación equivalente mediante Graphviz y la incorpora como PNG. El Markdown conserva los bloques Mermaid para verlos y editarlos en GitHub. Las imágenes se regeneran en cada exportación para reflejar la fuente actual.

El renderizador admite el subconjunto usado aquí: `flowchart LR`, `TD` o `TB`, nodos rectangulares, flechas `-->` y etiquetas de flechas entre barras. Se detiene con un error si se añade una construcción no admitida. Para diagramas más complejos se deberá ampliar el renderizador o utilizar Mermaid CLI.

Los anchos están definidos para las tablas actuales en `pdf-layout.lua`. Si cambia el número de columnas de una de ellas, debe actualizarse su distribución en ese archivo.

Referencias: [tablas y PDF en Pandoc](https://pandoc.org/MANUAL.html), [filtros Lua](https://pandoc.org/lua-filters.html).

Los títulos siguen el primer avance: tablas numeradas en cursiva encima y figuras numeradas en cursiva debajo. La exportación reserva espacio para iniciar cada tabla junto a su título y mantiene cada figura junto a su descripción, conservando las proporciones de la imagen.

El calendario Gantt se edita en `plan-gantt.tex`: cada barra declara su identificador, etiqueta, esfuerzo y fechas inclusivas de inicio y fin; `\ganttlink` define dependencias de final a inicio. Este archivo es la fuente del gráfico y debe permanecer en control de versiones. El PNG es un resultado generado. Para reproducir todo el documento, incluido el Gantt actualizado, use `bash generar-pdf.sh`.

Las horas-persona de las etiquetas corresponden al resultado PERT redondeado hacia arriba a intervalos de media hora por tarea; las barras representan ventanas de calendario acordadas para distribuir ese trabajo. Cambiar una estimación no cambia automáticamente las fechas ni calcula una ruta crítica. Al modificar el calendario también deben actualizarse la tabla y la explicación del plan en el Markdown.

El Gantt utiliza colores por grupo de trabajo y columnas separadas para tarea, responsable y esfuerzo. La planificación actual asume inicio el 12 de octubre y distribuye 55 horas-persona de trabajo base sin superar cuatro horas semanales por integrante; los hitos permanecen el 9 y el 30 de noviembre.

Los enlaces se muestran en azul oscuro mediante las opciones `colorlinks`, `urlcolor` y `linkcolor`. Conservan su destino clicable y se distinguen del texto sin usar negrita.

El cuerpo usa Latin Modern Roman y el código Latin Modern Mono, como el entregable 1. La distribución por tarea y rol está en el anexo B; la carga semanal, en la tabla 7.
