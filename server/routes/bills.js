const { getDb } = require('../db');
const router = require('express').Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM invoices ORDER BY created_at DESC', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id], (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const i = req.body;
  const db = getDb();
  db.run(
    'INSERT INTO invoices (kind,title,amount,status,created_at) VALUES (?,?,?,?,datetime("now"))',
    [i.kind, i.title, i.amount, i.status || 'выставлен'],
    function(err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

router.put('/:id', (req, res) => {
  const i = req.body;
  const db = getDb();
  db.run(
    'UPDATE invoices SET kind=?,title=?,amount=?,status=? WHERE id=?',
    [i.kind, i.title, i.amount, i.status, req.params.id],
    function(err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

/* PATCH /api/bills/:id { status } — например, оплата счёта */
router.patch('/:id', (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  const db = getDb();
  db.run('UPDATE invoices SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    if (this.changes === 0) { db.close(); return res.status(404).json({ error: 'Not found' }); }
    db.get('SELECT * FROM invoices WHERE id = ?', [req.params.id], (e2, row) => {
      db.close();
      if (e2) return res.status(500).json({ error: e2.message });
      res.json(row);
    });
  });
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM invoices WHERE id = ?', [req.params.id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
