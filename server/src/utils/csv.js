/** Minimal CSV writer — the admin export buttons only need flat rows. */
const escapeCell = (value) => {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label ?? c.key)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escapeCell(c.get ? c.get(row) : row[c.key])).join(','))
    .join('\n')
  return `${header}\n${body}\n`
}

export function sendCsv(res, filename, rows, columns) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(toCsv(rows, columns))
}

/** Parses a simple CSV buffer (no embedded newlines inside quotes). */
export function parseCsv(buffer) {
  const text = buffer.toString('utf8').trim()
  if (!text) return []
  const [headerLine, ...lines] = text.split(/\r?\n/)
  const headers = splitLine(headerLine).map((h) => h.trim())
  return lines.filter(Boolean).map((line) => {
    const cells = splitLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]))
  })
}

function splitLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}
