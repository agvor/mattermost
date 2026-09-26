# Evidencia del estado base — Mattermost #38480

Fecha de preparación: **26 de septiembre de 2026**
Issue: [#38480 — Collapse Details of a Mattermost Message](https://github.com/mattermost/mattermost/issues/38480)

## 1. Objetivo

Comprobar cómo Mattermost representa actualmente secciones HTML `<details>` / `<summary>` dentro de mensajes Markdown.

El issue solicita ocultar por defecto detalles extensos —por ejemplo, información de depuración o bloques de código— y permitir que el lector los expanda. También menciona `<details open>` para una sección inicialmente abierta.

La evidencia debe cubrir:

- Composición y vista previa.
- Mensaje publicado.
- Variante cerrada y variante `open`.
- Contenido con párrafos y bloques de código.
- Edición posterior del mensaje.
- Comportamiento seguro del HTML no admitido.

## 2. Base utilizada

| Elemento | Valor |
|---|---|
| Repositorio | `https://github.com/agvor/mattermost` |
| Rama | `master` |
| SHA | `53211e45b6e63e99a5cc64d1ce1b344e3b64cc51` |
| Mattermost | `12.0.0-dev` Team Edition |
| Go | `1.26.7 linux/amd64` |
| URL | `http://localhost:8065` |
| Equipo | `Evidencia base 38480` (`evidencia-38480`) |
| Canal | `Pruebas details` (`pruebas-details`) |

Para instalar dependencias, construir y ejecutar Mattermost, seguir el [setup simplificado](../../SETUP_SIMPLIFICADO_MATTERMOST.md).

Confirmar el commit:

```bash
cd "/ruta/al/repositorio/mattermost"
git rev-parse HEAD
git status --short --branch
```

Iniciar el servidor desde `mattermost/server`:

```bash
export PATH="$HOME/.local/go1.26.7/bin:$PATH"
make run-server RUN_SERVER_IN_BACKGROUND=false
```

En otra terminal, comprobar que esté listo:

```bash
curl --fail --silent --show-error http://localhost:8065/api/v4/system/ping
```

Continuar únicamente cuando la respuesta contenga `"status":"OK"`.

## 3. Crear usuarios, equipo y canal

Los comandos suponen que estas cuentas y el equipo todavía no existen. Ejecutarlos desde `mattermost/server`.

Solicitar una contraseña local sin mostrarla ni guardarla:

```bash
read -rsp "Contraseña temporal para evidencia: " MM_EVIDENCE_PASSWORD
printf "\n"
export MM_EVIDENCE_PASSWORD
```

Crear tres usuarios:

```bash
bin/mmctl user create --local \
  --email sysadmin38480@example.local \
  --username sysadmin38480 \
  --password "$MM_EVIDENCE_PASSWORD" \
  --firstname System --lastname Administrator \
  --system-admin --email-verified --disable-welcome-email

bin/mmctl user create --local \
  --email author38480@example.local \
  --username author38480 \
  --password "$MM_EVIDENCE_PASSWORD" \
  --firstname Message --lastname Author \
  --email-verified --disable-welcome-email

bin/mmctl user create --local \
  --email reader38480@example.local \
  --username reader38480 \
  --password "$MM_EVIDENCE_PASSWORD" \
  --firstname Message --lastname Reader \
  --email-verified --disable-welcome-email
```

Crear el equipo y el canal, y agregar los usuarios:

```bash
bin/mmctl team create --local \
  --name evidencia-38480 \
  --display-name "Evidencia base 38480"

bin/mmctl team users add --local evidencia-38480 \
  sysadmin38480 author38480 reader38480

bin/mmctl channel create --local \
  --team evidencia-38480 \
  --name pruebas-details \
  --display-name "Pruebas details" \
  --purpose "Estado base de Mattermost #38480"

bin/mmctl channel users add --local \
  evidencia-38480:pruebas-details \
  sysadmin38480 author38480 reader38480

unset MM_EVIDENCE_PASSWORD
```

## 4. Usuarios del escenario

| Usuario | Rol | Uso |
|---|---|---|
| `author38480` | Miembro | Redactar, previsualizar, publicar y editar |
| `reader38480` | Miembro | Comprobar lo que ve otro lector |
| `sysadmin38480` | System Admin | Preparación y comparación administrativa |

Usar datos ficticios. No incluir contraseñas, tokens, cookies ni información real de depuración en las capturas..

**Estado local verificado (26 de septiembre de 2026):** las tres cuentas, el equipo y el canal fueron creados. Las tres membresías de equipo y canal están activas como miembros ordinarios; `sysadmin38480` conserva además el rol global `system_admin`.

## 5. Mensajes de prueba

Iniciar sesión como `author38480`, entrar a **Pruebas details** y publicar cada caso por separado.

### Caso A — details cerrado por defecto

Copiar exactamente:

````text
Caso A — sección cerrada por defecto

<details>
<summary>Detalles de depuración</summary>

Texto interno que debería estar oculto inicialmente.

```text
request_id=38480
status=example
duration_ms=125
```

Fin de los detalles.
</details>
````

Antes de publicar, abrir la vista previa si está disponible y comparar el texto fuente con el resultado.

### Caso B — details inicialmente abierto

````text
Caso B — sección inicialmente abierta

<details open>
<summary>Detalles visibles al publicar</summary>

El atributo open debería mostrar este contenido inicialmente.

```text
mode=open
result=example
```

</details>
````

### Caso C — control Markdown sin HTML

````text
Caso C — control Markdown

Resumen visible.

```text
line_01=example
line_02=example
line_03=example
line_04=example
line_05=example
```
````

Este control permite distinguir el comportamiento normal de un bloque de código del comportamiento solicitado para `details`.

### Caso D — sintaxis incompleta

```text
Caso D — sintaxis incompleta

<details>
<summary>Resumen sin cierre</summary>

Contenido sin etiqueta de cierre.
```

La finalidad es observar un resultado seguro y estable, no ejecutar HTML arbitrario.

## 6. Recorrido de captura

Mantener el navegador en `1440 × 900`, zoom `100 %`, y mostrar el nombre del canal cuando sea posible.

### Como autor

1. Pegar el Caso A sin publicarlo.
2. Capturar el texto fuente en el compositor.
3. Abrir la vista previa y capturar el resultado.
4. Publicar el Caso A y capturar su estado inicial.
5. Intentar expandir y contraer el contenido.
6. Publicar el Caso B y comprobar si inicia abierto.
7. Publicar los casos C y D.
8. Editar el Caso A, cambiar el texto interno y guardar.
9. Volver a abrir o recargar el canal y comprobar el resultado.

### Como lector

1. Cerrar sesión e iniciar como `reader38480`.
2. Abrir **Pruebas details**.
3. Capturar los casos A y B en su estado inicial.
4. Intentar operar cualquier control expandible.
5. Confirmar que el bloque de código del Caso C se muestra normalmente.
6. Confirmar que el Caso D no rompe la vista ni ejecuta contenido.

## 7. Capturas sugeridas

Guardar las imágenes en `evidencia-base/issue-38480/capturas/`:

| Archivo | Contenido |
|---|---|
| `01-composer-details-source.png` | Caso A en el compositor |
| `02-preview-details.png` | Vista previa del Caso A |
| `03-published-details-closed.png` | Caso A recién publicado |
| `04-published-details-open.png` | Caso B recién publicado |
| `05-markdown-code-control.png` | Caso C publicado |
| `06-invalid-details.png` | Caso D publicado |
| `07-edited-details.png` | Caso A después de editar |
| `08-reader-view.png` | Vista de los casos A y B como lector |

No es obligatorio conservar todas si una captura demuestra varios puntos claramente. Renombrar esta lista en el README final para que coincida con los archivos reales.

## 8. Observaciones

Completar después de las capturas:

| Caso | Vista previa | Publicado | ¿Se puede expandir? | Observación |
|---|---|---|---:|---|
| A — `<details>` | Pendiente | Pendiente | Pendiente | |
| B — `<details open>` | Pendiente | Pendiente | Pendiente | |
| C — Markdown normal | Pendiente | Pendiente | No aplica | |
| D — sintaxis incompleta | Pendiente | Pendiente | Pendiente | |
| A después de editar | No aplica | Pendiente | Pendiente | |

## 9. Resultado esperado por el issue

Una implementación que satisfaga la solicitud debería:

- Mostrar el contenido de `summary` como control visible.
- Iniciar `<details>` contraído.
- Permitir expandirlo y volverlo a contraer.
- Iniciar `<details open>` expandido.
- Renderizar correctamente párrafos y bloques de código internos.
- Mantener el contenido después de editar y recargar.
- Ser operable con teclado y comunicar su estado.
- Tratar sintaxis inválida de forma segura.

## 10. Conclusión pendiente

Después de revisar la evidencia, clasificar el estado base:

- **Reproducido:** Mattermost no ofrece secciones desplegables equivalentes.
- **Parcial:** existe alguna forma de contracción, pero no cubre el comportamiento solicitado.
- **No reproducido:** los casos funcionan de forma equivalente en la base seleccionada.

Registrar la diferencia exacta entre la solicitud y el comportamiento observado, sin asumir que el HTML arbitrario deba habilitarse.

