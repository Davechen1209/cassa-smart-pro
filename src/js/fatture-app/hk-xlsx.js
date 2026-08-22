import { Store } from './hk-store.js';

/* Minimal .xlsx reader: ZIP central-directory parser + DecompressionStream("deflate-raw")
   + DOMParser for sheet XML. No external libraries. */
export const XLSXLite = (function () {
  "use strict";

  var supported = typeof window.DecompressionStream === "function";

  /* Errors carry a machine-readable code so the UI can localize them. */
  function codedError(code, msg) {
    var e = new Error(msg);
    e.code = code;
    return e;
  }

  /* ---------- ZIP ---------- */

  function findEOCD(view) {
    // End Of Central Directory signature 0x06054b50, scan backwards (max 64KB comment)
    var len = view.byteLength;
    var min = Math.max(0, len - 65558);
    for (var i = len - 22; i >= min; i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        return {
          count: view.getUint16(i + 10, true),
          cdSize: view.getUint32(i + 12, true),
          cdOffset: view.getUint32(i + 16, true)
        };
      }
    }
    return null;
  }

  function readEntries(buffer) {
    var view = new DataView(buffer);
    var eocd = findEOCD(view);
    if (!eocd) throw codedError("notXlsx", "Not a ZIP/XLSX file");
    var decoder = new TextDecoder("utf-8");
    var entries = {};
    var p = eocd.cdOffset;
    for (var i = 0; i < eocd.count; i++) {
      if (view.getUint32(p, true) !== 0x02014b50) break;
      var method = view.getUint16(p + 10, true);
      var compSize = view.getUint32(p + 20, true);
      var nameLen = view.getUint16(p + 28, true);
      var extraLen = view.getUint16(p + 30, true);
      var commentLen = view.getUint16(p + 32, true);
      var localOffset = view.getUint32(p + 42, true);
      var name = decoder.decode(new Uint8Array(buffer, p + 46, nameLen));
      entries[name] = { method: method, compSize: compSize, localOffset: localOffset };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  function extract(buffer, entry) {
    var view = new DataView(buffer);
    var p = entry.localOffset;
    if (view.getUint32(p, true) !== 0x04034b50) return Promise.reject(codedError("notXlsx", "Bad local header"));
    var nameLen = view.getUint16(p + 26, true);
    var extraLen = view.getUint16(p + 28, true);
    var dataStart = p + 30 + nameLen + extraLen;
    var data = new Uint8Array(buffer, dataStart, entry.compSize);
    if (entry.method === 0) {
      return Promise.resolve(new Uint8Array(data)); // stored
    }
    if (entry.method === 8) {
      var ds = new DecompressionStream("deflate-raw");
      var stream = new Blob([data]).stream().pipeThrough(ds);
      return new Response(stream).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
    }
    return Promise.reject(codedError("notXlsx", "Unsupported compression method " + entry.method));
  }

  function extractText(buffer, entries, name) {
    var entry = entries[name];
    if (!entry) return Promise.resolve(null);
    return extract(buffer, entry).then(function (bytes) {
      return new TextDecoder("utf-8").decode(bytes);
    });
  }

  /* ---------- XML helpers ---------- */

  function parseXML(text) {
    return new DOMParser().parseFromString(text, "application/xml");
  }

  function siText(si) {
    // concatenate all <t> not inside <rPh> (phonetic runs)
    var out = "";
    var ts = si.getElementsByTagName("*");
    for (var i = 0; i < ts.length; i++) {
      var el = ts[i];
      if (el.localName !== "t") continue;
      var skip = false, a = el.parentNode;
      while (a && a !== si) {
        if (a.localName === "rPh") { skip = true; break; }
        a = a.parentNode;
      }
      if (!skip) out += el.textContent;
    }
    return out;
  }

  function colToIndex(ref) {
    // "BC12" -> column index 54
    var col = 0;
    for (var i = 0; i < ref.length; i++) {
      var c = ref.charCodeAt(i);
      if (c >= 65 && c <= 90) col = col * 26 + (c - 64);
      else if (c >= 97 && c <= 122) col = col * 26 + (c - 96);
      else break;
    }
    return col - 1;
  }

  /* ---------- workbook ---------- */

  function readWorkbook(buffer) {
    if (!supported) return Promise.reject(codedError("unsupported", "unsupported"));
    var entries;
    try { entries = readEntries(buffer); } catch (e) { return Promise.reject(e); }

    return Promise.all([
      extractText(buffer, entries, "xl/workbook.xml"),
      extractText(buffer, entries, "xl/_rels/workbook.xml.rels"),
      extractText(buffer, entries, "xl/sharedStrings.xml")
    ]).then(function (parts) {
      var wbXml = parts[0], relsXml = parts[1], ssXml = parts[2];
      if (!wbXml) throw codedError("notXlsx", "workbook.xml missing");

      var shared = [];
      if (ssXml) {
        var ssDoc = parseXML(ssXml);
        var sis = ssDoc.getElementsByTagName("si");
        for (var i = 0; i < sis.length; i++) shared.push(siText(sis[i]));
      }

      var rels = {};
      if (relsXml) {
        var relDoc = parseXML(relsXml);
        var relNodes = relDoc.getElementsByTagName("Relationship");
        for (var j = 0; j < relNodes.length; j++) {
          var target = relNodes[j].getAttribute("Target") || "";
          target = target.replace(/^\//, "");
          if (target.indexOf("xl/") !== 0) target = "xl/" + target;
          rels[relNodes[j].getAttribute("Id")] = target;
        }
      }

      var wbDoc = parseXML(wbXml);
      var sheetNodes = wbDoc.getElementsByTagName("sheet");
      var sheets = [];
      for (var k = 0; k < sheetNodes.length; k++) {
        var sn = sheetNodes[k];
        var rid = sn.getAttribute("r:id") || sn.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        var path = rels[rid] || ("xl/worksheets/sheet" + (k + 1) + ".xml");
        sheets.push({ name: sn.getAttribute("name") || ("Sheet" + (k + 1)), path: path });
      }

      // parse every sheet's rows (files are small enough)
      return Promise.all(sheets.map(function (sh) {
        return extractText(buffer, entries, sh.path).then(function (xml) {
          sh.rows = xml ? parseSheetRows(parseXML(xml), shared) : [];
          delete sh.path;
          return sh;
        });
      })).then(function (out) {
        return { sheets: out };
      });
    });
  }

  function parseSheetRows(doc, shared) {
    var rows = [];
    var rowNodes = doc.getElementsByTagName("row");
    for (var i = 0; i < rowNodes.length; i++) {
      var rowNode = rowNodes[i];
      var rIdx = parseInt(rowNode.getAttribute("r") || (i + 1), 10) - 1;
      var cells = [];
      var cNodes = rowNode.getElementsByTagName("c");
      for (var j = 0; j < cNodes.length; j++) {
        var c = cNodes[j];
        var ref = c.getAttribute("r");
        var col = ref ? colToIndex(ref) : j;
        if (col > 30) continue; // ignore far-right scratch columns
        var t = c.getAttribute("t") || "n";
        var val = null;
        if (t === "inlineStr") {
          var isNode = c.getElementsByTagName("is")[0];
          val = isNode ? siText(isNode) : "";
        } else {
          var vNode = c.getElementsByTagName("v")[0];
          if (!vNode) { cells[col] = null; continue; }
          var raw = vNode.textContent;
          if (t === "s") {
            val = shared[parseInt(raw, 10)];
            if (val == null) val = "";
          } else if (t === "str" || t === "e") {
            val = raw;
          } else if (t === "b") {
            val = raw === "1";
          } else {
            var num = Number(raw);
            val = isFinite(num) ? num : raw;
          }
        }
        cells[col] = val;
      }
      rows[rIdx] = cells;
    }
    // compact: replace missing rows with empty arrays
    for (var k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
    return rows;
  }

  /* ---------- Excel serial dates ---------- */

  function serialToISO(serial) {
    var n = Number(serial);
    if (!isFinite(n) || n <= 0 || n > 2958465) return null;
    var ms = Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  function parseDateCell(val) {
    if (val == null || val === "") return null;
    if (typeof val === "number") return serialToISO(val);
    var s = String(val).trim();
    var m = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(s);
    if (m) return m[1] + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[3]).padStart(2, "0");
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s); // dd/mm/yyyy
    if (m) return m[3] + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[1]).padStart(2, "0");
    return null;
  }

  /* ---------- header mapping (A..K layout, Chinese/Italian aliases) ---------- */

  var ALIASES = {
    arrival: ["到货日期", "到货", "arrivo", "data arrivo", "data"],
    supplier: ["公司名", "公司", "供应商", "fornitore"],
    invoice: ["发票号码", "发票", "fattura"],
    amount: ["金额", "货款", "importo"],
    cash: ["现金支付", "现金", "contanti"],
    other: ["支票/汇款", "支票汇款", "汇款", "支票", "bonifico", "assegno", "assegno/bonifico"],
    unpaid: ["未付", "residuo", "unpaid"],
    paid: ["已付", "pagato", "paid"],
    terms: ["付款周期", "termini"],
    due: ["货款到期日", "到期日", "scadenza"],
    notes: ["备注", "note"],
    checkNo: ["支票号码", "支票号", "n. assegno", "numero assegno", "n assegno"]
  };

  function detectColumns(headerRow) {
    var map = {};
    var used = {};
    for (var col = 0; col < 16; col++) {
      var h = headerRow[col];
      if (h == null) continue;
      var hs = String(h).trim().toLowerCase();
      if (!hs) continue;
      for (var field in ALIASES) {
        if (map[field] != null) continue;
        var list = ALIASES[field];
        for (var i = 0; i < list.length; i++) {
          if (hs === list[i].toLowerCase()) { map[field] = col; used[col] = true; break; }
        }
      }
    }
    if (map.supplier == null || map.amount == null) {
      // fallback: fixed A..L layout
      return { arrival: 0, supplier: 1, invoice: 2, amount: 3, cash: 4, other: 5, unpaid: 6, paid: 7, terms: 8, due: 9, notes: 10, checkNo: 11, headerDetected: false };
    }
    map.headerDetected = true;
    return map;
  }

  function cellStr(v) {
    if (v == null) return "";
    if (typeof v === "number") {
      // keep invoice-like numbers intact
      return (Math.floor(v) === v) ? String(v) : String(v);
    }
    return String(v).trim();
  }

  function amountCell(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? Math.round(v * 100) : null;
    return Store ? Store.parseAmount(String(v)) : null;
  }

  /* Map raw sheet rows to record drafts. Returns {rows, skipped, headerDetected} */
  function mapSheet(rawRows) {
    if (!rawRows || !rawRows.length) return { rows: [], skipped: 0, headerDetected: false };
    var cols = detectColumns(rawRows[0] || []);
    var start = cols.headerDetected ? 1 : 0;
    var out = [], skipped = 0;
    for (var i = start; i < rawRows.length; i++) {
      var row = rawRows[i];
      if (!row || !row.length) continue;
      var supplier = cellStr(row[cols.supplier]);
      var amountCents = amountCell(row[cols.amount]);
      var isBlank = !supplier && amountCents == null && !cellStr(row[cols.invoice]) && !cellStr(row[cols.notes]);
      if (isBlank) continue;
      if (!supplier || amountCents == null) { skipped++; continue; }
      var cash = amountCell(row[cols.cash]);
      var other = amountCell(row[cols.other]);
      /* The 现金支付/支票汇款 columns are often pre-filled with the *scheduled* payment
         while the ledger's own 未付 (unpaid) / 已付 (paid) columns hold the truth.
         When those columns exist, derive the actual paid total from them. */
      var unpaidC = cols.unpaid != null ? amountCell(row[cols.unpaid]) : null;
      var paidColC = cols.paid != null ? amountCell(row[cols.paid]) : null;
      var paidTotal = null;
      if (unpaidC != null) {
        // 未付 is authoritative: clamp to [0, amount] (batch totals can exceed the row amount)
        paidTotal = amountCents - Math.max(0, Math.min(unpaidC, amountCents));
      } else if (paidColC != null) {
        paidTotal = Math.max(0, Math.min(paidColC, amountCents));
      } else if (cols.headerDetected && (cols.unpaid != null || cols.paid != null)) {
        // sheet tracks unpaid/paid explicitly; both empty means settled
        paidTotal = amountCents;
      }
      if (paidTotal != null) {
        var cashC = cash == null ? 0 : cash;
        var otherC = other == null ? 0 : other;
        if (cashC + otherC !== paidTotal) {
          cashC = Math.max(0, Math.min(cashC, paidTotal));
          otherC = paidTotal - cashC;
        }
        cash = cashC;
        other = otherC;
      }
      var terms = cellStr(row[cols.terms]);
      var notes = cellStr(row[cols.notes]);
      var oldDebt = /老货款|旧账|老账/.test(terms + " " + notes);
      var checkNo = cols.checkNo != null ? cellStr(row[cols.checkNo]) : "";
      if (checkNo === "0") checkNo = ""; // the ledger uses a bare 0 as "none"
      out.push({
        arrivalDate: parseDateCell(row[cols.arrival]),
        supplier: supplier,
        invoice: cellStr(row[cols.invoice]),
        amount: amountCents / 100,
        paidCash: cash == null ? 0 : cash / 100,
        paidOther: other == null ? 0 : other / 100,
        terms: terms,
        dueDate: parseDateCell(row[cols.due]),
        notes: notes,
        oldDebt: oldDebt,
        checkNo: checkNo
      });
    }
    return { rows: out, skipped: skipped, headerDetected: !!cols.headerDetected };
  }

  return {
    supported: supported,
    readWorkbook: readWorkbook,
    serialToISO: serialToISO,
    parseDateCell: parseDateCell,
    mapSheet: mapSheet
  };
})();
