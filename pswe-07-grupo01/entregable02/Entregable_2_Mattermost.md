# Entregable 2: Proceso y plan de ejecución de mejoras en Mattermost

**Universidad CENFOTEC, Maestría Profesional en Ingeniería del Software**\
**Curso:** PSWE-07, Procesos y Administración de Software, C3 2026\
**Docente:** Shirley Ramírez Cordero\
**Grupo:** Grupo 01\
**Integrantes:** Alexander Gatica (`agvor`), José Cisneros (`megachivo`) y Juan Ignacio González (`J-IgnacioGC`)\
**Entrega prevista:** 9 de noviembre de 2026\
**Actualización:** 5 de octubre de 2026

## 1. Contexto y alcance

Este documento complementa el [entregable 1](https://github.com/agvor/mattermost/blob/master/pswe-07-grupo01/entregable01/Entregable_1_Mattermost.md) y detalla las tareas, los responsables, el flujo de desarrollo, las prácticas de integración y entrega (CI/CD) y las métricas del proyecto. El propósito se mantiene: implementar dos mejoras de Mattermost y evaluar el proceso de trabajo del equipo con evidencia [1, 2].

El incremento 1 corresponde a **#37406: identificación y filtro de Team Admins**. El incremento 2 corresponde a **#38480: secciones desplegables en mensajes web**. Para el segundo avance se prevé completar el incremento 1 y realizar su retrospectiva. El equipo seleccionará una mejora de proceso para aplicarla y medirla en el incremento 2.

La base funcional es Mattermost Team Edition `12.0.0-dev`, commit `53211e45b6e63e99a5cc64d1ce1b344e3b64cc51`, en el [fork del grupo](https://github.com/agvor/mattermost). Se conservan la [guía de ambiente](https://github.com/agvor/mattermost/blob/master/pswe-07-grupo01/SETUP_MATTERMOST.md), la evidencia inicial de [#37406](https://github.com/agvor/mattermost/blob/master/pswe-07-grupo01/evidencia-base/issue-37406/README.md) y [#38480](https://github.com/agvor/mattermost/blob/master/pswe-07-grupo01/evidencia-base/issue-38480/README.md), y los criterios TA-01 a TA-03, DT-01 a DT-04 y RG-01 del primer avance.

Se mantienen las exclusiones del primer entregable: clientes móviles nativos, rediseño de la System Console, nuevos roles o permisos, directorios entre equipos, secciones anidadas, adjuntos de las secciones, persistencia del estado abierto o cerrado y reproducción completa del Markdown de GitHub. La entrega académica no depende de que Mattermost acepte los cambios en su repositorio oficial.

**Estado del documento.** Al 5 de octubre están documentados la base funcional y el plan. El tablero, la implementación y los resultados de ejecución siguen pendientes. Esta versión es preparatoria; para la entrega del 9 de noviembre deberá incorporar el avance realizado, sus dificultades y ajustes, el análisis de riesgos y costos, la arquitectura actualizada y la coevaluación [1].

## 2. Historias, tareas y responsables

El trabajo pendiente (*backlog*) se organiza en tres grupos: **G**, preparación y seguimiento; **TA**, incremento 1; y **DT**, incremento 2. Las historias describen el resultado esperado y las tareas dividen el trabajo para asignarlo, ejecutarlo y medirlo. Los identificadores de las tablas son códigos del plan. Los números de las incidencias (*Issues*) se añadirán al crearlas en el fork.

Cada tarea tendrá un **responsable**, que realiza el trabajo y corrige las devoluciones; un **revisor**, que comprueba y aprueba el cambio; y un **validador**, que prueba el resultado según los criterios de aceptación. Los tres roles se asignan a personas distintas. Cualquier cambio de asignación se registrará en la Issue.

Los códigos TA y DT también se usan para los criterios de aceptación del entregable 1. En este documento, las tablas identifican tareas y las historias indican los criterios que deben cumplirse.

### 2.1. Tareas generales: documentación y CI/CD

**Propósito.** Preparar la documentación, el tablero, el registro de métricas y el flujo de integración y entrega. Alexander coordinará la documentación inicial y la configuración de CI/CD; José revisará esos cambios y Juan Ignacio comprobará su funcionamiento.

| ID | Tarea y aceptación verificable | Responsable | Revisor | Validador | Depende de |
|---|---|---|---|---|---|
| G-01 | **Documentar el proceso y el ambiente.** Reunir el alcance, los roles, el flujo, los comandos de ejecución y las condiciones de cierre. Reproducir la base siguiendo la guía y verificar la coherencia con la consigna. | Alexander | José | Juan Ignacio | Base del entregable 1 |
| G-02 | **Configurar GitHub Projects y cargar el backlog.** Crear historias, tareas, campos y vistas. Comprobar el acceso de los tres integrantes y mover una tarea de prueba, registrando sus eventos y conservando su asignación. | Alexander | José | Juan Ignacio | G-01 |
| G-03 | **Configurar ramas y CI.** Definir los requisitos de integración en `master` y configurar Actions para los PR y los cambios integrados. Comprobar los controles y artefactos con un PR exitoso y otro con un fallo controlado. | Alexander | José | Juan Ignacio | G-02 |
| G-04 | **Configurar la entrega al ambiente académico.** Documentar cómo construir u obtener el artefacto, desplegarlo manualmente y recuperar la versión anterior. Ejecutar la guía, comprobar que el servidor responde y confirmar el SHA desplegado. | Alexander | José | Juan Ignacio | G-03 |
| G-05 | **Preparar el registro de métricas.** Definir los comentarios de eventos y el archivo CSV. Comprobar los cálculos con una tarea de prueba que incluya una devolución y un bloqueo; excluir esos datos del reporte real. | Juan Ignacio | José | Alexander | G-02 |
| G-06 | **Evaluar el incremento 1.** Reunir las métricas, analizar las esperas y realizar la retrospectiva. Registrar una mejora de proceso, su responsable y el indicador esperado para el incremento 2. José reproduce los cálculos. | Juan Ignacio | Alexander | José | TA-05, G-05 |
| G-07 | **Consolidar el segundo avance.** Actualizar la arquitectura en Mermaid, el plan, las dificultades y la evidencia. Incorporar riesgos y costos, comprobar enlaces y versiones, y acordar la coevaluación entre los tres. | Alexander | José | Juan Ignacio | G-06 |

G-01 y G-02 tendrán revisión y validación manual mientras se configura CI. A partir de G-03 se aplicarán los controles automáticos correspondientes. La configuración de integración y entrega se comprobará primero con la base funcional y luego con la versión del incremento 1.

### 2.2. Historia TA: descubrir administradores del equipo (#37406)

**Como miembro de un equipo, quiero identificar y filtrar sus Team Admins para saber a quién acudir sin necesitar acceso a la System Console.** La historia se aceptará cuando la etiqueta y el filtro reflejen la membresía real, funcionen con la búsqueda y la paginación y respeten los permisos. Debe cumplir los criterios TA-01 a TA-03 y conservar el comportamiento de las listas existentes, según RG-01.

| ID | Tarea y aceptación verificable | Responsable | Revisor | Validador | Depende de |
|---|---|---|---|---|---|
| TA-01 | **Definir la interacción y los casos de prueba.** Especificar la etiqueta, el filtro, la búsqueda, la paginación y los resultados vacíos. Localizar los componentes y la API, acordar dónde se filtra y documentar ejemplos por rol. | José | Alexander | Juan Ignacio | G-01 |
| TA-02 | **Implementar la consulta de administradores.** Reutilizar o ajustar la API y la lógica de membresías para encontrar a todos los administradores con búsqueda y paginación. Incluir pruebas de consulta y permisos; documentar si basta la API existente. | Alexander | José | Juan Ignacio | TA-01, G-03, G-05 |
| TA-03 | **Implementar la etiqueta de Team Admin.** Mostrarla según el rol real en el equipo. Probar los casos de administrador y miembro, incluido un System Admin que no sea Team Admin del equipo consultado. | Alexander | José | Juan Ignacio | TA-02 |
| TA-04 | **Implementar el filtro en la lista web.** Combinarlo con la búsqueda, reiniciar la paginación al cambiar el filtro y mostrar los resultados vacíos. Agregar pruebas de componentes y regresión de la lista sin filtro. | Alexander | José | Juan Ignacio | TA-03 |
| TA-05 | **Validar el incremento y guardar evidencia.** Comprobar los roles, los administradores en páginas posteriores, la búsqueda y la regresión. Añadir pruebas de extremo a extremo (E2E) y capturas comparables del antes y el después, con sus versiones identificadas. José reproduce el recorrido. | Juan Ignacio | Alexander | José | TA-04, G-04 |

Los defectos encontrados al validar TA-02 a TA-04 se corregirán en su tarea de origen. TA-05 comprobará el incremento completo; sus cambios en pruebas y evidencia también tendrán revisión y validación.

### 2.3. Historia DT: contraer contenido de mensajes (#38480)

**Como persona que publica o lee información extensa, quiero una sección con resumen visible y contenido desplegable para consultar detalles sin desplazar toda la conversación.** La historia incluirá secciones no anidadas con párrafos y código. Debe funcionar de forma consistente en la vista previa, la publicación y la edición, admitir el uso del teclado y producir una salida segura, según los criterios DT-01 a DT-04 y RG-01.

| ID | Tarea y aceptación verificable | Responsable | Revisor | Validador | Depende de |
|---|---|---|---|---|---|
| DT-01 | **Definir la sintaxis y el comportamiento.** Localizar el analizador y los renderizadores. Acordar ejemplos válidos, incompletos y no admitidos, el estado inicial, la variante `open`, el teclado y el foco. Aplicar la mejora de proceso de G-06. | José | Juan Ignacio | Alexander | G-06 |
| DT-02 | **Implementar el análisis seguro de la sección.** Reconocer el resumen y el cuerpo sin habilitar HTML arbitrario. Incluir pruebas con sintaxis inválida, secciones anidadas no admitidas y entradas maliciosas. | José | Juan Ignacio | Alexander | DT-01 |
| DT-03 | **Implementar el componente desplegable.** Conservar el resumen al abrir y cerrar, representar párrafos y código, y verificar el teclado, el foco y el estado accesible. Probar la variante `open` acordada. | José | Juan Ignacio | Alexander | DT-02 |
| DT-04 | **Integrar los tres recorridos del mensaje.** Aplicar el comportamiento en la vista previa, la publicación y la edición. Agregar pruebas de consistencia y regresión de mensajes ordinarios. | José | Juan Ignacio | Alexander | DT-03 |
| DT-05 | **Validar el incremento y guardar evidencia.** Incorporar pruebas E2E, comprobar los casos funcionales, la accesibilidad y la salida segura, y capturar el antes y el después. Alexander reproduce los casos en la versión integrada. | Juan Ignacio | José | Alexander | DT-04 |

Cada tarea incluirá las pruebas pertinentes a sus cambios. TA-05 y DT-05 comprobarán el resultado conjunto de cada incremento. Una historia se cerrará cuando todas sus tareas estén entregadas y se hayan cumplido sus criterios de aceptación.

## 3. Asignación y ejecución en GitHub Projects

### 3.1. Organización de las Issues

El tablero se llamará **PSWE-07 Grupo 01: Ejecución**. Tendrá tres Issues principales en el fork: preparación y seguimiento, historia TA e historia DT. Cada tarea de las tablas se registrará como una subincidencia (*sub-issue*) de GitHub [3]. Las historias TA y DT enlazarán las incidencias originales de Mattermost. Las Issues principales servirán para consultar el progreso; la medición se realizará sobre sus tareas.

Alexander cargará las Issues en G-02. Cada tarea tendrá una sola persona asignada en **Assignee**, según la tabla. Los campos **Revisor** y **Validador** permitirán seleccionar a Alexander, José o Juan Ignacio; **Grupo** permitirá elegir G, TA o DT [4]. También se registrarán el estado, la fecha objetivo, la estimación y el esfuerzo real en horas-persona. La descripción incluirá los criterios de aceptación, las dependencias y los enlaces al *pull request* (PR) y a la evidencia.

La vista **Flujo** mostrará las tareas agrupadas por estado. La vista **Plan** incluirá historias, tareas, responsables y fechas. Cada PR se enlazará en su tarea para evitar duplicar tarjetas. El responsable conservará la asignación durante la revisión y la validación; al pasar el trabajo a otro rol, mencionará a la persona correspondiente en un comentario.

### 3.2. Estados y responsables de cada transición

| Estado de destino | Quién mueve la tarjeta | Condición y evento registrado |
|---|---|---|
| Pendiente | Alexander al cargar el backlog | La tarea tiene sus roles asignados, pero aún no se ha acordado su inicio. |
| Lista para iniciar | Responsable, de acuerdo con revisor y validador | El alcance y la aceptación están claros, las dependencias están entregadas y la estimación está acordada. Registrar `aceptada`. |
| Implementación | Responsable | Inicia el trabajo y crea una rama breve. Registrar `inicio`. |
| Revisión | Responsable | Presenta el resultado y el PR, con las pruebas pertinentes ejecutadas. Solicita la revisión y registra `solicitud_revision`. |
| Validación | Revisor | Registra `inicio_revision` al comenzar la revisión efectiva. Después de aprobar el cambio y comprobar CI, mueve la tarjeta y registra `solicitud_validacion`. |
| Entregada | Validador | Registra `inicio_validacion` y su resultado. Si acepta, el responsable integra el cambio; el validador comprueba la versión integrada, registra `entregada` y cierra la Issue. |

Las condiciones de **Lista para iniciar** corresponden a la *Definition of Ready* del primer entregable. Una tarea cumple la *Definition of Done* al contar con revisión aprobada, pruebas pertinentes exitosas, evidencia vinculada, documentación actualizada y comprobación de la versión integrada.

**Trabajo en curso (WIP).** Se permitirá como máximo una tarea en Implementación, una en Revisión y una en Validación. El equipo priorizará terminar el trabajo iniciado. Una dependencia se considerará resuelta cuando la tarea previa esté Entregada, aunque el calendario indique una fecha de inicio anterior.

Si la revisión o la validación requieren correcciones, se registrará `devolucion_revision` o `devolucion_validacion`, con el motivo y la evidencia. La tarjeta volverá a Implementación respetando el límite de WIP y conservará su historial y la fecha de aceptación inicial. Si una tarea se bloquea, mantendrá su estado y contará dentro del límite; se registrarán el inicio y el fin del bloqueo y quién debe resolverlo.

El cierre será manual, después de comprobar la versión integrada. Se evitará el cierre automático desde los PR y se desactivarán las automatizaciones que adelanten el estado Entregada [5]. **El enlace al tablero y los números de las Issues están pendientes de configuración.**

### 3.3. Registro mínimo para medir

Quien realiza una transición deja un comentario en la Issue con este formato:

```text
evento: solicitud_revision
fecha: AAAA-MM-DDTHH:MM:SS-06:00
actor: agvor
desde: Implementación
hacia: Revisión
evidencia: <URL del PR sobre el SHA revisado>
resultado: <aceptada o rechazada, cuando corresponda>
motivo: <devolución o bloqueo, cuando corresponda>
```

Juan Ignacio reunirá semanalmente los eventos en un archivo CSV con tarea, grupo, evento, fecha, actor, resultado y evidencia. En cada sesión de trabajo se registrarán también la persona, la actividad y los minutos efectivos. Los tiempos se calcularán a partir de los eventos; el tablero mostrará el estado actual. Cada cambio de estado deberá tener su comentario, incluidas las tareas iniciales. Se registrarán las fechas reales de ejecución.

## 4. CI/CD, revisión y pruebas

La rama de integración será **`master` del fork del grupo**. Cada tarea partirá de su versión actual y usará una rama breve con el prefijo **`pswe07/`** y su identificador, por ejemplo, `pswe07/G-03`, `pswe07/TA-02` o `pswe07/DT-03`. Se registrará el SHA de partida para relacionar el cambio con la base documentada.

Los PR se dirigirán a `master` del mismo fork, seguirán la plantilla del repositorio y enlazarán la tarea, sus criterios, las pruebas y la evidencia. La integración requerirá revisión aprobada, controles exitosos y validación del resultado. Después se comprobará la versión integrada y se eliminará la rama de la tarea. Los enlaces al PR y a sus commits permanecerán en la Issue.

En G-03 se adaptarán los flujos existentes de [webapp](https://github.com/agvor/mattermost/blob/master/.github/workflows/webapp-ci.yml) y [servidor](https://github.com/agvor/mattermost/blob/master/.github/workflows/server-ci.yml) al fork. Se comprobarán los filtros de ejecución, los servicios y las dependencias de secretos. CI se ejecutará en los PR dirigidos a `master` y al integrar los cambios en esa rama. Los reportes conservarán el SHA de la versión comprobada.

| Tipo de cambio | Verificación mínima |
|---|---|
| Documentación y proceso | Coherencia con la consigna, enlaces válidos y reproducción de las instrucciones por el validador. |
| Web | Instalación según el archivo de dependencias bloqueadas, lint, tipos, pruebas unitarias y de componentes, y compilación. Regresión de los componentes compartidos. |
| Servidor y API | Formato y controles de Go, pruebas de consulta y permisos, integración con PostgreSQL cuando corresponda y compilación. |
| Incremento completo | Pruebas E2E y validación por roles o recorridos del mensaje. Evidencia funcional y compilación de web y servidor sobre la misma versión. |

Un control fallido impedirá integrar el cambio. Una ejecución omitida no contará como prueba realizada. Los fallos y las devoluciones se corregirán en la misma tarea; si hay cambios relevantes después de la aprobación, se revisará y validará de nuevo el SHA actualizado.

La entrega usará artefactos identificados por SHA y **despliegue manual al ambiente académico**. G-04 documentará el despliegue, la comprobación de respuesta del servidor, la prueba funcional y la recuperación de la última versión validada. Juan Ignacio probará las instrucciones y José revisará la configuración de Alexander. Las pruebas y los reportes se vincularán a la tarea y se conservarán hasta la defensa.

## 5. Calendario y seguimiento

La capacidad prevista se mantiene en **4 horas semanales por integrante, 12 horas-persona para el equipo**. Las fechas de la tabla son objetivos de trabajo. Cada tarea se estimará por consenso antes de pasar a Lista para iniciar. Si el esfuerzo supera la capacidad, el equipo dividirá las tareas o ajustará las fechas de trabajo y el alcance dentro de las exclusiones acordadas, sin eliminar revisiones ni pruebas [2].

| Periodo de 2026 | Tareas e hitos |
|---|---|
| Del 5 al 11 de octubre | G-01 y G-02: documentación inicial y tablero. |
| Del 12 al 18 de octubre | G-03 a G-05 y TA-01: CI/CD, medición y definición de la mejora. |
| Del 19 al 25 de octubre | TA-02 y TA-03: consulta e identificación visual. |
| Del 26 de octubre al 1 de noviembre | TA-04 y TA-05: filtro y comprobación integral. |
| Del 2 al 8 de noviembre | G-06 y G-07: métricas, retrospectiva, arquitectura y segundo avance. |
| 9 de noviembre | Entregable 2. |
| Del 16 al 22 de noviembre | DT-01 a DT-05: segundo incremento con el proceso ajustado. |
| Del 23 al 29 de noviembre | Regresión final, comparación de métricas y documentación del cierre. |
| 30 de noviembre | Entrega y demostración final. |

Las fechas de entrega corresponden al calendario del primer avance. Las tareas de una misma semana se ejecutarán respetando sus dependencias y los límites de WIP. En una revisión semanal de 20 a 30 minutos, el equipo registrará el avance, las dificultades, las decisiones y los cambios de asignación o calendario. Las tareas del cierre final se detallarán después de G-06 y seguirán el mismo flujo.

## 6. Métricas del proceso

Las métricas se calcularán sobre las **tareas TA y DT**, por incremento y tipo de trabajo: definición, implementación o validación integral. La comparación principal usará las tareas de implementación TA-02 a TA-04 y DT-02 a DT-04. Las tareas G se reportarán aparte. Se excluirán las Issues principales, los PR y las tareas de prueba de configuración para evitar duplicar resultados o mezclar preparación con desarrollo.

| Métrica | Fuente y cálculo | Meta inicial |
|---|---|---|
| *Lead time* | Tiempo desde `aceptada` hasta `entregada`, incluidas las esperas, los bloqueos y las devoluciones. Se reporta la mediana por incremento. | Mediana de 5 días hábiles o menos. |
| Espera de revisión | Tiempo desde la primera `solicitud_revision` hasta el primer `inicio_revision` que corresponda a una revisión efectiva. | Al menos el 80 % de las tareas en 2 días hábiles o menos. |
| Aceptación sin retrabajo (%CA) | `100 × tareas aceptadas en la primera validación / tareas con primera validación concluida`. El validador registra el resultado; una devolución cuenta como rechazo inicial. | 80 % o más. |

Las fechas y horas se registrarán en formato ISO 8601, con la zona `America/Costa_Rica` (UTC-06:00). Para evaluar las metas se contará el tiempo de lunes a viernes, excluyendo los fines de semana; cada 24 horas acumuladas en esos días equivaldrá a un día hábil. El esfuerzo efectivo se registrará aparte, según las sesiones de trabajo.

Juan Ignacio reportará los valores por tarea, el número de tareas medidas y los denominadores de los porcentajes. También incluirá las tareas abiertas con su antigüedad o espera acumulada. Las devoluciones no reiniciarán la medición; se conservará la fecha de primera entrega y se registrarán las reaperturas por separado. **Aún no hay datos de ejecución de las tareas de este plan.**

En G-06, el equipo usará los registros para representar el flujo observado, identificar las esperas y seleccionar una mejora medible. El incremento 2 mantendrá las mismas definiciones. La comparación considerará las diferencias técnicas y el tamaño reducido de la muestra, sin atribuir causalidad cuando falte evidencia.

## 7. Evidencia, arquitectura y estado del avance

La evidencia disponible comprende el entregable 1, la guía del ambiente y las capturas del comportamiento inicial. El tablero, los PR de las mejoras, los reportes de CI y las mediciones se incorporarán conforme se ejecuten las tareas.

Cada tarea vinculará la historia, los criterios de aceptación, el PR y sus commits, la revisión, los controles de CI, la validación y la entrega. Las capturas indicarán el SHA, el rol de usuario, los pasos y el resultado. Las dificultades y los ajustes se registrarán en la Issue y se resumirán en el seguimiento semanal. Una comprobación prevista en G-03 es determinar si los flujos originales dependen de secretos o condiciones que requieran adaptación en el fork.

En G-07 se revisará el [C4 de contexto](https://github.com/agvor/mattermost/blob/master/pswe-07-grupo01/entregable01/arquitectura-c4-contexto.mmd) y se añadirá la vista necesaria para explicar los componentes modificados de la lista de miembros y la API. Los diagramas incluirán su fuente Mermaid y una representación visual. Los cambios del analizador y los renderizadores se documentarán al desarrollar el incremento 2. **La arquitectura de la implementación está pendiente.**

## 8. Riesgos

El análisis de riesgos está pendiente. Se completará antes del segundo avance, con base en el contenido de clase y los riesgos iniciales del entregable 1. Incluirá responsables, condiciones de activación y acciones de respuesta.

## 9. Costos

El modelo de costos está pendiente. Se completará antes del segundo avance con el enfoque abordado en clase y las estimaciones y horas-persona registradas por el equipo.

## 10. Coevaluación

Las notas y las justificaciones se acordarán entre los tres integrantes según los aportes realizados y se completarán para la entrega del segundo avance.

| Integrante | Nota sugerida | Aporte y justificación |
|---|---|---|
| Alexander Gatica (`agvor`) | Pendiente | Pendiente. |
| José Cisneros (`megachivo`) | Pendiente | Pendiente. |
| Juan Ignacio González (`J-IgnacioGC`) | Pendiente | Pendiente. |

## 11. Referencias y uso de IA

1. Ramírez Cordero, S. *Consigna general de entregables 1, 2 y final del proyecto del curso*. CENFOTEC, C3 2026, pp. 1 a 2 y 6 a 7.
2. Ramírez Cordero, S. *Fundamentos de procesos*; *Modelado de procesos, VSM, evaluación y medición*; *Enfoques de gestión de proyectos de tecnología*; *Planificación y estimación de proyectos de software*. Presentaciones del curso, C3 2026.
3. GitHub Docs. [Adding sub-issues](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues).
4. GitHub Docs. [About single select fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-single-select-fields).
5. GitHub Docs. [Using the built-in automations](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations).
6. Grupo 01. Entregable 1, guía del ambiente y evidencia base; Mattermost, workflows del repositorio.

**Uso de IA.** Codex se consultó como apoyo para revisar la planificación, la descomposición de tareas y la coherencia del flujo de trabajo y de CI/CD. Las sugerencias se contrastaron con la consigna, el primer entregable, el repositorio y la documentación oficial. El [registro de prompts](https://github.com/agvor/mattermost/blob/master/pswe-07-grupo01/entregable02/PROMPTS_USO_IA.md) reúne consultas generales y representativas en formato reutilizable. El equipo conserva la responsabilidad sobre las decisiones, la elaboración de los artefactos y la validación de los resultados.
