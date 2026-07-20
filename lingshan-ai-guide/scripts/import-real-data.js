const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data/lingshan.db');
const db = new Database(dbPath, { verbose: null });
db.pragma('foreign_keys = ON');

db.prepare(`CREATE TABLE IF NOT EXISTS spot_highlights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id INTEGER,
  highlight TEXT,
  FOREIGN KEY (spot_id) REFERENCES scenic_spots(id)
)`).run();

db.prepare(`CREATE TABLE IF NOT EXISTS spot_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id INTEGER,
  tip TEXT,
  FOREIGN KEY (spot_id) REFERENCES scenic_spots(id)
)`).run();

function extractSpotInfo(content) {
  const lines = content.split('\n').filter(line => line.trim());
  let subtitle = '';
  let highlights = [];
  let tips = [];
  
  for (const line of lines) {
    if (subtitle === '' && line.length < 100 && !line.includes('---') && !line.includes('|') && !line.includes('一、') && !line.includes('二、') && !line.includes('三、')) {
      subtitle = line.trim();
    }
    if (line.includes('特色') || line.includes('奇观') || line.includes('体验')) {
      highlights.push(line.trim().substring(0, 100));
    }
    if (line.includes('注意') || line.includes('建议') || line.includes('提醒')) {
      tips.push(line.trim().substring(0, 100));
    }
  }
  
  return { subtitle: subtitle.substring(0, 50) || '灵山景点', highlights, tips };
}

function excelDateToJSDate(excelDate) {
  if (!excelDate || typeof excelDate !== 'number') return new Date();
  const baseDate = new Date(1899, 11, 30);
  const date = new Date(baseDate.getTime() + excelDate * 24 * 60 * 60 * 1000);
  return date;
}

