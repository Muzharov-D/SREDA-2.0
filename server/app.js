const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

const API_KEY = process.env.API_KEY || 'sreda-prototype-key-2026';

function auth(req, res, next){
  if(req.path === '/health') return next();
  const key = req.headers['x-api-key'];
  if(key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

initDb().then(() => {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', auth);

  // API routes
  app.use('/api/agents', require('./routes/agents'));
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/bills', require('./routes/bills'));
  app.use('/api/audit', require('./routes/audit'));

  // Health check (no auth)
  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // Static files (frontend)
  app.use(express.static(path.join(__dirname, '..')));

  // SPA fallback for Inside routes
  app.get('/inside', (req, res) => res.sendFile(path.join(__dirname, '..', 'index.html')));
  app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, '..', 'portal.html')));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log('SREDA API on port', PORT));
}).catch(err => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
