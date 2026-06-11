const { getDb } = require('../db');
const router = require('express').Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM audit_log WHERE id = ?', [req.params.id], (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const a = req.body;
  const db = getDb();
  db.run(
    'INSERT INTO audit_log (time,who,what,verdict,emoji,dept,created_at) VALUES (?,?,?,?,?,?,datetime("now"))',
    [a.time, a.who, a.what, a.verdict, a.emoji, a.dept],
    function(err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM audit_log WHERE id = ?', [req.params.id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
