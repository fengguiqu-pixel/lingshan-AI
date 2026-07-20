const express = require('express');
const cors = require('cors');
const path = require('path');
require('./config/database');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const scenicSpotsRoutes = require('./routes/scenic-spots');
const faqsRoutes = require('./routes/faqs');
const chatRoutes = require('./routes/chat');
const routesRoutes = require('./routes/routes');
const statsRoutes = require('./routes/stats');
const characterRoutes = require('./routes/character');
const ticketRoutes = require('./routes/ticket');
const adminRoutes = require('./routes/admin');
const visualizationRoutes = require('./routes/visualization');
const knowledgeRoutes = require('./routes/knowledge');

app.use('/api/scenic-spots', scenicSpotsRoutes);
app.use('/api/faqs', faqsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/visualization', visualizationRoutes);
app.use('/api/knowledge', knowledgeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '灵山胜境AI导游后端服务运行正常' });
});

app.get('/api/stats/overview', (req, res) => {
  const db = require('./config/database');
  try {
    const spotCount = db.prepare(`SELECT COUNT(*) as count FROM scenic_spots`).get().count;
    const faqCount = db.prepare(`SELECT COUNT(*) as count FROM faqs`).get().count;
    const chatCount = db.prepare(`SELECT COUNT(*) as count FROM chat_interactions`).get().count;
    const routeCount = db.prepare(`SELECT COUNT(*) as count FROM routes`).get().count;
    const knowledgeCount = db.prepare(`SELECT COUNT(*) as count FROM knowledge_documents WHERE status = 'published'`).get().count;
    
    // 游客行为数据统计
    let vbStats = { totalRecords: 0 };
    try {
      vbStats.totalRecords = db.prepare('SELECT COUNT(*) as cnt FROM visitor_behavior').get().cnt;
    } catch(e) { /* table may not exist yet */ }
    
    const todayChats = db.prepare(
      `SELECT COUNT(*) as count FROM chat_interactions WHERE DATE(created_at) = DATE('now')`
    ).get().count;
    
    const visitorCount = db.prepare(`SELECT COUNT(*) as count FROM visitor_stats`).get().count;
    
    const spotStats = db.prepare(
      `SELECT ss.name, COUNT(vs.id) as visits 
       FROM scenic_spots ss 
       LEFT JOIN visitor_stats vs ON ss.id = vs.spot_id 
       GROUP BY ss.id 
       ORDER BY visits DESC`
    ).all();
    
    const dailyChatStats = db.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM chat_interactions 
       WHERE created_at >= DATE('now', '-7 days')
       GROUP BY DATE(created_at) 
       ORDER BY date`
    ).all();
    
    const chatHistory = db.prepare(
      `SELECT * FROM chat_interactions ORDER BY created_at DESC LIMIT 10`
    ).all();
    
    res.json({
      success: true,
      data: {
        overview: {
          totalSpots: spotCount,
          totalFaqs: faqCount,
          totalChats: chatCount,
          totalRoutes: routeCount,
          totalKnowledge: knowledgeCount,
          visitorBehaviorRecords: vbStats.totalRecords,
          todayChats,
          totalVisitors: visitorCount
        },
        spotStats,
        dailyChatStats,
        recentChats: chatHistory
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});