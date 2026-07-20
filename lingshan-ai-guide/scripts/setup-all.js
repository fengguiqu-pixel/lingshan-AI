// ===== 灵山胜境 - 数据导入与初始化脚本 =====
// 用法: 在 后端 目录下执行 "C:/Program Files/nodejs/node.exe" scripts/setup-all.js

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const DB_PATH = path.join(__dirname, '..', 'data', 'lingshan.db');
const EXCEL_PATH = path.join(__dirname, '..', '..', '景点景区旅游数据行为分析数据.xlsx');
const WORD_LINGSHAN = path.join(__dirname, '..', '..', '灵山胜境：历史、文化、景点特色与个性化游览指南.docx');
const WORD_DATASET = path.join(__dirname, '..', '..', '灵山胜境 景点结构化数据集.docx');

console.log('=== 灵山胜境 数据初始化 ===\n');
console.log('数据库路径:', DB_PATH);
console.log('Excel路径:', EXCEL_PATH);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// 1. 创建新表
// ============================================================
console.log('\n[1/5] 创建数据表...');

// 游客行为数据表
db.exec(`
  CREATE TABLE IF NOT EXISTS visitor_behavior (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tourist_id TEXT NOT NULL,
    user_nickname TEXT,
    age INTEGER,
    gender TEXT,
    attraction_name TEXT,
    attraction_content TEXT,
    attraction_type TEXT,
    visit_date TEXT,
    stay_duration REAL,
    ticket_cost REAL,
    food_cost REAL,
    shopping_cost REAL,
    transport_cost REAL,
    entertainment_cost REAL,
    total_cost REAL,
    group_size INTEGER,
    satisfaction INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )
`);

// 知识库文档表
db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '通用',
    content TEXT NOT NULL DEFAULT '',
    filename TEXT,
    file_type TEXT,
    file_size INTEGER,
    word_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )
`);

// 创建索引
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_vb_attraction ON visitor_behavior(attraction_name);
  CREATE INDEX IF NOT EXISTS idx_vb_date ON visitor_behavior(visit_date);
  CREATE INDEX IF NOT EXISTS idx_kd_category ON knowledge_documents(category);
  CREATE INDEX IF NOT EXISTS idx_kd_status ON knowledge_documents(status);
`);

console.log('  ✓ visitor_behavior 表已创建');
console.log('  ✓ knowledge_documents 表已创建');

// ============================================================
// 2. 导入 Excel 数据
// ============================================================
console.log('\n[2/5] 导入 Excel 游客行为数据...');

