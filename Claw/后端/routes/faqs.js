const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    
    let query = `SELECT * FROM faqs ORDER BY category, order_num`;
    
    if (category) {
      query = `SELECT * FROM faqs WHERE category = ? ORDER BY order_num`;
      const faqs = db.prepare(query).all(category);
      res.json({ success: true, data: faqs });
    } else {
      const faqs = db.prepare(query).all();
      res.json({ success: true, data: faqs });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const faq = db.prepare(`SELECT * FROM faqs WHERE id = ?`).get(req.params.id);
    
    if (!faq) {
      return res.status(404).json({ error: 'FAQ不存在' });
    }
    res.json({ success: true, data: faq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { question, answer, category, order_num } = req.body;
    
    const result = db.prepare(
      `INSERT INTO faqs (question, answer, category, order_num) VALUES (?, ?, ?, ?)`
    ).run(question, answer, category || 'other', order_num || 0);
    
    res.json({ success: true, id: result.lastInsertRowid, message: 'FAQ创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { question, answer, category, order_num } = req.body;
    
    const result = db.prepare(
      `UPDATE faqs SET question = ?, answer = ?, category = ?, order_num = ? WHERE id = ?`
    ).run(question, answer, category || 'other', order_num || 0, req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'FAQ不存在' });
    }
    res.json({ success: true, message: 'FAQ更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM faqs WHERE id = ?`).run(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'FAQ不存在' });
    }
    res.json({ success: true, message: 'FAQ删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories/list', (req, res) => {
  try {
    const categories = db.prepare(`SELECT DISTINCT category FROM faqs`).all();
    const result = categories.map(c => c.category);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
