const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    const ticket = db.prepare(`SELECT * FROM ticket_info LIMIT 1`).get();
    
    if (!ticket) {
      return res.status(404).json({ error: '门票信息不存在' });
    }
    res.json({ success: true, data: ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { price, half_price, free, open_time, includes } = req.body;
    
    const result = db.prepare(
      `UPDATE ticket_info SET price = ?, half_price = ?, free = ?, open_time = ?, includes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(price, half_price, free, open_time, includes, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '门票信息不存在' });
    }
    res.json({ success: true, message: '门票信息更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
