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
