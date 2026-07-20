const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/lingshan.db');
const db = new Database(dbPath, { verbose: null });

const tables = ['scenic_spots', 'spot_highlights', 'spot_tips', 'faqs', 'routes', 'route_stops', 'chat_interactions', 'character_configs', 'ticket_info', 'visitor_stats', 'admin_users'];

tables.forEach(table => {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    console.log(`\n=== ${table} ===`);
    columns.forEach(col => {
      console.log(`  ${col.name} (${col.type}) ${col.pk ? 'PK' : ''}`);
    });
  } catch (err) {
    console.log(`\n=== ${table}: 表不存在 ===`);
  }
});

db.close();