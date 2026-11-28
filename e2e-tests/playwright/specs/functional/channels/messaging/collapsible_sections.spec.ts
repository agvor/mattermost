// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * Secciones colapsables (<details>/<summary>) en mensajes - PSWE-07 grupo 01 (DT-04).
 * Casos de referencia: DT-01 (ejemplos V/I/M, criterios CA-DT-01..17).
 */

const closedSection = ['<details>', '<summary>Resumen de la seccion</summary>', '', 'Contenido interno visible al abrir', '', '</details>'].join('\n');

const openSection = ['<details open>', '<summary>Seccion abierta</summary>', '', 'Contenido ya visible', '', '</details>'].join('\n');

/**
 * @objective Verificar que una seccion colapsable valida se publica cerrada y se abre/cierra con el mouse
 */
test('Collapsible section renders closed and toggles on click', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    await channelsPage.postMessage(closedSection);
    const post = await channelsPage.getLastPost();

    const details = post.container.getByTestId('post-details');
    await expect(details).toBeVisible();
    await expect(details).toHaveJSProperty('open', false);
    await expect(details.locator('.post-details__summary')).toContainText('Resumen de la seccion');
    await expect(post.container).not.toContainText('<details>');

    await details.locator('.post-details__summary').click();
    await expect(details).toHaveJSProperty('open', true);
    await expect(details.locator('.post-details__body')).toContainText('Contenido interno visible al abrir');

    await details.locator('.post-details__summary').click();
    await expect(details).toHaveJSProperty('open', false);
});

/**
 * @objective Verificar que el atributo open inicia la seccion abierta y que el teclado (Enter y Espacio) alterna una sola vez
 */
test('Collapsible section with open attribute toggles with keyboard', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    await channelsPage.postMessage(openSection);
    const post = await channelsPage.getLastPost();

    const details = post.container.getByTestId('post-details');
    const summary = details.locator('.post-details__summary');
    await expect(details).toHaveJSProperty('open', true);

    const postsBefore = await channelsPage.centerView.container.getByTestId('postView').count();

    await summary.focus();
    await expect(summary).toBeFocused();

    await summary.press('Enter');
    await expect(details).toHaveJSProperty('open', false);

    await summary.press('Space');
    await expect(details).toHaveJSProperty('open', true);

    await expect(channelsPage.centerView.container.getByTestId('postView')).toHaveCount(postsBefore);
});

/**
 * @objective Verificar que entradas invalidas o maliciosas se muestran como texto, sin ejecutar codigo ni crear secciones
 */
test('Invalid and malicious collapsible input stays as plain text', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
        dialogSeen = true;
        await dialog.dismiss();
    });

    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // I1: sin cierre -> no es seccion
    await channelsPage.postMessage('<details>\n<summary>Sin cierre</summary>\n\nTexto');
    let post = await channelsPage.getLastPost();
    await expect(post.container.getByTestId('post-details')).toHaveCount(0);
    await expect(post.container).toContainText('Sin cierre');

    // M1: atributo de evento ontoggle -> no se acepta como seccion
    await channelsPage.postMessage('<details ontoggle="alert(1)">\n<summary>Evento</summary>\n\nTexto\n\n</details>');
    post = await channelsPage.getLastPost();
    await expect(post.container.getByTestId('post-details')).toHaveCount(0);

    // M2: HTML dentro del resumen -> nunca se interpreta
    await channelsPage.postMessage('<details>\n<summary><img src=x onerror="alert(2)"></summary>\n\nTexto\n\n</details>');
    post = await channelsPage.getLastPost();
    await expect(post.container.locator('img[src="x"]')).toHaveCount(0);

    await page.waitForTimeout(500);
    expect(dialogSeen).toBe(false);
});

/**
 * @objective Verificar que al editar un mensaje a <details open> la seccion se muestra abierta y el mensaje queda como editado
 */
test('Editing a collapsible section updates its initial state', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    await channelsPage.postMessage(closedSection);
    let post = await channelsPage.getLastPost();
    await expect(post.container.getByTestId('post-details')).toHaveJSProperty('open', false);

    await channelsPage.centerView.postCreate.input.focus();
    await page.keyboard.press('ArrowUp');
    await channelsPage.centerView.postEdit.toBeVisible();
    await channelsPage.centerView.postEdit.input.fill(openSection);
    await channelsPage.centerView.postEdit.sendMessage();

    post = await channelsPage.getLastPost();
    await expect(post.container.getByTestId('post-details')).toHaveJSProperty('open', true);
    await post.toBeEdited();
});

