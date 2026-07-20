const db = require('../config/database');

const scenicSpotsData = [
  {
    spot_id: 'ling-shan-da-fo',
    name: '灵山大佛',
    subtitle: '世界最高青铜立佛',
    rating: 4.9,
    tag: '必打卡',
    tag_color: '#C8A357',
    duration: '60分钟',
    best_time: '上午10点',
    hero_image: 'images/scenic-spots/ling-shan-da-fo.jpg',
    description: '灵山大佛坐落于无锡马山秦履峰南侧，是世界上最高的青铜立佛。大佛通高88米，佛体79米，莲花座9米，由1560块青铜壁板焊接而成，总重量达700余吨。登上佛脚远眺，太湖风光尽收眼底，令人心旷神怡。',
    coordinates: '31.4534, 120.2345',
    position_x: 65,
    position_y: 45,
    highlights: [
      { icon: '🗿', title: '世界之最', text: '88米高的青铜立佛，世界最高' },
      { icon: '🏞️', title: '俯瞰太湖', text: '登上佛脚可远眺太湖美景' },
      { icon: '✨', title: '祈福圣地', text: '千年古刹，香火旺盛' }
    ],
    tips: [
      { icon: '⏰', title: '登佛时间', text: '登大佛台阶约300级，建议预留充足时间' },
      { icon: '📷', title: '最佳角度', text: '在大佛脚下仰拍，可获得最佳构图' },
      { icon: '🎒', title: '舒适着装', text: '建议穿着舒适的鞋子' }
    ]
  },
  {
    spot_id: 'ling-shan-fan-gong',
    name: '灵山梵宫',
    subtitle: '东方卢浮宫',
    rating: 4.8,
    tag: '文化艺术',
    tag_color: '#E53935',
    duration: '90分钟',
    best_time: '下午2点',
    hero_image: 'images/scenic-spots/ling-shan-fan-gong.jpg',
    description: '灵山梵宫是一座集文化、艺术、宗教于一体的宏伟建筑，建筑面积达7.2万平方米。宫内汇集了大量的艺术珍品，包括穹顶壁画、木雕、石雕、铜雕等，展现了佛教文化的博大精深。特别是大型史诗演出《吉祥颂》，以其震撼的视觉效果和深刻的文化内涵，成为游客必看的节目。',
    coordinates: '31.4521, 120.2338',
    position_x: 55,
    position_y: 60,
    highlights: [
      { icon: '🎨', title: '艺术殿堂', text: '汇集木雕、石雕、铜雕等艺术珍品' },
      { icon: '🎭', title: '吉祥颂演出', text: '大型史诗演出，震撼心灵' },
      { icon: '🌟', title: '穹顶壁画', text: '华藏世界，美轮美奂' }
    ],
    tips: [
      { icon: '🎫', title: '演出票', text: '《吉祥颂》演出需单独购票，建议提前预约' },
      { icon: '🚶', title: '参观路线', text: '建议按顺时针方向参观，不走回头路' },
      { icon: '✨', title: '灯光秀', text: '夜晚的梵宫灯光秀不容错过' }
    ]
  },
  {
    spot_id: 'jiu-long-guan-yu',
    name: '九龙灌浴',
    subtitle: '震撼佛教表演',
    rating: 4.7,
    tag: '必看表演',
    tag_color: '#1E88E5',
    duration: '20分钟',
    best_time: '10:00/14:00',
    hero_image: 'images/scenic-spots/jiu-long-guan-yu.jpg',
    description: '九龙灌浴是灵山胜境的标志性表演，以佛教经典《本生经》为蓝本，讲述了释迦牟尼诞生时九龙吐水为其沐浴的故事。喷泉高达数十米，九条青铜龙环绕莲花座，当莲花盛开时，太子佛像缓缓升起，九龙口中喷出圣水，场面壮观，令人叹为观止。',
    coordinates: '31.4518, 120.2352',
    position_x: 45,
    position_y: 40,
    highlights: [
      { icon: '💦', title: '圣水沐浴', text: '九条龙同时喷水，场面震撼' },
      { icon: '🌸', title: '莲花盛开', text: '巨大莲花缓缓盛开，太子像升起' },
      { icon: '🎵', title: '音乐喷泉', text: '配合庄严的佛教音乐' }
    ],
    tips: [
      { icon: '🕐', title: '表演时间', text: '每天4场：10:00、11:30、14:00、15:30' },
      { icon: '🌂', title: '注意防水', text: '前排观众可能会被水花溅到' },
      { icon: '📱', title: '录像准备', text: '建议提前准备好摄像设备' }
    ]
  },
  {
    spot_id: 'wu-yin-tan-cheng',
    name: '五印坛城',
    subtitle: '藏传佛教文化',
    rating: 4.6,
    tag: '藏式风情',
    tag_color: '#8E24AA',
    duration: '45分钟',
    best_time: '下午3点',
    hero_image: 'images/scenic-spots/wu-yin-tan-cheng.jpg',
    description: '五印坛城是一座融合了藏传佛教文化的特色建筑，整体按照西藏传统建筑风格建造。坛城内部展示了丰富的藏传佛教文化，包括唐卡、法器、佛像等。游客可以在这里体验转经筒、欣赏藏式壁画，感受浓郁的藏族风情。',
    coordinates: '31.4525, 120.2348',
    position_x: 70,
    position_y: 65,
    highlights: [
      { icon: '🏯', title: '藏式建筑', text: '原汁原味的西藏传统建筑风格' },
      { icon: '📜', title: '唐卡艺术', text: '精美的唐卡绘画展示' },
      { icon: '🔄', title: '转经祈福', text: '体验转经筒祈福仪式' }
    ],
    tips: [
      { icon: '👣', title: '脱鞋入内', text: '进入坛城内部需要脱鞋' },
      { icon: '📸', title: '拍照限制', text: '部分区域禁止拍照' },
      { icon: '🎁', title: '特色商品', text: '可购买藏式特色纪念品' }
    ]
  },
  {
    spot_id: 'xiang-fu-chan-si',
    name: '祥符禅寺',
    subtitle: '千年古刹',
    rating: 4.5,
    tag: '历史悠久',
    tag_color: '#388E3C',
    duration: '30分钟',
    best_time: '上午9点',
    hero_image: 'images/scenic-spots/xiang-fu-chan-si.jpg',
    description: '祥符禅寺始建于唐代，是一座具有千年历史的古刹。寺内保存了大量的历史文物和古建筑，包括大雄宝殿、藏经楼、钟楼等。作为灵山大佛的发源地，祥符禅寺承载着深厚的佛教文化底蕴，是信众朝拜的重要场所。',
    coordinates: '31.4538, 120.2342',
    position_x: 60,
    position_y: 35,
    highlights: [
      { icon: '🏛️', title: '千年古刹', text: '始建于唐代，历史悠久' },
      { icon: '📜', title: '历史文物', text: '保存大量珍贵文物' },
      { icon: '🙏', title: '祈福圣地', text: '香火旺盛的佛教圣地' }
    ],
    tips: [
      { icon: '🕯️', title: '上香祈福', text: '寺内提供香烛，可虔诚祈福' },
      { icon: '🙅', title: '着装得体', text: '进入寺庙请穿着得体' },
      { icon: '🤫', title: '保持安静', text: '寺庙内请保持肃静' }
    ]
  }
];

