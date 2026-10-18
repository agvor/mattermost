# Setup del ambiente de desarrollo de Mattermost en macOS

Esta guía adapta [la guía del ambiente](SETUP_MATTERMOST.md), escrita para Windows con WSL2, a macOS en Apple Silicon. Mantiene las mismas versiones y el mismo commit base, y reemplaza Docker Engine dentro de WSL por Colima, sin Docker Desktop.

## Base reproducible

| Elemento | Versión o valor |
|---|---|
| Repositorio | `https://github.com/agvor/mattermost` |
| Commit base | `53211e45b6e63e99a5cc64d1ce1b344e3b64cc51` |
| Mattermost | `12.0.0-dev` |
| Sistema | macOS 26 sobre Apple Silicon (`arm64`) |
| Docker | Colima con Docker CLI, Compose y Buildx |
| Go | `1.26.7` |
| Node.js | `24.11.1` |
| npm | `11.6.2` |
| URL local | `http://localhost:8065` |

Se requiere [Homebrew](https://brew.sh/). Se recomiendan al menos 16 GB de RAM y 40 GB libres.

## 1. Instalar Docker con Colima

```bash
brew install colima docker docker-compose docker-buildx
```

Registrar los complementos de Docker en `~/.docker/config.json`. Si el archivo ya existe, añadir la clave sin borrar las demás:

```json
{
  "cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]
}
```

Iniciar la máquina virtual y validar Docker:

```bash
colima start --cpu 6 --memory 12 --disk 80 --vm-type vz --mount-type virtiofs
docker compose version
docker run --rm hello-world
```

## 2. Instalar Go 1.26.7

Descargar el archivo oficial, verificar su SHA-256 con el publicado en [go.dev/dl](https://go.dev/dl/) e instalarlo bajo el usuario, como en la guía de WSL:

```bash
curl -fLO https://dl.google.com/go/go1.26.7.darwin-arm64.tar.gz
shasum -a 256 go1.26.7.darwin-arm64.tar.gz   # Comparar con el valor de go.dev/dl
mkdir -p "$HOME/.local/go1.26.7"
tar -C "$HOME/.local/go1.26.7" --strip-components=1 -xzf go1.26.7.darwin-arm64.tar.gz
export PATH="$HOME/.local/go1.26.7/bin:$PATH"
go version   # go version go1.26.7 darwin/arm64
```

Si el equipo está administrado y bloquea `proxy.golang.org`, configurar el proxy de módulos autorizado por la organización. No desactivar `GOSUMDB`: la verificación con `sum.golang.org` debe seguir activa.

```bash
go env -w GOPROXY=https://<proxy-autorizado>,direct
go env GOPROXY GOSUMDB
```

## 3. Instalar Node.js 24.11.1

Se usa `fnm`, que lee el `.nvmrc` del repositorio:

```bash
brew install fnm
fnm install 24.11.1
```

Añadir a `~/.zshrc` para que cada terminal cargue Go y cambie de versión de Node al entrar al repositorio:

```bash
export PATH="$HOME/.local/go1.26.7/bin:$PATH"
eval "$(fnm env --use-on-cd --version-file-strategy=recursive --shell zsh)"
```

Validar en una terminal nueva, dentro del repositorio: `node --version` debe mostrar `v24.11.1` y `npm --version`, `11.6.2`.

## 4. Verificar los puertos

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN
lsof -nP -iTCP:8065 -sTCP:LISTEN
```

Ambos comandos deben terminar sin resultados. Si existe un PostgreSQL local en ejecución, detenerlo de forma reversible, por ejemplo con `brew services stop postgresql`.

## 5. Construir y ejecutar

Construir el frontend instalando las dependencias según el archivo bloqueado:

```bash
cd webapp
npm ci
npm run build   # Debe terminar con «Web app built!»
```

Iniciar el servidor desde `server/`, conservando la terminal:

```bash
make run-server RUN_SERVER_IN_BACKGROUND=false
```

Esperar a ver `Server is listening on [::]:8065` y comprobar desde otra terminal:

```bash
curl --fail --silent --show-error http://localhost:8065/api/v4/system/ping
```

La respuesta debe contener `"status":"OK"`.

## 6. Ejecutar las pruebas

Las pruebas del servidor deben ejecutarse con `TZ=UTC`, porque algunas comparan fechas y fallan cerca de la medianoche local. Las de la webapp ya fijan `TZ=Etc/UTC`.

```bash
# Desde server/
TZ=UTC go test ./channels/api4 -run '^(TestGetTeamMembers|TestGetUsersInTeam|TestSearchUsers)$' -count=1
TZ=UTC go test ./channels/store/sqlstore -run '^TestUserStore$' -count=1

# Desde webapp/
npm run check-types
npm run check
npm run test --workspaces --if-present -- --ci
```

`--ci` evita escribir o actualizar *snapshots*. Una prueba que falle solo con ejecución paralela se repite de forma aislada antes de registrarla.

## 7. Detener el ambiente

```bash
cd server
make stop-server
make stop-docker
colima stop
```

## Solución rápida de problemas

- **`proxy.golang.org: connection refused` o resolución a `::1`:** el equipo bloquea el proxy público. Ver el paso 2.
- **`docker: 'compose' is not a docker command`:** falta `cliPluginsExtraDirs` en `~/.docker/config.json`.
- **`Cannot connect to the Docker daemon`:** ejecutar `colima start`.

## Lista de verificación

- [ ] `docker run --rm hello-world` funciona.
- [ ] `go version` muestra `go1.26.7 darwin/arm64`.
- [ ] Node.js muestra `v24.11.1` y npm `11.6.2`.
- [ ] Los puertos `5432` y `8065` están libres antes del arranque.
- [ ] El build web termina con «Web app built!».
- [ ] El ping de Mattermost contiene `"status":"OK"`.

## Referencias

- [Mattermost: Developer setup](https://developers.mattermost.com/contribute/developer-setup/)
- [Colima](https://github.com/abiosoft/colima)
- [Go: descargas oficiales](https://go.dev/dl/) y [proxy de módulos](https://go.dev/ref/mod#module-proxy)
- [fnm](https://github.com/Schniz/fnm)
