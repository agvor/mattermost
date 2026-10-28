# TA-01: Solución y casos de aceptación

Tarea [#10](https://github.com/agvor/mattermost/issues/10) de la historia [#4](https://github.com/agvor/mattermost/issues/4) (Mattermost [#37406](https://github.com/mattermost/mattermost/issues/37406)). Las referencias de código corresponden a la base `53211e45`; el servidor y la web no cambiaron en `master`.

## 1. Lista de miembros

### 1.1. Entrada y componentes

Un miembro abre la lista desde el menú del equipo, en **View Members**. El acceso requiere `view_team`.

| Componente | Archivo | Función |
|---|---|---|
| `TeamMembersModal` | `webapp/channels/src/components/team_members_modal/team_members_modal.tsx:116` | Modal con el título, la invitación (solo administradores) y la lista. |
| `MemberListTeam` | `webapp/channels/src/components/member_list_team/member_list_team.tsx` | Carga inicial, búsqueda y paginación. Muestra 50 usuarios por página (línea 18). |
| `SearchableUserList` | `webapp/channels/src/components/searchable_user_list/searchable_user_list.tsx:65` | Barra de búsqueda, filas, paginación y acciones. También la usan `member_list_channel` y la consola de administración. |
| `TeamMembersDropdown` | `webapp/channels/src/components/team_members_dropdown/team_members_dropdown.tsx` | Menú de gestión de cada fila; solo aparece a quien puede administrar miembros. |

### 1.2. Carga, búsqueda y paginación

- **Carga inicial** (`componentDidMount`, línea 57): `loadProfilesAndTeamMembers(0, PROFILE_CHUNK_SIZE, teamId, {active: true})`, `getTeamMembers(teamId, 0, …, {sort, exclude_deleted_users: true})` y `getTeamStats(teamId)`.
- **Búsqueda** (`componentDidUpdate`, línea 75): `searchProfiles(term, {team_id})` (línea 93) y luego la membresía de los usuarios encontrados. Busca en nombre, usuario, correo y apodo; no considera roles.
- **Paginación** (`nextPage`, línea 119): repite la carga con la página siguiente.
- El total de la lista viene de `getTeamStats` (miembros activos del equipo).

### 1.3. Cómo se muestra el rol hoy

El rol solo aparece en `TeamMembersDropdown` (líneas 154-175) y en este orden: Guest, System Admin (`user.roles`), Team Admin (`teamMember.scheme_admin` o `teamMember.roles`) y Member. Un miembro común no ve ese menú, por lo que no puede saber quién administra el equipo.

## 2. API

### 2.1. Endpoints

| Método | Endpoint | Parámetros | Uso actual | Cliente |
|---|---|---|---|---|
| GET | `/api/v4/users` | `in_team`, `page`, `per_page`, `sort`, `active` | Perfiles del equipo | `Client4.getProfilesInTeam` (`client4.ts:948`) |
| GET | `/api/v4/teams/{id}/members` | `page`, `per_page`, `sort`, `exclude_deleted_users` | Membresía y roles | `Client4.getTeamMembers` (`client4.ts:1540`) |
| POST | `/api/v4/users/search` | `term`, `team_id` | Búsqueda en el equipo | `Client4.searchUsers` (`client4.ts:1186`) |
| GET | `/api/v4/teams/{id}/stats` | — | Total de miembros | `Client4.getTeamStats` (`client4.ts:1617`) |

`Client4.getProfilesInTeam` reenvía cualquier opción adicional a la consulta, por lo que acepta `team_roles` y `roles` sin cambios en el cliente.

### 2.2. Sanitización de roles

`getTeamMembers` (`server/channels/api4/team.go:825`) exige `view_team` y aplica `GetViewUsersRestrictions`. Si quien consulta no tiene `manage_team_roles`, llama a `SanitizeRoleData` en cada miembro (líneas 859-863).

`SanitizeRoleData` (`server/public/model/team_member.go:146`) deja `Roles` y `ExplicitRoles` vacíos y `SchemeAdmin`, `SchemeUser` y `SchemeGuest` en `false` para todos los usuarios excepto quien consulta. La misma sanitización se aplica en otros endpoints de miembros (`team.go`: 817, 907, 957, 1078 y 1239).

Esta es la causa de #37406: un miembro recibe `scheme_admin=false` para todos los demás, aunque sean Team Admins. La etiqueta no puede depender de esta respuesta.

### 2.3. Filtro por rol existente

- `GET /api/v4/users` acepta `roles` y `team_roles` separados por comas (`server/channels/api4/user.go:867`). Valida que los roles existan (líneas 913-975) y, con `in_team`, solo exige `view_team` (línea 1090).
- `POST /api/v4/users/search` acepta `team_roles` en el cuerpo (`server/public/model/user_search.go:24`, `user.go:1351`) y exige `view_team` cuando incluye `team_id` (línea 1328).
- `GET /api/v4/users/stats/filtered` acepta `team_roles` (`user.go:769`), pero exige `sysconsole_read_user_management_users` (línea 812). Un miembro recibe 403, así que no sirve para contar administradores.

El servidor filtra en `applyMultiRoleFilters` (`server/channels/store/sqlstore/user_store.go:730`). Los valores se combinan con OR:

| Valor | Condición | Incluye a |
|---|---|---|
| `team_roles=team_admin` | `tm.SchemeAdmin = true` y `Users.Roles` sin `system_admin` | Team Admins del equipo que no son System Admins |
| `team_roles=team_user` | `tm.SchemeUser = true`, `tm.SchemeAdmin = false` y sin `system_admin` | Miembros comunes |
| `roles=system_admin` | `Users.Roles` contiene `system_admin` | System Admins del equipo (con `in_team`) |

### 2.4. Datos que recibe un miembro

- `scheme_admin` de los demás: no, por la sanitización.
- `user.roles` de los demás: sí (por ejemplo, `system_user system_admin`). Permite mostrar la etiqueta System Admin sin cambiar el servidor.
- Usuarios filtrados con `team_roles=team_admin`: sí, con paginación del servidor.

## 3. Etiqueta y filtro

### 3.1. Etiqueta

La fila de cada usuario muestra una etiqueta junto al nombre:

| Condición | Etiqueta | Clave existente | Español |
|---|---|---|---|
| `user.roles` incluye `system_admin` | System Admin | `team_members_dropdown.systemAdmin` | Admin del Sistema |
| Aparece en la consulta `team_roles=team_admin` del equipo | Team Admin | `team_members_dropdown.teamAdmin` | Administrador de Equipo |
| Resto | Sin etiqueta | — | — |

Se usa el mismo orden que el menú de gestión (sección 1.3), para que ambos muestren el mismo rol. El estilo puede seguir el de los grupos de Channel Admins (`channel_members_rhs.tsx:159-190`).

### 3.2. Fuente del rol

| Opción | Cómo funciona | Cambios | Riesgo |
|---|---|---|---|
| A | Consultar `GET /users?in_team={id}&team_roles=team_admin` y marcar a esos usuarios. | Solo web. | Una consulta adicional; usa datos que un miembro ya puede pedir con `view_team`. |
| B | Dejar `scheme_admin` sin sanitizar en `getTeamMembers`. | Servidor y web. | Toca la lógica de permisos de varios endpoints; requiere pruebas en Go. |

La propuesta es la opción A. La decisión final corresponde a TA-02 (decisión D3).

### 3.3. Filtro

- Selector junto a la búsqueda con dos opciones: "Todos" (por defecto) y "Administradores".
- "Administradores" consulta el servidor con `in_team={id}&team_roles=team_admin&roles=system_admin&active=true`. No se filtra en el navegador, porque se perderían los administradores de páginas no cargadas.
- Con búsqueda activa, se envía `team_roles` (y `roles`, según D1) en `POST /users/search` junto con `team_id`.
- Al cambiar el filtro o el texto de búsqueda, la lista vuelve a la primera página.
- Sin resultados, se muestra el mensaje existente "No users found" (`user_list.tsx:81`).
- El total de `getTeamStats` no aplica al filtro, y `stats/filtered` no está disponible para un miembro. Con el filtro activo, la paginación debe basarse en si la página llegó completa, sin mostrar un total.

### 3.4. Claves nuevas propuestas

| Clave | Inglés | Español |
|---|---|---|
| `team_members_modal.filter.all` | All members | Todos |
| `team_members_modal.filter.admins` | Admins | Administradores |
| `team_members_modal.filter.label` | Filter members | Filtrar miembros |
| `team_members_modal.filter.no_admins` | No admins found | No se encontraron administradores |

## 4. Decisiones para acordar en la revisión

| ID | Pregunta | Opciones | Propuesta |
|---|---|---|---|
| D1 | ¿El filtro incluye a los System Admins que pertenecen al equipo? | Solo `team_admin`, o `team_admin` y `system_admin`. | Incluirlos, con su propia etiqueta: también pueden administrar el equipo. |
| D2 | ¿Etiqueta en la fila o secciones como en Channel Admins? | Etiqueta; secciones "Administradores" y "Miembros". | Etiqueta en la fila. Con páginas de 50, las secciones solo ordenarían la página cargada. |
| D3 | ¿De dónde sale el rol Team Admin? | Opción A o B de la sección 3.2. | Opción A. Lo decide TA-02. |
| D4 | ¿Qué etiqueta lleva un System Admin que además es Team Admin? | "System Admin", o ambas. | "System Admin", igual que el menú de gestión. `team_roles=team_admin` no lo devuelve; aparece por `roles=system_admin`. |

## 5. Casos de aceptación

Los casos se prueban con un equipo de varios roles: miembros comunes, al menos un Team Admin, un System Admin miembro del equipo, un System Admin que también es Team Admin y un Team Admin de otro equipo.

### 5.1. Rol

| ID | Quién consulta | Escenario | Resultado esperado | Criterio |
|---|---|---|---|---|
| CA-TA-01 | Miembro | Equipo con Team Admins y miembros comunes | Los Team Admins muestran "Team Admin"; los miembros comunes no tienen etiqueta. | TA-01 |
| CA-TA-02 | Miembro | System Admin que pertenece al equipo | Muestra "System Admin" y no "Team Admin". | TA-01 |
| CA-TA-03 | Miembro | System Admin que también es Team Admin | Muestra una sola etiqueta, según D4. | TA-01 |
| CA-TA-04 | Miembro | Team Admin de otro equipo que aquí es miembro común | No tiene etiqueta en este equipo. En su propio equipo sí muestra "Team Admin". | TA-01 |
| CA-TA-05 | Team Admin y System Admin | Abren la misma lista | Ven las mismas etiquetas que un miembro. El menú de gestión sigue igual. | TA-01, RG-01 |
| CA-TA-06 | Miembro | Un administrador promueve o degrada a un usuario | Al volver a abrir la lista, la etiqueta refleja el rol nuevo. | TA-01 |
| CA-TA-07 | Miembro | Bot con `scheme_admin` en el equipo | Recibe la misma etiqueta que un usuario con ese rol. | TA-01 |
| CA-TA-08 | Miembro | Team Admin desactivado | No aparece en la lista ni en el filtro, igual que hoy. | RG-01 |

### 5.2. Búsqueda

| ID | Quién consulta | Escenario | Resultado esperado | Criterio |
|---|---|---|---|---|
| CA-TA-09 | Miembro | Filtro "Administradores" y búsqueda que coincide con un administrador | Solo aparecen los administradores cuyo perfil coincide con el texto. | TA-02 |
| CA-TA-10 | Miembro | Búsqueda sin filtro | Aparecen los mismos resultados que hoy y los administradores llevan su etiqueta. | TA-02, RG-01 |
| CA-TA-11 | Miembro | Se borra la búsqueda con el filtro activo | Vuelve la lista completa de administradores. | TA-02 |

### 5.3. Paginación

| ID | Quién consulta | Escenario | Resultado esperado | Criterio |
|---|---|---|---|---|
| CA-TA-12 | Miembro | Más de 50 miembros, con administradores que en la lista completa están después de la primera página | Con el filtro aparecen todos los administradores, sin repetidos ni omitidos. | TA-02 |
| CA-TA-13 | Miembro | Más administradores que el tamaño de página | El filtro permite pasar a la página siguiente y termina cuando no hay más resultados. | TA-02 |
| CA-TA-14 | Miembro | Cambia el filtro o la búsqueda desde la segunda página | La lista vuelve a la primera página. | TA-02 |

### 5.4. Resultados vacíos

| ID | Quién consulta | Escenario | Resultado esperado | Criterio |
|---|---|---|---|---|
| CA-TA-15 | Miembro | Filtro en un equipo sin Team Admins ni System Admins miembros | Mensaje de lista vacía. | TA-02 |
| CA-TA-16 | Miembro | Filtro y búsqueda sin coincidencias | Mensaje de lista vacía; al quitar la búsqueda vuelven los administradores. | TA-02 |
| CA-TA-17 | Miembro | Búsqueda sin coincidencias y sin filtro | Mismo mensaje que hoy. | RG-01 |

### 5.5. Permisos

| ID | Quién consulta | Escenario | Resultado esperado | Criterio |
|---|---|---|---|---|
| CA-TA-18 | Miembro | Abre la lista con el filtro | No aparecen acciones de gestión. Cambiar un rol por la API devuelve 403. | TA-03 |
| CA-TA-19 | Miembro | Revisa las respuestas de la API | `/teams/{id}/members` sigue sin `scheme_admin` de otros; no recibe datos que hoy no ve. | TA-03 |
| CA-TA-20 | Usuario fuera del equipo | Consulta `team_roles` del equipo | Recibe 403. | TA-03 |

### 5.6. Regresión

| ID | Quién consulta | Escenario | Resultado esperado | Criterio |
|---|---|---|---|---|
| CA-TA-21 | Miembro | Lista con "Todos" | Mismo orden, búsqueda, paginación y total que antes. | RG-01 |
| CA-TA-22 | Cualquiera | Otras listas que usan `SearchableUserList` (miembros de canal, consola de administración) | Sin cambios de comportamiento. | RG-01 |

## 6. Pruebas sugeridas para TA-02 a TA-04

| Tipo | Archivo | Qué cubrir |
|---|---|---|
| Unitaria web | `member_list_team/member_list_team.test.tsx` (nuevo) | Envío de `team_roles` y `roles`, combinación con la búsqueda y vuelta a la primera página. |
| Unitaria web | `team_members_modal/team_members_modal.test.tsx` | Selector de filtro y etiquetas por rol. |
| Unitaria web | `team_members_dropdown/team_members_dropdown.test.tsx` | Que el menú siga mostrando el mismo rol que la etiqueta. |
| Unitaria web | `searchable_user_list/searchable_user_list.test.tsx` (nuevo) | Mensaje vacío y paginación sin total. |
| Servidor | `server/channels/api4/team_test.go` (`TestGetTeamMembersRoleDataSanitization`) | Si se elige la opción B: qué datos quedan visibles. |
| Servidor | `server/channels/api4/user_test.go` (`TestGetUsersInTeam`, `TestSearchUsers`) | `team_roles` como miembro: solo administradores del equipo, con paginación y búsqueda. |
| E2E | `e2e-tests/` | Recorrido por rol: miembro, Team Admin y System Admin; filtro, búsqueda, paginación y lista vacía. |

## 7. Comprobación en el ambiente local

Se verificó el comportamiento de la API como miembro común, con usuarios de prueba: System Admin, Team Admin, dos miembros, un System Admin que también es Team Admin y un Team Admin de otro equipo.

El script [`TA-01_comprobacion_api.py`](TA-01_comprobacion_api.py) crea esos usuarios y equipos y ejecuta las comprobaciones. Requiere una instancia local vacía, porque el primer usuario creado queda como System Admin. Recibe la ruta del archivo donde guarda las contraseñas generadas:

```bash
python3 pswe-07-grupo01/entregable02/TA-01_comprobacion_api.py /ruta/credenciales-locales.json
```

| ID | Comprobación | Resultado |
|---|---|---|
| S1 | `/teams/{id}/members` como miembro | `scheme_admin=false` para el Team Admin. |
| S2 | `/teams/{id}/members` como System Admin | `scheme_admin=true` para el Team Admin. |
| S3 | `team_roles=team_admin` como miembro | Solo el Team Admin del equipo; sin System Admins ni el administrador del otro equipo. |
| S4 | `team_roles=team_admin&roles=system_admin` | Team Admin, System Admin y System Admin que también es Team Admin. |
| S5 | Filtro con `per_page=1` | Pagina correctamente. |
| S6 | Filtro y búsqueda sin coincidencias | Lista vacía con estado 200. |
| S7 | `user.roles` de otros como miembro | Visible (`system_user system_admin`). |
| S8 | `/users/stats/filtered` como miembro | 403 por `sysconsole_read_user_management_users`. |
| S9 | `team_roles` desde fuera del equipo | 403. |

Las pruebas del servidor `TestGetTeamMembersRoleDataSanitization`, `TestGetUsersInTeam`, `TestSearchUsers` y `TestGetFilteredUsersStats` también pasan en la base.