const routesData = [
  {
    route_id: 'classic-full-day',
    name: '经典一日游',
    duration: '6-7小时',
    difficulty: '轻松',
    difficulty_color: '#4CAF50',
    description: '涵盖灵山胜境核心景点，适合初次到访的游客，体验佛教文化精华。',
    stops: [
      { time: '08:30', spot: '九龙灌浴', activity: '观看表演', duration: '20分钟' },
      { time: '09:00', spot: '祥符禅寺', activity: '参观古刹', duration: '30分钟' },
      { time: '09:45', spot: '灵山大佛', activity: '登佛远眺', duration: '60分钟' },
      { time: '11:00', spot: '梵宫广场', activity: '午餐休息', duration: '60分钟' },
      { time: '13:00', spot: '灵山梵宫', activity: '参观艺术殿堂', duration: '90分钟' },
      { time: '14:45', spot: '五印坛城', activity: '体验藏传佛教', duration: '45分钟' },
      { time: '16:00', spot: '出口', activity: '结束行程', duration: '30分钟' }
    ]
  },
  {
    route_id: 'cultural-deep-dive',
    name: '文化深度游',
    duration: '4-5小时',
    difficulty: '中等',
    difficulty_color: '#FF9800',
    description: '深度体验佛教艺术与文化，适合对佛教文化感兴趣的游客。',
    stops: [
      { time: '09:30', spot: '灵山梵宫', activity: '深度参观+吉祥颂演出', duration: '120分钟' },
      { time: '11:30', spot: '五印坛城', activity: '藏传佛教文化体验', duration: '60分钟' },
      { time: '13:00', spot: '梵宫广场', activity: '素食体验', duration: '60分钟' },
      { time: '14:30', spot: '祥符禅寺', activity: '古刹探秘', duration: '45分钟' },
      { time: '15:30', spot: '九龙灌浴', activity: '观看表演', duration: '20分钟' }
    ]
  },
  {
    route_id: 'family-friendly',
    name: '亲子欢乐游',
    duration: '3-4小时',
    difficulty: '轻松',
    difficulty_color: '#4CAF50',
    description: '适合家庭出游，路线轻松，兼顾趣味性与文化性。',
    stops: [
      { time: '10:00', spot: '九龙灌浴', activity: '观看表演', duration: '20分钟' },
      { time: '10:30', spot: '灵山大佛', activity: '登佛挑战', duration: '60分钟' },
      { time: '11:45', spot: '梵宫广场', activity: '亲子午餐', duration: '60分钟' },
      { time: '13:00', spot: '灵山梵宫', activity: '艺术欣赏', duration: '60分钟' },
      { time: '14:15', spot: '五印坛城', activity: '转经体验', duration: '30分钟' }
    ]
  }
];

