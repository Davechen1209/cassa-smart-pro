// ─── Lettura CSV ───
// Un CSV non e' un foglio di calcolo: dato in pasto a un lettore xlsx, in
// italiano "500,00" diventa 50000 e "1.000,00" diventa 1. Qui il file viene
// letto come testo e diviso in celle, lasciando i numeri come stringhe a chi
// sa interpretarli. Sta in un modulo suo perche' lo usano sia l'import dei
// movimenti sia quello delle fatture.

// Excel italiano salva i CSV in Windows-1252 e il "Testo Unicode" in UTF-16:
// senza riconoscerle, accenti e simboli arrivano rotti.
export function decodeCsvText(buffer) {
  const bytes = new Uint8Array(buffer);
  let text;
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
    text = new TextDecoder('utf-16le').decode(bytes);
  } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
    text = new TextDecoder('utf-16be').decode(bytes);
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (err) {
      text = new TextDecoder('windows-1252').decode(bytes);
    }
  }
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  return text;
}

// Vince il separatore piu' frequente fuori dalle virgolette; a parita' il ';',
// perche' nei file italiani la virgola e' il separatore dei decimali.
export function detectCsvSeparator(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== '').slice(0, 5);
  let best = ';';
  let bestScore = 0;
  [';', ',', '\t', '|'].forEach(sep => {
    let score = 0;
    lines.forEach(line => {
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === sep && !inQuotes) score++;
      }
    });
    if (score > bestScore) { bestScore = score; best = sep; }
  });
  return best;
}

// Virgolette, virgolette raddoppiate e a capo dentro al campo, come li scrive
// Excel. Le righe completamente vuote spariscono.
export function parseCsvMatrix(text, sep) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch !== '"') { field += ch; continue; }
      if (text[i + 1] === '"') { field += '"'; i++; continue; }
      inQuotes = false;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === sep) { row.push(field); field = ''; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }

  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

// Dal file alle celle, in un colpo solo.
export function csvMatrixFromBuffer(buffer, forcedSep) {
  const text = decodeCsvText(buffer);
  if (!text.trim()) return [];
  return parseCsvMatrix(text, forcedSep || detectCsvSeparator(text));
}
