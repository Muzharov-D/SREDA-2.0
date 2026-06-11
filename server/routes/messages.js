const { getDb } = require('../db');
const router = require('express').Router();

const PAGE_LIMIT = 100;
const REPLY_MIN_MS = 1500;
const REPLY_MAX_MS = 4000;
const ARTIFACT_MIN_MS = 6000;
const ARTIFACT_MAX_MS = 10000;
const FALLBACK_TASK_PRICE = 4000;
const GIST_MAX_LEN = 80;

/* Похоже ли сообщение на постановку задачи */
const TASK_RE = /(сдела|собер[иё]|подготов|провер|нужн|срочн|посчита|сформируй|выгрузи|обнови)/i;

function parseMeta(row) {
  if (row && row.meta) {
    try { row.meta = JSON.parse(row.meta); } catch (e) { /* оставляем строкой */ }
  }
  return row;
}

function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/* Суть запроса для подстановки в шаблон */
function gist(text) {
  const clean = String(text)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[А-ЯЁA-Z][а-яёa-z]+\s*[,!]\s*/, '') // срезаем обращение «Дарья, …»
    .replace(/^(привет|здравствуйте|добрый день|добрый вечер|доброе утро)[,!.]?\s*/i, '')
    .replace(/[.!?]+$/, '');
  const cut = clean.length > GIST_MAX_LEN ? clean.slice(0, GIST_MAX_LEN - 1).trim() + '…' : clean;
  return cut.charAt(0).toLowerCase() + cut.slice(1);
}

/* Шаблоны ответа на постановку задачи (формулировки без рода) */
const ACK_TEMPLATES = [
  g => `Принято в работу: ${g}. Черновик пришлю сюда же, как будет готов.`,
  g => `Беру в работу: ${g}. Начну с проверки данных, дальше соберу черновик — отпишусь по готовности.`,
  g => `Задача ясна: ${g}. План такой — выгрузка, сверка, черновик. Если по ходу всплывут вопросы, напишу сразу.`,
  g => `Ок, фиксирую: ${g}. Сделаю первую версию и пришлю на приёмку, дальше докрутим по замечаниям.`
];

/* Шаблоны уточняющего ответа на обычное сообщение */
const CLARIFY_TEMPLATES = [
  g => `По теме «${g}»: правильно понимаю, что нужен разовый срез, а не регулярный отчёт? От этого зависит, как соберу данные.`,
  g => `Вижу. По «${g}» один вопрос: какой период берём — последний месяц или квартал? Дальше двигаюсь без вас.`,
  g => `Принято. Чтобы не промахнуться с «${g}»: что считаем источником истины — витрину продаж или выгрузку из CRM?`,
  g => `Ок. По «${g}» предложу вариант сегодня к вечеру. Если был похожий результат раньше — киньте пример, сэкономим итерацию.`
];

function pick(templates) {
  return templates[Math.floor(Math.random() * templates.length)];
}

function insertMessage(msg, cb) {
  const db = getDb();
  db.run(
    "INSERT INTO messages (channel,who,kind,text,meta,created_at) VALUES (?,?,?,?,?,datetime('now'))",
    [msg.channel, msg.who, msg.kind, msg.text, msg.meta ? JSON.stringify(msg.meta) : null],
    function (err) {
      const id = this ? this.lastID : null;
      db.close();
      if (cb) cb(err, id);
    }
  );
}

/* Симуляция ответа цифрового сотрудника */
function scheduleAgentReply(channel, clientText) {
  const etaMs = randBetween(REPLY_MIN_MS, REPLY_MAX_MS);
  const isTask = TASK_RE.test(clientText);
  const g = gist(clientText);

  setTimeout(() => {
    const replyText = isTask ? pick(ACK_TEMPLATES)(g) : pick(CLARIFY_TEMPLATES)(g);
    insertMessage({ channel, who: 'agent', kind: 'chat', text: replyText, meta: null }, err => {
      if (err) return console.error('Agent reply failed:', err.message);
      if (!isTask) return;
      // Через 6–10 секунд агент приносит черновик-артефакт
      setTimeout(() => {
        insertMessage({
          channel,
          who: 'agent',
          kind: 'artifact',
          text: `Черновик готов: ${g}. Посмотрите — если всё в порядке, нажмите «Принять», и я закрою задачу.`,
          meta: { title: `Черновик: ${g}`, desc: 'готов к приёмке', actions: ['accept', 'return'] }
        }, e2 => {
          if (e2) console.error('Agent artifact failed:', e2.message);
        });
      }, randBetween(ARTIFACT_MIN_MS, ARTIFACT_MAX_MS));
    });
  }, etaMs);

  return etaMs;
}

/* GET /api/messages?channel=tg:tl-da-02&after=<id> */
router.get('/', (req, res) => {
  const { channel } = req.query;
  if (!channel) return res.status(400).json({ error: 'channel is required' });
  const after = parseInt(req.query.after, 10) || 0;
  const db = getDb();
  db.all(
    'SELECT * FROM messages WHERE channel = ? AND id > ? ORDER BY id ASC LIMIT ?',
    [channel, after, PAGE_LIMIT],
    (err, rows) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ items: rows.map(parseMeta) });
    }
  );
});

