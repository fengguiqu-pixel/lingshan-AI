const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../data/lingshan.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath, { verbose: null });
db.pragma('foreign_keys = OFF');

const tables = [
  `DROP TABLE IF EXISTS scenic_spots`,
  `DROP TABLE IF EXISTS highlights`,
  `DROP TABLE IF EXISTS tips`,
  `DROP TABLE IF EXISTS faqs`,
  `DROP TABLE IF EXISTS routes`,
  `DROP TABLE IF EXISTS route_stops`,
  `DROP TABLE IF EXISTS chat_interactions`,
  `DROP TABLE IF EXISTS character_configs`,
  `DROP TABLE IF EXISTS ticket_info`,
  `DROP TABLE IF EXISTS admin_users`,
  `DROP TABLE IF EXISTS visitor_stats`,
  `CREATE TABLE scenic_spots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    rating REAL DEFAULT 5.0,
    tag TEXT,
    tag_color TEXT,
    duration TEXT,
    best_time TEXT,
    hero_gradient TEXT,
    hero_image TEXT,
    description TEXT,
    position_x REAL,
    position_y REAL,
    coordinates TEXT,
    order_num INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_id INTEGER,
    icon TEXT,
    title TEXT,
    text TEXT,
    FOREIGN KEY (spot_id) REFERENCES scenic_spots(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE tips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_id INTEGER,
    icon TEXT,
    title TEXT,
    text TEXT,
    FOREIGN KEY (spot_id) REFERENCES scenic_spots(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    order_num INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    difficulty TEXT,
    difficulty_color TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE route_stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER,
    time TEXT,
    spot TEXT,
    activity TEXT,
    duration TEXT,
    stop_order INTEGER DEFAULT 0,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE chat_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE character_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT,
    description TEXT,
    category TEXT DEFAULT 'appearance',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE ticket_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price TEXT,
    half_price TEXT,
    free TEXT,
    open_time TEXT,
    includes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_login TEXT
  )`,
  `CREATE TABLE visitor_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    spot_id INTEGER,
    user_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (spot_id) REFERENCES scenic_spots(id) ON DELETE CASCADE
  )`
];

tables.forEach(sql => {
  try {
    db.prepare(sql).run();
  } catch (e) {
    console.log('Error creating table:', e.message);
  }
});

db.prepare(`INSERT INTO admin_users (username, password, role) VALUES (?, ?, ?)`).run('admin', 'admin123', 'admin');
console.log('创建管理员账号: admin/admin123');