try {
  const insertSpot = db.prepare(`INSERT OR IGNORE INTO scenic_spots (spot_id, name, subtitle, rating, tag, tag_color, duration, best_time, hero_image, description, coordinates, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertHighlight = db.prepare(`INSERT INTO spot_highlights (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`);
  const insertTip = db.prepare(`INSERT INTO spot_tips (spot_id, icon, title, text) VALUES (?, ?, ?, ?)`);
  
  scenicSpotsData.forEach(spot => {
    const { highlights, tips, ...spotData } = spot;
    const result = insertSpot.run([
      spotData.spot_id, spotData.name, spotData.subtitle, spotData.rating,
      spotData.tag, spotData.tag_color, spotData.duration, spotData.best_time,
      spotData.hero_image, spotData.description, spotData.coordinates,
      spotData.position_x, spotData.position_y
    ]);
    
    if (result.changes > 0) {
      const spotId = result.lastInsertRowid;
      highlights.forEach(h => insertHighlight.run([spotId, h.icon, h.title, h.text]));
      tips.forEach(t => insertTip.run([spotId, t.icon, t.title, t.text]));
      console.log(`景点 ${spotData.name} 导入成功`);
    }
  });
  
  const insertRoute = db.prepare(`INSERT OR IGNORE INTO routes (route_id, name, duration, difficulty, difficulty_color, description) VALUES (?, ?, ?, ?, ?, ?)`);
  const insertStop = db.prepare(`INSERT INTO route_stops (route_id, time, spot, activity, duration, stop_order) VALUES (?, ?, ?, ?, ?, ?)`);
  
  routesData.forEach(route => {
    const { stops, ...routeData } = route;
    const result = insertRoute.run([
      routeData.route_id, routeData.name, routeData.duration,
      routeData.difficulty, routeData.difficulty_color, routeData.description
    ]);
    
    if (result.changes > 0) {
      const routeId = result.lastInsertRowid;
      stops.forEach((stop, index) => {
        insertStop.run([routeId, stop.time, stop.spot, stop.activity, stop.duration, index]);
      });
      console.log(`路线 ${routeData.name} 导入成功`);
    }
  });
  
  console.log('景点和路线数据导入完成！');
} catch (err) {
  console.error('导入失败:', err.message);
  process.exit(1);
}
