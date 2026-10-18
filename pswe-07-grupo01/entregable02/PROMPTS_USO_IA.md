# Registro de prompts de apoyo: Entregable 2

Este archivo reúne versiones generales y representativas de consultas de apoyo utilizadas durante la preparación del entregable 2. Los prompts están normalizados para permitir su reutilización; no son una transcripción exhaustiva de la conversación ni un registro de autoría de los artefactos. El equipo es responsable de las decisiones, la revisión y la validación del trabajo.

## 1. Revisar la planificación del segundo avance

```text
Revise el plan descrito en <RUTA_PLAN_DEL_PROYECTO> considerando la consigna
<RUTA_CONSIGNA> y el alcance aprobado en <RUTA_ENTREGABLE_ANTERIOR>.

Identifique vacíos o inconsistencias en:

- actividades, fechas, capacidad y dependencias;
- responsabilidades de ejecución, revisión y validación;
- evidencia necesaria para demostrar el avance;
- continuidad entre los incrementos del proyecto.

Presente observaciones y recomendaciones concretas para que el equipo
evalúe los ajustes. Mantenga costos y riesgos pendientes cuando todavía
no corresponda desarrollarlos. Distinga trabajo previsto de resultados
respaldados por evidencia.
```

## 2. Evaluar la descomposición de una mejora en tareas

```text
Considere la mejora <DESCRIPCION_O_URL_DEL_ISSUE>, sus criterios de aceptación
<CRITERIOS> y el backlog <RUTA_BACKLOG>.

Evalúe si las tareas tienen tamaño acotado, un resultado verificable y
dependencias claras. Sugiera ajustes para cubrir análisis, implementación,
pruebas y documentación sin duplicar actividades.

Compruebe que cada tarea tenga un responsable, un revisor distinto y una
persona que valide el resultado. Incluya las actividades generales de
preparación del entorno, documentación inicial y CI/CD cuando correspondan.

Relacione las recomendaciones con los criterios de aceptación y señale
las decisiones que requieran análisis técnico adicional del equipo.
```

## 3. Revisar el flujo de seguimiento y medición

```text
Revise el flujo de trabajo descrito en <RUTA_PROCESO> para un equipo que
utiliza <HERRAMIENTA_KANBAN>.

Compruebe que sean claros:

- la relación entre historias, tareas y pull requests;
- la asignación de responsables y los traspasos entre roles;
- las condiciones para iniciar, revisar, validar y cerrar una tarea;
- el tratamiento de bloqueos, devoluciones y límites de trabajo en curso;
- los eventos necesarios para medir lead time, espera de revisión y
  aceptación sin retrabajo.

Identifique ambigüedades y proponga reglas sencillas. Para cada métrica
indique fuente, inicio y fin de medición, unidad de observación y posibles
duplicaciones. No suponga que mover una tarjeta demuestra aceptación
funcional ni que el tiempo transcurrido equivale al esfuerzo trabajado.
```

## 4. Contrastar la estrategia de integración y entrega

```text
Revise la estrategia de ramas y CI/CD de <RUTA_PROCESO> contra los workflows
y comandos existentes en <RUTA_REPOSITORIO>.

Evalúe si contempla:

- ramas breves por tarea y pull requests hacia <RAMA_INTEGRACION_DEL_FORK>;
- revisión independiente y controles pertinentes antes de integrar;
- pruebas unitarias, de integración y funcionales según el cambio;
- identificación de código y artefactos mediante SHA;
- despliegue reproducible, comprobación del resultado y recuperación de
  la versión anterior;
- evidencia de ejecución vinculada a cada tarea.

Señale dependencias, filtros de ramas o configuraciones que deban
comprobarse en el fork. Recomiende ajustes fundamentados en los archivos
del proyecto y la documentación oficial, sin dar por ejecutados los
controles todavía pendientes.
```

## 5. Generar y revisar el PDF a partir de Markdown