const scenicSpots = [
  {
    spot_id: 'linghan-dafo',
    name: '灵山大佛',
    subtitle: '88米青铜释迦牟尼立佛',
    rating: 5.0,
    tag: '青铜巨佛·地标打卡',
    tag_color: '#C8A357',
    duration: '约40分钟',
    best_time: '上午 9:00-11:00',
    hero_gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #C8A357 100%)',
    hero_image: 'assets/linghan-dafo.jpg',
    description: '灵山大佛位于无锡马山秦履峰南侧，通高88米，佛体79米，莲花座9米。由725吨铜铸造而成，是目前世界上最高的青铜立佛。大佛右手指天，称为"施无畏印"，意在为众生除却痛苦；左手点地，称为"与愿印"，意为满足众生愿望。大佛慈颜微笑，广视众生，展现了佛祖"慈悲为怀、普度众生"的宗旨。',
    position_x: 50,
    position_y: 35,
    coordinates: '31.4303°N, 120.0964°E',
    order_num: 1,
    highlights: [
      { icon: '🏔️', title: '世界最高青铜立佛', text: '通高88米，725吨青铜铸造，气势恢宏，仰望之间令人心生敬畏与宁静。' },
      { icon: '🙏', title: '佛教手印文化', text: '右手施无畏印除却痛苦，左手与愿印满足愿望，蕴含深厚佛教哲理。' },
      { icon: '🌅', title: '登高望远胜境', text: '登217级台阶至大佛脚下，俯瞰太湖万顷碧波，远眺马山苍翠群峰。' }
    ],
    tips: [
      { icon: '⏰', title: '游览时间', text: '建议上午光线最佳时游览，全程约40分钟，含登阶体验。' },
      { icon: '👗', title: '着装建议', text: '需登217级台阶，建议穿舒适运动鞋，夏季注意防晒。' },
      { icon: '📿', title: '祈福礼仪', text: '可在佛脚平台绕佛三圈祈福，顺时针方向，保持安静恭敬。' }
    ]
  },
  {
    spot_id: 'fanggong',
    name: '灵山梵宫',
    subtitle: '7.2万㎡佛教艺术殿堂',
    rating: 5.0,
    tag: '佛教艺术·必游打卡',
    tag_color: '#D4AF37',
    duration: '约60分钟',
    best_time: '全天开放',
    hero_gradient: 'linear-gradient(135deg, #1a1a2e 0%, #3d2b1f 40%, #D4AF37 100%)',
    hero_image: 'assets/fanggong.jpg',
    description: '灵山梵宫建筑面积7.2万余平方米，整体建筑采用华藏塔风格，融合了中国传统佛教石窟艺术与西藏佛教建筑特色。穹顶高达64米，殿内装饰使用黄金、琉璃、楠木等珍贵材料，耗资18亿元精心打造，是集会议、展览、演出于一体的世界级佛教艺术殿堂。',
    position_x: 65,
    position_y: 50,
    coordinates: '31.4278°N, 120.1026°E',
    order_num: 2,
    highlights: [
      { icon: '🎨', title: '穹顶天象图', text: '穹顶绘制精美天象图，色彩斑斓，融合敦煌飞天元素，美轮美奂。' },
      { icon: '✨', title: '华藏世界琉璃壁画', text: '大型琉璃壁画以华藏世界为主题，流光溢彩，展现佛教宇宙观。' },
      { icon: '🎭', title: '《吉祥颂》演出', text: '每日定时上演大型佛教情境演出《吉祥颂》，视觉震撼，心灵洗涤。' }
    ],
    tips: [
      { icon: '⏰', title: '演出时间', text: '《吉祥颂》演出每天定时举行，建议提前20分钟入场。' },
      { icon: '📷', title: '拍照须知', text: '殿内允许拍照但禁用闪光灯，穹顶壁画为最佳取景点。' },
      { icon: '🚶', title: '游览路线', text: '从南门进入，沿中轴线游览，依次参观廊厅、塔厅、圣坛，不走回头路。' }
    ]
  },
  {
    spot_id: 'jiulong-guanyu',
    name: '九龙灌浴',
    subtitle: '27.5米动态表演景观',
    rating: 4.8,
    tag: '演艺体验·亲子推荐',
    tag_color: '#4A90D9',
    duration: '约30分钟',
    best_time: '10:00 / 11:30 / 14:00 / 15:30',
    hero_gradient: 'linear-gradient(135deg, #0a1a2e 0%, #1e3a5f 40%, #4A90D9 100%)',
    hero_image: 'assets/jiulong-guanyu.jpg',
    description: '九龙灌浴以佛教经典故事"九龙浴太子"为主题，高达27.5米的九龙雕塑环绕太子铜像，定时喷涌水柱和音乐。莲花绽放时，太子铜像缓缓旋转，七彩佛光环绕，场面壮观动人。是集声、光、电、水于一体的大型动态景观表演。',
    position_x: 38,
    position_y: 58,
    coordinates: '31.4249°N, 120.1001°E',
    order_num: 3,
    highlights: [
      { icon: '🐉', title: '动态莲花绽放', text: '巨大的青铜莲花定时绽放，太子铜像缓缓旋转上升，令人叹为观止。' },
      { icon: '🌈', title: '七彩佛光', text: '水雾与阳光交织形成七彩佛光，如梦如幻，是最佳拍照时刻。' },
      { icon: '💧', title: '祈福圣水', text: '表演结束后可接取圣水祈福，寓意洗涤心灵、吉祥如意。' }
    ],
    tips: [
      { icon: '⏰', title: '表演场次', text: '每天4场定时表演，建议提前10分钟到达占位，前排视野更佳。' },
      { icon: '📸', title: '拍摄技巧', text: '七彩佛光出现时是最佳拍摄时刻，建议使用连拍模式捕捉瞬间。' },
      { icon: '👶', title: '亲子提醒', text: '表演时水花飞溅，前排可能被淋湿，建议带好雨具或保持距离。' }
    ]
  },
  {
    spot_id: 'wuyin-tancheng',
    name: '五印坛城',
    subtitle: '5000㎡藏传佛教建筑',
    rating: 4.7,
    tag: '藏传佛教·文化体验',
    tag_color: '#9B59B6',
    duration: '约45分钟',
    best_time: '下午 13:00-16:00',
    hero_gradient: 'linear-gradient(135deg, #1a0a2e 0%, #3d1f5f 40%, #9B59B6 100%)',
    hero_image: 'assets/wuyin-tancheng.jpg',
    description: '五印坛城建筑面积约5000平方米，是按照藏传佛教坛城（曼茶罗）理念建造的藏式建筑。整体建筑色彩艳丽、装饰华美，融合了藏汉建筑艺术精华。殿内供奉五方佛，四壁绘有精美的曼茶罗壁画，展现了藏传佛教深邃的哲学思想与独特的艺术魅力。',
    position_x: 72,
    position_y: 68,
    coordinates: '31.4248°N, 120.1030°E',
    order_num: 4,
    highlights: [
      { icon: '🏛️', title: '藏式建筑艺术', text: '白墙金顶、彩绘飞檐，完美再现藏式建筑风格，犹如小布达拉宫。' },
      { icon: '🎨', title: '曼茶罗壁画', text: '四壁精美壁画展现佛教宇宙观，色彩艳丽，画工精湛，令人驻足。' },
      { icon: '🎡', title: '转经祈福体验', text: '可沿坛城外围转经筒祈福，顺时针转动经筒，体验藏传佛教文化。' }
    ],
    tips: [
      { icon: '⏰', title: '游览时间', text: '下午光线透过彩色窗户最为美丽，建议下午游览，约45分钟。' },
      { icon: '🤲', title: '转经礼仪', text: '转经筒须顺时针方向转动，绕行坛城一周为圆满功德。' },
      { icon: '🎨', title: '壁画欣赏', text: '殿内壁画精美绝伦，建议聘请讲解或使用语音导览了解内涵。' }
    ]
  },
  {
    spot_id: 'xiangfu-chansi',
    name: '祥符禅寺',
    subtitle: '千年古刹禅意悠然',
    rating: 4.6,
    tag: '历史文化·祈福纳祥',
    tag_color: '#8B7355',
    duration: '约30分钟',
    best_time: '上午 8:00-10:00',
    hero_gradient: 'linear-gradient(135deg, #2e1a0a 0%, #4a3520 40%, #8B7355 100%)',
    hero_image: 'assets/xiangfu-chansi.jpg',
    description: '祥符禅寺始建于唐贞观年间，距今已有1300余年历史，是灵山胜境历史最悠久的景点。寺内保存有千年银杏、江南第一钟等珍贵文物。古刹掩映于苍松翠柏之间，钟声悠远、梵音阵阵，是体验禅宗文化、感受佛门清幽的绝佳去处。',
    position_x: 28,
    position_y: 42,
    coordinates: '31.4280°N, 120.0980°E',
    order_num: 5,
    highlights: [
      { icon: '🌳', title: '千年银杏', text: '寺内古银杏树龄逾千年，枝繁叶茂，秋日金黄满地，是灵山胜境最古老的活文物。' },
      { icon: '🔔', title: '江南第一钟', text: '寺内大钟重达12.8吨，钟声悠远绵长，可祈福撞钟，寓意平安吉祥。' },
      { icon: '🕯️', title: '撞钟祈福', text: '撞钟三下寓意福禄寿三星高照，是游客必体验的祈福活动之一。' }
    ],
    tips: [
      { icon: '⏰', title: '游览时间', text: '上午最为清幽，建议早间游览，感受禅寺晨钟暮鼓的宁静氛围。' },
      { icon: '🤫', title: '保持安静', text: '寺院为修行之地，请保持安静，不大声喧哗，尊重僧众修行。' },
      { icon: '🙏', title: '礼佛须知', text: '进殿不走中门，左进右出；不踩门槛，合十礼佛，心诚则灵。' }
    ]
  }
];

