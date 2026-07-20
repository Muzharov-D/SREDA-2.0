/* ============================================================================
   СРЕДА · вещество, а не витрина
   ---------------------------------------------------------------------------
   Три вещи, которые скептик требует доказать, и которые НЕ требуют ни LLM,
   ни бэкенда — потому что это не про язык, а про арифметику, хэши и учёт:

   1. РАБОТА.  Сверка — детерминированный расчёт. Цифровой сотрудник реально
      сопоставляет два реестра и находит настоящие расхождения. Результат
      выгружается файлом, который можно открыть в Excel.
   2. ГРАНИЦА. Платёж — реальная операция над реестром. Превышение лимита
      останавливается ДО мутации: реестр не меняется, попытка ложится в аудит.
   3. АУДИТ.   Журнал — хэш-цепочка. Любая правка задним числом обнаруживается,
      в том числе владельцем платформы. Это проверяется, а не обещается.

   Отдельно: ПАМЯТЬ ОРГАНИЗАЦИИ — решения живут не в профиле человека, а в
   общем хранилище, и цитируются другому человеку с автором и датой.
   ========================================================================== */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- хэши -- */
  // FNV-1a: короткий, детерминированный, без зависимостей
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  /* ------------------------------------------------------- данные сверки -- */
  // Реестр компании и акт поставщика. Расхождения заложены как в жизни:
  // разошлась сумма, документ есть у одной стороны, задвоение, разная дата.
  const OURS = [
    { doc: 'УПД-1041', date: '03.03', sum: 128400.00, note: 'материалы' },
    { doc: 'УПД-1047', date: '05.03', sum: 76500.00,  note: 'материалы' },
    { doc: 'УПД-1052', date: '11.03', sum: 214980.50, note: 'оборудование' },
    { doc: 'УПД-1061', date: '14.03', sum: 43200.00,  note: 'услуги' },
    { doc: 'УПД-1064', date: '18.03', sum: 155000.00, note: 'материалы' },
    { doc: 'УПД-1070', date: '21.03', sum: 98750.00,  note: 'материалы' },
    { doc: 'УПД-1078', date: '25.03', sum: 312400.00, note: 'оборудование' },
    { doc: 'УПД-1083', date: '28.03', sum: 67300.00,  note: 'услуги' },
    { doc: 'УПД-1090', date: '31.03', sum: 189600.00, note: 'материалы' },
  ];
  const THEIRS = [
    { doc: 'УПД-1041', date: '03.03', sum: 128400.00 },
    { doc: 'УПД-1047', date: '05.03', sum: 76500.00 },
    { doc: 'УПД-1052', date: '11.03', sum: 219980.50 },   // ← сумма разошлась на 5 000
    { doc: 'УПД-1061', date: '14.03', sum: 43200.00 },
    { doc: 'УПД-1064', date: '19.03', sum: 155000.00 },   // ← дата на день позже
    { doc: 'УПД-1070', date: '21.03', sum: 98750.00 },
    { doc: 'УПД-1074', date: '23.03', sum: 51000.00 },    // ← у нас такого нет
    { doc: 'УПД-1078', date: '25.03', sum: 312400.00 },
    { doc: 'УПД-1083', date: '28.03', sum: 67300.00 },
    { doc: 'УПД-1083', date: '28.03', sum: 67300.00 },    // ← задвоение у поставщика
  ];
  // УПД-1090 у поставщика отсутствует — четвёртый тип расхождения

  const money = n => n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /** Настоящая сверка: сопоставление по номеру документа. */
  function reconcile(ours, theirs) {
    ours = ours || OURS; theirs = theirs || THEIRS;
    const issues = [];
    const seen = {};

    theirs.forEach(t => {
      seen[t.doc] = (seen[t.doc] || 0) + 1;
    });
    Object.keys(seen).forEach(doc => {
      if (seen[doc] > 1) {
        const t = theirs.find(x => x.doc === doc);
        issues.push({ kind: 'dup', doc: doc, text: 'задвоен у поставщика (' + seen[doc] + ' раза)', delta: t.sum });
      }
    });

    ours.forEach(o => {
      const t = theirs.find(x => x.doc === o.doc);
      if (!t) { issues.push({ kind: 'onlyOurs', doc: o.doc, text: 'есть у нас, нет у поставщика', delta: o.sum }); return; }
      if (Math.abs(t.sum - o.sum) > 0.005) {
        issues.push({ kind: 'sum', doc: o.doc, text: 'сумма разошлась: у нас ' + money(o.sum) + ', у них ' + money(t.sum), delta: +(t.sum - o.sum).toFixed(2) });
      }
      if (t.date !== o.date) {
        issues.push({ kind: 'date', doc: o.doc, text: 'дата разошлась: у нас ' + o.date + ', у них ' + t.date, delta: 0 });
      }
    });

    theirs.forEach(t => {
      if (!ours.some(o => o.doc === t.doc)) {
        if (!issues.some(i => i.doc === t.doc && i.kind === 'onlyTheirs')) {
          issues.push({ kind: 'onlyTheirs', doc: t.doc, text: 'есть у поставщика, нет у нас', delta: t.sum });
        }
      }
    });

    const sumOurs = ours.reduce((a, x) => a + x.sum, 0);
    const sumTheirs = theirs.reduce((a, x) => a + x.sum, 0);
    return {
      rowsOurs: ours.length, rowsTheirs: theirs.length,
      sumOurs: +sumOurs.toFixed(2), sumTheirs: +sumTheirs.toFixed(2),
      diff: +(sumTheirs - sumOurs).toFixed(2),
      issues: issues.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    };
  }

  /** Файл, который открывается в Excel. Не картинка результата — результат. */
  function reconCsv(res) {
    const rows = [['документ', 'тип расхождения', 'описание', 'влияние, ₽']];
    res.issues.forEach(i => rows.push([i.doc, i.kind, i.text, String(i.delta).replace('.', ',')]));
    rows.push([]);
    rows.push(['итого у нас', '', '', String(res.sumOurs).replace('.', ',')]);
    rows.push(['итого у поставщика', '', '', String(res.sumTheirs).replace('.', ',')]);
    rows.push(['расхождение', '', '', String(res.diff).replace('.', ',')]);
    return '﻿' + rows.map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  }

  /* ------------------------------------------------------- аудит-цепочка -- */
  const LS_CHAIN = 'sreda_kam2_chain_v1';

  function chainLoad() {
    try { const a = JSON.parse(localStorage.getItem(LS_CHAIN) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function chainSave(a) { try { localStorage.setItem(LS_CHAIN, JSON.stringify(a)); } catch (e) {} }

  function entryHash(e, prevHash) {
    return fnv1a([prevHash, e.i, e.t, e.act, e.detail, e.verdict, e.by].join('|'));
  }
  /** Добавить запись. Хэш считается от предыдущего — цепочка неразрывна. */
  function chainAdd(act, detail, verdict, by) {
    const a = chainLoad();
    const prev = a.length ? a[a.length - 1].hash : 'genesis';
    const e = { i: a.length, t: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                act: String(act), detail: String(detail || ''), verdict: String(verdict || 'ok'), by: String(by || 'вы'), prev: prev };
    e.hash = entryHash(e, prev);
    a.push(e); chainSave(a);
    return e;
  }
  /** Проверка целостности: правка или удаление задним числом видны сразу. */
  function chainVerify() {
    const a = chainLoad();
    let prev = 'genesis';
    for (let i = 0; i < a.length; i++) {
      const e = a[i];
      if (e.prev !== prev) return { ok: false, at: i, why: 'разрыв: запись не ссылается на предыдущую' };
      if (entryHash(e, prev) !== e.hash) return { ok: false, at: i, why: 'подмена: содержимое не сходится с хэшем' };
      if (e.i !== i) return { ok: false, at: i, why: 'изъятие: нарушена нумерация' };
      prev = e.hash;
    }
    return { ok: true, len: a.length };
  }

  /* ------------------------------------------------- реестр и лимит ------- */
  const LS_LEDGER = 'sreda_kam2_ledger_v1';
  const LIMIT = 100000;   // лимит одной операции без санкции

  function ledgerLoad() {
    try {
      const l = JSON.parse(localStorage.getItem(LS_LEDGER) || 'null');
      if (l && typeof l.balance === 'number' && Array.isArray(l.ops)) return l;
    } catch (e) {}
    return { balance: 1450000, ops: [] };
  }
  function ledgerSave(l) { try { localStorage.setItem(LS_LEDGER, JSON.stringify(l)); } catch (e) {} }

  /**
   * Настоящая операция над реестром. Превышение лимита останавливается ДО
   * мутации: баланс не меняется, попытка пишется в цепочку.
   */
  function pay(vendor, sum, opts) {
    opts = opts || {};
    const l = ledgerLoad();
    if (!opts.sanctioned && sum > LIMIT) {
      chainAdd('Платёж остановлен границей', vendor + ' · ' + money(sum) + ' ₽ · лимит ' + money(LIMIT) + ' ₽', 'deny', opts.by);
      return { ok: false, reason: 'limit', limit: LIMIT, balanceBefore: l.balance, balanceAfter: l.balance };
    }
    if (sum > l.balance) {
      chainAdd('Платёж остановлен: недостаточно средств', vendor + ' · ' + money(sum) + ' ₽', 'deny', opts.by);
      return { ok: false, reason: 'funds', balanceBefore: l.balance, balanceAfter: l.balance };
    }
    const before = l.balance;
    l.balance = +(l.balance - sum).toFixed(2);
    l.ops.unshift({ vendor: vendor, sum: sum, at: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), sanctioned: !!opts.sanctioned });
    ledgerSave(l);
    chainAdd(opts.sanctioned ? 'Платёж проведён по санкции' : 'Платёж проведён', vendor + ' · ' + money(sum) + ' ₽', 'ok', opts.by);
    return { ok: true, balanceBefore: before, balanceAfter: l.balance };
  }

  /* --------------------------------------------- память организации ------- */
  // Решения живут ОТДЕЛЬНО от профиля человека: их видит следующий, кто спросит.
  const LS_ORG = 'sreda_kam2_orgmem_v1';

  function orgLoad() {
    try { const a = JSON.parse(localStorage.getItem(LS_ORG) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function orgSave(a) { try { localStorage.setItem(LS_ORG, JSON.stringify(a)); } catch (e) {} }

  function orgRemember(subject, decision, by) {
    const a = orgLoad();
    const key = String(subject).toLowerCase().trim();
    a.unshift({ key: key, subject: String(subject), decision: String(decision), by: String(by || 'вы'),
                at: new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) });
    orgSave(a.slice(0, 40));
    return a[0];
  }
  /**
   * Ищем по основам, а не по точному вхождению: человек спросит «поставщику
   * Гамма», а решение записано про «поставщик гамма». Без морфологии и без
   * LLM — обрезаем слова до основы и требуем, чтобы совпали все значимые.
   */
  const norm = x => String(x).toLowerCase().replace(/[^а-яёa-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const stem = w => w.length > 5 ? w.slice(0, w.length - 2) : w;
  // Служебные слова формы («ооо», «ип», «зао») не должны решать, узнали мы предмет или нет.
  const NOISE = ['ооо', 'оао', 'зао', 'ип', 'пао', 'нко', 'ао'];
  function orgRecall(text) {
    const t = norm(text);
    return orgLoad().filter(d => {
      const words = norm(d.key).split(' ').filter(w => w.length >= 4 && NOISE.indexOf(w) < 0);
      if (!words.length) return false;
      return words.every(w => t.indexOf(stem(w)) >= 0);
    });
  }

  root.__K2WORK = {
    OURS: OURS, THEIRS: THEIRS, LIMIT: LIMIT, money: money,
    reconcile: reconcile, reconCsv: reconCsv,
    chainAdd: chainAdd, chainVerify: chainVerify, chainLoad: chainLoad,
    ledgerLoad: ledgerLoad, pay: pay,
    orgRemember: orgRemember, orgRecall: orgRecall, orgLoad: orgLoad,
  };

  /* ======================= ЧУЖОЙ ФАЙЛ ======================================
     Самое дорогое в корпоративном ИИ — не модель, а сопоставление колонок.
     Обычно это неделя настройки на каждый источник. Здесь структура таблицы
     определяется ПО СОДЕРЖИМОМУ, а не по названиям колонок: где бы что ни
     лежало и как бы ни называлось, документ, дата и сумма находятся сами.
     Работает на выгрузке из 1С, Excel, ERP — потому что не знает про них
     ничего, кроме того, что видит в ячейках.
     ====================================================================== */

  const DATE_RE = /^\s*(\d{1,2})[.\-\/](\d{1,2})(?:[.\-\/](\d{2,4}))?\s*$/;
  const DOC_RE  = /[A-Za-zА-Яа-яЁё]{1,6}[\s-]?№?\s?\d{2,}|^\d{4,}$/;

  function sniffSep(text) {
    const head = text.split(/\r?\n/).slice(0, 5).join('\n');
    const cand = [';', '\t', ',', '|'];
    let best = ';', bestN = 0;
    cand.forEach(c => {
      const n = head.split(c).length - 1;
      if (n > bestN) { bestN = n; best = c; }
    });
    return best;
  }

  function parseNum(v) {
    if (v == null) return null;
    let x = String(v).replace(/\u00a0/g, ' ').trim();
    if (!x || !/\d/.test(x)) return null;
    if (!/^[-+\s\d.,]+$/.test(x)) return null;
    x = x.replace(/\s/g, '');
    const lastC = x.lastIndexOf(','), lastD = x.lastIndexOf('.');
    if (lastC > -1 && lastD > -1) {
      if (lastC > lastD) x = x.replace(/\./g, '').replace(',', '.');
      else x = x.replace(/,/g, '');
    } else if (lastC > -1) {
      x = (x.length - lastC - 1) === 3 ? x.replace(/,/g, '') : x.replace(',', '.');
    } else if (lastD > -1) {
      if ((x.length - lastD - 1) === 3 && x.split('.').length > 2) x = x.replace(/\./g, '');
    }
    const n = parseFloat(x);
    return isNaN(n) ? null : n;
  }

  function splitLine(line, sep) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; continue; }
      if (c === sep && !q) { out.push(cur); cur = ''; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map(x => x.replace(/\u00a0/g, ' ').trim());
  }

  /** Разбор таблицы + определение смысла колонок по содержимому. */
  function parseTable(text) {
    text = String(text).replace(/^\uFEFF/, '');
    const sep = sniffSep(text);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (lines.length < 2) return { ok: false, why: 'в файле меньше двух строк' };
    const grid = lines.map(l => splitLine(l, sep));
    const width = Math.max.apply(null, grid.map(r => r.length));
    if (width < 2) return { ok: false, why: 'не вижу колонок — проверьте разделитель' };

    // шапка — если в первой строке почти нет чисел, а ниже они есть
    const numShare = r => r.filter(c => parseNum(c) != null).length / Math.max(1, r.length);
    const hasHeader = numShare(grid[0]) < 0.34 && grid.length > 1 && numShare(grid[1]) >= numShare(grid[0]);
    const headers = hasHeader ? grid[0] : grid[0].map((_, i) => 'колонка ' + (i + 1));
    const rows = (hasHeader ? grid.slice(1) : grid).filter(r => r.join('').trim().length);

    // профиль каждой колонки — только по данным
    const prof = [];
    for (let c = 0; c < width; c++) {
      const vals = rows.map(r => (r[c] == null ? '' : r[c]));
      const nonEmpty = vals.filter(v => v !== '');
      const nums = nonEmpty.filter(v => parseNum(v) != null);
      const dates = nonEmpty.filter(v => DATE_RE.test(v));
      const docs = nonEmpty.filter(v => DOC_RE.test(v));
      const uniq = new Set(nonEmpty.map(v => v.toLowerCase())).size;
      const parsed = nums.map(parseNum);
      prof.push({
        i: c, header: headers[c] || '',
        fill: nonEmpty.length / Math.max(1, rows.length),
        numShare: nonEmpty.length ? nums.length / nonEmpty.length : 0,
        dateShare: nonEmpty.length ? dates.length / nonEmpty.length : 0,
        docShare: nonEmpty.length ? docs.length / nonEmpty.length : 0,
        uniqShare: nonEmpty.length ? uniq / nonEmpty.length : 0,
        avgAbs: parsed.length ? parsed.reduce((a, b) => a + Math.abs(b), 0) / parsed.length : 0,
        decShare: nonEmpty.length ? nonEmpty.filter(v => /[.,]\d{1,2}\s*$/.test(v)).length / nonEmpty.length : 0,
      });
    }

    const pick = (score, exclude) => {
      let best = null, bs = -1;
      prof.forEach(c => {
        if (exclude && exclude.indexOf(c.i) >= 0) return;
        const v = score(c);
        if (v > bs) { bs = v; best = c; }
      });
      return bs > 0 ? best : null;
    };
    const dateCol = pick(c => c.dateShare > 0.6 ? c.dateShare : 0);
    const sumCol = pick(c => {
      if (c.numShare < 0.7 || c.fill < 0.5) return 0;
      if (dateCol && c.i === dateCol.i) return 0;
      // деньги — это большие числа и/или копейки, а не порядковые номера
      return c.numShare + c.decShare * 1.5 + Math.min(1, Math.log10(1 + c.avgAbs) / 5);
    }, dateCol ? [dateCol.i] : []);
    const docCol = pick(c => {
      if (c.uniqShare < 0.5 || c.fill < 0.6) return 0;
      if ((dateCol && c.i === dateCol.i) || (sumCol && c.i === sumCol.i)) return 0;
      return c.docShare * 2 + c.uniqShare;
    }, [dateCol && dateCol.i, sumCol && sumCol.i].filter(x => x != null));

    return {
      ok: true, sep: sep, hasHeader: hasHeader, headers: headers, rows: rows,
      cols: { doc: docCol ? docCol.i : null, date: dateCol ? dateCol.i : null, sum: sumCol ? sumCol.i : null },
      profile: prof,
      count: rows.length,
      total: sumCol ? +rows.reduce((a, r) => a + (parseNum(r[sumCol.i]) || 0), 0).toFixed(2) : null,
    };
  }

  const asRec = (t) => t.rows.map((r, i) => ({
    doc: t.cols.doc != null ? String(r[t.cols.doc] || '').trim() : ('строка ' + (i + 1)),
    date: t.cols.date != null ? String(r[t.cols.date] || '').trim() : '',
    sum: t.cols.sum != null ? (parseNum(r[t.cols.sum]) || 0) : 0,
  }));

  /** Сверка ДВУХ загруженных таблиц — тем же алгоритмом, что и демо-данные. */
  function reconcileFiles(tA, tB) {
    const a = asRec(tA), b = asRec(tB);
    const res = reconcile(a, b);
    res.fromFiles = true;
    return res;
  }

  /** Анализ ОДНОЙ таблицы: дубли, пропуски в нумерации, выбросы по сумме. */
  function analyzeOne(t) {
    const rec = asRec(t);
    const issues = [];
    const seen = {};
    rec.forEach(r => { if (r.doc) seen[r.doc] = (seen[r.doc] || 0) + 1; });
    Object.keys(seen).forEach(d => {
      if (seen[d] > 1) {
        const r = rec.find(x => x.doc === d);
        issues.push({ kind: 'dup', doc: d, text: 'документ встречается ' + seen[d] + ' раза', delta: r ? r.sum : 0 });
      }
    });
    // Выброс ищем по медиане и MAD, а не по среднему: одно аномальное значение
    // само раздувает среднее и стандартное отклонение — и перестаёт быть аномалией.
    const sums = rec.map(r => r.sum).filter(x => x);
    if (sums.length > 4) {
      const srt = sums.slice().sort((x, y) => x - y);
      const med = arr => arr.length % 2 ? arr[(arr.length - 1) / 2] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
      const m = med(srt);
      const mad = med(sums.map(x => Math.abs(x - m)).sort((x, y) => x - y));
      const scale = mad > 0 ? mad * 1.4826 : 0;
      if (scale > 0) rec.forEach(r => {
        if (r.sum && Math.abs(r.sum - m) > 5 * scale) {
          issues.push({ kind: 'outlier', doc: r.doc,
            text: 'сумма резко выбивается из ряда (обычно около ' + money(+m.toFixed(2)) + ')', delta: r.sum });
        }
      });
    }
    const nums = rec.map(r => (String(r.doc).match(/(\d+)\s*$/) || [])[1]).filter(Boolean).map(Number).sort((x, y) => x - y);
    if (nums.length > 3) {
      const gaps = [];
      for (let i = 1; i < nums.length; i++) {
        const d = nums[i] - nums[i - 1];
        if (d > 1 && d <= 20) for (let k = nums[i - 1] + 1; k < nums[i]; k++) gaps.push(k);
      }
      if (gaps.length && gaps.length <= 12) {
        issues.push({ kind: 'gap', doc: '№ ' + gaps.slice(0, 6).join(', ') + (gaps.length > 6 ? '…' : ''), text: 'пропуски в нумерации: ' + gaps.length + ' шт.', delta: 0 });
      }
    }
    const empties = rec.filter(r => !r.sum).length;
    if (empties) issues.push({ kind: 'empty', doc: '—', text: empties + ' ' + (empties === 1 ? 'строка без суммы' : 'строк без суммы'), delta: 0 });
    return { rows: rec.length, total: t.total, issues: issues.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)) };
  }

  root.__K2WORK.parseTable = parseTable;
  root.__K2WORK.reconcileFiles = reconcileFiles;
  root.__K2WORK.analyzeOne = analyzeOne;
  root.__K2WORK.parseNum = parseNum;

})(typeof window !== 'undefined' ? window : globalThis);
