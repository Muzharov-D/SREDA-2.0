const { getDb } = require('../db');
const router = require('express').Router();

/* GET /api/tasks?contract=<id> */
router.get('/', (req, res) => {
  const { contract } = req.query;
  const sql = contract
    ? 'SELECT * FROM tasks WHERE contract = ? ORDER BY id ASC'
    : 'SELECT * FROM tasks ORDER BY id ASC';
  const params = contract ? [contract] : [];
  const db = getDb();
  db.all(sql, params, (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/* POST /api/tasks */
router.post('/', (req, res) => {
  const t = req.body || {};
  if (!t.item) return res.status(400).json({ error: 'item is required' });
  const db = getDb();
  db.run(
    'INSERT INTO tasks (item,who,cost,risk,note,done,fresh,dept,contract,status) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [t.item, t.who || null, t.cost || null, t.risk || null, t.note || null, t.done || null, t.fresh ? 1 : 0, t.dept || null, t.contract || null, t.status || 'new'],
    function (err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID });
    }
  );
});

/* PATCH /api/tasks/:id { status } */
router.patch('/:id', (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status is required' });
  const db = getDb();
  db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
    if (err) { db.close(); return res.status(500).json({ error: err.message }); }
    if (this.changes === 0) { db.close(); return res.status(404).json({ error: 'Not found' }); }
    db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (e2, row) => {
      db.close();
      if (e2) return res.status(500).json({ error: e2.message });
      res.json(row);
    });
  });
});

module.exports = router;
