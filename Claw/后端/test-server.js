const express = require('express');
const cors = require('cors');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const dbPath = path.join(__dirname, './data/lingshan.db');

const app = express();
app.use(cors());
app.use(express.json());

let db = null;

function rowsToObjects(columns, values) {
  if (!values || values.length === 0) return [];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

function getDbWrapper() {
  return {
    run: function(sql, params = []) {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      const lastInsertRowid = db.getRowsModified();
      stmt.free();
      return {
        changes: lastInsertRowid > 0 ? 1 : 0,
        lastInsertRowid: lastInsertRowid
      };
    },
    
    get: function(sql, params = []) {
      const result = db.exec(sql, params);
      if (!result || result.length === 0 || !result[0].values || result[0].values.length === 0) {
        return null;
      }
      return rowsToObjects(result[0].columns, result[0].values)[0];
    },
    
    all: function(sql, params = []) {
      const result = db.exec(sql, params);
      if (!result || result.length === 0 || !result[0].values) {
        return [];
      }
      return rowsToObjects(result[0].columns, result[0].values);
    }
  };
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '服务运行正常' });
});

app.get('/api/faqs', (req, res) => {
  try {
    const dbw = getDbWrapper();
    const faqs = dbw.all(`SELECT * FROM faqs ORDER BY category, order_num`);
    res.json({ success: true, data: faqs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  try {
    console.log('Initializing SQL.js...');
    const SQL = await initSqlJs();
    console.log('SQL.js initialized');
    
    let buffer = null;
    if (fs.existsSync(dbPath)) {
      buffer = fs.readFileSync(dbPath);
      console.log('Loaded existing database');
    }
    
    db = new SQL.Database(buffer);
    db.run('PRAGMA foreign_keys = ON');
    console.log('Database ready');
    
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Server startup failed:', err.message);
    process.exit(1);
  }
}

startServer();
