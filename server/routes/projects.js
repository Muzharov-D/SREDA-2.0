const { getDb } = require('../db');
const router = require('express').Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.all('SELECT * FROM projects', [], (err, rows) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(r => {
      ['prog','crew','what','crit','artifacts','feed','feed_done','gate_wait'].forEach(k => {
        try { r[k] = JSON.parse(r[k]); } catch(e) {}
      });
    });
    res.json(rows);
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.get('SELECT * FROM projects WHERE id = ?', [req.params.id], (err, row) => {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Not found' });
    ['prog','crew','what','crit','artifacts','feed','feed_done','gate_wait'].forEach(k => {
      try { row[k] = JSON.parse(row[k]); } catch(e) {}
    });
    res.json(row);
  });
});

router.post('/', (req, res) => {
  const p = req.body;
  const db = getDb();
  db.run(
    'INSERT INTO projects (id,title,icon,tpl,status,stage,price,prog,crew,what,crit,artifacts,feed,feed_done,gate_wait,paid_lbl,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [p.id,p.title,p.icon,p.tpl,p.status,p.stage,p.price,JSON.stringify(p.prog||[]),JSON.stringify(p.crew||[]),JSON.stringify(p.what||[]),JSON.stringify(p.crit||[]),JSON.stringify(p.artifacts||[]),JSON.stringify(p.feed||[]),JSON.stringify(p.feed_done||[]),JSON.stringify(p.gate_wait||null),p.paid_lbl,p.meta?1:0],
    function(err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: p.id });
    }
  );
});

router.put('/:id', (req, res) => {
  const p = req.body;
  const db = getDb();
  db.run(
    'UPDATE projects SET title=?,icon=?,tpl=?,status=?,stage=?,price=?,prog=?,crew=?,what=?,crit=?,artifacts=?,feed=?,feed_done=?,gate_wait=?,paid_lbl=?,meta=? WHERE id=?',
    [p.title,p.icon,p.tpl,p.status,p.stage,p.price,JSON.stringify(p.prog||[]),JSON.stringify(p.crew||[]),JSON.stringify(p.what||[]),JSON.stringify(p.crit||[]),JSON.stringify(p.artifacts||[]),JSON.stringify(p.feed||[]),JSON.stringify(p.feed_done||[]),JSON.stringify(p.gate_wait||null),p.paid_lbl,p.meta?1:0,req.params.id],
    function(err) {
      db.close();
      if (err) return res.status(500).json({ error: err.message });
      res.json({ updated: this.changes });
    }
  );
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.run('DELETE FROM projects WHERE id = ?', [req.params.id], function(err) {
    db.close();
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes });
  });
});

module.exports = router;