function importRealData() {
  console.log('=== 开始导入真实数据 ===');
  
  const chatData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/chat-data.json'), 'utf8'));
  const lingshanData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/lingshan-excel-data.json'), 'utf8'));
  
  console.log(`\n1. 更新景点数据`);
  
  const spotMapping = {
    '灵山胜境': { subtitle: '国家5A级景区', tag: '世界佛教论坛永久会址', tag_color: '#C8A357', duration: '4-5小时', best_time: '全年适宜', hero_gradient: 'linear-gradient(135deg, #C8A357 0%, #8B6914 100%)' },
    '灵山大佛': { subtitle: '世界最高青铜立佛', tag: '五方五佛之东方佛', tag_color: '#C8A357', duration: '1-2小时', best_time: '上午9-11点', hero_gradient: 'linear-gradient(135deg, #C8A357 0%, #D4AF37 100%)' },
    '灵山梵宫': { subtitle: '佛教艺术殿堂', tag: '世界佛教论坛主会场', tag_color: '#FF9800', duration: '1-2小时', best_time: '下午1-3点', hero_gradient: 'linear-gradient(135deg, #FF9800 0%, #E65100 100%)' },
    '九龙灌浴': { subtitle: '大型音乐动态群雕', tag: '花开见佛奇观', tag_color: '#4CAF50', duration: '30分钟', best_time: '表演时间', hero_gradient: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)' },
    '五印坛城': { subtitle: '藏传佛教文化景观', tag: '原汁原味藏文化', tag_color: '#9C27B0', duration: '1小时', best_time: '下午3-5点', hero_gradient: 'linear-gradient(135deg, #9C27B0 0%, #6A1B9A 100%)' },
    '祥符禅寺': { subtitle: '唐代古刹', tag: '慈恩宗道场', tag_color: '#2196F3', duration: '1小时', best_time: '清晨', hero_gradient: 'linear-gradient(135deg, #2196F3 0%, #1565C0 100%)' },
    '禅意小镇·拈花湾': { subtitle: '东方禅意生活乐土', tag: '国家5A级景区', tag_color: '#E91E63', duration: '3-4小时', best_time: '傍晚夜景', hero_gradient: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)' }
  };
  
  lingshanData.forEach((item, index) => {
    if (index >= 20) return;
    
    const info = spotMapping[item.name] || { 
      subtitle: extractSpotInfo(item.content).subtitle, 
      tag: '热门景点', 
      tag_color: '#C8A357',
      duration: '2-3小时',
      best_time: '全年适宜',
      hero_gradient: 'linear-gradient(135deg, #C8A357 0%, #8B6914 100%)'
    };
    const existing = db.prepare('SELECT id FROM scenic_spots WHERE name = ?').get(item.name);
    
    if (existing) {
      db.prepare(`UPDATE scenic_spots SET 
        subtitle = ?, 
        description = ?, 
        rating = ?, 
        tag = ?, 
        tag_color = ?,
        duration = ?,
        best_time = ?,
        hero_gradient = ?
      WHERE id = ?`).run(
        info.subtitle,
        item.content.substring(0, 5000),
        item.satisfaction || 4.5,
        info.tag,
        info.tag_color,
        info.duration,
        info.best_time,
        info.hero_gradient,
        existing.id
      );
      console.log(`  更新: ${item.name}`);
    } else {
      db.prepare(`INSERT INTO scenic_spots (spot_id, name, subtitle, description, rating, tag, tag_color, duration, best_time, hero_gradient) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        `spot-${Date.now()}-${index}`,
        item.name,
        info.subtitle,
        item.content.substring(0, 5000),
        item.satisfaction || 4.5,
        info.tag,
        info.tag_color,
        info.duration,
        info.best_time,
        info.hero_gradient
      );
      console.log(`  新增: ${item.name}`);
    }
    
    const spotId = existing ? existing.id : db.prepare('SELECT last_insert_rowid() as id').get().id;
    const { highlights, tips } = extractSpotInfo(item.content);
    
    highlights.slice(0, 5).forEach(h => {
      db.prepare('INSERT OR IGNORE INTO spot_highlights (spot_id, highlight) VALUES (?, ?)').run(spotId, h);
    });
    
    tips.slice(0, 3).forEach(t => {
      db.prepare('INSERT OR IGNORE INTO spot_tips (spot_id, tip) VALUES (?, ?)').run(spotId, t);
    });
  });
  
  console.log(`\n2. 更新对话记录`);
  
  db.prepare('DELETE FROM chat_interactions').run();
  
  chatData.forEach((chat, index) => {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    date.setHours(Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    
    db.prepare(`INSERT INTO chat_interactions (user_message, ai_response, user_id, created_at) 
      VALUES (?, ?, ?, ?)`).run(
      chat.user,
      chat.ai,
      `user-${Math.floor(Math.random() * 50) + 1}`,
      date.toISOString()
    );
  });
  console.log(`  插入 ${chatData.length} 条对话记录`);
  
  console.log(`\n3. 更新访问统计数据`);
  
  db.prepare('DELETE FROM visitor_stats').run();
  
  lingshanData.forEach((item, index) => {
    if (index >= 100) return;
    
    const spot = db.prepare('SELECT id FROM scenic_spots WHERE name = ?').get(item.name);
    if (!spot) return;
    
    const visitDate = excelDateToJSDate(item.visitDate);
    
    db.prepare(`INSERT INTO visitor_stats (spot_id, user_id, created_at) 
      VALUES (?, ?, ?)`).run(
      spot.id,
      `user-${Math.floor(Math.random() * 100) + 1}`,
      visitDate.toISOString()
    );
  });
  console.log(`  插入 ${Math.min(lingshanData.length, 100)} 条访问记录`);
  
  console.log(`\n4. 更新FAQ数据`);
  
  const realFaqs = [
    { question: '灵山胜境的门票价格是多少？', answer: '灵山胜境门票价格为210元/人，包含灵山大佛、灵山梵宫、九龙灌浴、五印坛城、祥符禅寺五大核心景点。', category: 'ticket' },
    { question: '灵山胜境开放时间是什么时候？', answer: '灵山胜境开放时间为07:30-17:30（16:30停止入园），建议提前到达景区以便充分游览。', category: 'time' },
    { question: '灵山大佛有多高？', answer: '灵山大佛通高88米，佛体高79米，莲花座高9米，是世界上最高的露天青铜释迦牟尼立像。', category: 'spot' },
    { question: '九龙灌浴表演时间是什么？', answer: '九龙灌浴表演每天定时进行，上午10:00、11:30，下午14:00、15:30、16:30各一场，每场约15分钟。', category: 'time' },
    { question: '灵山梵宫有什么特别的？', answer: '灵山梵宫建筑面积7.2万平方米，穹顶高达64米，内部汇聚东阳木雕、敦煌壁画、琉璃烧制等数十项国家级非物质文化遗产，被誉为"东方的卢浮宫"。', category: 'spot' },
    { question: '五印坛城需要另外购票吗？', answer: '五印坛城包含在灵山胜境门票内，无需另外购票，游客可免费参观藏传佛教文化展览。', category: 'ticket' },
    { question: '景区内有餐饮服务吗？', answer: '景区内设有灵山蔬食馆、梵宫自助餐、素斋等多种餐饮选择，提供素食和简餐服务。', category: 'service' },
    { question: '游览灵山胜境需要多长时间？', answer: '建议游览时间为4-5小时，可全面体验灵山胜境的五大核心景点和文化活动。', category: 'route' },
    { question: '景区是否提供讲解服务？', answer: '景区提供专业导游讲解服务，也可租用智能导览设备，费用为30元/台。', category: 'service' },
    { question: '灵山胜境适合带孩子游玩吗？', answer: '非常适合！景区有九龙灌浴表演、灵山梵宫趣味寻宝、五印坛城转经祈福等亲子活动，让孩子在游玩中了解佛教文化。', category: 'service' },
    { question: '如何到达灵山胜境？', answer: '可乘坐无锡公交88路、89路直达景区，也可自驾前往，景区提供大型停车场。', category: 'rule' },
    { question: '景区内可以拍照吗？', answer: '景区内大部分区域可以拍照，但灵山大佛内部和部分宗教场所禁止拍照，请遵守景区规定。', category: 'rule' },
    { question: '拈花湾和灵山胜境有联票吗？', answer: '灵山胜境与拈花湾推出联票优惠，联票价格为310元/人，两日内有效。', category: 'ticket' },
    { question: '祥符禅寺的历史有多久？', answer: '祥符禅寺始建于唐代贞观年间，距今已有1300余年历史，是灵山胜境历史最悠久的景点。', category: 'spot' },
    { question: '灵山大佛的建造用了多少铜？', answer: '灵山大佛由725吨青铜铸造，由1560块6-8毫米厚的铜壁板焊接而成，焊缝长达35公里。', category: 'spot' }
  ];
  
  db.prepare('DELETE FROM faqs').run();
  
  realFaqs.forEach((faq, index) => {
    db.prepare('INSERT INTO faqs (question, answer, category, order_num) VALUES (?, ?, ?, ?)').run(
      faq.question, faq.answer, faq.category, index + 1
    );
  });
  console.log(`  插入 ${realFaqs.length} 条FAQ`);
  
  console.log(`\n5. 更新路线数据`);
  
  const realRoutes = [
    { name: '经典祈福路线', description: '入口 → 天下第一掌 → 百子戏弥勒 → 九龙灌浴 → 灵山梵宫 → 五印坛城 → 祥符禅寺 → 灵山大佛 → 佛足印 → 登云道', duration: '3-4小时', difficulty: '轻松', difficulty_color: '#4CAF50' },
    { name: '深度文化路线', description: '入口 → 祥符禅寺（参观千年古刹） → 灵山大佛（登顶祈福） → 九龙灌浴（观看表演） → 灵山梵宫（欣赏非遗艺术） → 五印坛城（体验藏文化）', duration: '4-5小时', difficulty: '适中', difficulty_color: '#FF9800' },
    { name: '亲子互动路线', description: '入口 → 百子戏弥勒（拍照打卡） → 九龙灌浴（观看表演） → 灵山梵宫趣味寻宝 → 五印坛城转经祈福 → 灵山蔬食馆（素食体验）', duration: '3小时', difficulty: '轻松', difficulty_color: '#4CAF50' },
    { name: '禅意静心路线', description: '入口 → 祥符禅寺（禅修体验） → 灵山精舍（抄经品茶） → 灵山大佛（静坐冥想） → 五印坛城（转经祈福）', duration: '5-6小时', difficulty: '适中', difficulty_color: '#FF9800' },
    { name: '夜景体验路线', description: '下午入园 → 灵山梵宫 → 五印坛城 → 等待九龙灌浴夜景 → 灵山精舍禅修体验', duration: '5小时', difficulty: '轻松', difficulty_color: '#4CAF50' }
  ];
  
  db.prepare('DELETE FROM routes').run();
  
  realRoutes.forEach((route, index) => {
    db.prepare(`INSERT INTO routes (route_id, name, description, duration, difficulty, difficulty_color) 
      VALUES (?, ?, ?, ?, ?, ?)`).run(
      `route-${Date.now()}-${index}`,
      route.name,
      route.description,
      route.duration,
      route.difficulty,
      route.difficulty_color
    );
  });
  console.log(`  插入 ${realRoutes.length} 条路线`);
  
  console.log(`\n6. 更新票务信息`);
  
  db.prepare('DELETE FROM ticket_info').run();
  db.prepare(`INSERT INTO ticket_info (price, half_price, free, open_time, includes) VALUES (?, ?, ?, ?, ?)`).run(
    '210元/人',
    '105元/人（60-69岁老人、1.2-1.5米儿童、全日制本科及以下学历学生）',
    '免费（70岁以上老人、1.2米以下儿童、残疾人、现役军人、记者、导游）',
    '07:30-17:30（16:30停止入园）',
    '灵山大佛、灵山梵宫、九龙灌浴、五印坛城、祥符禅寺'
  );
  console.log(`  更新票务信息`);
  
  console.log(`\n=== 真实数据导入完成！ ===`);
  
  const spotCount = db.prepare('SELECT COUNT(*) as count FROM scenic_spots').get().count;
  const highlightCount = db.prepare('SELECT COUNT(*) as count FROM spot_highlights').get().count;
  const tipCount = db.prepare('SELECT COUNT(*) as count FROM spot_tips').get().count;
  const faqCount = db.prepare('SELECT COUNT(*) as count FROM faqs').get().count;
  const routeCount = db.prepare('SELECT COUNT(*) as count FROM routes').get().count;
  const chatCount = db.prepare('SELECT COUNT(*) as count FROM chat_interactions').get().count;
  const visitCount = db.prepare('SELECT COUNT(*) as count FROM visitor_stats').get().count;
  
  console.log(`\n数据库统计：`);
  console.log(`  景点数: ${spotCount}`);
  console.log(`  景点亮点数: ${highlightCount}`);
  console.log(`  景点提示数: ${tipCount}`);
  console.log(`  FAQ数: ${faqCount}`);
  console.log(`  路线数: ${routeCount}`);
  console.log(`  对话数: ${chatCount}`);
  console.log(`  访问记录数: ${visitCount}`);
  
  db.close();
}

importRealData();