/* POST /api/messages { channel, text } */
router.post('/', (req, res) => {
  const { channel, text } = req.body || {};
  if (!channel || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'channel and text are required' });
  }
  const db = getDb();
  db.run(
    "INSERT INTO messages (channel,who,kind,text,meta,created_at) VALUES (?,?,?,?,NULL,datetime('now'))",
    [channel, 'client', 'chat', String(text).trim()],
    function (err) {
      if (err) { db.close(); return res.status(500).json({ error: err.message }); }
      db.get('SELECT * FROM messages WHERE id = ?', [this.lastID], (e2, row) => {
        db.close();
        if (e2) return res.status(500).json({ error: e2.message });
        const etaMs = scheduleAgentReply(channel, String(text));
        res.status(201).json({ message: parseMeta(row), agentReply: { etaMs } });
      });
    }
  );
});

/* POST /api/messages/:id/accept — приёмка артефакта: meta.accepted + счёт + аудит */
router.post('/:id/accept', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM messages WHERE id = ?', [req.params.id], (err, row) => {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    if (!row) { db.close(); return res.status(404).json({ error: 'Not found' }); }
    if (row.kind !== 'artifact') { db.close(); return res.status(400).json({ error: 'Принять можно только артефакт' }); }

    let meta = {};
    try { meta = JSON.parse(row.meta) || {}; } catch (e) { meta = {}; }
    if (meta.accepted) { db.close(); return res.status(409).json({ error: 'Артефакт уже принят' }); }

    const agentId = String(row.channel || '').split(':')[1] || null;
    db.get('SELECT name, price_task FROM agents WHERE id = ?', [agentId], (e2, agent) => {
      if (e2) { db.close(); return res.status(500).json({ error: e2.message }); }

      const updatedMeta = Object.assign({}, meta, { accepted: true });
      const amount = (agent && agent.price_task) || FALLBACK_TASK_PRICE;
      const artifactTitle = updatedMeta.title || 'результат';
      const invoiceTitle = `Talent · приёмка результата — ${artifactTitle}`;
      const who = (agent && agent.name) || agentId || 'цифровой сотрудник';
      const hhmm = new Date().toTimeString().slice(0, 5);

      db.serialize(() => {
        db.run('UPDATE messages SET meta = ? WHERE id = ?', [JSON.stringify(updatedMeta), row.id]);
        db.run(
          "INSERT INTO invoices (kind,title,amount,status,created_at) VALUES ('task',?,?,'выставлен',datetime('now'))",
          [invoiceTitle, amount],
          function (e3) {
            if (e3) { db.close(); return res.status(500).json({ error: e3.message }); }
            const invoice = { id: this.lastID, kind: 'task', title: invoiceTitle, amount, status: 'выставлен' };
            db.run(
              "INSERT INTO audit_log (time,who,what,verdict,emoji,dept,created_at) VALUES (?,?,?,?,?,?,datetime('now'))",
              [hhmm, who, `Приёмка результата: ${artifactTitle}`, 'принято', '✅', 'talent'],
              e4 => {
                if (e4) { db.close(); return res.status(500).json({ error: e4.message }); }
                // системное сообщение в канал — чат видит факт приёмки
                db.run(
                  "INSERT INTO messages (channel,who,kind,text,meta,created_at) VALUES (?,?,?,?,NULL,datetime('now'))",
                  [row.channel, 'system', 'status', `Результат принят. Выставлен счёт: ${invoiceTitle}.`],
                  () => {
                    db.close();
                    const message = Object.assign({}, row, { meta: updatedMeta });
                    res.json({ message, invoice });
                  }
                );
              }
            );
          }
        );
      });
    });
  });
});

/* POST /api/messages/:id/return — возврат артефакта на доработку: meta.returned,
   чтобы после F5 у возвращённого артефакта не появлялись кнопки приёмки заново */
router.post('/:id/return', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM messages WHERE id = ?', [req.params.id], (err, row) => {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    if (!row) { db.close(); return res.status(404).json({ error: 'Not found' }); }
    if (row.kind !== 'artifact') { db.close(); return res.status(400).json({ error: 'Вернуть можно только артефакт' }); }

    let meta = {};
    try { meta = JSON.parse(row.meta) || {}; } catch (e) { meta = {}; }
    if (meta.accepted) { db.close(); return res.status(409).json({ error: 'Артефакт уже принят' }); }

    const updatedMeta = Object.assign({}, meta, { returned: true });
    db.run('UPDATE messages SET meta = ? WHERE id = ?', [JSON.stringify(updatedMeta), row.id], e2 => {
      db.close();
      if (e2) return res.status(500).json({ error: e2.message });
      res.json({ message: Object.assign({}, row, { meta: updatedMeta }) });
    });
  });
});

module.exports = router;
