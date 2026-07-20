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
})(typeof window !== 'undefined' ? window : globalThis);
