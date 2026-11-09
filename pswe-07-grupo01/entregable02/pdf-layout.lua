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
      pandoc.RawBlock('latex', '\\Needspace{7\\baselineskip}'),
      paragraph,
      pandoc.RawBlock('latex', '\\nopagebreak[4]')
    }
  end
end

-- Encuadre de los PNG actuales, en puntos de su tamaño original (izq., abajo,
-- der., arriba). El PDF omite los márgenes y el encabezado rasterizado de los
-- C4; el pie conserva el nivel, el nombre y el alcance de cada vista.
-- Las imágenes y las fuentes Mermaid originales permanecen completas.
local c4_frames = {
  ['arquitectura-c4-contexto.png'] = {trim = '186bp 249bp 295bp 896bp', height = '0.34', width = '0.80'},
  ['arquitectura-c4-contenedores.png'] = {trim = '88bp 236bp 280bp 845bp', height = '0.43', width = '0.84'},
  ['arquitectura-c4-componentes.png'] = {trim = '88bp 237bp 165bp 845bp', height = '0.43', width = '0.84'}
}

-- Mantener cada diagrama junto con su pie, sin reservar una altura fija.
function Blocks(blocks)
  if not FORMAT:match('latex') then return nil end
  local result = pandoc.List()
  local i = 1
  while i <= #blocks do
    local current, following = blocks[i], blocks[i + 1]
    if current.t == 'Para' and #current.content == 1 and current.content[1].t == 'Image'
        and following and following.t == 'Para'
        and pandoc.utils.stringify(following):match('^Figura %d+%.') then
      local source = current.content[1].src
      local frame = c4_frames[pandoc.path.filename(source)]
      local caption = pandoc.utils.stringify(following)
      local height = frame and frame.height or (caption:match('^Figura 1%.') and '0.32' or '0.48')
      local width = frame and frame.width or '1'
      local options = 'width=' .. width .. '\\linewidth,height=' .. height .. '\\textheight,keepaspectratio'
      if frame then options = options .. ',trim=' .. frame.trim .. ',clip' end
      local latex_image = '\\includegraphics[' .. options .. ']{\\detokenize{' .. source .. '}}\\par'
      local opening = '\\par\\addvspace{0.5\\baselineskip}\\noindent\\begin{minipage}{\\linewidth}\\centering'
      local closing = '\\end{minipage}\\par\\addvspace{0.5\\baselineskip}'
      result:insert(pandoc.RawBlock('latex', opening))
      result:insert(pandoc.RawBlock('latex', latex_image))
      result:insert(following)
      result:insert(pandoc.RawBlock('latex', closing))
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
    includes:insert(pandoc.MetaBlocks({pandoc.RawBlock('latex', '\\usepackage{needspace}\n\\usepackage{graphicx}\n\\setlength{\\parskip}{4pt plus 1pt minus 1pt}')}))
    meta['header-includes'] = includes
  end
  return meta
end
