const { getDb } = require('../db');
const router = require('express').Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM agents', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(r => {
      ['domains','spells','folio','reviews','passport'].forEach(k => {
        try { r[k] = JSON.parse(r[k]); } catch(e) {}
      });
    });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM agents WHERE id = ?', [req.params.id], (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    ['domains','spells','folio','reviews','passport'].forEach(k => {
      try { row[k] = JSON.parse(row[k]); } catch(e) {}
    });
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const a = req.body;
  const db = getDb();
  db.run(
    'INSERT INTO agents (id,name,role,grade,rating,acc,done,price_task,price_month,domains,spells,folio,reviews,passport,featured) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [a.id,a.name,a.role,a.grade,a.rating,a.acc,a.done,a.price_task,a.price_month,JSON.stringify(a.domains||[]),JSON.stringify(a.spells||[]),JSON.stringify(a.folio||[]),JSON.stringify(a.reviews||[]),JSON.stringify(a.passport||[]),a.featured?1:0],
    function(err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: a.id });
    }
  );
});

router.put('/:id', (req, res) => {
  const a = req.body;
  const db = getDb();
  db.run(
    'UPDATE agents SET name=?,role=?,grade=?,rating=?,acc=?,done=?,price_task=?,price_month=?,domains=?,spells=?,folio=?,reviews=?,passport=?,featured=? WHERE id=?',
    [a.name,a.role,a.grade,a.rating,a.acc,a.done,a.price_task,a.price_month,JSON.stringify(a.domains||[]),JSON.stringify(a.spells||[]),JSON.stringify(a.folio||[]),JSON.stringify(a.reviews||[]),JSON.stringify(a.passport||[]),a.featured?1:0,req.params.id],
    function(err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM agents WHERE id = ?', [req.params.id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
