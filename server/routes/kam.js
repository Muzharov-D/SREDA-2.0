/* ── KAM: выученные правила цифровых сотрудников ──
   GET  /api/kam/learn  → список правил (реплей при загрузке стенда)
   POST /api/kam/learn  → записать правило (правка эксперта / возврат из петли)
   POST /api/kam/reset  → стереть обучение (подготовка к показу)
   Auth — общий X-API-Key (см. server/app.js). */
const express = require('express');
const { getDb } = require('../db');
const router = express.Router();

router.get('/learn', (req, res) => {
  const db = getDb();
  db.all('SELECT wid, risk_text, human_text, source, risk_ref, applied, created_at FROM kam_learn ORDER BY id ASC LIMIT 500', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/learn', (req, res) => {
  const b = req.body || {};
  if (!b.wid || !b.humanText) return res.status(400).json({ error: 'wid and humanText required' });
  const db = getDb();
  db.run('INSERT INTO kam_learn (wid, risk_text, human_text, source, risk_ref, applied) VALUES (?,?,?,?,?,?)',
    [String(b.wid).slice(0,64), String(b.riskText||'').slice(0,500), String(b.humanText).slice(0,500),
     String(b.source||'').slice(0,200), String(b.riskRef||'').slice(0,500), String(b.applied||'').slice(0,500)],
    function(err){
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: this.lastID });
    });
});

/* проекты: список целиком (кросс-девайс) и полная замена набора */
router.get('/projects', (req, res) => {
  const db = getDb();
  db.all('SELECT id, data FROM kam_projects ORDER BY updated_at DESC LIMIT 50', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    const out = [];
    rows.forEach(r => { try { out.push(JSON.parse(r.data)); } catch (e) {} });
    res.json(out);
  });
});

router.post('/projects', (req, res) => {
  const list = Array.isArray(req.body && req.body.list) ? req.body.list : null;
  if (!list) return res.status(400).json({ error: 'list[] required' });
  const db = getDb();
  db.serialize(() => {
    db.run('DELETE FROM kam_projects');
    const stmt = db.prepare('INSERT OR REPLACE INTO kam_projects (id, data, updated_at) VALUES (?,?,datetime("now"))');
    list.slice(0, 20).forEach(p => { if (p && p.id) stmt.run(String(p.id).slice(0,64), JSON.stringify(p).slice(0, 200000)); });
    stmt.finalize((err) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, saved: Math.min(list.length, 20) });
    });
  });
});

router.post('/reset', (req, res) => {
  const db = getDb();
  db.serialize(() => {
    db.run('DELETE FROM kam_learn');
    db.run('DELETE FROM kam_projects', [], (err) => {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, reset: true });
    });
  });
});

module.exports = router;
