#!/usr/bin/env python3
"""Renderiza el subconjunto Mermaid usado en este documento mediante Graphviz.

Admite flowchart LR/TD/TB, nodos rectangulares y flechas --> con etiqueta
opcional. Una construcción no admitida detiene la exportación.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import textwrap


def render(source, target):
    lines = [line.strip() for line in source.splitlines() if line.strip()]
    if not lines or lines[0] not in ('flowchart LR', 'flowchart TD', 'flowchart TB'):
        raise ValueError('Se requiere flowchart LR, TD o TB.')
    direction = 'LR' if lines[0].endswith('LR') else 'TB'
    nodes = {}
    edges = []
    node_pattern = r'([A-Za-z][A-Za-z0-9_]*)(?:\[("[^"]*"|[^\]]+)\])?'
    edge_pattern = re.compile(node_pattern + r'\s*-->\s*(?:\|([^|]+)\|\s*)?' + node_pattern)
    for line in lines[1:]:
        if line.startswith('%%'):
            continue
        match = edge_pattern.fullmatch(line)
        if not match:
            raise ValueError(f'Sintaxis Mermaid no admitida: {line}')
        start, start_label, edge_label, end, end_label = match.groups()
        for identifier, label in ((start, start_label), (end, end_label)):
            nodes.setdefault(identifier, identifier)
            if label is not None:
                nodes[identifier] = label.strip('"')
        edges.append((start, end, edge_label))
    dot = [
        'digraph documento {',
        f'graph [rankdir={direction}, bgcolor="white", pad="0.15", nodesep="0.25", ranksep="0.3", dpi=180];',
        'node [shape=box, style="rounded,filled", fillcolor="#f3f6f9", color="#5a6b7b", fontname="DejaVu Sans", fontsize=11, margin="0.10,0.07"];',
        'edge [color="#5a6b7b", fontname="DejaVu Sans", fontsize=9, arrowsize=0.6];',
    ]
    for identifier, label in nodes.items():
        wrapped = '\n'.join(textwrap.wrap(label, width=15 if direction == 'LR' else 30,
                                        break_long_words=False, break_on_hyphens=False))
        dot.append(f'{identifier} [label={json.dumps(wrapped, ensure_ascii=False)}];')
    for start, end, label in edges:
        attributes = f' [label={json.dumps(label, ensure_ascii=False)}]' if label else ''
        dot.append(f'{start} -> {end}{attributes};')
    dot.append('}')
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['dot', '-Tpng', '-o', str(target)], input='\n'.join(dot),
                   text=True, check=True)


if __name__ == '__main__':
    render(sys.stdin.read(), Path(sys.argv[1]))
