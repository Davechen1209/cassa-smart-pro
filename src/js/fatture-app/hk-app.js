import { I18N } from './hk-i18n.js';
import { Store } from './hk-store.js';
import { XLSXLite } from './hk-xlsx.js';

/* Views, rendering, events. */
export const FattureApp = (function () {
  "use strict";

  var S = Store;
  var X = XLSXLite;

  /* ================= i18n ================= */

  var lang = "it";
  (function initLang() {
    var m = /[?&]lang=(it|zh)/.exec(location.search);
    if (m) { lang = m[1]; return; }
    var saved = S.meta().lang;
    if (saved === "it" || saved === "zh") lang = saved;
  })();

  function t(key, params) {
    var dict = I18N[lang] || I18N.it;
    var s = dict[key];
    if (s == null) s = I18N.it[key];
    if (s == null) return key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, function (_, name) {
        return params[name] != null ? params[name] : "{" + name + "}";
      });
    }
    return s;
  }

  function applyLangAttr() {
    // Titolo e lingua del documento appartengono all'app ospite: non si toccano.
    var pill = document.getElementById("langPill");
    if (pill) pill.setAttribute("aria-label", t("aria.lang"));
  }

  var moneyFmt;
  function rebuildFormatters() {
    moneyFmt = new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "it-IT", { style: "currency", currency: "EUR" });
  }

  function formatMoney(cents) { return moneyFmt.format(cents / 100); }

  function formatDate(iso) {
    if (!iso || !S.isValidISO(iso)) return t("misc.dash");
    var p = iso.split("-");
    if (lang === "zh") return p[0] + "-" + p[1] + "-" + p[2];
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function formatAmountInput(cents) {
    // plain number for inputs, in the active UI locale: it "1.234,56" / zh "1,234.56"
    return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }).format(cents / 100);
  }

  /* parse an amount typed in the UI, honouring the active locale's separators */
  function parseAmountInput(str) {
    return S.parseAmount(str, lang);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ================= app state ================= */

  var TODAY = S.todayISO();
  var currentView = "movimenti";
  (function initView() {
    var m = /[?&]view=(movimenti|scadenzario|fornitori|dashboard|dati)/.exec(location.search);
    if (m) currentView = m[1];
  })();
  var filters = { search: "", status: "all", supplier: "", from: "", to: "", oldDebtOnly: false };
  var sortState = { key: "arrivalDate", dir: -1 };
  var flashId = null;
  var wizard = null; // import wizard state
  var selection = {}; // ids of unpaid rows ticked for a combined payment

  function norm(s) { return String(s || "").trim().replace(/\s+/g, " ").toLowerCase(); }

  function decorate(r) {
    var c = S.recCents(r);
    return {
      rec: r,
      amount: c.amount,
      paid: c.paid,
      unpaid: c.unpaid,
      status: S.computeStatus(r, TODAY)
    };
  }

  function allDecorated() { return S.records().map(decorate); }

  function endOfWeekISO() {
    var p = TODAY.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var dow = d.getDay(); // 0=Sun
    return S.addDaysISO(TODAY, dow === 0 ? 0 : 7 - dow);
  }

  /* ================= chrome ================= */

  function renderChrome() {
    applyLangAttr();
    rebuildFormatters();
    document.getElementById("btnNew").textContent = t("action.new");
    var ql = document.getElementById("quickLinks");
    if (ql) {
      ql.innerHTML =
        '<button type="button" class="quicklink" data-action="ql-gmail" title="Gmail">✉ Gmail</button>' +
        '<button type="button" class="quicklink" data-action="ql-bank" title="' + esc(t("ql.bank")) + '">🏦 ' + esc(t("ql.bank")) + "</button>";
    }
    document.getElementById("langIt").classList.toggle("active", lang === "it");
    document.getElementById("langZh").classList.toggle("active", lang === "zh");
    renderCashStrip();
    renderTabs();
    renderBanners();
  }

  function renderCashStrip() {
    var ds = allDecorated();
    var overdue = 0, overdueN = 0, week = 0, weekN = 0, open = 0, openN = 0;
    var totalAll = 0;
    var sunday = endOfWeekISO();
    ds.forEach(function (d) {
      totalAll += d.amount;
      if (d.unpaid <= 0) return;
      open += d.unpaid; openN++;
      var isOver = d.status === "overdue";
      if (isOver) { overdue += d.unpaid; overdueN++; }
      if (isOver || (d.rec.dueDate && d.rec.dueDate >= TODAY && d.rec.dueDate <= sunday)) { week += d.unpaid; weekN++; }
    });
    var html = '<div class="cashstrip-inner">';
    if (overdue > 0) {
      html += '<div class="strip-seg red" data-action="goto-scadenzario"><span class="lbl">' + esc(t("strip.overdue")) +
        '</span><span class="val">' + esc(formatMoney(overdue)) + ' <span class="cnt">(' + overdueN + ')</span></span></div>';
    } else {
      html += '<div class="strip-seg green" data-action="goto-scadenzario"><span class="lbl">' + esc(t("strip.overdue")) +
        '</span><span class="val">' + esc(t("strip.noOverdue")) + '</span></div>';
    }
    html += '<div class="strip-seg amber" data-action="goto-scadenzario"><span class="lbl">' + esc(t("strip.week")) +
      '</span><span class="val">' + esc(formatMoney(week)) + ' <span class="cnt">(' + weekN + ')</span></span></div>';
    html += '<div class="strip-seg neutral" data-action="goto-open"><span class="lbl">' + esc(t("strip.open")) +
      '</span><span class="val">' + esc(formatMoney(open)) + ' <span class="cnt">(' + openN + ')</span></span></div>';
    html += '<div class="strip-seg neutral" data-action="goto-all"><span class="lbl">' + esc(t("strip.total")) +
      '</span><span class="val">' + esc(formatMoney(totalAll)) + ' <span class="cnt">(' + ds.length + ')</span></span></div>';
    html += "</div>";
    document.getElementById("cashStrip").innerHTML = html;
  }

  function renderTabs() {
    var overdueN = allDecorated().filter(function (d) { return d.status === "overdue"; }).length;
    var tabs = [
      ["movimenti", t("nav.movimenti")],
      ["scadenzario", t("nav.scadenzario")],
      ["fornitori", t("nav.fornitori")],
      ["dashboard", t("nav.dashboard")],
      ["dati", t("nav.dati")]
    ];
    var html = '<div class="tabs-inner">';
    tabs.forEach(function (tb) {
      html += '<button type="button" class="tab' + (currentView === tb[0] ? " active" : "") + '" data-action="tab" data-view="' + tb[0] + '">' +
        esc(tb[1]) +
        (tb[0] === "scadenzario" && overdueN > 0 ? '<span class="badge">' + overdueN + "</span>" : "") +
        "</button>";
    });
    html += "</div>";
    document.getElementById("tabs").innerHTML = html;
  }

  function renderBanners() {
    var el = document.getElementById("seedBanner");
    var html = "";
    var meta = S.meta();
    if (S.corruptRecovered()) {
      html += '<div class="banner-wrap"><div class="banner error"><span>' + esc(t("storage.corrupt")) + "</span></div></div>";
    }
    if (S.quotaError()) {
      html += '<div class="banner-wrap"><div class="banner error"><span>' + esc(t("storage.quota")) + "</span></div></div>";
    }
    if (S.seedRefreshPending()) {
      var sd = window.SEED_DATA;
      // importedOn may carry a revision suffix ("2026-07-14-r2"): show just the date part
      html += '<div class="banner-wrap"><div class="banner warn"><span>' +
        esc(t("seed.refresh", { n: sd.records.length, d: formatDate(String(sd.importedOn).slice(0, 10)) })) + "</span>" +
        '<button type="button" data-action="seed-refresh-apply">' + esc(t("seed.refreshApply")) + "</button>" +
        '<button type="button" data-action="seed-refresh-decline">' + esc(t("seed.refreshKeep")) + "</button></div></div>";
    }
    if (meta.seedBannerCount != null && !meta.seedBannerDismissed) {
      html += '<div class="banner-wrap"><div class="banner info"><span>' + esc(t("seed.banner", { n: meta.seedBannerCount })) +
        '</span><button type="button" data-action="dismiss-seed">' + esc(t("seed.dismiss")) + "</button></div></div>";
    }
    el.innerHTML = html;
  }

  /* ================= shared rendering bits ================= */

  function statusChip(d) {
    var st = d.status;
    var label;
    if (st === "overdue" && d.paid > 0) label = t("status.overduePartial");
    else label = t("status." + st);
    return '<span class="chip ' + st + '"><span class="dot"></span>' + esc(label) + "</span>" +
      (d.rec.oldDebt ? ' <span class="chip olddebt">' + esc(t("badge.oldDebt")) + "</span>" : "");
  }

  function daysPill(d) {
    if (!d.rec.dueDate) return d.rec.oldDebt && d.unpaid > 0 ? '<span class="days-pill late">' + esc(t("group.noDateTag")) + "</span>" : "";
    if (d.unpaid <= 0) return "";
    var diff = S.diffDaysISO(TODAY, d.rec.dueDate);
    if (diff < 0) return '<span class="days-pill late">' + esc(t("days.late", { n: -diff })) + "</span>";
    if (diff === 0) return '<span class="days-pill">' + esc(t("days.today")) + "</span>";
    if (diff === 1) return '<span class="days-pill">' + esc(t("days.tomorrow")) + "</span>";
    return '<span class="days-pill">' + esc(t("days.in", { n: diff })) + "</span>";
  }

  /* ================= view router ================= */

  function render() {
    renderChrome();
    var v = document.getElementById("view");
    if (currentView === "movimenti") renderMovimenti(v);
    else if (currentView === "scadenzario") renderScadenzario(v);
    else if (currentView === "fornitori") renderFornitori(v);
    else if (currentView === "dashboard") renderDashboard(v);
    else if (currentView === "dati") renderDati(v);
  }

  function gotoView(v) {
    currentView = v;
    render();
    window.scrollTo(0, 0);
  }

  /* ================= Movimenti ================= */

  function matchesFilters(d) {
    var r = d.rec;
    if (filters.search) {
      var q = filters.search.toLowerCase();
      var hay = (r.supplier + " " + r.invoice + " " + r.notes + " " + r.terms + " " + (r.checkNo || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (filters.status === "unpaid" && d.unpaid <= 0) return false;
    else if (filters.status === "overdue" && d.status !== "overdue") return false;
    else if (filters.status === "partial" && d.status !== "partial") return false;
    else if (filters.status === "paid" && d.status !== "paid") return false;
    else if (filters.status === "checks" && !(r.checkNo && r.checkNo.trim())) return false;
    if (filters.supplier && norm(r.supplier) !== filters.supplier) return false;
    if (filters.from && (!r.arrivalDate || r.arrivalDate < filters.from)) return false;
    if (filters.to && (!r.arrivalDate || r.arrivalDate > filters.to)) return false;
    if (filters.oldDebtOnly && !r.oldDebt) return false;
    return true;
  }

  function sortDecorated(list) {
    var k = sortState.key, dir = sortState.dir;
    var statusOrder = { overdue: 0, partial: 1, open: 2, paid: 3 };
    list.sort(function (a, b) {
      var va, vb;
      switch (k) {
        case "amount": va = a.amount; vb = b.amount; break;
        case "paid": va = a.paid; vb = b.paid; break;
        case "unpaid": va = a.unpaid; vb = b.unpaid; break;
        case "status": va = statusOrder[a.status]; vb = statusOrder[b.status]; break;
        case "supplier": va = norm(a.rec.supplier); vb = norm(b.rec.supplier); break;
        case "invoice": va = norm(a.rec.invoice); vb = norm(b.rec.invoice); break;
        case "terms": va = norm(a.rec.terms); vb = norm(b.rec.terms); break;
        case "dueDate": va = a.rec.dueDate; vb = b.rec.dueDate; break;
        default: va = a.rec.arrivalDate; vb = b.rec.arrivalDate;
      }
      // nulls / empties always last
      var na = va == null || va === "", nb = vb == null || vb === "";
      if (na && nb) { /* tiebreak below */ }
      else if (na) return 1;
      else if (nb) return -1;
      else if (va < vb) return -1 * dir;
      else if (va > vb) return 1 * dir;
      // tiebreak: createdAt then id, newest first when dir=-1
      if (a.rec.id < b.rec.id) return 1 * dir;
      if (a.rec.id > b.rec.id) return -1 * dir;
      return 0;
    });
    return list;
  }

  function filteredMovimenti() {
    return sortDecorated(allDecorated().filter(matchesFilters));
  }

  function renderMovimenti(v) {
    var all = allDecorated();
    var counts = { all: all.length, unpaid: 0, overdue: 0, partial: 0, paid: 0, checks: 0 };
    all.forEach(function (d) {
      if (d.unpaid > 0) counts.unpaid++;
      if (d.status === "overdue") counts.overdue++;
      else if (d.status === "partial") counts.partial++;
      else if (d.status === "paid") counts.paid++;
      if (d.rec.checkNo && d.rec.checkNo.trim()) counts.checks++;
    });

    var supplierOptions = supplierAggregates().map(function (s) {
      return '<option value="' + esc(s.key) + '"' + (filters.supplier === s.key ? " selected" : "") + ">" + esc(s.name) + "</option>";
    }).join("");

    var chips = [
      ["all", t("filter.all", { n: counts.all })],
      ["unpaid", t("filter.unpaid", { n: counts.unpaid })],
      ["overdue", t("filter.overdue", { n: counts.overdue })],
      ["partial", t("filter.partial", { n: counts.partial })],
      ["paid", t("filter.paid", { n: counts.paid })],
      ["checks", t("filter.checks", { n: counts.checks })]
    ].map(function (c) {
      return '<button type="button" class="chip-filter' + (filters.status === c[0] ? " active" : "") + '" data-action="filter-status" data-status="' + c[0] + '">' + esc(c[1]) + "</button>";
    }).join("");

    var html =
      '<div class="toolbar">' +
      '<input type="search" class="search" id="movSearch" placeholder="' + esc(t("search.placeholder")) + '" value="' + esc(filters.search) + '">' +
      '<div class="chips">' + chips + "</div>" +
      // I filtri di dettaglio stanno dentro un interruttore di sole regole CSS:
      // su schermo largo il contenitore sparisce (display:contents) e restano
      // figli diretti della barra come prima; su telefono si aprono a richiesta,
      // altrimenti da soli occupano un quarto dello schermo.
      '<input type="checkbox" id="movAdvToggle" class="adv-toggle">' +
      '<label class="adv-summary" for="movAdvToggle">' + esc(t("filter.more")) + "</label>" +
      '<div class="adv-body">' +
      '<select id="movSupplier"><option value="">' + esc(t("filter.supplierAll")) + "</option>" + supplierOptions + "</select>" +
      '<label class="inline">' + esc(t("filter.from")) + ' <input type="date" id="movFrom" value="' + esc(filters.from) + '"></label>' +
      '<label class="inline">' + esc(t("filter.to")) + ' <input type="date" id="movTo" value="' + esc(filters.to) + '"></label>' +
      '<label class="inline"><input type="checkbox" id="movOldDebt"' + (filters.oldDebtOnly ? " checked" : "") + "> " + esc(t("filter.oldDebtOnly")) + "</label>" +
      '<button type="button" class="btn btn-sm" data-action="clear-filters">⟳ ' + esc(t("action.clearFilters")) + "</button>" +
      "</div>" +
      "</div>" +
      '<div id="movTableWrap"></div>' +
      '<div id="movTotals"></div>' +
      '<div id="selBar"></div>';
    v.innerHTML = html;

    var search = document.getElementById("movSearch");
    var debounce = null;
    search.addEventListener("input", function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        filters.search = search.value;
        renderMovTable();
      }, 200);
    });
    document.getElementById("movSupplier").addEventListener("change", function (e) { filters.supplier = e.target.value; renderMovTable(); });
    document.getElementById("movFrom").addEventListener("change", function (e) { filters.from = e.target.value; renderMovTable(); });
    document.getElementById("movTo").addEventListener("change", function (e) { filters.to = e.target.value; renderMovTable(); });
    document.getElementById("movOldDebt").addEventListener("change", function (e) { filters.oldDebtOnly = e.target.checked; renderMovTable(); });

    renderMovTable();
  }

  function renderMovTable() {
    var wrap = document.getElementById("movTableWrap");
    var totalsEl = document.getElementById("movTotals");
    if (!wrap) return;
    var list = filteredMovimenti();

    // prune the combined-payment selection: keep only ids that still exist and are unpaid
    var unpaidById = {};
    allDecorated().forEach(function (d) { if (d.unpaid > 0) unpaidById[d.rec.id] = true; });
    Object.keys(selection).forEach(function (id) { if (!unpaidById[id]) delete selection[id]; });

    if (!S.records().length) {
      wrap.innerHTML = '<div class="empty"><div class="big">📂</div><div>' + esc(t("empty.fresh")) + '</div>' +
        '<div class="actions"><button type="button" class="btn btn-primary" data-action="goto-dati">' + esc(t("empty.import")) + "</button>" +
        '<button type="button" class="btn" data-action="new-record">' + esc(t("action.new")) + "</button></div></div>";
      totalsEl.innerHTML = "";
      return;
    }
    if (!list.length) {
      wrap.innerHTML = '<div class="empty"><div>' + esc(t("empty.filtered")) + '</div>' +
        '<div class="actions"><button type="button" class="btn" data-action="clear-filters">' + esc(t("action.clearFilters")) + "</button></div></div>";
      totalsEl.innerHTML = "";
      renderSelBar();
      return;
    }

    var cols = [
      ["arrivalDate", t("col.arrival"), ""],
      ["supplier", t("col.supplier"), ""],
      ["invoice", t("col.invoice"), ""],
      ["amount", t("col.amount"), "money"],
      ["paid", t("col.paid"), "money"],
      ["unpaid", t("col.unpaid"), "money"],
      ["status", t("col.status"), ""],
      ["terms", t("col.terms"), ""],
      ["dueDate", t("col.due"), ""]
    ];
    var unpaidInList = list.filter(function (d) { return d.unpaid > 0; });
    var allSelected = unpaidInList.length > 0 && unpaidInList.every(function (d) { return selection[d.rec.id]; });
    var thead = '<tr><th class="selcol"><input type="checkbox" class="sel-cb" data-action="sel-all"' +
      (allSelected ? " checked" : "") + ' title="' + esc(t("sel.all")) + '"></th>' + cols.map(function (c) {
      var arrow = sortState.key === c[0] ? (sortState.dir === 1 ? " ▲" : " ▼") : "";
      return '<th class="sortable ' + c[2] + '" data-action="sort" data-key="' + c[0] + '">' + esc(c[1]) + arrow + "</th>";
    }).join("") + '<th class="nowrap"></th></tr>';

    var totalAmount = 0, totalPaid = 0, totalUnpaid = 0, hasOverdue = false;
    var rows = list.map(function (d) {
      var r = d.rec;
      // clamp at 0 like the strip/dashboard/suppliers: an overpaid record must not
      // shrink the total owed to other suppliers
      totalAmount += d.amount; totalPaid += d.paid; totalUnpaid += Math.max(0, d.unpaid);
      if (d.status === "overdue") hasOverdue = true;
      var trClass = (d.status === "overdue" ? "overdue-row " : "") + (d.status === "paid" ? "paid-row " : "") + (flashId === r.id ? "flash" : "");
      var paidTitle = t("misc.paidSplit", { c: formatMoney(S.toCents(r.paidCash)), o: formatMoney(S.toCents(r.paidOther)) });
      return '<tr class="' + trClass + '" data-id="' + esc(r.id) + '" data-action="edit-row">' +
        '<td class="selcol">' + (d.unpaid > 0 ? '<input type="checkbox" class="sel-cb" data-action="sel-row" data-id="' + esc(r.id) + '"' + (selection[r.id] ? " checked" : "") + ">" : "") + "</td>" +
        '<td class="nowrap num" data-label="' + esc(t("col.arrival")) + '">' + esc(formatDate(r.arrivalDate)) + "</td>" +
        '<td data-label="' + esc(t("col.supplier")) + '"><strong>' + esc(r.supplier) + "</strong></td>" +
        "<td>" + esc(r.invoice || "") + (r.notes ? '<span class="notes-dot" title="' + esc(r.notes) + '">📝</span>' : "") +
        (r.checkNo ? '<div class="checkno" title="' + esc(t("col.checkNo")) + '">' + esc(r.checkNo) + "</div>" : "") + "</td>" +
        '<td class="money" data-label="' + esc(t("col.amount")) + '">' + esc(formatMoney(d.amount)) + "</td>" +
        '<td class="money" data-label="' + esc(t("col.paid")) + '" title="' + esc(paidTitle) + '">' + esc(formatMoney(d.paid)) + "</td>" +
        '<td class="money bold' + (d.status === "overdue" ? " red" : "") + '" data-label="' + esc(t("col.unpaid")) + '">' + esc(formatMoney(d.unpaid)) + "</td>" +
        "<td>" + statusChip(d) + "</td>" +
        "<td>" + esc(r.terms || "") + "</td>" +
        '<td class="nowrap num" data-label="' + esc(t("col.due")) + '">' + esc(formatDate(r.dueDate)) + " " + daysPill(d) + "</td>" +
        '<td><div class="row-actions">' +
        (d.unpaid > 0 ? '<button type="button" class="btn btn-sm" data-action="pay" data-id="' + esc(r.id) + '">€ ' + esc(t("action.pay")) + "</button>" : "") +
        '<button type="button" class="btn btn-sm" data-action="edit" data-id="' + esc(r.id) + '" title="' + esc(t("action.edit")) + '">✎</button>' +
        '<button type="button" class="btn btn-sm" data-action="delete" data-id="' + esc(r.id) + '" title="' + esc(t("action.delete")) + '">🗑</button>' +
        "</div></td></tr>";
    }).join("");

    wrap.innerHTML = '<div class="table-wrap"><table class="grid"><thead>' + thead + "</thead><tbody>" + rows + "</tbody></table></div>";
    totalsEl.innerHTML = '<div class="totalsbar"><span>' +
      t("footer.totals", {
        n: list.length,
        a: "<span class=\"num\">" + esc(formatMoney(totalAmount)) + "</span>",
        p: "<span class=\"num\">" + esc(formatMoney(totalPaid)) + "</span>",
        r: "<span class=\"num" + (hasOverdue ? " red" : "") + "\">" + esc(formatMoney(totalUnpaid)) + "</span>"
      }) + "</span></div>";
    flashId = null;
    renderSelBar();
  }

  /* ---------- combined payment: selection bar + modal ---------- */

  function selectedDecorated() {
    return allDecorated().filter(function (d) { return selection[d.rec.id] && d.unpaid > 0; });
  }

  function renderSelBar() {
    var el = document.getElementById("selBar");
    if (!el) return;
    var sel = selectedDecorated();
    if (!sel.length) { el.innerHTML = ""; return; }
    var total = sel.reduce(function (acc, d) { return acc + d.unpaid; }, 0);
    el.innerHTML = '<div class="selbar">' +
      "<span>" + esc(t("sel.bar", { n: sel.length, x: formatMoney(total) })) + "</span>" +
      '<button type="button" class="btn btn-primary btn-sm" data-action="gpay-open">' + esc(t("sel.payTogether")) + "</button>" +
      '<button type="button" class="btn btn-sm selbar-clear" data-action="sel-clear">' + esc(t("sel.clear")) + "</button>" +
      "</div>";
  }

  var groupPay = null;

  function openGroupPay() {
    var sel = selectedDecorated();
    if (!sel.length) return;
    var total = sel.reduce(function (acc, d) { return acc + d.unpaid; }, 0);
    groupPay = { ids: sel.map(function (d) { return d.rec.id; }), total: total };
    var rows = sel.map(function (d) {
      var r = d.rec;
      return '<div class="gpay-row"><span>' + esc(r.supplier) + (r.invoice ? ' <span class="ginv">' + esc(r.invoice) + "</span>" : "") + "</span>" +
        '<span class="num">' + esc(formatMoney(d.unpaid)) + "</span></div>";
    }).join("");
    var root = document.getElementById("modalRoot");
    root.innerHTML = '<div class="modal-scrim" data-action="gpay-scrim"><div class="modal" data-stop="1">' +
      "<h2>" + esc(t("gpay.title")) + "</h2>" +
      "<p style=\"font-size:13px;color:var(--ink2);margin:0 0 10px\">" + esc(t("gpay.desc")) + "</p>" +
      '<div class="gpay-list">' + rows + "</div>" +
      '<div class="gpay-total"><span>' + esc(t("gpay.total")) + "</span><span>" + esc(formatMoney(total)) + "</span></div>" +
      '<div class="gpay-fields">' +
      '<div class="form-field" style="margin-top:12px"><label for="gpayCheckNo">' + esc(t("gpay.checkNo")) + "</label>" +
      '<input type="text" id="gpayCheckNo" autocomplete="off"></div>' +
      '<div class="form-field" style="margin-top:12px"><label for="gpayDue">' + esc(t("gpay.newDue")) + "</label>" +
      '<input type="date" id="gpayDue"></div>' +
      "</div>" +
      '<div class="pay-warn" id="gpayWarn"></div>' +
      '<div class="gpay-hint">' + esc(t("gpay.methodAuto")) + "</div>" +
      '<div class="pay-methods" style="margin-top:8px">' +
      '<button type="button" class="btn btn-primary gpay-settle" data-action="gpay-confirm" data-method="settle">' + esc(t("gpay.settleAll")) + " — " + esc(formatMoney(total)) + "</button>" +
      "</div>" +
      '<div class="pay-methods" style="margin-top:8px">' +
      '<button type="button" class="btn gpay-defer" data-action="gpay-confirm" data-method="defer">🗓 ' + esc(t("gpay.defer")) + "</button>" +
      "</div>" +
      '<div class="modal-footer end"><button type="button" class="btn" data-action="gpay-cancel">' + esc(t("action.cancel")) + "</button></div>" +
      "</div></div>";
    var input = document.getElementById("gpayCheckNo");
    input.focus();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); confirmGroupPay("settle"); }
    });
  }

  /* The ledger's terms column already says how an invoice gets paid:
     支票/汇款/assegno/bonifico -> check-or-transfer, 现金/contanti -> cash. */
  function inferPayMethod(rec) {
    var terms = String(rec.terms || "");
    if (/支票|汇款|bonifico|assegno|transfer/i.test(terms)) return "other";
    if (/现金|contanti|cash/i.test(terms)) return "cash";
    return "other";
  }

  function appendCheckNo(existing, added) {
    if (!added) return existing || "";
    if (!existing) return added;
    if (existing === added || existing.split(/\s*,\s*/).indexOf(added) !== -1) return existing;
    return existing + ", " + added;
  }

  function confirmGroupPay(method) {
    if (!groupPay) return;
    var checkNo = (document.getElementById("gpayCheckNo").value || "").trim();
    var dueEl = document.getElementById("gpayDue");
    var newDue = dueEl && S.isValidISO(dueEl.value) ? dueEl.value : null;
    if (method === "defer" && !newDue && !checkNo) {
      var warn = document.getElementById("gpayWarn");
      if (warn) warn.textContent = t("gpay.deferNeed");
      return;
    }
    var snapshots = [];
    var paidTotal = 0, count = 0, cashTotal = 0, otherTotal = 0;
    groupPay.ids.forEach(function (id) {
      var rec = S.getRecord(id);
      if (!rec) return;
      var d = decorate(rec);
      if (d.unpaid <= 0) return;
      snapshots.push({ id: id, paidCash: rec.paidCash, paidOther: rec.paidOther, checkNo: rec.checkNo, dueDate: rec.dueDate });
      var upd = {};
      for (var k in rec) upd[k] = rec[k];
      if (method === "settle") {
        if (inferPayMethod(rec) === "cash") { upd.paidCash = (S.toCents(rec.paidCash) + d.unpaid) / 100; cashTotal += d.unpaid; }
        else { upd.paidOther = (S.toCents(rec.paidOther) + d.unpaid) / 100; otherTotal += d.unpaid; }
      }
      if (newDue) upd.dueDate = newDue;
      upd.checkNo = appendCheckNo(rec.checkNo, checkNo);
      S.updateRecord(id, upd);
      paidTotal += d.unpaid;
      count++;
    });
    selection = {};
    closeModal();
    var msg;
    if (method === "defer") {
      msg = newDue ? t("gpay.deferred", { n: count, d: formatDate(newDue) }) : t("gpay.updated", { n: count });
    } else {
      msg = t("gpay.done", { n: count, x: formatMoney(paidTotal) });
      if (cashTotal > 0 && otherTotal > 0) {
        msg += " (" + t("misc.paidSplit", { c: formatMoney(cashTotal), o: formatMoney(otherTotal) }) + ")";
      }
    }
    showToast(msg,
      function () {
        snapshots.forEach(function (s) {
          var cur = S.getRecord(s.id);
          if (!cur) return;
          var u = {};
          for (var k in cur) u[k] = cur[k];
          u.paidCash = s.paidCash; u.paidOther = s.paidOther; u.checkNo = s.checkNo; u.dueDate = s.dueDate;
          S.updateRecord(s.id, u);
        });
        render();
      });
    render();
  }

  /* ================= Scadenzario ================= */

  function renderScadenzario(v) {
    var unpaid = allDecorated().filter(function (d) { return d.unpaid > 0; });
    var sunday = endOfWeekISO();
    var in4w = S.addDaysISO(sunday, 28);

    var groups = [
      { key: "overdue", name: t("group.overdue"), red: true, items: [] },
      { key: "thisWeek", name: t("group.thisWeek"), items: [] },
      { key: "next4Weeks", name: t("group.next4Weeks"), items: [] },
      { key: "later", name: t("group.later"), items: [] },
      { key: "noDue", name: t("group.noDue"), items: [] }
    ];
    unpaid.forEach(function (d) {
      var due = d.rec.dueDate;
      if (d.status === "overdue") groups[0].items.push(d);
      else if (!due) groups[4].items.push(d);
      else if (due <= sunday) groups[1].items.push(d);
      else if (due <= in4w) groups[2].items.push(d);
      else groups[3].items.push(d);
    });
    groups.forEach(function (g) {
      g.items.sort(function (a, b) {
        var da = a.rec.dueDate, db = b.rec.dueDate;
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da < db ? -1 : da > db ? 1 : 0;
      });
      g.total = g.items.reduce(function (acc, d) { return acc + d.unpaid; }, 0);
    });

    var html = '<div class="toolbar">' +
      '<div class="view-title" style="margin:0;flex:1">' + esc(t("nav.scadenzario")) + "</div>" +
      '<button type="button" class="btn" data-action="print">🖨 ' + esc(t("action.print")) + "</button>" +
      "</div>" +
      '<div class="print-only">' + esc(t("print.title", { d: formatDate(TODAY) })) + "</div>";

    if (!unpaid.length) {
      html += '<div class="empty green"><div class="big">✓</div><div>' + esc(t("empty.scadenzario")) + "</div></div>";
      v.innerHTML = html;
      return;
    }

    var cumulative = 0;
    groups.forEach(function (g) {
      if (!g.items.length) return;
      cumulative += g.total;
      html += '<div class="sgroup"><div class="sgroup-header' + (g.red ? " red" : "") + '">' +
        '<span class="gname">' + esc(g.name) + '</span><span class="gcount">(' + g.items.length + ")</span>" +
        '<span class="gsub">' + esc(t("group.subtotal")) + " " + esc(formatMoney(g.total)) + "</span>" +
        '<span class="gcum">' + esc(t("group.cumulative", { x: formatMoney(cumulative) })) + "</span></div>";
      g.items.forEach(function (d) {
        var r = d.rec;
        html += '<div class="srow' + (d.status === "overdue" ? " overdue-row" : "") + '" data-action="edit-row" data-id="' + esc(r.id) + '">' +
          '<span class="sdate num">' + esc(formatDate(r.dueDate)) + "</span>" +
          daysPill(d) +
          '<span class="ssup">' + esc(r.supplier) + "</span>" +
          (r.invoice ? '<span class="sinv">' + esc(r.invoice) + "</span>" : "") +
          (r.terms ? '<span class="sterms">' + esc(r.terms) + "</span>" : "") +
          (r.oldDebt ? '<span class="chip olddebt">' + esc(t("badge.oldDebt")) + "</span>" : "") +
          '<span class="samt' + (d.status === "overdue" ? " red" : "") + '">' + esc(formatMoney(d.unpaid)) + "</span>" +
          '<button type="button" class="btn btn-sm" data-action="pay" data-id="' + esc(r.id) + '">€ ' + esc(t("action.pay")) + "</button>" +
          "</div>";
      });
      html += "</div>";
    });
    html += '<div class="print-sign">' + esc(t("print.sign")) + ": ______________________________</div>";
    v.innerHTML = html;
  }

  /* ================= Fornitori ================= */

  function supplierAggregates() {
    var map = {};
    S.records().forEach(function (r) {
      var key = norm(r.supplier);
      if (!key) return;
      var d = decorate(r);
      var agg = map[key];
      if (!agg) {
        agg = map[key] = { key: key, name: r.supplier.trim(), count: 0, total: 0, paid: 0, unpaid: 0, overdue: 0, lastArrival: null, lastCreated: "" };
      }
      agg.count++;
      agg.total += d.amount; agg.paid += d.paid; agg.unpaid += Math.max(0, d.unpaid);
      if (d.status === "overdue") agg.overdue += d.unpaid;
      if (r.arrivalDate && (!agg.lastArrival || r.arrivalDate > agg.lastArrival)) {
        agg.lastArrival = r.arrivalDate;
      }
      if (r.id > agg.lastCreated) { agg.lastCreated = r.id; agg.name = r.supplier.trim(); }
    });
    var list = Object.keys(map).map(function (k) { return map[k]; });
    list.sort(function (a, b) { return b.unpaid - a.unpaid || a.name.localeCompare(b.name); });
    return list;
  }

  var supSearch = "";

  function renderFornitori(v) {
    var html = '<div class="toolbar">' +
      '<div class="view-title" style="margin:0">' + esc(t("nav.fornitori")) + "</div>" +
      '<input type="search" class="search" id="supSearch" placeholder="' + esc(t("sup.search")) + '" value="' + esc(supSearch) + '">' +
      "</div>" +
      '<div id="supTableWrap"></div>';
    v.innerHTML = html;
    var input = document.getElementById("supSearch");
    var deb = null;
    input.addEventListener("input", function () {
      clearTimeout(deb);
      deb = setTimeout(function () { supSearch = input.value; renderSupTable(); }, 200);
    });
    renderSupTable();
  }

  function renderSupTable() {
    var wrap = document.getElementById("supTableWrap");
    if (!wrap) return;
    var list = supplierAggregates();
    if (supSearch) {
      var q = supSearch.toLowerCase();
      list = list.filter(function (s) { return s.name.toLowerCase().indexOf(q) !== -1; });
    }
    if (!list.length) {
      wrap.innerHTML = '<div class="empty">' + esc(S.records().length ? t("empty.filtered") : t("empty.fresh")) + "</div>";
      return;
    }
    var totU = 0, totT = 0, totP = 0;
    var rows = list.map(function (s) {
      totU += s.unpaid; totT += s.total; totP += s.paid;
      return '<tr class="sup-row" data-action="sup-open" data-key="' + esc(s.key) + '">' +
        "<td><strong>" + esc(s.name) + "</strong></td>" +
        '<td class="num">' + s.count + "</td>" +
        '<td class="money">' + esc(formatMoney(s.total)) + "</td>" +
        '<td class="money">' + esc(formatMoney(s.paid)) + "</td>" +
        '<td class="money bold' + (s.unpaid > 0 ? "" : "") + '">' + esc(formatMoney(s.unpaid)) + "</td>" +
        '<td class="money' + (s.overdue > 0 ? " red" : "") + '">' + (s.overdue > 0 ? esc(formatMoney(s.overdue)) : esc(t("misc.dash"))) + "</td>" +
        '<td class="nowrap num">' + esc(formatDate(s.lastArrival)) + "</td>" +
        '<td><button type="button" class="btn btn-sm" data-action="sup-open" data-key="' + esc(s.key) + '">' + esc(t("sup.viewMovs")) + " →</button></td></tr>";
    }).join("");
    wrap.innerHTML = '<div class="table-wrap"><table class="grid"><thead><tr>' +
      "<th>" + esc(t("col.supplier")) + "</th>" +
      "<th>" + esc(t("sup.records")) + "</th>" +
      '<th class="money">' + esc(t("sup.total")) + "</th>" +
      '<th class="money">' + esc(t("sup.paid")) + "</th>" +
      '<th class="money">' + esc(t("sup.unpaid")) + "</th>" +
      '<th class="money">' + esc(t("sup.ofWhichOverdue")) + "</th>" +
      "<th>" + esc(t("sup.lastArrival")) + "</th><th></th>" +
      "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
      '<div class="totalsbar"><span>' + t("footer.suppliers", {
        n: list.length,
        a: "<span class=\"num\">" + esc(formatMoney(totT)) + "</span>",
        p: "<span class=\"num\">" + esc(formatMoney(totP)) + "</span>",
        r: "<span class=\"num\">" + esc(formatMoney(totU)) + "</span>"
      }) + "</span></div>";
  }

  /* ================= Dashboard ================= */

  function renderDashboard(v) {
    var ds = allDecorated();
    if (!ds.length) {
      v.innerHTML = '<div class="empty"><div class="big">📂</div><div>' + esc(t("empty.fresh")) + '</div>' +
        '<div class="actions"><button type="button" class="btn btn-primary" data-action="goto-dati">' + esc(t("empty.import")) + "</button>" +
        '<button type="button" class="btn" data-action="new-record">' + esc(t("action.new")) + "</button></div></div>";
      return;
    }
    var week7 = S.addDaysISO(TODAY, 7);
    var month = TODAY.slice(0, 7);
    var overdue = 0, overdueN = 0, oldestDays = 0;
    var due7 = 0, due7N = 0;
    var open = 0, oldDebtOpen = 0;
    var paidMonth = 0, paidMonthN = 0;
    ds.forEach(function (d) {
      var r = d.rec;
      if (r.dueDate && r.dueDate.slice(0, 7) === month && d.paid > 0) { paidMonth += d.paid; paidMonthN++; }
      if (d.unpaid <= 0) return;
      open += d.unpaid;
      if (r.oldDebt) oldDebtOpen += d.unpaid;
      if (d.status === "overdue") {
        overdue += d.unpaid; overdueN++;
        if (r.dueDate) {
          var late = -S.diffDaysISO(TODAY, r.dueDate);
          if (late > oldestDays) oldestDays = late;
        }
      } else if (r.dueDate && r.dueDate >= TODAY && r.dueDate <= week7) {
        due7 += d.unpaid; due7N++;
      }
    });

    var html = '<div class="kpi-row">' +
      '<div class="kpi ' + (overdue > 0 ? "red" : "green") + '" data-action="goto-scadenzario">' +
      '<div class="klabel">' + esc(t("dash.kpi.overdue")) + '</div><div class="kval">' + esc(formatMoney(overdue)) + "</div>" +
      '<div class="ksub">' + (overdueN ? esc(t("dash.kpi.overdueSub", { n: overdueN, d: oldestDays })) : esc(t("strip.noOverdue"))) + "</div></div>" +
      '<div class="kpi amber" data-action="goto-scadenzario">' +
      '<div class="klabel">' + esc(t("dash.kpi.week")) + '</div><div class="kval">' + esc(formatMoney(due7)) + "</div>" +
      '<div class="ksub">' + esc(t("dash.kpi.weekSub", { n: due7N })) + "</div></div>" +
      '<div class="kpi teal" data-action="goto-open">' +
      '<div class="klabel">' + esc(t("dash.kpi.open")) + '</div><div class="kval">' + esc(formatMoney(open)) + "</div>" +
      '<div class="ksub">' + esc(t("dash.kpi.openSub", { x: formatMoney(oldDebtOpen) })) + "</div></div>" +
      '<div class="kpi green">' +
      '<div class="klabel">' + esc(t("dash.kpi.paidMonth")) + '</div><div class="kval">' + esc(formatMoney(paidMonth)) + "</div>" +
      '<div class="ksub">' + esc(t("dash.kpi.paidMonthHint")) + "</div></div>" +
      "</div>";

    // "pay now" list
    var payNow = ds.filter(function (d) { return d.unpaid > 0; });
    payNow.sort(function (a, b) {
      var ao = a.status === "overdue" ? 0 : 1, bo = b.status === "overdue" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      var da = a.rec.dueDate, db = b.rec.dueDate;
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da < db ? -1 : da > db ? 1 : 0;
    });
    payNow = payNow.slice(0, 10);
    var listTotal = payNow.reduce(function (acc, d) { return acc + d.unpaid; }, 0);
    var listHtml = payNow.map(function (d) {
      var r = d.rec;
      return '<div class="dash-list-row" data-action="edit-row" data-id="' + esc(r.id) + '" style="cursor:pointer">' +
        '<span class="dd">' + esc(formatDate(r.dueDate)) + "</span>" + daysPill(d) +
        '<span class="ds">' + esc(r.supplier) + "</span>" +
        (r.invoice ? '<span class="sinv" style="color:var(--ink2);font-size:12px">' + esc(r.invoice) + "</span>" : "") +
        '<span class="da' + (d.status === "overdue" ? " red" : "") + '">' + esc(formatMoney(d.unpaid)) + "</span>" +
        '<button type="button" class="btn btn-sm" data-action="pay" data-id="' + esc(r.id) + '">€ ' + esc(t("action.pay")) + "</button>" +
        "</div>";
    }).join("");

    // top 5 suppliers
    var sups = supplierAggregates().filter(function (s) { return s.unpaid > 0; }).slice(0, 5);
    var maxU = sups.length ? sups[0].unpaid : 1;
    var barsHtml = sups.map(function (s) {
      var w = Math.max(2, Math.round((s.unpaid / maxU) * 100));
      var redW = s.unpaid > 0 ? Math.round((s.overdue / s.unpaid) * w) : 0;
      return '<div class="hbar-row">' +
        '<span class="hname" data-action="sup-open" data-key="' + esc(s.key) + '">' + esc(s.name) + "</span>" +
        '<div class="hbar-track">' +
        (redW > 0 ? '<div class="hbar-fill red" style="width:' + redW + '%"></div>' : "") +
        '<div class="hbar-fill" style="width:' + (w - redW) + '%"></div>' +
        "</div>" +
        '<span class="hval">' + esc(formatMoney(s.unpaid)) + "</span></div>";
    }).join("");

    html += '<div class="dash-cols">' +
      '<div class="card"><div class="section-title">' + esc(t("dash.payNow")) + "</div>" +
      (listHtml || '<div class="empty-inline">' + esc(t("empty.scadenzario")) + "</div>") +
      (payNow.length ? '<div class="dash-total">' + esc(t("dash.listTotal")) + ": " + esc(formatMoney(listTotal)) + "</div>" : "") +
      '<div style="margin-top:10px"><button type="button" class="btn btn-ghost" data-action="goto-scadenzario">' + esc(t("dash.viewList")) + " →</button></div>" +
      "</div>" +
      '<div class="card"><div class="section-title">' + esc(t("dash.topSuppliers")) + "</div>" +
      (barsHtml || '<div class="empty-inline">' + esc(t("misc.dash")) + "</div>") +
      "</div></div>";

    v.innerHTML = html;
  }

  /* ================= Dati ================= */

  function renderDati(v) {
    var n = S.records().length;
    var kb = Math.round(S.storageBytes() / 1024);
    var html = '<div class="view-title">' + esc(t("nav.dati")) + "</div>" +
      '<div class="dati-grid">' +
      '<div class="card dati-card"><h3>' + esc(t("dati.import")) + "</h3><p>" + esc(t("dati.importDesc")) + "</p>" +
      '<div class="actions"><button type="button" class="btn btn-primary" data-action="import-open">' + esc(t("dati.chooseFile")) + "</button></div></div>" +
      '<div class="card dati-card"><h3>' + esc(t("dati.export")) + "</h3><p>" + esc(t("dati.exportDesc")) + "</p>" +
      '<div class="actions"><button type="button" class="btn btn-primary" data-action="export-csv">' + esc(t("dati.export")) + "</button></div></div>" +
      '<div class="card dati-card"><h3>' + esc(t("dati.backup")) + "</h3><p>" + esc(t("dati.backupDesc")) + "</p>" +
      '<div class="actions"><button type="button" class="btn btn-primary" data-action="backup-json">' + esc(t("backup.download")) + "</button>" +
      '<button type="button" class="btn" data-action="restore-json">' + esc(t("backup.restore")) + "</button></div>" +
      '<p style="margin:12px 0 0">' + esc(t("dati.storageNote")) + "</p></div>" +
      '<div class="card dati-card"><h3>' + esc(t("dati.links")) + "</h3><p>" + esc(t("dati.linksDesc")) + "</p>" +
      '<div class="form-field"><label for="datiBankUrl">' + esc(t("bank.url")) + "</label>" +
      '<input type="text" id="datiBankUrl" placeholder="https://…" value="' + esc(S.meta().bankUrl || "") + '"></div>' +
      '<div class="actions" style="margin-top:10px"><button type="button" class="btn btn-primary" data-action="bank-save">' + esc(t("action.save")) + "</button></div></div>" +
      '<div class="card dati-card danger"><h3>' + esc(t("dati.reset")) + "</h3><p>" + esc(t("dati.resetDesc")) + "</p>" +
      '<div class="actions"><button type="button" class="btn btn-danger" data-action="reset-all">' + esc(t("reset.btn")) + "</button></div></div>" +
      "</div>" +
      '<div class="card" style="margin-top:16px"><h3 style="font-size:16px;margin-bottom:6px">' + esc(t("dati.info")) + "</h3>" +
      '<p style="font-size:13px;color:var(--ink2)">' + esc(t("dati.infoLine", { n: n, kb: kb })) + "</p></div>" +
      '<input type="file" id="restoreFile" accept=".json,application/json" style="display:none">';
    v.innerHTML = html;

    document.getElementById("restoreFile").addEventListener("change", onRestoreFile);
  }

  /* ---------- CSV export ---------- */

  function csvField(s) {
    return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"';
  }

  function csvAmount(cents) {
    return (cents / 100).toFixed(2).replace(".", ",");
  }

  function exportCSV() {
    var header = ["id", t("col.arrival"), t("col.supplier"), t("col.invoice"), t("col.amount"),
      t("form.paidCash"), t("form.paidOther"), t("col.unpaid"), t("col.status"),
      t("col.terms"), t("col.due"), t("col.notes"), t("col.checkNo"), t("form.oldDebt"), "createdAt"];
    var lines = [header.map(csvField).join(";")];
    allDecorated().forEach(function (d) {
      var r = d.rec;
      lines.push([
        r.id, r.arrivalDate || "", r.supplier, r.invoice,
        csvAmount(d.amount), csvAmount(S.toCents(r.paidCash)), csvAmount(S.toCents(r.paidOther)), csvAmount(d.unpaid),
        t("status." + d.status), r.terms, r.dueDate || "", r.notes, r.checkNo || "",
        r.oldDebt ? t("misc.yes") : t("misc.no"), r.createdAt
      ].map(csvField).join(";"));
    });
    var content = "﻿" + lines.join("\r\n");
    downloadFile("pagamenti_" + TODAY + ".csv", content, "text/csv;charset=utf-8");
  }

  function backupJSON() {
    var payload = {
      app: "huokuan", version: 1, exportedAt: new Date().toISOString(),
      records: S.records(), meta: { nextId: S.meta().nextId }
    };
    downloadFile("pagamenti-backup-" + TODAY + ".json", JSON.stringify(payload, null, 1), "application/json");
  }

  function downloadFile(name, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }

  function onRestoreFile(e) {
    var file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data = null;
      try { data = JSON.parse(reader.result); } catch (err) { data = null; }
      var records = data && Array.isArray(data.records) ? data.records : null;
      var isNum = function (v) { return typeof v === "number" && isFinite(v); };
      var valid = records && records.every(function (r) {
        return r && typeof r === "object" && r.supplier !== undefined &&
          isNum(r.amount) &&
          (r.paidCash == null || isNum(r.paidCash)) &&
          (r.paidOther == null || isNum(r.paidOther));
      });
      if (!valid) { showToast(t("backup.invalid"), null, true); return; }
      var when = data.exportedAt ? formatDate(String(data.exportedAt).slice(0, 10)) : t("misc.dash");
      if (!window.confirm(t("backup.restoreConfirm", { n: records.length, d: when }))) return;
      S.replaceAll(records, true);
      S.meta().seedBannerDismissed = true;
      S.save();
      showToast(t("backup.restored", { n: records.length }));
      render();
    };
    reader.readAsText(file, "utf-8");
  }

  function resetAll() {
    var n = S.records().length;
    if (!window.confirm(t("reset.confirm1", { n: n }))) return;
    if (!window.confirm(t("reset.confirm2"))) return;
    S.replaceAll([], true);
    S.meta().seedBannerDismissed = true;
    S.save();
    showToast(t("reset.done"));
    render();
  }

  /* ================= import wizard ================= */

  function openImportWizard() {
    wizard = { step: 1, workbook: null, sheet: null, mapped: null, error: null, loading: false };
    renderWizard();
  }

  function renderWizard() {
    if (!wizard) return;
    var root = document.getElementById("modalRoot");
    var body = "";
    var steps = '<div class="wizard-steps">' +
      '<span class="' + (wizard.step === 1 ? "on" : "") + '">' + esc(t("import.step1")) + "</span>" +
      '<span class="' + (wizard.step === 2 ? "on" : "") + '">' + esc(t("import.step2")) + "</span>" +
      '<span class="' + (wizard.step === 3 ? "on" : "") + '">' + esc(t("import.step3")) + "</span></div>";

    if (wizard.step === 1) {
      if (!X.supported) {
        body = '<div class="banner error" style="margin:0">' + esc(t("import.errUnsupported")) + "</div>";
      } else if (wizard.error) {
        var errMsg;
        if (wizard.errorCode === "notXlsx") errMsg = t("import.errNotXlsx");
        else if (wizard.errorCode === "unsupported") errMsg = t("import.errUnsupported");
        else errMsg = t("import.errFile", { x: wizard.error });
        body = '<div class="banner error" style="margin:0 0 12px">' + esc(errMsg) + "</div>" +
          '<input type="file" id="wizFile" accept=".xlsx">';
      } else if (wizard.loading) {
        body = "<p>" + esc(t("import.reading")) + "</p>";
      } else if (wizard.workbook) {
        body = "<p>" + esc(t("import.pickSheet")) + '</p><div class="sheet-pick">' +
          wizard.workbook.sheets.map(function (sh, i) {
            // count the rows the mapper would actually import, not raw XML rows
            // (style-only cells make thousands of empty rows look non-empty)
            if (sh.mappedRowCount == null) sh.mappedRowCount = X.mapSheet(sh.rows).rows.length;
            return '<button type="button" class="btn" data-action="wiz-sheet" data-idx="' + i + '">' +
              esc(sh.name) + " — " + esc(t("import.sheetRows", { n: sh.mappedRowCount })) + "</button>";
          }).join("") + "</div>";
      } else {
        body = '<input type="file" id="wizFile" accept=".xlsx">';
      }
    } else if (wizard.step === 2) {
      var mp = wizard.mapped;
      if (!mp.rows.length) {
        body = "<p>" + esc(t("import.noRows")) + '</p>' +
          '<div class="modal-footer end"><button type="button" class="btn" data-action="wiz-back">' + esc(t("action.back")) + "</button></div>";
      } else {
        var prev = mp.rows.slice(0, 20).map(function (r) {
          return "<tr><td class=\"nowrap num\">" + esc(formatDate(r.arrivalDate)) + "</td>" +
            "<td>" + esc(r.supplier) + "</td><td>" + esc(r.invoice) + "</td>" +
            '<td class="money">' + esc(formatMoney(S.toCents(r.amount))) + "</td>" +
            '<td class="money">' + esc(formatMoney(S.toCents(r.paidCash))) + "</td>" +
            '<td class="money">' + esc(formatMoney(S.toCents(r.paidOther))) + "</td>" +
            "<td>" + esc(r.terms) + "</td>" +
            '<td class="nowrap num">' + esc(formatDate(r.dueDate)) + "</td>" +
            "<td>" + esc(r.notes) + "</td>" +
            "<td>" + esc(r.checkNo || "") + "</td></tr>";
        }).join("");
        body = "<p>" + esc(t("import.previewTitle", { n: mp.rows.length })) + "</p>" +
          '<div class="preview-wrap"><table class="grid"><thead><tr>' +
          "<th>" + esc(t("col.arrival")) + "</th><th>" + esc(t("col.supplier")) + "</th><th>" + esc(t("col.invoice")) + "</th>" +
          '<th class="money">' + esc(t("col.amount")) + '</th><th class="money">' + esc(t("form.paidCash")) + '</th><th class="money">' + esc(t("form.paidOther")) + "</th>" +
          "<th>" + esc(t("col.terms")) + "</th><th>" + esc(t("col.due")) + "</th><th>" + esc(t("col.notes")) + "</th><th>" + esc(t("col.checkNo")) + "</th>" +
          "</tr></thead><tbody>" + prev + "</tbody></table></div>" +
          '<label class="inline" style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px">' +
          '<input type="checkbox" id="wizSkipDup" checked> ' + esc(t("import.skipDup")) + "</label>" +
          '<div class="modal-footer end">' +
          '<button type="button" class="btn" data-action="wiz-back">' + esc(t("action.back")) + "</button>" +
          '<button type="button" class="btn btn-primary" data-action="wiz-import">' + esc(t("import.doImport", { n: mp.rows.length })) + "</button></div>";
      }
    } else if (wizard.step === 3) {
      body = '<div class="import-summary">✓ ' + esc(t("import.done")) + "</div>" +
        "<p>" + esc(t("import.summary", { a: wizard.result.imported, s: wizard.result.skipped, w: wizard.mapped.skipped })) + "</p>" +
        '<div class="modal-footer end"><button type="button" class="btn btn-primary" data-action="wiz-close">' + esc(t("action.close")) + "</button></div>";
    }

    root.innerHTML = '<div class="modal-scrim" data-action="wiz-scrim"><div class="modal wide" data-stop="1">' +
      "<h2>" + esc(t("import.title")) + "</h2>" + steps + body +
      (wizard.step === 1 ? '<div class="modal-footer end"><button type="button" class="btn" data-action="wiz-close">' + esc(t("action.cancel")) + "</button></div>" : "") +
      "</div></div>";

    var fileInput = document.getElementById("wizFile");
    if (fileInput) {
      fileInput.addEventListener("change", function (e) {
        var file = e.target.files[0];
        if (!file) return;
        wizard.loading = true; wizard.error = null; wizard.errorCode = null;
        renderWizard();
        file.arrayBuffer().then(function (buf) {
          return X.readWorkbook(buf);
        }).then(function (wb) {
          wizard.loading = false;
          wizard.workbook = wb;
          if (wb.sheets.length === 1) {
            pickWizardSheet(0);
          } else {
            renderWizard();
          }
        }).catch(function (err) {
          wizard.loading = false;
          wizard.workbook = null;
          wizard.error = err && err.message ? err.message : String(err);
          wizard.errorCode = err && err.code ? err.code : null;
          renderWizard();
        });
      });
    }
  }

  function pickWizardSheet(idx) {
    wizard.sheet = wizard.workbook.sheets[idx];
    wizard.mapped = X.mapSheet(wizard.sheet.rows);
    wizard.step = 2;
    renderWizard();
  }

  function doWizardImport() {
    var skip = document.getElementById("wizSkipDup");
    var result = S.importRecords(wizard.mapped.rows, skip ? skip.checked : true);
    wizard.result = result;
    wizard.step = 3;
    renderWizard();
    renderChrome();
  }

  /* ================= record form modal ================= */

  var form = null; // {mode:'new'|'edit', id, saved fields...}

  function openForm(rec) {
    form = {
      mode: rec ? "edit" : "new",
      id: rec ? rec.id : null,
      rec: rec || null
    };
    renderForm(rec);
  }

  /* best-effort parse of a terms string (old data is free text, also Chinese) */
  function parseTermsString(s) {
    s = (s || "").toLowerCase();
    var o = { days: null, custom: false, method: null };
    var m = /(\d+)/.exec(s);
    if (m) {
      o.days = parseInt(m[1], 10);
      o.custom = o.days !== 30 && o.days !== 60 && o.days !== 90 && o.days !== 0;
    }
    if (/支票|assegno/.test(s)) o.method = "assegno";
    else if (/汇款|银行|bonifico|bank/.test(s)) o.method = "bonifico";
    else if (/现金|contanti/.test(s)) o.method = "contanti";
    // 现金/Contanti with no day count = immediate (due on arrival) — e.g. 现金支票,
    // a check handed over at delivery that the supplier cashes at will
    if (o.days == null && /现金|contanti/.test(s)) { o.days = 0; o.custom = false; }
    return o;
  }

  var METHOD_LABELS = { assegno: "Assegno", bonifico: "Bonifico", contanti: "Contanti" };

  function currentTermDays() {
    if (form.termCustom) {
      var el = document.getElementById("fTermDays");
      var n = el ? parseInt(el.value, 10) : NaN;
      return isNaN(n) || n <= 0 ? null : n;
    }
    return form.termDays;
  }

  function composeTermsString() {
    var days = currentTermDays();
    var parts = [];
    if (days === 0) parts.push(METHOD_LABELS.contanti); // immediate: "Contanti", "Contanti Assegno", ...
    else if (days != null) parts.push(days + "gg");
    if (form.termMethod && !(days === 0 && form.termMethod === "contanti")) parts.push(METHOD_LABELS[form.termMethod]);
    return parts.join(" ");
  }

  function supplierDatalist() {
    return '<datalist id="dlSuppliers">' + supplierAggregates().map(function (s) {
      return '<option value="' + esc(s.name) + '"></option>';
    }).join("") + "</datalist>";
  }

  function renderForm(rec) {
    var root = document.getElementById("modalRoot");
    var isEdit = form.mode === "edit";
    var r = rec || { supplier: "", arrivalDate: TODAY, invoice: "", amount: 0, paidCash: 0, paidOther: 0, terms: "", dueDate: null, notes: "", oldDebt: false, checkNo: "" };
    var title = isEdit ? t("form.editTitle", { s: r.supplier }) : t("form.newTitle");
    var pt = parseTermsString(r.terms);
    form.termDays = pt.custom ? null : pt.days;
    form.termCustom = pt.custom;
    form.termMethod = pt.method;
    form.dueManual = !!r.dueDate;

    var html = '<div class="modal-scrim" data-action="form-scrim"><div class="modal" data-stop="1">' +
      "<h2>" + esc(title) + "</h2>" +
      '<div class="form-grid">' +
      '<div class="form-field"><label for="fSupplier">' + esc(t("form.supplier")) + ' *</label>' +
      '<input type="text" id="fSupplier" list="dlSuppliers" value="' + esc(r.supplier) + '" autocomplete="off">' +
      '<span class="err" id="eSupplier"></span></div>' +
      '<div class="form-field"><label for="fArrival">' + esc(t("form.arrival")) + "</label>" +
      '<input type="date" id="fArrival" value="' + esc(r.arrivalDate || "") + '"></div>' +
      '<div class="form-field"><label for="fInvoice">' + esc(t("form.invoice")) + "</label>" +
      '<input type="text" id="fInvoice" value="' + esc(r.invoice) + '"><span class="hint warn" id="hDupInvoice"></span></div>' +
      '<div class="form-field"><label for="fAmount">' + esc(t("form.amount")) + ' *</label>' +
      '<input type="text" id="fAmount" inputmode="decimal" style="text-align:right" value="' + (S.toCents(r.amount) ? esc(formatAmountInput(S.toCents(r.amount))) : "") + '">' +
      '<span class="err" id="eAmount"></span></div>' +
      '<div class="form-field"><label>' + esc(t("form.terms")) + "</label>" +
      '<div class="chips term-chips">' +
      '<button type="button" class="chip-filter' + (!pt.custom && pt.days === 0 ? " active" : "") + '" data-action="term-days" data-days="0">' + esc(t("method.contanti")) + "</button>" +
      [30, 60, 90].map(function (dd) {
        return '<button type="button" class="chip-filter' + (!pt.custom && pt.days === dd ? " active" : "") + '" data-action="term-days" data-days="' + dd + '">' + dd + " gg</button>";
      }).join("") +
      '<button type="button" class="chip-filter' + (pt.custom ? " active" : "") + '" data-action="term-days" data-days="custom">' + esc(t("term.custom")) + "</button>" +
      '<input type="number" id="fTermDays" min="1" placeholder="gg" style="width:72px;' + (pt.custom ? "" : "display:none") + '" value="' + (pt.custom && pt.days ? pt.days : "") + '">' +
      "</div></div>" +
      '<div class="form-field"><label>' + esc(t("form.methodLabel")) + "</label>" +
      '<div class="chips term-chips">' +
      ["assegno", "bonifico", "contanti"].map(function (mm) {
        return '<button type="button" class="chip-filter' + (pt.method === mm ? " active" : "") + '" data-action="term-method" data-method="' + mm + '">' + esc(t("method." + mm)) + "</button>";
      }).join("") +
      "</div></div>" +
      '<div class="form-field"><label for="fDue">' + esc(t("form.due")) + "</label>" +
      '<input type="date" id="fDue" value="' + esc(r.dueDate || "") + '"><span class="hint">' + esc(t("form.dueAutoHelp")) + "</span></div>" +
      '<div class="check-field"><input type="checkbox" id="fPaidFull"' +
      (S.toCents(r.amount) > 0 && S.toCents(r.paidCash) + S.toCents(r.paidOther) >= S.toCents(r.amount) ? " checked" : "") + '>' +
      '<div><label for="fPaidFull" style="font-weight:600">' + esc(t("form.paidFull")) + '</label>' +
      '<div class="help">' + esc(t("form.paidFullHelp")) + "</div></div></div>" +
      '<div class="form-field"><label for="fCheckNo">' + esc(t("form.checkNo")) + "</label>" +
      '<input type="text" id="fCheckNo" value="' + esc(r.checkNo || "") + '" autocomplete="off"></div>' +
      '<div class="residuo-line" id="fResiduo"></div>' +
      '<div class="form-field full"><label for="fNotes">' + esc(t("form.notes")) + "</label>" +
      '<textarea id="fNotes" rows="2">' + esc(r.notes) + "</textarea></div>" +
      "</div>" +
      '<div class="modal-footer">' +
      '<span class="meta">' + (isEdit ? esc(r.id + " · " + formatDate(r.createdAt)) : "") + "</span>" +
      (isEdit ? '<button type="button" class="btn btn-danger" data-action="form-delete">' + esc(t("action.delete")) + "</button>" : "") +
      '<button type="button" class="btn" data-action="form-cancel">' + esc(t("action.cancel")) + "</button>" +
      (!isEdit ? '<button type="button" class="btn" data-action="form-save-new">' + esc(t("action.saveNew")) + "</button>" : "") +
      '<button type="button" class="btn btn-primary" data-action="form-save">' + esc(t("action.save")) + "</button>" +
      "</div>" +
      supplierDatalist() +
      "</div></div>";

    root.innerHTML = html;

    var elAmount = document.getElementById("fAmount");
    elAmount.addEventListener("input", updateResiduo);
    elAmount.addEventListener("blur", function () {
      var c = parseAmountInput(elAmount.value);
      if (c != null) elAmount.value = formatAmountInput(c);
    });
    document.getElementById("fPaidFull").addEventListener("change", updateResiduo);
    updateResiduo();

    document.getElementById("fInvoice").addEventListener("blur", function () {
      var inv = document.getElementById("fInvoice").value.trim();
      var sup = document.getElementById("fSupplier").value.trim();
      var hint = document.getElementById("hDupInvoice");
      hint.textContent = "";
      if (!inv || !sup) return;
      var dup = S.records().find(function (x) {
        return x.id !== form.id && norm(x.supplier) === norm(sup) && x.invoice.trim() === inv;
      });
      if (dup) hint.textContent = t("form.dupInvoice", { f: inv, s: dup.supplier, d: formatDate(dup.arrivalDate || dup.createdAt) });
    });

    document.getElementById("fArrival").addEventListener("change", function () { applyTermsDue(false); });
    document.getElementById("fDue").addEventListener("change", function () { form.dueManual = true; });
    document.getElementById("fTermDays").addEventListener("input", function () { applyTermsDue(true); });

    document.getElementById("fSupplier").focus();

    form.initial = formSnapshot();
  }

  /* serialize the form fields to detect unsaved edits */
  function formSnapshot() {
    var ids = ["fSupplier", "fArrival", "fInvoice", "fAmount", "fTermDays", "fDue", "fCheckNo", "fNotes"];
    var parts = ids.map(function (id) {
      var el = document.getElementById(id);
      return el ? el.value : "";
    });
    parts.push(String(form.termDays), form.termCustom ? "1" : "0", form.termMethod || "");
    var pf = document.getElementById("fPaidFull");
    parts.push(pf && pf.checked ? "1" : "0");
    return parts.join("\u0001");
  }

  function formIsDirty() {
    return !!(form && form.initial != null && formSnapshot() !== form.initial);
  }

  /* auto-fill the due date from arrival + selected terms; manual edits win */
  function applyTermsDue(force) {
    var dueEl = document.getElementById("fDue");
    var arrEl = document.getElementById("fArrival");
    if (!dueEl || !arrEl) return;
    var arrival = arrEl.value;
    if (!arrival || !S.isValidISO(arrival)) return;
    if (!force && form.dueManual) return;
    var days = currentTermDays();
    if (days == null && form.termMethod === "contanti") days = 0;
    if (days == null) return;
    dueEl.value = S.addDaysISO(arrival, days);
    form.dueManual = false;
  }

  function updateTermChips() {
    var btns = document.querySelectorAll('[data-action="term-days"]');
    for (var i = 0; i < btns.length; i++) {
      var dv = btns[i].getAttribute("data-days");
      var on = dv === "custom" ? form.termCustom : (!form.termCustom && form.termDays === parseInt(dv, 10));
      btns[i].className = "chip-filter" + (on ? " active" : "");
    }
    var mbtns = document.querySelectorAll('[data-action="term-method"]');
    for (var j = 0; j < mbtns.length; j++) {
      mbtns[j].className = "chip-filter" + (form.termMethod === mbtns[j].getAttribute("data-method") ? " active" : "");
    }
    var inp = document.getElementById("fTermDays");
    if (inp) inp.style.display = form.termCustom ? "" : "none";
  }

  /* payments (in cents) resulting from the "already paid" checkbox:
     checked = fully paid; unchecked keeps existing partial payments */
  function formPaymentsCents(amountC) {
    var prev = form && form.mode === "edit" ? S.getRecord(form.id) : null;
    var prevCash = prev ? S.toCents(prev.paidCash) : 0;
    var prevOther = prev ? S.toCents(prev.paidOther) : 0;
    var box = document.getElementById("fPaidFull");
    if (box && box.checked) {
      var cash = prevCash < amountC ? prevCash : amountC;
      return { cash: cash, other: amountC - cash };
    }
    if (amountC > 0 && prevCash + prevOther >= amountC) return { cash: 0, other: 0 };
    return { cash: prevCash, other: prevOther };
  }

  function updateResiduo() {
    var line = document.getElementById("fResiduo");
    if (!line) return;
    var a = parseAmountInput(document.getElementById("fAmount").value) || 0;
    var p = formPaymentsCents(a);
    var resid = a - p.cash - p.other;
    if (a > 0 && resid <= 0) {
      line.className = "residuo-line green";
      line.textContent = t("form.paidOff");
    } else {
      line.className = "residuo-line" + (resid > 0 ? " red" : "");
      line.textContent = t("form.remaining", { x: formatMoney(resid) });
    }
  }

  function collectForm() {
    var supplier = document.getElementById("fSupplier").value.trim();
    var amountC = parseAmountInput(document.getElementById("fAmount").value);
    var eS = document.getElementById("eSupplier");
    var eA = document.getElementById("eAmount");
    eS.textContent = ""; eA.textContent = "";
    document.getElementById("fSupplier").classList.remove("invalid");
    document.getElementById("fAmount").classList.remove("invalid");
    var ok = true;
    if (!supplier) {
      eS.textContent = t("err.supplier");
      document.getElementById("fSupplier").classList.add("invalid");
      document.getElementById("fSupplier").focus();
      ok = false;
    }
    if (amountC == null || amountC <= 0) {
      eA.textContent = t("err.amount");
      document.getElementById("fAmount").classList.add("invalid");
      if (ok) document.getElementById("fAmount").focus();
      ok = false;
    }
    if (!ok) return null;
    var pays = formPaymentsCents(amountC);
    var cash = pays.cash;
    var other = pays.other;
    var arrival = document.getElementById("fArrival").value;
    var due = document.getElementById("fDue").value;
    return {
      supplier: supplier,
      arrivalDate: S.isValidISO(arrival) ? arrival : null,
      invoice: document.getElementById("fInvoice").value.trim(),
      amount: amountC / 100,
      paidCash: cash / 100,
      paidOther: other / 100,
      terms: composeTermsString(),
      dueDate: S.isValidISO(due) ? due : null,
      notes: document.getElementById("fNotes").value.trim(),
      oldDebt: form.mode === "edit" && S.getRecord(form.id) ? !!S.getRecord(form.id).oldDebt : false,
      checkNo: document.getElementById("fCheckNo").value.trim()
    };
  }

  function saveForm(andNew) {
    var data = collectForm();
    if (!data) return;
    var prev = null, newId = null;
    if (form.mode === "edit") {
      prev = JSON.parse(JSON.stringify(S.getRecord(form.id)));
      S.updateRecord(form.id, data);
      flashId = form.id;
    } else {
      var rec = S.addRecord(data);
      newId = rec.id;
      flashId = rec.id;
    }
    var undoId = form.id, undoPrev = prev;
    showToast(t("toast.saved"), form.mode === "edit" ? function () {
      S.updateRecord(undoId, undoPrev);
      render();
    } : function () {
      S.deleteRecord(newId);
      render();
    });
    if (andNew) {
      var keepSupplier = data.supplier, keepArrival = data.arrivalDate;
      form = { mode: "new", id: null, rec: null };
      renderForm({ supplier: keepSupplier, arrivalDate: keepArrival, invoice: "", amount: 0, paidCash: 0, paidOther: 0, terms: data.terms, dueDate: null, notes: "", oldDebt: false, checkNo: "" });
    } else {
      closeModal();
    }
    render();
  }

  function deleteFromForm() {
    var rec = S.getRecord(form.id);
    if (!rec) { closeModal(); return; }
    var d = decorate(rec);
    if (!window.confirm(t("confirm.delete", { s: rec.supplier, x: formatMoney(d.amount) }))) return;
    var removed = S.deleteRecord(form.id);
    closeModal();
    showToast(t("toast.deleted"), function () {
      S.restoreRecord(removed.record, removed.index);
      render();
    });
    render();
  }

  function deleteRow(id) {
    var rec = S.getRecord(id);
    if (!rec) return;
    var d = decorate(rec);
    if (!window.confirm(t("confirm.delete", { s: rec.supplier, x: formatMoney(d.amount) }))) return;
    var removed = S.deleteRecord(id);
    showToast(t("toast.deleted"), function () {
      S.restoreRecord(removed.record, removed.index);
      render();
    });
    render();
  }

  function closeModal() {
    document.getElementById("modalRoot").innerHTML = "";
    form = null;
    wizard = null;
    payState = null;
    groupPay = null;
  }

  /* ================= pay modal ================= */

  var payState = null;

  function openPay(id) {
    var rec = S.getRecord(id);
    if (!rec) return;
    var d = decorate(rec);
    if (d.unpaid <= 0) return;
    payState = { id: id, resid: d.unpaid };
    var root = document.getElementById("modalRoot");
    root.innerHTML = '<div class="modal-scrim" data-action="pay-scrim"><div class="modal small" data-stop="1">' +
      "<h2>" + esc(t("pay.title")) + "</h2>" +
      '<div class="pay-head"><span class="who">' + esc(rec.supplier) + (rec.invoice ? " · " + esc(rec.invoice) : "") + "</span>" +
      '<span class="resid">' + esc(t("pay.remaining")) + ": " + esc(formatMoney(d.unpaid)) + "</span></div>" +
      '<input type="text" class="pay-amount" id="payAmount" inputmode="decimal" value="' + esc(formatAmountInput(d.unpaid)) + '">' +
      '<div class="pay-warn" id="payWarn"></div>' +
      '<div class="form-field" style="margin-top:10px"><label for="payCheckNo">' + esc(t("gpay.checkNo")) + "</label>" +
      '<input type="text" id="payCheckNo" autocomplete="off"></div>' +
      '<div class="pay-methods">' +
      '<button type="button" class="btn btn-primary" data-action="pay-confirm" data-method="other">' + esc(t("pay.settle")) + "</button>" +
      "</div>" +
      '<div class="modal-footer end"><button type="button" class="btn" data-action="pay-cancel">' + esc(t("action.cancel")) + "</button></div>" +
      "</div></div>";
    var input = document.getElementById("payAmount");
    input.focus();
    input.select();
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); confirmPay("other"); }
    });
  }

  function confirmPay(method) {
    if (!payState) return;
    var input = document.getElementById("payAmount");
    var warn = document.getElementById("payWarn");
    var cents = parseAmountInput(input.value);
    if (cents == null || cents <= 0) {
      warn.textContent = t("pay.invalidAmount");
      input.classList.add("invalid");
      return;
    }
    if (cents > payState.resid) {
      if (!window.confirm(t("pay.overpayWarn", { x: formatMoney(cents - payState.resid) }))) return;
    }
    var rec = S.getRecord(payState.id);
    if (!rec) { closeModal(); return; }
    var prevCash = rec.paidCash, prevOther = rec.paidOther, prevCheckNo = rec.checkNo;
    var payCheckEl = document.getElementById("payCheckNo");
    var upd = {};
    for (var k in rec) upd[k] = rec[k];
    if (method === "cash") upd.paidCash = (S.toCents(rec.paidCash) + cents) / 100;
    else upd.paidOther = (S.toCents(rec.paidOther) + cents) / 100;
    upd.checkNo = appendCheckNo(rec.checkNo, payCheckEl ? payCheckEl.value.trim() : "");
    S.updateRecord(rec.id, upd);
    flashId = rec.id;
    var id = rec.id;
    showToast(t("toast.paid", { x: formatMoney(cents), s: rec.supplier }),
      function () {
        var cur = S.getRecord(id);
        if (!cur) return;
        var u = {};
        for (var k2 in cur) u[k2] = cur[k2];
        u.paidCash = prevCash; u.paidOther = prevOther; u.checkNo = prevCheckNo;
        S.updateRecord(id, u);
        render();
      });
    closeModal();
    render();
  }

  /* ================= toast ================= */

  var toastTimer = null;

  function showToast(msg, undoFn, isError) {
    var root = document.getElementById("toastRoot");
    root.innerHTML = '<div class="toast' + (isError ? " error" : "") + '"><span>' + esc(msg) + "</span>" +
      (undoFn ? '<button type="button" id="toastUndo">' + esc(t("action.undo")) + "</button>" : "") +
      "</div>";
    if (undoFn) {
      document.getElementById("toastUndo").addEventListener("click", function () {
        root.innerHTML = "";
        clearTimeout(toastTimer);
        undoFn();
        showToast(t("toast.restored"));
      });
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { root.innerHTML = ""; }, 6000);
  }

  /* ================= events ================= */

  document.addEventListener("click", function (e) {
    var el = e.target;
    var actionEl = null;
    while (el && el !== document) {
      if (el.getAttribute && el.getAttribute("data-action")) { actionEl = el; break; }
      el = el.parentNode;
    }
    if (!actionEl) return;
    var action = actionEl.getAttribute("data-action");
    var id = actionEl.getAttribute("data-id");

    // don't let inner buttons bubble into row edit
    if (action !== "edit-row") e.stopPropagation();

    switch (action) {
      case "tab": gotoView(actionEl.getAttribute("data-view")); break;
      case "goto-scadenzario": gotoView("scadenzario"); break;
      case "goto-open":
        filters.status = "unpaid"; filters.search = ""; filters.supplier = ""; filters.from = ""; filters.to = ""; filters.oldDebtOnly = false;
        gotoView("movimenti"); break;
      case "goto-all":
        filters = { search: "", status: "all", supplier: "", from: "", to: "", oldDebtOnly: false };
        gotoView("movimenti"); break;
      case "goto-dati": gotoView("dati"); break;
      case "ql-gmail": window.open("https://mail.google.com/", "_blank"); break;
      case "ql-bank": {
        var bankUrl = S.meta().bankUrl;
        if (bankUrl) { window.open(bankUrl, "_blank"); }
        else {
          gotoView("dati");
          showToast(t("ql.bankMissing"));
          var bi = document.getElementById("datiBankUrl");
          if (bi) bi.focus();
        }
        break;
      }
      case "bank-save": {
        var input = document.getElementById("datiBankUrl");
        if (!input) break;
        var url = input.value.trim();
        if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
        if (url && !/^https?:\/\/[^\s]+\.[^\s]+/i.test(url)) { showToast(t("bank.invalid"), null, true); break; }
        S.meta().bankUrl = url || null;
        S.save();
        showToast(url ? t("bank.saved") : t("bank.cleared"));
        render();
        break;
      }
      case "new-record": openForm(null); break;
      case "dismiss-seed":
        S.meta().seedBannerDismissed = true; S.save(); renderBanners(); break;
      case "seed-refresh-apply":
        S.applySeedRefresh();
        showToast(t("seed.refreshDone", { n: S.records().length }));
        render(); break;
      case "seed-refresh-decline":
        S.declineSeedRefresh(); renderBanners(); break;
      case "filter-status":
        filters.status = actionEl.getAttribute("data-status"); render(); break;
      case "clear-filters":
        filters = { search: "", status: "all", supplier: "", from: "", to: "", oldDebtOnly: false }; render(); break;
      case "sort":
        var key = actionEl.getAttribute("data-key");
        if (sortState.key === key) sortState.dir = -sortState.dir;
        else { sortState.key = key; sortState.dir = key === "arrivalDate" || key === "dueDate" ? -1 : 1; }
        renderMovTable(); break;
      case "edit-row": {
        // ignore if the actual click landed on a button inside the row
        var t2 = e.target;
        var isButton = false;
        while (t2 && t2 !== actionEl) {
          if (t2.tagName === "BUTTON" || t2.tagName === "A" || t2.tagName === "INPUT") { isButton = true; break; }
          t2 = t2.parentNode;
        }
        if (!isButton) {
          var rid = actionEl.getAttribute("data-id");
          var rec0 = S.getRecord(rid);
          if (rec0) openForm(rec0);
        }
        break;
      }
      case "edit": {
        var rec1 = S.getRecord(id);
        if (rec1) openForm(rec1);
        break;
      }
      case "delete": deleteRow(id); break;
      case "pay": openPay(id); break;
      case "pay-confirm": confirmPay(actionEl.getAttribute("data-method")); break;
      case "sel-row":
        if (actionEl.checked) selection[id] = true; else delete selection[id];
        renderSelBar();
        // keep the header select-all checkbox coherent
        renderMovTable();
        break;
      case "sel-all": {
        var wantAll = actionEl.checked;
        filteredMovimenti().forEach(function (d) {
          if (d.unpaid <= 0) return;
          if (wantAll) selection[d.rec.id] = true; else delete selection[d.rec.id];
        });
        renderMovTable();
        break;
      }
      case "sel-clear": selection = {}; renderMovTable(); break;
      case "gpay-open": openGroupPay(); break;
      case "gpay-confirm": confirmGroupPay(actionEl.getAttribute("data-method")); break;
      case "gpay-cancel": case "gpay-scrim":
        if (action === "gpay-scrim" && e.target !== actionEl) break;
        closeModal(); break;
      case "pay-cancel": case "pay-scrim":
        if (action === "pay-scrim" && e.target !== actionEl) break;
        closeModal(); break;
      case "sup-open":
        filters = { search: "", status: "all", supplier: actionEl.getAttribute("data-key"), from: "", to: "", oldDebtOnly: false };
        gotoView("movimenti"); break;
      case "print": window.print(); break;
      case "form-save": saveForm(false); break;
      case "form-save-new": saveForm(true); break;
      case "form-cancel":
        if (formIsDirty() && !window.confirm(t("dirty.prompt"))) break;
        closeModal(); break;
      case "form-delete": deleteFromForm(); break;
      case "form-scrim":
        if (e.target === actionEl) {
          if (formIsDirty() && !window.confirm(t("dirty.prompt"))) break;
          closeModal();
        }
        break;
      case "term-days": {
        var dv = actionEl.getAttribute("data-days");
        if (dv === "custom") {
          form.termCustom = !form.termCustom;
          if (form.termCustom) form.termDays = null;
        } else {
          var nd = parseInt(dv, 10);
          if (!form.termCustom && form.termDays === nd) form.termDays = null;
          else form.termDays = nd;
          form.termCustom = false;
        }
        updateTermChips();
        if (form.termCustom) {
          var ce = document.getElementById("fTermDays");
          if (ce) ce.focus();
        } else applyTermsDue(true);
        break;
      }
      case "term-method": {
        var mm = actionEl.getAttribute("data-method");
        form.termMethod = form.termMethod === mm ? null : mm;
        updateTermChips();
        applyTermsDue(true);
        break;
      }
      case "import-open": openImportWizard(); break;
      case "wiz-sheet": pickWizardSheet(parseInt(actionEl.getAttribute("data-idx"), 10)); break;
      case "wiz-back": wizard.step = 1; renderWizard(); break;
      case "wiz-import": doWizardImport(); break;
      case "wiz-close": closeModal(); render(); break;
      case "wiz-scrim":
        if (e.target === actionEl) { closeModal(); render(); }
        break;
      case "export-csv": exportCSV(); break;
      case "backup-json": backupJSON(); break;
      case "restore-json": document.getElementById("restoreFile").click(); break;
      case "reset-all": resetAll(); break;
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (form || wizard || payState || groupPay) {
        if (form && formIsDirty() && !window.confirm(t("dirty.prompt"))) return;
        var wasWizard = !!wizard;
        closeModal();
        // the wizard may have imported records: refresh the view behind the modal
        if (wasWizard) render();
        return;
      }
    }
    var inInput = /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName || "");
    if (inInput) {
      if (e.key === "Enter" && form && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveForm(e.shiftKey); }
      return;
    }
    if (form || wizard || payState || groupPay) return;
    if (e.key === "/") {
      var s = document.getElementById("movSearch") || document.getElementById("supSearch");
      if (s) { e.preventDefault(); s.focus(); }
    } else if (e.key === "n" || e.key === "N") {
      openForm(null);
    }
  });

  document.getElementById("btnNew").addEventListener("click", function () { openForm(null); });
  document.getElementById("langIt").addEventListener("click", function () { setLang("it"); });
  document.getElementById("langZh").addEventListener("click", function () { setLang("zh"); });

  function setLang(l) {
    lang = l;
    S.meta().lang = l;
    S.save();
    // keep an explicit ?lang= URL parameter in sync, otherwise a reload of a
    // bookmarked "?lang=it" silently overrides the saved choice
    if (/[?&]lang=(it|zh)/.test(location.search)) {
      try {
        /* URL gestita dall'ospite: nessuna riscrittura da qui. */
      } catch (err) { /* ignore (older browsers / exotic protocols) */ }
    }
    render();
  }

  /* ================= avvio ================= */
  // Nell'app autonoma qui partiva render() al caricamento dello script. Dentro
  // cassa-smart-pro il montaggio lo decide la tab che la ospita: il markup
  // esiste da subito ma si disegna solo quando serve.
  return {
    render: render,
    setLang: function (l) { if (l === "it" || l === "zh") { lang = l; render(); } }
  };
})();
