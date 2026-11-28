# DT-04: Validación del incremento y prueba E2E

Incremento validado: secciones colapsables `<details>`/`<summary>` en mensajes (DT-01 a DT-03).
Línea base (antes): [`evidencia-base/issue-38480`](../../evidencia-base/issue-38480/README.md).

## 1. Prueba E2E automatizada

Archivo: `e2e-tests/playwright/specs/functional/channels/messaging/collapsible_sections.spec.ts`
(Playwright, Chromium, servidor local de desarrollo).

Ejecución:

```bash
cd e2e-tests/playwright
export PW_BASE_URL=http://localhost:8065 PW_ADMIN_USERNAME=sysadmin PW_ADMIN_PASSWORD=<contraseña local>
npm run test -- collapsible_sections --project=chrome
```

Resultado: 12 suites y 384 tests pasaron, 0 fallaron (8 snapshots).
Evidencia: [`resultado_e2e.txt`](resultado_e2e.txt) e [`informe_e2e.png`](informe_e2e.png).

| Prueba | Casos cubiertos |
|---|---|
| Se publica cerrada y se abre/cierra con clic | CA-DT-01, CA-DT-02 (V1) |
| `open` inicia abierta; Enter y Espacio alternan sin enviar | CA-DT-08, CA-DT-09 (V2) |
| Sin cierre, `ontoggle` y HTML en el resumen no ejecutan código | CA-DT-12 (I1), CA-DT-14 (M1, M2) |
| Editar a `<details open>` cambia el estado inicial | CA-DT-06 |
| Vista previa del editor alterna sin enviar y conserva el borrador | CA-DT-05 (vista previa), CA-DT-11 |
| I2 a I4 y N2 a N5 se muestran como texto | CA-DT-12, CA-DT-13 |
| `<script>`, `<iframe>` y enlaces `javascript:` quedan neutralizados | CA-DT-14 (M3, M4) |

## 2. Validación manual

Realizada en el servidor local con los usuarios `member1` y `member2`.

| Verificación | Resultado |
|---|---|
| Mensaje V1 sale contraído y se abre con clic | Sí |
| `<details open>` sale abierto | Sí |
| Teclado: Tab llega al resumen, foco visible, Enter y Espacio alternan | Sí |
| M1 (`ontoggle`) se muestra como texto y no ejecuta nada | Sí |
| Otro usuario (`member2`) ve la sección contraída aunque quien publica la abrió (CA-DT-03) | Sí |

Captura: [`validacion_manual.png`](validacion_manual.png)

## 3. Regresión (CA-DT-15, CA-DT-17)

Pruebas unitarias existentes de Markdown, componente de sección, utilidades y `show_more`:

```bash
cd webapp/channels
npx jest src/utils/markdown src/components/details_section src/utils/utils.test.tsx src/components/post_view/show_more
```

Resultado: 12 suites y 384 tests pasaron, 0 fallaron (8 snapshots).

## 4. Alcance y límites

- La E2E corre solo en Chromium y contra un servidor local de desarrollo; no se probó en Firefox ni Safari.
- No cubre el anuncio del lector de pantalla (CA-DT-10), el resaltado de código dentro del cuerpo (CA-DT-04) ni menciones, emojis y enlaces (CA-DT-07). Esos casos quedan en pruebas unitarias o validación manual.
- Los casos N1 (anidada) y N6 (HTML dentro del cuerpo) no se automatizaron porque DT-01 no fija con exactitud el resultado visible.
- La prueba se escribió con apoyo de IA (Claude) y la revisó el equipo.