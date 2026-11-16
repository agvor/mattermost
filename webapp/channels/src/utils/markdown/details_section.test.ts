// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import EmojiMap from 'utils/emoji_map';
import {formatText} from 'utils/text_formatting';

import {splitDetailsSections} from './details_section';

import {format, stripMarkdown} from './index';

// Example IDs (V, I, N, M) and acceptance cases (CA-DT-*) refer to DT-01_definicion.md.

const emojiMap = new EmojiMap(new Map());

function countSections(html: string) {
    return (html.match(/data-details-section=/g) || []).length;
}

describe('splitDetailsSections', () => {
    test('returns the text unchanged when there is no section', () => {
        const text = 'Hola\n\n**mundo**';
        expect(splitDetailsSections(text)).toEqual([{type: 'text', text}]);
    });

    test('V1: summary on its own line, paragraph and code block', () => {
        const text = '<details>\n<summary>Registro del error</summary>\n\nFalló:\n\n```\nerror 500\n```\n</details>';
        expect(splitDetailsSections(text)).toEqual([{
            type: 'details',
            open: false,
            summary: 'Registro del error',
            body: '\nFalló:\n\n```\nerror 500\n```',
        }]);
    });

    test('V2: open variant', () => {
        const segments = splitDetailsSections('<details open>\n<summary>Pasos</summary>\n\n- uno\n- dos\n</details>');
        expect(segments).toHaveLength(1);
        expect(segments[0]).toMatchObject({type: 'details', open: true, summary: 'Pasos'});
    });

    test('V3: summary on the same line as <details>', () => {
        const segments = splitDetailsSections('<details><summary>Resumen</summary>\nCuerpo\n</details>');
        expect(segments).toEqual([{type: 'details', open: false, summary: 'Resumen', body: 'Cuerpo'}]);
    });

    test('V5: text, two sections and more text', () => {
        const text = 'Antes\n\n<details><summary>A</summary>\nuno\n</details>\n<details><summary>B</summary>\ndos\n</details>\n\nDespués';
        const segments = splitDetailsSections(text);
        expect(segments.map((s) => s.type)).toEqual(['text', 'details', 'details', 'text']);
        expect(segments[0]).toEqual({type: 'text', text: 'Antes\n'});
        expect(segments[3]).toEqual({type: 'text', text: '\nDespués'});
    });

    test('V6: section without body', () => {
        expect(splitDetailsSections('<details><summary>Vacía</summary>\n</details>')).toEqual([
            {type: 'details', open: false, summary: 'Vacía', body: ''},
        ]);
    });

    test('accepts Windows line endings and trailing spaces', () => {
        const segments = splitDetailsSections('<details>  \r\n<summary>R</summary> \r\ncuerpo\r\n</details> ');
        expect(segments).toEqual([{type: 'details', open: false, summary: 'R', body: 'cuerpo'}]);
    });

    test('a </details> inside a code block of the body does not close the section', () => {
        const text = '<details><summary>R</summary>\n```html\n</details>\n```\n</details>';
        expect(splitDetailsSections(text)).toEqual([
            {type: 'details', open: false, summary: 'R', body: '```html\n</details>\n```'},
        ]);
    });

    test.each([
        ['I1: no closing tag', '<details>\n<summary>R</summary>\ncuerpo'],
        ['I2: no summary', '<details>\ncuerpo\n</details>'],
        ['I3: empty summary', '<details>\n<summary></summary>\ncuerpo\n</details>'],
        ['I3: blank summary', '<details><summary>   </summary>\ncuerpo\n</details>'],
        ['I4: closing tag only', 'texto\n</details>'],
        ['N1: nested section', '<details><summary>A</summary>\n<details><summary>B</summary>\nx\n</details>\n</details>'],
        ['N2: everything on one line', '<details><summary>R</summary>Cuerpo</details>'],
        ['N3: other attribute on details', '<details class="x">\n<summary>R</summary>\ncuerpo\n</details>'],
        ['N3: open with a value', '<details open="false">\n<summary>R</summary>\ncuerpo\n</details>'],
        ['N3: attribute on summary', '<details>\n<summary style="color: red">R</summary>\ncuerpo\n</details>'],
        ['N4: inside a fenced code block', '```\n<details>\n<summary>R</summary>\ncuerpo\n</details>\n```'],
        ['N4: inside a tilde code block', '~~~\n<details><summary>R</summary>\ncuerpo\n</details>\n~~~'],
        ['N4: inside an indented code block', '    <details>\n    <summary>R</summary>\n    cuerpo\n    </details>'],
        ['N5: inside a quote', '> <details>\n> <summary>R</summary>\n> cuerpo\n> </details>'],
        ['N5: inside a list', '- <details>\n  <summary>R</summary>\n  cuerpo\n  </details>'],
        ['M1: event handler attribute', '<details ontoggle="alert(1)">\n<summary>R</summary>\ncuerpo\n</details>'],
        ['two summaries', '<details><summary>A</summary><summary>B</summary>\ncuerpo\n</details>'],
    ])('%s stays as text', (_, text) => {
        const segments = splitDetailsSections(text);
        expect(segments.every((s) => s.type === 'text')).toBe(true);
        expect(segments.map((s) => (s.type === 'text' ? s.text : '')).join('\n')).toBe(text.replace(/\r\n/g, '\n'));
    });

    test('N1: a nested section is not recognized either', () => {
        const segments = splitDetailsSections('<details><summary>A</summary>\n<details><summary>B</summary>\nx\n</details>\n</details>\n\n<details><summary>C</summary>\ny\n</details>');
        expect(segments.map((s) => s.type)).toEqual(['text', 'details']);
        expect(segments[1]).toMatchObject({summary: 'C'});
    });

    test('an incomplete section does not hide a later valid one', () => {
        const segments = splitDetailsSections('<details>\ncuerpo\n\n<details><summary>R</summary>\nx\n</details>');
        expect(segments.map((s) => s.type)).toEqual(['text', 'details']);
    });
});

