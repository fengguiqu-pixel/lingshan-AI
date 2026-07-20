const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/lingshan.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: null });
db.pragma('foreign_keys = ON');

function saveDb() {
  db.close();
}

process.on('exit', saveDb);
process.on('SIGINT', () => {
  saveDb();
  process.exit(0);
});

module.exports = db;
