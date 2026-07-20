const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', (req, res) => {
  try {
    const spotCount = db.prepare(`SELECT COUNT(*) as count FROM scenic_spots`).get().count;
    const faqCount = db.prepare(`SELECT COUNT(*) as count FROM faqs`).get().count;
    const chatCount = db.prepare(`SELECT COUNT(*) as count FROM chat_interactions`).get().count;
    
    const todayChats = db.prepare(
      `SELECT COUNT(*) as count FROM chat_interactions WHERE DATE(created_at) = DATE('now')`
    ).get().count;
    
    const monthlyStats = db.prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count 
       FROM chat_interactions 
       GROUP BY strftime('%Y-%m', created_at) 
       ORDER BY month DESC LIMIT 6`
    ).all();
    
    const spotVisits = db.prepare(
      `SELECT ss.name, COUNT(*) as visits 
       FROM visitor_stats vs 
       JOIN scenic_spots ss ON vs.spot_id = ss.id 
       GROUP BY ss.id 
       ORDER BY visits DESC LIMIT 10`
    ).all();
    
    res.json({
      success: true,
      data: {
        overview: {
          totalSpots: spotCount,
          totalFaqs: faqCount,
          totalChats: chatCount,
          todayChats
        },
        monthlyStats,
        popularSpots: spotVisits
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/visit', (req, res) => {
  try {
    const { spot_id, user_id } = req.body;
    
    db.prepare(
      `INSERT INTO visitor_stats (spot_id, user_id) VALUES (?, ?)`
    ).run(spot_id, user_id || 'guest');
    
    res.json({ success: true, message: '访问记录已保存' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/visitors', (req, res) => {
  try {
    const { spot_id, limit = 20 } = req.query;
    
    let query = `SELECT * FROM visitor_stats ORDER BY created_at DESC LIMIT ?`;
    
    if (spot_id) {
      query = `SELECT * FROM visitor_stats WHERE spot_id = ? ORDER BY created_at DESC LIMIT ?`;
      const visits = db.prepare(query).all(spot_id, parseInt(limit));
      res.json({ success: true, data: visits });
    } else {
      const visits = db.prepare(query).all(parseInt(limit));
      res.json({ success: true, data: visits });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/chat-trends', (req, res) => {
  try {
    const dailyStats = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM chat_interactions 
       WHERE created_at >= DATE('now', '-7 days')
       GROUP BY DATE(created_at) 
       ORDER BY date`
    ).all();
    
    res.json({ success: true, data: dailyStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
