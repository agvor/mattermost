# G-02: CI y despliegue manual

Tarea: [G-02 / #7](https://github.com/agvor/mattermost/issues/7).

## Controles

`PSWE-07 CI` se ejecuta en PR a `master`, al integrar y manualmente. Reutiliza
los comandos de los flujos originales con runners públicos, sin secretos de
Mattermost. Ejecuta las pruebas de métricas siempre y selecciona por rutas:

| Componente | Controles |
|---|---|
| Web | `npm ci`, lint, tipos, pruebas de todos los workspaces y compilación. Incluye regresión de componentes compartidos. |
| Servidor | Formato, `go vet` de API/app/store, pruebas de miembros y roles de equipos, búsquedas de usuarios y consultas de equipos con PostgreSQL; compilación Linux amd64. |

La selección de pruebas Go cubre el alcance actual de TA. Al modificar otros
paquetes o añadir casos, ampliar la selección del flujo en el mismo PR.
La ejecución manual y los cambios al flujo verifican ambos componentes y sirven
para comprobar la base. Los cambios solo de documentación no ejecutan builds.
Los recorridos E2E y las comprobaciones por rol se validan en cada incremento.

El control final **`PSWE-07 / requerido`** falla ante errores o cancelaciones de
los jobs necesarios. Un componente sin cambios aparece omitido; eso no acredita
haberlo probado. Los artefactos web y servidor incluyen `PSWE07_SHA`, conservan
los permisos de los binarios mediante tar y se retienen 90 días.

## Activar en GitHub

Después de publicar la rama y abrir su PR:

1. Habilitar Actions en el fork y permitir las acciones oficiales `actions/*`.
   En Actions, deshabilitar los flujos originales **Web App CI** y **Server CI**
   para evitar duplicación y dependencias de infraestructura del upstream.
2. Ejecutar `PSWE-07 CI` en el PR. En Settings → Branches, proteger `master`:
   exigir PR, una aprobación, descartar aprobaciones tras nuevos commits,
   resolver conversaciones, exigir rama actualizada y el control
   **`PSWE-07 / requerido`**. Aplicar también a administradores y bloquear
   force push y eliminación. No exigir los checks del upstream.
3. Si GitHub no permite protección por el plan o visibilidad del repositorio,
   registrar la limitación en G-02; la revisión manual no acredita un bloqueo
   automático. Comprobar que un PR con CI fallido no se puede integrar.
4. En Settings → Actions, permitir retención de 90 días. Descargar la evidencia
   antes de su vencimiento y conservarla hasta la defensa.

## Métricas

Se reutiliza `PSWE-07 · Proceso y métricas`: eventos de incidencias, ejecución
manual, calendario semanal y cambios al script o a su configuración en `master`.
Configurar estas variables y el secreto en Settings → Secrets and variables → Actions:

| Nombre | Valor |
|---|---|
| Variable `PSWE07_PROJECT_OWNER` | `agvor` |
| Variable `PSWE07_PROJECT_NUMBER` | Número del tablero del grupo |
| Secreto `PSWE07_PROJECT_TOKEN` | Token con acceso de lectura y escritura al Project del grupo |
| Variable opcional `PSWE07_EXCLUDED_EVENTS` | Exclusiones justificadas conforme al anexo A del entregable 2 |

Ejecutar el flujo manualmente en `master`. Confirmar el resumen, el artefacto
`pswe07-metricas-*`, `metricas.csv`, `resumen.json` y la sincronización del tablero.
No guardar el token en el repositorio ni en capturas.

## Despliegue académico (WSL/Linux amd64)

Requisito: ambiente y base de datos preparados según
[SETUP_MATTERMOST.md](../SETUP_MATTERMOST.md). Usar un checkout limpio dedicado
al ambiente. Ejecutar desde la raíz de `mattermost`. Desplegar una ejecución
exitosa de **push a master** o manual sobre ese commit; los SHA de PR pueden ser
commits de integración temporales y no se usan como versión entregada.

Detener primero el servidor con `Ctrl+C`. Registrar el SHA de la versión que
estaba funcionando y conservar sus dos archivos tar descargados de Actions.
Respaldar `server/config/config.json` y `server/data` fuera de Git antes de cambiar
la versión. Para cambios de servidor, respaldar también PostgreSQL con `pg_dump`
del contenedor y la base indicados por `docker ps` y la configuración del ambiente:

```bash
docker exec CONTENEDOR_POSTGRES pg_dump -U mmuser -Fc mattermost_test > /tmp/mattermost-anterior.dump
test -s /tmp/mattermost-anterior.dump
```

Sustituir SHA y RUN_ID por el commit integrado y su ejecución exitosa. La primera
vez ejecutar manualmente el flujo sobre ese commit para obtener ambos artefactos.
Para un cambio solo web se puede reutilizar el servidor validado anterior,
registrando ambos SHA y comprobando que `server/` no cambió entre versiones.

```bash
SHA=SHA_COMPLETO_VALIDADO
RUN_ID=NUMERO_DE_EJECUCION_EXITOSA
git status --short  # Debe estar limpio.
git fetch origin master
git switch --detach "$SHA"
mkdir -p "/tmp/pswe07-$SHA/web" "/tmp/pswe07-$SHA/servidor"
gh run download "$RUN_ID" -R agvor/mattermost \
  -n "pswe07-web-$SHA" -D "/tmp/pswe07-$SHA/web"
gh run download "$RUN_ID" -R agvor/mattermost \
  -n "pswe07-servidor-$SHA" -D "/tmp/pswe07-$SHA/servidor"
# Conservar el dist anterior fuera del destino para evitar mezclar archivos.
if [ -d webapp/channels/dist ]; then
  mv webapp/channels/dist "/tmp/pswe07-dist-anterior-$(date +%s)"
fi
mkdir -p webapp/channels/dist server/bin
tar -xzf "/tmp/pswe07-$SHA/web/pswe07-web.tar.gz" -C webapp/channels/dist
tar -xzf "/tmp/pswe07-$SHA/servidor/pswe07-servidor.tar.gz" -C server/bin
test "$(cat webapp/channels/dist/PSWE07_SHA)" = "$SHA"
test "$(cat server/bin/PSWE07_SHA)" = "$SHA"
make -C server start-docker client
cd server
./bin/mattermost
```

En otra terminal, guardar el resultado de estas comprobaciones:

```bash
curl --fail --silent --show-error http://localhost:8065/api/v4/system/ping
curl --fail --silent --show-error http://localhost:8065/static/PSWE07_SHA
```

El ping debe contener `"status":"OK"` y el segundo comando debe devolver el SHA
de la web. Confirmar el SHA del servidor con `server/bin/mattermost version`.
En el navegador, iniciar sesión, abrir un equipo, consultar sus miembros y
enviar un mensaje. Registrar resultado, fecha, rol y SHA. El ping por sí solo
no acredita el recorrido funcional.

## Recuperación

Detener el servidor. Repetir el despliegue con el SHA y RUN_ID de la última
versión validada, usando los tar conservados. Restaurar la configuración y los
archivos respaldados si cambiaron. G-02 no modifica el esquema de datos.
Si una versión posterior incluye migraciones incompatibles, restaurar también
el respaldo previo con el servidor detenido, antes de arrancar la versión anterior:

```bash
docker exec -i CONTENEDOR_POSTGRES pg_restore -U mmuser \
  --clean --if-exists --no-owner -d mattermost_test < /tmp/mattermost-anterior.dump
```

Repetir ping, verificación de SHA y recorrido funcional. Registrar la recuperación.

## Evidencia para aceptar G-02

Añadir a la incidencia los enlaces y resultados reales:

- PR, aprobación de José y ejecución exitosa de CI con su SHA.
- Ejecución manual del mismo SHA con `fallo_controlado=true`: el control final
  debe fallar. Conservar el enlace y comprobar el bloqueo de un PR fallido.
- Configuración de protección de `master` y ejecución de métricas con el reporte.
- Ejecución exitosa del commit integrado, tar descargados, despliegue y
  recuperación comprobados por Juan Ignacio, con fecha, SHA, ping y recorrido.

La implementación local no acredita estas ejecuciones. G-02 permanece abierta
hasta reunir la evidencia y validar la versión integrada.