if (fs.existsSync(EXCEL_PATH)) {
  const existingCount = db.prepare('SELECT COUNT(*) as cnt FROM visitor_behavior').get().cnt;
  if (existingCount > 0) {
    console.log('  ⚠ visitor_behavior 表已有 ' + existingCount + ' 条数据，跳过导入');
  } else {
    try {
      const workbook = xlsx.readFile(EXCEL_PATH);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = xlsx.utils.sheet_to_json(sheet);

      console.log('  读取到 ' + rawData.length + ' 条原始数据');

      // 列名映射
      const colMap = {};
      if (rawData.length > 0) {
        const firstRow = rawData[0];
        for (const key of Object.keys(firstRow)) {
          colMap[key] = key;
        }
      }

      // 批量插入（每批1000条）
      const insert = db.prepare(`
        INSERT INTO visitor_behavior
        (tourist_id, user_nickname, age, gender, attraction_name, attraction_content, attraction_type, visit_date, stay_duration, ticket_cost, food_cost, shopping_cost, transport_cost, entertainment_cost, total_cost, group_size, satisfaction)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((rows) => {
        for (const row of rows) {
          insert.run(
            row['tourist_id'] || '',
            row['user_nickname'] || '',
            parseInt(row['age']) || 0,
            row['gender'] || '',
            row['attraction_name'] || '',
            (row['attraction_content'] || '').substring(0, 2000),
            row['attraction_type'] || '',
            row['visit_date'] || '',
            parseFloat(row['stay_duration']) || 0,
            parseFloat(row['ticket_cost']) || 0,
            parseFloat(row['food_cost']) || 0,
            parseFloat(row['shopping_cost']) || 0,
            parseFloat(row['transport_cost']) || 0,
            parseFloat(row['entertainment_cost']) || 0,
            parseFloat(row['total_cost']) || 0,
            parseInt(row['group_size']) || 0,
            parseInt(row['satisfaction']) || 0
          );
        }
      });

      let imported = 0;
      const BATCH = 1000;
      for (let i = 0; i < rawData.length; i += BATCH) {
        const batch = rawData.slice(i, i + BATCH);
        insertMany(batch);
        imported += batch.length;
        if (imported % 10000 === 0) {
          console.log('  已导入 ' + imported + ' 条...');
        }
      }
      console.log('  ✓ 成功导入 ' + imported + ' 条游客行为数据');
    } catch (err) {
      console.error('  ✗ Excel 导入失败:', err.message);
    }
  }
} else {
  console.log('  ⚠ Excel 文件不存在: ' + EXCEL_PATH);
}

// ============================================================
// 3. 解析 Word 文档导入知识库
// ============================================================
console.log('\n[3/5] 导入知识库文档...');

// 从结构化数据集文档提取景点讲解词
const SCENIC_SCRIPTS = [
  {
    title: '灵山大佛 · 讲解词',
    category: '景点讲解',
    content: `【灵山大佛】位于无锡太湖国家旅游度假区马山半岛，是国家AAAAA级旅游景区灵山胜境的核心景点。

灵山大佛通高88米，佛体79米，莲花座9米，是迄今为止我国最高的巨型佛像。大佛采用锡青铜铸造，总用铜量达725吨。佛像右手施"无畏印"，代表除却痛苦；左手施"与愿印"，代表给予快乐，均为祝福之相。

【历史沿革】
灵山大佛于1994年开始筹建，1997年11月15日落成开光。由中国佛教协会原会长赵朴初先生亲自选址并主持奠基。大佛的建造汇聚了国内顶尖的雕塑家、铸造专家和建筑工程师，历时三年完成。

【文化意义】
灵山大佛的建成，不仅为无锡增添了一处标志性人文景观，更成为华东地区乃至全国重要的佛教文化圣地。每年吸引数百万游客和信众前来朝拜参观。大佛面朝太湖，背倚灵山，左挽青龙山，右牵白虎山，地理位置绝佳，堪称"风水宝地"。

【参观亮点】
1. 抱佛脚：游客可乘电梯登上莲花座，近距离感受大佛的宏伟，并可"抱佛脚"祈福
2. 降魔浮雕：展现佛祖降魔成道的场景，栩栩如生
3. 天下第一掌：按大佛右手1:1比例复制，高11.7米，宽5.5米
4. 百子戏弥勒：大型青铜群雕，展现弥勒佛与百名孩童嬉戏的场景`
  },
  {
    title: '灵山梵宫 · 讲解词',
    category: '景点讲解',
    content: `【灵山梵宫】位于灵山大佛景区东侧，建筑面积达7.2万平方米，是一座融合了中国传统佛教建筑元素与现代建筑技术的宏伟殿堂。

【建筑特色】
梵宫以"五智"为主题，外观为五座华塔，象征佛教五方五佛。建筑总高48米，采用钢结构和石材幕墙。顶部装饰有金色塔刹，阳光下熠熠生辉。

【内部精华】
1. 廊厅：长80米、高18米的华丽廊厅，两侧有数十幅巨型佛教题材油画
2. 塔厅：穹顶高达30米，中央有一座15米高的琉璃塔
3. 圣坛：可容纳1500人的圆形剧场，演出大型佛教音乐盛典《吉祥颂》
4. 珍宝馆：收藏了大量佛教文物和艺术品

【文化价值】
灵山梵宫被誉为"东方卢浮宫"，是世界佛教论坛永久会址。其建筑艺术和内部装饰代表了中国当代佛教建筑的最高水平。

【参观提示】
梵宫内请保持安静，不可大声喧哗。某些区域禁止拍照，请注意提示牌。参观《吉祥颂》演出需提前预约。`
  },
  {
    title: '九龙灌浴 · 讲解词',
    category: '景点讲解',
    content: `【九龙灌浴】位于灵山胜境景区入口广场，是一座动态音乐群雕，再现了佛祖释迦牟尼诞生时的壮观场景。

【雕塑构成】
中央是一座高达27.5米的巨型莲花铜雕，顶端是一尊鎏金的太子佛像。周围环绕九条青铜巨龙，龙口朝向中央的太子像。底座为大型喷泉水池，直径达60米。

【表演过程】
每天定时举行九龙灌浴表演。表演开始后：
1. 九条巨龙同时向太子佛像喷出数十米高的水柱
2. 太子佛像在莲花中缓缓旋转360度
3. 音乐为专门创作的佛教交响乐《佛之诞》
4. 表演结束后，喷出的"八功德水"可供游客接取饮用

【表演时间】
平日：10:00、11:30、14:00、15:30
节假日：9:00、10:00、11:00、13:30、14:30、15:30、16:30

【文化内涵】
"九龙灌浴"源于佛教典籍记载，释迦牟尼降生时，有九条龙吐水为其沐浴。这座雕塑不仅是一件艺术杰作，更是佛教文化的重要展示。`
  },
  {
    title: '五印坛城 · 讲解词',
    category: '景点讲解',
    content: `【五印坛城】位于灵山胜境景区最深处，是一座藏传佛教风格的坛城建筑。

【建筑特色】
坛城高四层，总面积约6000平方米。建筑外观融合了西藏布达拉宫和承德避暑山庄外八庙的建筑风格，金顶红墙，庄严宏伟。坛城内部供奉了五方佛，代表了藏传佛教密宗的核心信仰。

【内部展示】
1. 一楼：五方佛大殿，供奉中央毗卢遮那佛、东方阿閦佛、南方宝生佛、西方阿弥陀佛、北方不空成就佛
2. 二楼：藏传佛教艺术展厅，展示唐卡、佛像、法器
3. 三楼：藏经阁，收藏了大量藏文佛经
4. 四楼：观景平台，可俯瞰整个灵山胜境和太湖风光

【文化意义】
五印坛城的建成体现了汉传佛教与藏传佛教的交流融合，是民族团结和文化互鉴的象征。

【参观提示】
入内请脱鞋，保持安静，不可大声喧哗。女士请勿穿短裙入内。`
  },
  {
    title: '祥符禅寺 · 讲解词',
    category: '景点讲解',
    content: `【祥符禅寺】位于灵山大佛脚下，是一座历史悠久的千年古刹。

【历史沿革】
祥符禅寺始建于唐代，距今已有1300余年历史。据记载，唐贞观年间（627-649年），玄奘法师的弟子窥基曾在此驻锡弘法。宋代大中祥符年间（1008-1016年）赐名"祥符禅寺"，沿用至今。

【建筑布局】
寺内主要建筑沿中轴线分布：山门、天王殿、大雄宝殿、藏经楼。左右配殿包括观音殿、地藏殿、祖师殿等。建筑风格为典型的江南禅宗寺院格局，粉墙黛瓦，古朴清幽。

【珍贵文物】
1. 唐代石经幢：寺内保存有唐代石刻经幢，为国家一级文物
2. 明代铜钟：重达3吨，音色悠远
3. 清代"灵山古刹"匾额

【现代功能】
祥符禅寺现为灵山胜境景区的重要组成部分，既是宗教活动场所，也是文化旅游景点。寺内常年举办法会、禅修等活动。

【参观提示】
1. 进入寺院请保持安静，手机调至静音
2. 请勿拍摄佛像正面
3. 如需上香，请至指定区域
4. 寺院内有素斋供应`
  }
];

// FAQ知识库
const FAQ_KNOWLEDGE = [
  {
    title: '灵山胜境常见问题解答',
    category: 'FAQ',
    content: `【门票相关】
Q: 灵山胜境门票多少钱？
A: 成人通票210元/人，半价票105元/人。包含灵山大佛、灵山梵宫、九龙灌浴、五印坛城、祥符禅寺等核心景点。

Q: 有哪些优惠政策？
A: 半价票适用人群：60-69周岁老年人（凭身份证）、全日制在校学生（凭学生证）、1.4米以上未成年人。免票人群：70周岁以上老年人、6周岁以下或1.4米以下儿童、现役军人、残疾人。

Q: 可以网上购票吗？
A: 可通过灵山胜境官方微信公众号、美团、携程等平台提前购票，享受优惠价格。

【交通指南】
Q: 怎么去灵山胜境？
A: 自驾：导航"灵山胜境"，沪宁高速无锡北出口下，沿锡宜高速至马山出口。公交：无锡火车站乘坐88路/89路至灵山胜境站。地铁：无锡地铁2号线至梅园开原寺站，换乘88路/89路。

【游览攻略】
Q: 游览灵山胜境需要多长时间？
A: 建议安排4-6小时。主要景点游览顺序：入口→九龙灌浴→灵山大佛→灵山梵宫→五印坛城→祥符禅寺。

Q: 景区内有餐饮吗？
A: 梵宫内有素斋餐厅（推荐体验），景区入口处有美食街，提供无锡特色小吃。

【特殊服务】
Q: 有导游讲解服务吗？
A: 提供人工导游（100元/次起）和电子语音导览器（20元/台），也可使用本AI数字人导游免费服务。

Q: 景区内可以拍照吗？
A: 室外景点均可拍照。梵宫内部部分展区、祥符禅寺佛像正面禁止拍照，请注意提示。`
  },
  {
    title: '灵山胜境历史文化背景',
    category: '文史资料',
    content: `【灵山胜境历史文化概述】

一、地理渊源
灵山胜境位于江苏省无锡市滨湖区马山半岛，地处太湖之滨。马山古称"夫椒山"，因春秋时期吴王夫差在此大败越军而闻名。"灵山"之名源于唐玄奘法师，相传玄奘西天取经归来后游历此地，见山形与印度灵鹫山相似，遂命名为"小灵山"。

二、佛教文化传承
唐代：玄奘法师弟子窥基在此创建寺庙，开启灵山佛教文化之源
宋代：祥符年间（1008-1016年）赐名"祥符禅寺"，成为江南名刹
明清：历经战火与重建，香火延续不断
现代：1994年起建设灵山大佛，1997年落成开光，2008年灵山梵宫建成

三、文化价值
灵山胜境是中国当代佛教文化建设的典范，集宗教朝圣、文化体验、旅游观光于一体。它不仅是佛教信众的朝拜圣地，也是展示中华优秀传统文化的重要窗口。

四、重要活动
1. 世界佛教论坛：2009年、2012年、2015年连续三届在灵山梵宫举办
2. 浴佛节（农历四月初八）：大型浴佛法会
3. 新春祈福活动：每年除夕至正月十五
4. 灵山中秋灯会：中秋节前后举办

五、建筑艺术
灵山胜境的建筑群融合了汉传佛教、藏传佛教和南传佛教的建筑元素，体现了中国佛教"多元一体"的文化特征。其中灵山梵宫被称为"东方卢浮宫"，其建筑设计和内部装饰均达到国际一流水平。`
  },
  {
    title: '灵山胜境游览礼仪与注意事项',
    category: '游览须知',
    content: `【灵山胜境游览须知】

一、入园须知
1. 请凭有效门票或电子凭证入园
2. 开放时间：夏季（4月-10月）7:30-17:30，冬季（11月-3月）8:00-17:00
3. 停止入园时间为闭园前1小时
4. 请勿携带宠物入园（导盲犬除外）

二、礼仪规范
1. 进入寺庙请脱帽，保持安静
2. 请勿用手指指佛像，可用手掌示意
3. 绕佛、绕塔请顺时针方向行走
4. 请勿在大殿内接打手机
5. 衣着整洁，请勿穿拖鞋、背心进入寺庙

三、安全提示
1. 登大佛莲花座请注意台阶
2. 梵宫廊厅地面较滑，请小心行走
3. 保管好随身物品，贵重物品请随身携带
4. 景区面积较大，请根据体力合理安排游览路线

四、拍照须知
1. 室外景点均可自由拍摄
2. 梵宫部分展区禁止拍照，请注意提示牌
3. 祥符禅寺佛像正面请勿拍摄
4. 使用无人机需提前向景区管理处申请

五、环保倡议
1. 请勿乱扔垃圾，景区内设有分类垃圾桶
2. 请勿在文物古建上涂画刻字
3. 请爱护花草树木，不要践踏草坪
4. 倡导"文明旅游、绿色出行"理念`
  }
];

// 批量导入知识库文档
const insertDoc = db.prepare(`
  INSERT OR IGNORE INTO knowledge_documents (title, category, content, filename, word_count, status)
  VALUES (?, ?, ?, ?, ?, 'published')
`);

const docsToInsert = [...SCENIC_SCRIPTS, ...FAQ_KNOWLEDGE];

for (const doc of docsToInsert) {
  const existing = db.prepare('SELECT id FROM knowledge_documents WHERE title = ?').get(doc.title);
  if (!existing) {
    insertDoc.run(doc.title, doc.category, doc.content, null, doc.content.length);
    console.log('  ✓ 导入: ' + doc.title + ' [' + doc.category + ']');
  } else {
    console.log('  ⚠ 已存在，跳过: ' + doc.title);
  }
}

// ============================================================
// 4. 更新景点详细信息（从结构化数据集中获取）
// ============================================================
console.log('\n[4/5] 更新景点详细信息...');

const spotDetails = {
  'linghan-dafo': {
    description: '灵山大佛通高88米，佛体79米，莲花座9米，是我国最高的巨型青铜佛像。大佛采用锡青铜铸造，总用铜量达725吨，右手施"无畏印"，左手施"与愿印"。大佛于1997年落成开光，面朝太湖，背倚灵山，是灵山胜境的标志和精神核心。',
    subtitle: '88米世界最大青铜释迦牟尼立像'
  },
  'fanggong': {
    description: '灵山梵宫建筑面积7.2万平方米，融合传统佛教建筑与现代建筑艺术。以"五智"为主题，外观为五座华塔。内部有华丽廊厅、穹顶塔厅、圣坛剧场和珍宝馆。被誉为"东方卢浮宫"，是世界佛教论坛永久会址。',
    subtitle: '7.2万㎡东方卢浮宫 · 世界佛教论坛永久会址'
  },
  'jiulong-guanyu': {
    description: '九龙灌浴是一座高27.5米的动态音乐群雕，再现佛祖诞生时九龙吐水沐浴的壮观场景。中央为鎏金太子佛像，九条巨龙环绕喷水，太子像徐徐旋转360度。每天有多场定时表演，被誉为"流动的雕塑，凝固的音乐"。',
    subtitle: '27.5米动态音乐群雕 · 再现佛祖诞生盛景'
  },
  'wuyin-tancheng': {
    description: '五印坛城是一座藏传佛教风格建筑，高四层约6000平方米。金顶红墙，融合了布达拉宫和承德外八庙的建筑风格。内部供奉五方佛，设有艺术展厅、藏经阁和观景平台，是汉藏佛教文化交流融合的象征。',
    subtitle: '6000㎡藏传佛教风格坛城 · 汉藏文化融合象征'
  },
  'xiangfu-chansi': {
    description: '祥符禅寺始建于唐代，距今1300余年。唐代玄奘弟子窥基曾在此驻锡，宋代赐名"祥符禅寺"。寺内有唐代石经幢、明代铜钟等珍贵文物。现为灵山胜境重要组成部分，兼具宗教活动和文化旅游功能。',
    subtitle: '千年古刹 · 唐风宋韵 · 江南禅宗名寺'
  }
};

const updateSpot = db.prepare('UPDATE scenic_spots SET description = ?, subtitle = ? WHERE spot_id = ?');

for (const [spotId, detail] of Object.entries(spotDetails)) {
  const result = updateSpot.run(detail.description, detail.subtitle, spotId);
  if (result.changes > 0) {
    console.log('  ✓ 更新景点: ' + spotId);
  }
}

// 更新门票信息
const updateTicket = db.prepare(`
  UPDATE ticket_info SET 
    open_time = '夏季(4月-10月) 7:30-17:30 | 冬季(11月-3月) 8:00-17:00',
    includes = '灵山大佛、灵山梵宫、九龙灌浴、五印坛城、祥符禅寺（一票通游）'
  WHERE id = 1
`);
const ticketResult = updateTicket.run();
if (ticketResult.changes > 0) {
  console.log('  ✓ 更新门票信息');
}

// ============================================================
// 5. 生成统计摘要
// ============================================================
console.log('\n[5/5] 数据统计...');

const stats = {
  visitorBehavior: db.prepare('SELECT COUNT(*) as cnt FROM visitor_behavior').get().cnt,
  knowledgeDocs: db.prepare('SELECT COUNT(*) as cnt FROM knowledge_documents').get().cnt,
  scenicSpots: db.prepare('SELECT COUNT(*) as cnt FROM scenic_spots').get().cnt,
  faqs: db.prepare('SELECT COUNT(*) as cnt FROM faqs').get().cnt,
  chatInteractions: db.prepare('SELECT COUNT(*) as cnt FROM chat_interactions').get().cnt
};

console.log('  ├ 游客行为数据: ' + stats.visitorBehavior.toLocaleString() + ' 条');
console.log('  ├ 知识库文档: ' + stats.knowledgeDocs + ' 篇');
console.log('  ├ 景点信息: ' + stats.scenicSpots + ' 个');
console.log('  ├ FAQ问答: ' + stats.faqs + ' 条');
console.log('  └ 对话记录: ' + stats.chatInteractions + ' 条');

// 各景点访问量统计
const topSpots = db.prepare(`
  SELECT attraction_name, COUNT(*) as visit_count, 
         ROUND(AVG(satisfaction), 1) as avg_satisfaction,
         ROUND(AVG(total_cost), 1) as avg_cost
  FROM visitor_behavior 
  WHERE attraction_name IS NOT NULL AND attraction_name != ''
  GROUP BY attraction_name 
  ORDER BY visit_count DESC 
  LIMIT 10
`).all();

if (topSpots.length > 0) {
  console.log('\n  热门景点 TOP 10:');
  topSpots.forEach(s => {
    console.log('    ' + s.attraction_name + ' | 访问 ' + s.visit_count.toLocaleString() + ' 次 | 均满意 ' + s.avg_satisfaction + ' 分 | 均消费 ¥' + s.avg_cost);
  });
}

db.close();
console.log('\n✓ 数据初始化完成！');
console.log('请运行服务器查看效果: node server.js 或 "C:/Program Files/nodejs/node.exe" server.js');
