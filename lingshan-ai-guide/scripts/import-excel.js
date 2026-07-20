const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/lingshan.db');
const db = new Database(dbPath, { verbose: null });
db.pragma('foreign_keys = OFF');

console.log('=== 插入模拟访问数据 ===');

const spots = db.prepare(`SELECT id, name FROM scenic_spots`).all();
console.log('景点列表:', spots.map(s => s.name));

const visitCounts = [
  { name: '灵山大佛', visits: 200 },
  { name: '灵山梵宫', visits: 150 },
  { name: '九龙灌浴', visits: 120 },
  { name: '五印坛城', visits: 80 },
  { name: '祥符禅寺', visits: 60 }
];

spots.forEach(spot => {
  const target = visitCounts.find(v => v.name === spot.name) || { visits: 50 };
  
  for (let i = 0; i < target.visits; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    db.prepare(`INSERT INTO visitor_stats (spot_id, user_id, created_at) VALUES (?, ?, ?)`).run(
      spot.id,
      `user-${Math.floor(Math.random() * 100)}`,
      date.toISOString()
    );
  }
  
  console.log(`景点 "${spot.name}" 已插入 ${target.visits} 条访问记录`);
});

console.log('\n=== 插入模拟对话数据 ===');
const mockChats = [
  { user: '请问灵山大佛有多高？', ai: '灵山大佛通高88米，是目前世界上最高的青铜立佛。' },
  { user: '门票多少钱？', ai: '全价票210元/人，半价票105元/人。' },
  { user: '九龙灌浴表演时间？', ai: '九龙灌浴每天4场定时表演：10:00、11:30、14:00、15:30。' },
  { user: '景区开放时间？', ai: '景区开放时间为7:30-17:30（夏季延长至07:00-17:30）。' },
  { user: '推荐路线？', ai: '推荐深度文化体验路线，涵盖祥符禅寺、灵山大佛、九龙灌浴、灵山梵宫和五印坛城。' },
  { user: '有什么优惠政策？', ai: '1.2米以下儿童、70周岁以上老人凭有效证件免费入园。' },
  { user: '可以拍照吗？', ai: '景区内大部分区域可以拍照，但部分室内场所禁止使用闪光灯。' },
  { user: '游览需要多长时间？', ai: '建议游览时间约3-4小时，可以根据个人喜好选择不同的游览路线。' },
  { user: '景区内有餐饮服务吗？', ai: '景区内设有多个餐饮点，提供素食和简餐服务。' },
  { user: '需要提前预约吗？', ai: '建议提前通过官方渠道预约门票，避免现场排队。' }
];

mockChats.forEach((chat, i) => {
  const daysAgo = Math.floor(Math.random() * 7);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  db.prepare(`INSERT INTO chat_interactions (user_id, user_message, ai_response, created_at) VALUES (?, ?, ?, ?)`).run(
    `user-${Math.floor(Math.random() * 50)}`,
    chat.user,
    chat.ai,
    date.toISOString()
  );
});

const todayChats = [
  { user: '今天天气适合游览吗？', ai: '今天天气晴朗，气温适宜，非常适合游览灵山胜境。' },
  { user: '停车方便吗？', ai: '景区内有大型停车场，停车方便，费用合理。' },
  { user: '有讲解服务吗？', ai: '景区提供专业讲解服务，可以在入口处咨询预约。' }
];

todayChats.forEach(chat => {
  db.prepare(`INSERT INTO chat_interactions (user_id, user_message, ai_response, created_at) VALUES (?, ?, ?, ?)`).run(
    `user-${Math.floor(Math.random() * 50)}`,
    chat.user,
    chat.ai,
    new Date().toISOString()
  );
});

console.log('已插入13条模拟对话记录');

db.pragma('foreign_keys = ON');
db.close();
console.log('\n数据导入完成！');