/**
 * @objective Verificar que la vista previa del editor muestra la seccion colapsable y alterna sin enviar el mensaje
 */
test('Collapsible section works in the composer preview without sending', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);

    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    const {postCreate} = channelsPage.centerView;
    await postCreate.writeMessage(closedSection);
    await postCreate.togglePreview();
    await expect(postCreate.previewArea).toBeVisible();

    const details = postCreate.previewArea.getByTestId('post-details');
    await expect(details).toHaveJSProperty('open', false);

    await details.locator('.post-details__summary').click();
    await expect(details).toHaveJSProperty('open', true);

    await postCreate.togglePreview();
    await expect(postCreate.input).toHaveValue(closedSection);
});

/**
 * @objective Verificar que ejemplos incompletos y no admitidos (I2-I4, N2-N5) se muestran sin crear secciones ni ejecutar codigo
 */
const plainTextCases: Array<{id: string; message: string}> = [
    {id: 'I2 sin summary', message: '<details>\n\nCuerpo sin resumen\n\n</details>'},
    {id: 'I3 summary vacio', message: '<details>\n<summary></summary>\n\nCuerpo\n\n</details>'},
    {id: 'I4 cierre sin apertura', message: 'Texto previo\n\n</details>'},
    {id: 'N2 todo en una linea', message: '<details><summary>R</summary>Cuerpo</details>'},
    {id: 'N3 atributo class', message: '<details class="x">\n<summary>Clase</summary>\n\nCuerpo\n\n</details>'},
    {id: 'N3 open con valor', message: '<details open="false">\n<summary>Valor</summary>\n\nCuerpo\n\n</details>'},
    {id: 'N3 style en summary', message: '<details>\n<summary style="color:red">Estilo</summary>\n\nCuerpo\n\n</details>'},
    {id: 'N4 dentro de codigo', message: '```\n<details>\n<summary>Codigo</summary>\n\nCuerpo\n\n</details>\n```'},
    {id: 'N5 dentro de cita', message: '> <details>\n> <summary>Cita</summary>\n>\n> Cuerpo\n>\n> </details>'},
];

test('Incomplete and unsupported collapsible examples stay as plain text', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
        dialogSeen = true;
        await dialog.dismiss();
    });

    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    for (const {id, message} of plainTextCases) {
        // eslint-disable-next-line no-await-in-loop
        await channelsPage.postMessage(message);
        // eslint-disable-next-line no-await-in-loop
        const post = await channelsPage.getLastPost();
        // eslint-disable-next-line no-await-in-loop
        await expect(post.container.getByTestId('post-details'), id).toHaveCount(0);
    }

    expect(dialogSeen).toBe(false);
});

/**
 * @objective Verificar que script, iframe y enlaces javascript: dentro de una seccion se escapan o se filtran (M3, M4)
 */
test('Script, iframe and javascript links inside a section are neutralized', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();
    const {channelsPage, page} = await pw.testBrowser.login(user);

    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
        dialogSeen = true;
        await dialog.dismiss();
    });

    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();

    // M3: script e iframe en el cuerpo
    await channelsPage.postMessage('<details>\n<summary>Cuerpo con HTML</summary>\n\n<script>alert(3)</script>\n\n<iframe src="https://example.com"></iframe>\n\n</details>');
    let post = await channelsPage.getLastPost();
    await expect(post.container.locator('script')).toHaveCount(0);
    await expect(post.container.locator('iframe')).toHaveCount(0);

    // M4: enlace javascript: en el resumen y en el cuerpo
    await channelsPage.postMessage('<details>\n<summary>[resumen](javascript:alert(4))</summary>\n\n[cuerpo](javascript:alert(5))\n\n</details>');
    post = await channelsPage.getLastPost();
    await expect(post.container.locator('a[href^="javascript:"]')).toHaveCount(0);

    await page.waitForTimeout(500);
    expect(dialogSeen).toBe(false);
});