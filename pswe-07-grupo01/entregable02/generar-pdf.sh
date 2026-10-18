#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
for dependency in pandoc xelatex python3 dot mutool; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        echo "Falta la dependencia: $dependency" >&2
        exit 1
    fi
done
# Compilar la fuente del Gantt y convertirla a PNG para Markdown y PDF.
build_directory=$(mktemp -d)
trap 'rm -rf -- "$build_directory"' EXIT
mkdir -p diagramas
if ! xelatex -interaction=nonstopmode -halt-on-error \
    -output-directory="$build_directory" plan-gantt.tex \
    > "$build_directory/gantt-compilacion.txt" 2>&1; then
    cat "$build_directory/gantt-compilacion.txt" >&2
    exit 1
fi
mutool draw -r 180 -o diagramas/plan-gantt.png "$build_directory/plan-gantt.pdf" 1

pandoc Entregable_2_Mattermost.md \
    --from=gfm \
    --lua-filter=pdf-layout.lua \
    --pdf-engine=xelatex \
    -V geometry:margin=2cm \
    -V papersize:a4 \
    -V fontsize=10pt \
    -V colorlinks=true \
    -V urlcolor='blue!60!black' \
    -V linkcolor='blue!60!black' \
    -V mainfont='Latin Modern Roman' \
    -V monofont='Latin Modern Mono' \
    -o Entregable_2_Mattermost.pdf
