// Muestra cómo el analizador actual (fork de marked, con sanitize: true) trata los ejemplos de DT-01.
// Uso, desde la raíz del repositorio: node pswe-07-grupo01/entregable02/DT-01_comprobacion_marked.js
const path = require('path');
const marked = require(path.resolve(__dirname, '../../webapp/node_modules/marked'));

const options = Object.assign({}, marked.defaults, {sanitize: true, gfm: true, tables: true, mangle: false});
const ejemplos = {
    V1: '<details>\n<summary>Registro del error</summary>\n\nTexto del cuerpo.\n\n```js\nconst a = 1;\n```\n\n</details>',
    V2: '<details open>\n<summary>Pasos</summary>\n\n1. Uno\n2. Dos\n\n</details>',
    V3: '<details><summary>Resumen</summary>\n\nCuerpo\n\n</details>',
    I1: '<details>\n<summary>Sin cierre</summary>\n\nCuerpo',
    N2: '<details><summary>Resumen</summary>Cuerpo</details>',
    N4: '```\n<details>\n<summary>En código</summary>\n</details>\n```',
    M1: '<details ontoggle="alert(1)">\n<summary>x</summary>\n\ny\n\n</details>',
};

for (const [id, texto] of Object.entries(ejemplos)) {
    const tokens = marked.lexer(texto, options).tokens.map((t) => t.type);
    console.log(`${id} tokens=${JSON.stringify(tokens)}`);
    console.log(`   html=${JSON.stringify(marked(texto, options).trim())}`);
}