scenicSpots.forEach(spot => {
  const result = db.prepare(
    `INSERT INTO scenic_spots (spot_id, name, subtitle, rating, tag, tag_color, duration, best_time, hero_gradient, hero_image, description, position_x, position_y, coordinates, order_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(spot.spot_id, spot.name, spot.subtitle, spot.rating, spot.tag, spot.tag_color, spot.duration, spot.best_time, spot.hero_gradient, spot.hero_image, spot.description, spot.position_x, spot.position_y, spot.coordinates, spot.order_num);
  
  const spotId = result.lastInsertRowid;
  
  spot.highlights.forEach(h => {
    db.prepare(`INSERT INTO highlights (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`).run(spotId, h.icon, h.title, h.text);
  });
  
  spot.tips.forEach(t => {
    db.prepare(`INSERT INTO tips (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`).run(spotId, t.icon, t.title, t.text);
  });
});
console.log('插入5个景点数据');

const routes = [
  {
    route_id: 'route-easy',
    name: '轻松游览路线',
    duration: '2-3小时',
    difficulty: '轻松',
    difficulty_color: '#4CAF50',
    description: '适合时间有限的游客，涵盖灵山最核心景点，精华尽览。',
    stops: [
      { time: '09:00', spot: '灵山大佛', activity: '登阶礼佛，仰望88米青铜大佛，登高望远俯瞰太湖', duration: '40分钟', order: 1 },
      { time: '09:50', spot: '九龙灌浴', activity: '观看10:00场次九龙灌浴表演，体验佛光圣水', duration: '30分钟', order: 2 },
      { time: '10:30', spot: '灵山梵宫', activity: '参观佛教艺术殿堂，欣赏穹顶壁画，观看《吉祥颂》', duration: '60分钟', order: 3 }
    ]
  },
  {
    route_id: 'route-cultural',
    name: '深度文化体验路线',
    duration: '4-5小时',
    difficulty: '适中',
    difficulty_color: '#FF9800',
    description: '深度体验灵山佛教文化精髓，全面了解各景点历史底蕴与艺术价值。',
    stops: [
      { time: '08:30', spot: '祥符禅寺', activity: '晨间礼佛，参观千年古刹，观赏千年银杏与江南第一钟', duration: '30分钟', order: 1 },
      { time: '09:10', spot: '灵山大佛', activity: '登阶礼佛，了解佛教手印文化，俯瞰灵山全景', duration: '40分钟', order: 2 },
      { time: '10:00', spot: '九龙灌浴', activity: '观看首场九龙灌浴表演，接取祈福圣水', duration: '30分钟', order: 3 },
      { time: '10:40', spot: '灵山梵宫', activity: '深度参观梵宫，聘请讲解了解壁画内涵，观看《吉祥颂》', duration: '90分钟', order: 4 },
      { time: '12:20', spot: '五印坛城', activity: '午后欣赏彩色窗光影，转经祈福，了解藏传佛教文化', duration: '45分钟', order: 5 }
    ]
  },
  {
    route_id: 'route-family',
    name: '亲子互动路线',
    duration: '3-4小时',
    difficulty: '轻松',
    difficulty_color: '#4CAF50',
    description: '专为亲子家庭设计，趣味互动与文化教育并重，孩子开心、大人满意。',
    stops: [
      { time: '09:30', spot: '九龙灌浴', activity: '观看11:30场次表演，感受水花飞溅的欢乐，寻找七彩佛光', duration: '30分钟', order: 1 },
      { time: '10:10', spot: '灵山大佛', activity: '亲子登阶挑战，认识佛教文化，登高远眺太湖美景', duration: '40分钟', order: 2 },
      { time: '11:00', spot: '灵山梵宫', activity: '趣味寻宝：在壁画中寻找飞天形象，观看《吉祥颂》', duration: '60分钟', order: 3 },
      { time: '12:10', spot: '五印坛城', activity: '体验转经筒，认识藏传佛教文化，彩窗前拍照留念', duration: '30分钟', order: 4 }
    ]
  }
];

routes.forEach(route => {
  const result = db.prepare(
    `INSERT INTO routes (route_id, name, description, duration, difficulty, difficulty_color) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(route.route_id, route.name, route.description, route.duration, route.difficulty, route.difficulty_color);
  
  const routeId = result.lastInsertRowid;
  
  route.stops.forEach(stop => {
    db.prepare(`INSERT INTO route_stops (route_id, time, spot, activity, duration, stop_order) VALUES (?, ?, ?, ?, ?, ?)`).run(routeId, stop.time, stop.spot, stop.activity, stop.duration, stop.order);
  });
});
console.log('插入3条游览路线');

db.prepare(`INSERT INTO ticket_info (price, half_price, free, open_time, includes) VALUES (?, ?, ?, ?, ?)`).run(
  '210元/人',
  '105元/人（1.2-1.5米儿童、60-69岁老人）',
  '免票（1.2米以下儿童、70岁以上老人、残疾人）',
  '07:30 - 17:30（冬季） / 07:00 - 17:30（夏季）',
  '灵山大佛 + 灵山梵宫 + 九龙灌浴 + 五印坛城 + 祥符禅寺'
);
console.log('插入门票信息');

const configs = [
  { key: 'avatar_name', value: '小灵', description: '数字人名称', category: 'basic' },
  { key: 'avatar_gender', value: 'female', description: '数字人性别', category: 'appearance' },
  { key: 'avatar_style', value: 'traditional', description: '数字人风格', category: 'appearance' },
  { key: 'avatar_color', value: '#C8A357', description: '数字人主题色', category: 'appearance' },
  { key: 'voice_type', value: 'female', description: '语音类型', category: 'voice' },
  { key: 'voice_speed', value: '1.0', description: '语音速度', category: 'voice' },
  { key: 'response_delay', value: '1000', description: '响应延迟(ms)', category: 'behavior' },
  { key: 'greeting', value: '您好！我是小灵，灵山胜境AI数字人导游，很高兴为您服务。', description: '欢迎语', category: 'behavior' }
];

configs.forEach(c => {
  db.prepare(`INSERT INTO character_configs (config_key, config_value, description, category) VALUES (?, ?, ?, ?)`).run(
    c.key, c.value, c.description, c.category
  );
});
console.log('插入数字人配置');

const faqs = [
  { question: '灵山胜境景区开放时间是什么时候？', answer: '景区开放时间为7:30-17:30（夏季延长至07:00-17:30），请合理安排游览时间。', category: 'time', order: 1 },
  { question: '门票价格是多少？', answer: '全价票210元/人，半价票105元/人。', category: 'ticket', order: 1 },
  { question: '有哪些优惠政策？', answer: '1.2米以下儿童、70周岁以上老人凭有效证件免费入园；1.2-1.5米儿童、60-69岁老人凭有效证件享受半价优惠。', category: 'ticket', order: 2 },
  { question: '景区内有哪些主要景点？', answer: '主要景点包括灵山大佛、灵山梵宫、九龙灌浴、五印坛城、祥符禅寺。', category: 'spot', order: 1 },
  { question: '游览需要多长时间？', answer: '建议游览时间约3-4小时，可以根据个人喜好选择不同的游览路线。', category: 'route', order: 1 },
  { question: '景区内有餐饮服务吗？', answer: '景区内设有多个餐饮点，提供素食和简餐服务。', category: 'service', order: 1 },
  { question: '是否需要提前预约？', answer: '建议提前通过官方渠道预约门票，避免现场排队。', category: 'ticket', order: 3 },
  { question: '可以拍照吗？', answer: '景区内大部分区域可以拍照，但部分室内场所禁止使用闪光灯。', category: 'rule', order: 1 },
  { question: '灵山大佛有多高？', answer: '灵山大佛通高88米，是目前世界上最高的青铜立佛。', category: 'spot', order: 2 },
  { question: '九龙灌浴表演时间？', answer: '九龙灌浴每天4场定时表演：10:00、11:30、14:00、15:30。', category: 'spot', order: 3 }
];

faqs.forEach(f => {
  db.prepare(`INSERT INTO faqs (question, answer, category, order_num) VALUES (?, ?, ?, ?)`).run(
    f.question, f.answer, f.category, f.order
  );
});
console.log('插入10个常见问题');

db.close();
console.log('数据库初始化完成！');