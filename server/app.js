const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb, initDb } = require('./db');
const { seedAll } = require('./seed');

const API_KEY = process.env.API_KEY || 'sreda-prototype-key-2026';

function auth(req, res, next){
  if(req.path === '/health') return next();
  const key = req.headers['x-api-key'];
  if(key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

/* Авто-сид: на Render диск эфемерный — если БД пустая, наполняем при старте */
function seedIfEmpty() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get('SELECT COUNT(*) AS n FROM agents', [], (err, row) => {
      db.close();
      if (err) return reject(err);
      if (row.n > 0) return resolve(false);
      console.log('Empty database — seeding…');
      seedAll().then(() => resolve(true)).catch(reject);
    });
  });
}

initDb().then(seedIfEmpty).then(() => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', auth);

  // API routes
  app.use('/api/agents', require('./routes/agents'));
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/bills', require('./routes/bills'));
  app.use('/api/audit', require('./routes/audit'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/tasks', require('./routes/tasks'));

  // Demo: полный пересев БД к исходному состоянию
  app.post('/api/demo/reset', (req, res) => {
    seedAll()
      .then(() => res.json({ ok: true, reset: true }))
      .catch(err => res.status(500).json({ error: err.message }));
  });

  // Health check (no auth)
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Static files (frontend): index.html на корне, portal.html / office.html по имени
  app.use(express.static(path.join(__dirname, '..')));

  // Дружелюбные пути без расширения
  app.get('/inside', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
  app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, '..', 'portal.html')));
  app.get('/office', (req, res) => res.sendFile(path.join(__dirname, '..', 'office.html')));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('SREDA API on port', PORT));
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