```text
Genere un PDF a partir de <RUTA_DOCUMENTO_MARKDOWN> utilizando Pandoc
con XeLaTeX. Considere <DOCUMENTO_DE_REFERENCIA> para mantener un formato
consistente y respete <TAMANO_PAPEL>, <MARGENES> y <TAMANO_FUENTE>.

La conversión directa produce tablas que exceden los márgenes y muestra
los bloques Mermaid como código en lugar de diagramas. Prepare los
archivos auxiliares necesarios para resolver estos problemas y explique
su propósito:

- Un filtro Lua para Pandoc: asignar anchos a las columnas, ajustar el
  texto, permitir encabezados repetidos y mantener los títulos junto
  al contenido. El filtro también debe detectar los bloques Mermaid,
  invocar el renderizador e incorporar los PNG resultantes en el PDF,
  conservando las proporciones de las imágenes. Estos ajustes pertenecen
  a la exportación; el Markdown debe conservar su fuente editable.
- Un renderizador de PNG en Python: Pandoc no interpreta Mermaid por sí
  solo. Para los diagramas sencillos del documento, convertir los nodos
  y las conexiones a una representación equivalente con Graphviz y
  generar las imágenes. Documentar el subconjunto de sintaxis admitido
  y detener la exportación si se encuentra una construcción incompatible.
  Regenerar los PNG en cada ejecución para reflejar los cambios de la
  fuente y evitar capturas manuales desactualizadas.
- Un script de generación del PDF: reunir la comprobación de dependencias,
  la ubicación de los archivos y las opciones de Pandoc, XeLaTeX, fuentes,
  márgenes y filtro Lua en un único comando reproducible. El script debe
  iniciar la conversión; el filtro debe coordinar la generación de las
  imágenes mediante el renderizador antes de incorporarlas al PDF.

Agregue títulos en cursiva y numeración consecutiva e independiente para
tablas y figuras: títulos encima de las tablas y debajo de las figuras.
Permita que las tablas continúen en otras páginas con encabezados
repetidos, sin dejar su título separado del inicio de la tabla.

Compruebe que los enlaces, las tildes, los símbolos monetarios y el código
se representen correctamente, sin desbordamientos ni caracteres faltantes.
Revise visualmente el PDF generado y preserve el contenido del documento.

Documente los archivos auxiliares, las dependencias, las instrucciones de
uso y las limitaciones. Distinga el Markdown y los scripts editables de
los PNG y el PDF generados.
```

## 6. Representar la planificación mediante un Gantt definido por código

```text
Sustituya el diagrama de dependencias del calendario de <RUTA_ENTREGABLE>
por un Gantt definido en un archivo fuente editable y versionable.
Conserve el diagrama del proceso que explica los estados de trabajo.

Utilice las tareas, responsables y estimaciones PERT del plan para
mostrar ventanas de ejecución, esfuerzo en horas-persona, dependencias
y fechas de entrega. Use <FECHA_INICIO_ACORDADA> como supuesto de inicio.
Mejore la legibilidad con columnas para tarea, responsable y esfuerzo,
colores por grupo de trabajo, una leyenda y una escala semanal clara,
sin resaltar texto en negrita. Distinga el esfuerzo acumulado del equipo de la
duración de calendario; no convierta horas directamente a días ni
presente tareas pendientes como ejecutadas.

Actualice las fechas de trabajo considerando la disponibilidad del
equipo, las dependencias y los límites de trabajo en curso. Explique
los ajustes y conserve los hitos de entrega. Identifique las cadenas
que requieren seguimiento sin afirmar que se ha calculado una ruta
crítica cuando falta distribuir el esfuerzo y estimar las esperas.

Integre la generación del gráfico en el script del PDF, mantenga el
título y la numeración de la figura y documente cómo editar la fuente
y regenerar la imagen. Compruebe que fechas, responsables y esfuerzo
coincidan con las tablas y que el gráfico sea legible en el PDF.
```

## 7. Redondear el esfuerzo planificado a intervalos de media hora

```text
Actualice <RUTA_ENTREGABLE> y <RUTA_FUENTE_GANTT> para utilizar horas-persona
en intervalos de media hora, redondeadas hacia arriba por tarea. Conserve los valores originales
de PERT y muestre por separado el esfuerzo planificado. Aplique el redondeo
antes de sumar las tareas y explique el criterio con un ejemplo:
3,67 pasa a 4 y 4,33 pasa a 4,5; los múltiplos exactos se mantienen.
Calcule la contingencia como el porcentaje exacto del trabajo pendiente,
sin aplicar de nuevo el redondeo de tareas a esa reserva.

Actualice las etiquetas del Gantt, el presupuesto, la contingencia y el
umbral de actuación, conservando la tarifa, los porcentajes y las fechas
acordadas. Distinga el margen del redondeo de la reserva por riesgos.
Adapte los anchos de la tabla al añadir la columna de planificación,
regenere la imagen y el PDF y compruebe la coherencia de los cálculos.
```


## 8. Ajustar identificación, esfuerzo y alcance de CI

```text
Corrija el anexo de métricas para documentar el marcador de tarea que
requiere el script y su comprobación en G-01. Revise las estimaciones
con supuestos explícitos e incluya implementación, revisión, validación
y coordinación. Distribuya las horas por rol y semana sin superar cuatro
horas por integrante; sincronice calendario, Gantt y presupuesto.
Acote CI a los componentes afectados y al despliegue académico manual.
Reduzca explicaciones repetidas y use la tipografía del entregable 1.
Mantenga las cosas simples y realistas, conserve el alcance funcional
y no presente estimaciones o acuerdos pendientes como hechos ejecutados.
```