describe('format with collapsible sections', () => {
    test('V1: renders the marker with the body formatted as Markdown', () => {
        const output = format('<details>\n<summary>Registro del error</summary>\n\nFalló:\n\n```\nerror 500\n```\n</details>');

        expect(output).toBe(
            '<div data-details-section="closed">' +
                '<span data-details-summary="true">Registro del error</span>' +
                '<div data-details-body="true">' +
                    '<p>Falló:</p>\n' +
                    '<div data-codeblock-code="error 500" data-codeblock-language="" data-codeblock-searchedcontent=""></div>' +
                '</div>' +
            '</div>',
        );
    });

    test('V2: open variant and list body', () => {
        const output = format('<details open>\n<summary>Pasos</summary>\n\n- uno\n- dos\n</details>');
        expect(output).toContain('data-details-section="open"');
        expect(output).toMatch(/<ul[^>]*>.*uno.*dos.*<\/ul>/s);
    });

    test('V4: the summary keeps inline Markdown but no block elements', () => {
        const output = format('<details><summary>**Importante:** revisar `config.json`</summary>\nx\n</details>');
        expect(output).toContain('<span data-details-summary="true"><strong>Importante:</strong> revisar <span class="codespan__pre-wrap"><code>config.json</code></span></span>');

        const heading = format('<details><summary># Título</summary>\nx\n</details>');
        expect(heading).toContain('<span data-details-summary="true"># Título</span>');
    });

    test('V5: surrounding text is formatted as before', () => {
        const output = format('Antes\n\n<details><summary>A</summary>\nuno\n</details>\n<details><summary>B</summary>\ndos\n</details>\n\nDespués');
        expect(countSections(output)).toBe(2);
        expect(output.startsWith('<p>Antes</p>')).toBe(true);
        expect(output.endsWith('<p>Después</p>')).toBe(true);
    });

    test('V6: empty body', () => {
        expect(format('<details><summary>Vacía</summary>\n</details>')).toBe(
            '<div data-details-section="closed"><span data-details-summary="true">Vacía</span><div data-details-body="true"></div></div>',
        );
    });

    test('I1 to I4 and N2: shown as escaped text, as today', () => {
        expect(format('<details>\n<summary>R</summary>\ncuerpo')).not.toContain('data-details');
        expect(format('<details><summary>R</summary>Cuerpo</details>')).toBe(
            '<p>&lt;details&gt;&lt;summary&gt;R&lt;/summary&gt;Cuerpo&lt;/details&gt;</p>',
        );
    });

    test('N4 / CA-DT-17: code and LaTeX blocks that contain the syntax do not change', () => {
        const code = '```\n<details>\n<summary>R</summary>\nx\n</details>\n```';
        const latex = '```latex\n<details>\n<summary>R</summary>\nx\n</details>\n```';

        expect(format(code)).not.toContain('data-details');
        expect(format(code)).toContain('data-codeblock-code="&lt;details&gt;');
        expect(format(latex)).toBe('<div data-latex="&lt;details&gt;\n&lt;summary&gt;R&lt;/summary&gt;\nx\n&lt;/details&gt;"></div>');
        expect(format('`<details>`')).not.toContain('data-details');
    });

    test('N6 / M3: HTML inside the body is escaped as today', () => {
        const output = format('<details><summary>R</summary>\n<p>hola</p>\n<script>alert(1)</script>\n<iframe src="https://x"></iframe>\n</details>');
        expect(countSections(output)).toBe(1);
        expect(output).toContain('<p>&lt;p&gt;hola&lt;/p&gt;</p>');
        expect(output).not.toMatch(/<(script|iframe)[ >]/);
        expect(output).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(output).toContain('&lt;iframe');
    });

    test('M1: event handler attribute is never emitted', () => {
        const output = format('<details ontoggle="alert(1)">\n<summary>R</summary>\ncuerpo\n</details>');
        expect(output).not.toContain('data-details');
        expect(output).not.toMatch(/<details/);
    });

    test('M2: HTML inside the summary is escaped', () => {
        const output = format('<details><summary><img src=x onerror=alert(1)></summary>\ncuerpo\n</details>');
        expect(countSections(output)).toBe(1);
        expect(output).toContain('<span data-details-summary="true">&lt;img src=x onerror=alert(1)&gt;</span>');
    });

    test('M4: javascript: links are filtered as outside the section', () => {
        const text = '[clic](javascript:alert(1))';
        const outside = format(text);
        const inSummary = format(`<details><summary>${text}</summary>\nx\n</details>`);
        const inBody = format(`<details><summary>R</summary>\n${text}\n</details>`);

        expect(outside).not.toContain('href="javascript');
        expect(inSummary).not.toContain('href="javascript');
        expect(inBody).not.toContain('href="javascript');
    });

    test('singleline formatting keeps the syntax as text', () => {
        const output = format('<details><summary>R</summary>\nx\n</details>', {singleline: true});
        expect(output).not.toContain('data-details');
    });
});

describe('formatText with collapsible sections', () => {
    test('CA-DT-07: mentions and emojis work in the summary and body', () => {
        const output = formatText('<details><summary>Para @usuario :smile:</summary>\nHola @usuario\n</details>', {atMentions: true}, emojiMap);
        expect(countSections(output)).toBe(1);
        expect((output.match(/data-mention="usuario"/g) || []).length).toBe(2);
    });

    test('CA-DT-15: messages without sections give the same output', () => {
        const text = 'Hola **mundo**\n\n- uno\n- dos\n\n```js\nconst a = 1;\n```';
        expect(formatText(text, {}, emojiMap)).not.toContain('data-details');
    });

    test('CA-DT-16: stripMarkdown (notifications, search, threads) is unchanged', () => {
        // Same value as on master: stripMarkdown does not go through the section recognition.
        expect(stripMarkdown('<details><summary>R</summary>\nCuerpo\n</details>')).toBe('<details><summary>R</summary> Cuerpo\n</details>');
    });
});
