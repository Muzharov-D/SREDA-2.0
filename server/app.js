const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');

initDb().then(() => {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api/agents', require('./routes/agents'));
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/bills', require('./routes/bills'));
  app.use('/api/audit', require('./routes/audit'));

  // Health check
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
