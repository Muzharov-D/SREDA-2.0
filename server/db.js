const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');

function getDb() {
  return new sqlite3.Database(DB_PATH);
}

function initDb() {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT,
        role TEXT,
        grade TEXT,
        rating REAL,
        acc INTEGER,
        done INTEGER,
        price_task INTEGER,
        price_month INTEGER,
        domains TEXT,
        spells TEXT,
        folio TEXT,
        reviews TEXT,
        passport TEXT,
        featured INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT,
        icon TEXT,
        tpl TEXT,
        status TEXT,
        stage INTEGER,
        price INTEGER,
        prog TEXT,
        crew TEXT,
        what TEXT,
        crit TEXT,
        artifacts TEXT,
        feed TEXT,
        feed_done TEXT,
        gate_wait TEXT,
        paid_lbl TEXT,
        meta INTEGER
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT,
        title TEXT,
        amount INTEGER,
        status TEXT,
        created_at TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time TEXT,
        who TEXT,
        what TEXT,
        verdict TEXT,
        emoji TEXT,
        dept TEXT,
        created_at TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item TEXT,
        who TEXT,
        cost TEXT,
        risk TEXT,
        note TEXT,
        done TEXT,
        fresh INTEGER,
        dept TEXT
      )`, function(err) {
        db.close();
        if (err) return reject(err);
        console.log('Database initialized at', DB_PATH);
        resolve();
      });
    });
  });
}

module.exports = { getDb, initDb };
