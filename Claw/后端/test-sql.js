const initSqlJs = require('sql.js');

(async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  
  db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
  db.run('INSERT INTO test VALUES (1, "hello")');
  
  const result = db.exec('SELECT * FROM test');
  console.log('exec result:', JSON.stringify(result));
  
  const stmt = db.prepare('SELECT * FROM test WHERE id = ?');
  stmt.bind([1]);
  const row = stmt.getAsObject();
  console.log('getAsObject:', row);
  
  stmt.reset();
  stmt.free();
  
  console.log('SQL.js API test passed!');
})();
