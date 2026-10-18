-- Ajustes exclusivos de la exportación LaTeX/PDF; el Markdown conserva Mermaid.
local directory = pandoc.path.directory(PANDOC_SCRIPT_FILE)
local diagram_number = 0

function CodeBlock(block)
  if not FORMAT:match('latex') or not block.classes:includes('mermaid') then
    return nil
  end
  diagram_number = diagram_number + 1
  local target = pandoc.path.join({directory, 'diagramas', 'diagrama-' .. diagram_number .. '.png'})
  pandoc.pipe('python3', {
    pandoc.path.join({directory, 'render-diagramas.py'}), target
  }, block.text)
  return pandoc.Para({pandoc.Image({}, target, '', {width = '100%'})})
end

function Table(tbl)
  if not FORMAT:match('latex') then return nil end
  local header = tbl.head.rows[1]
  local first = header and pandoc.utils.stringify(header.cells[1].contents) or ''
  local widths
  if first == 'ID' then
    widths = {0.08, 0.46, 0.13, 0.11, 0.12, 0.10}
  elseif first == 'Tarea' then
    widths = {0.14, 0.05, 0.05, 0.05, 0.07, 0.10, 0.54}
  elseif first == 'Estado' then
    widths = {0.18, 0.24, 0.58}
  elseif first == 'Tipo de cambio' then
    widths = {0.24, 0.76}
  elseif first == 'Periodo de 2026' then
    widths = {0.30, 0.70}
  elseif first == 'Semana de 2026' then
    widths = {0.44, 0.14, 0.14, 0.16, 0.12}
  elseif first == 'Código' then
    widths = {0.22, 0.26, 0.26, 0.26}
  elseif first == 'Métrica' then
    widths = {0.23, 0.54, 0.23}
  elseif first == 'ID y riesgo' then
    widths = {0.25, 0.18, 0.44, 0.13}
  elseif first == 'Riesgo' then
    widths = {0.08, 0.40, 0.52}
  elseif first == 'Recurso' then
    widths = {0.30, 0.17, 0.53}
  elseif first == 'Componente' then
    widths = {0.56, 0.20, 0.24}
  elseif first == 'Integrante' then
    widths = {0.52, 0.18, 0.30}
  end
  for i, col in ipairs(tbl.colspecs) do
    col[1] = 'AlignLeft'
    col[2] = widths and widths[i] or (1 / #tbl.colspecs)
  end
  return {
    pandoc.RawBlock('latex', '\\begingroup\\small\\setlength{\\tabcolsep}{3pt}\\raggedright'),
    tbl,
    pandoc.RawBlock('latex', '\\endgroup')
  }
end

-- Permitir saltos visuales en el SHA sin alterar su contenido.
function Code(code)
  if FORMAT:match('latex') and #code.text == 40 and code.text:match('^%x+$') then
    local chunks = {}
    for i = 1, #code.text, 8 do
      chunks[#chunks + 1] = code.text:sub(i, i + 7)
    end
    return pandoc.RawInline('latex', '\\texttt{' .. table.concat(chunks, '\\allowbreak{}') .. '}')
  end
end

-- Reservar espacio para el título y el comienzo de cada tabla.
function Para(paragraph)
  if FORMAT:match('latex') and pandoc.utils.stringify(paragraph):match('^Tabla %d+%.') then
    return {
      pandoc.RawBlock('latex', '\\Needspace{12\\baselineskip}'),
      paragraph,
      pandoc.RawBlock('latex', '\\nopagebreak[4]')
    }
  end
end

-- Mantener cada diagrama junto con su título, situado debajo como en el avance 1.
function Blocks(blocks)
  if not FORMAT:match('latex') then return nil end
  local result = pandoc.List()
  local i = 1
  while i <= #blocks do
    local current, following = blocks[i], blocks[i + 1]
    if current.t == 'Para' and #current.content == 1 and current.content[1].t == 'Image'
        and following and following.t == 'Para'
        and pandoc.utils.stringify(following):match('^Figura %d+%.') then
      -- Limitar la altura deja espacio para el título en la misma página.
      local is_process_diagram = pandoc.utils.stringify(following):match('^Figura 1%.')
      current.content[1].attributes.height = is_process_diagram and '35%' or '75%'
      result:insert(pandoc.RawBlock('latex', '\\begin{center}\\begin{minipage}{\\linewidth}\\centering'))
      local latex_image = pandoc.write(pandoc.Pandoc({current}), 'latex')
      latex_image = latex_image:gsub('\\includegraphics%[', '\\includegraphics[keepaspectratio,')
      result:insert(pandoc.RawBlock('latex', latex_image))
      result:insert(following)
      result:insert(pandoc.RawBlock('latex', '\\end{minipage}\\end{center}'))
      i = i + 2
    else
      result:insert(current)
      i = i + 1
    end
  end
  return result
end

function Meta(meta)
  if FORMAT:match('latex') then
    local includes = meta['header-includes'] or pandoc.MetaList({})
    includes:insert(pandoc.MetaBlocks({pandoc.RawBlock('latex', '\\usepackage{needspace}\n\\usepackage{graphicx}')}))
    meta['header-includes'] = includes
  end
  return meta
end
