/**
 * 种子脚本: 数字人动作配置
 * 包括空闲动作、触发动作映射、autoIdle 开关
 */
const db = require('../config/database');

console.log('[Seed] 写入数字人动作配置...');

const configs = [
  // ===== 空闲动作设置 =====
  {
    key: 'motion_idle_auto',
    value: 'true',
    desc: '是否启用自动空闲动作（autoIdle），true=自动循环播放 Idle 组动作',
    category: 'motion'
  },
  {
    key: 'motion_idle_interval',
    value: '12',
    desc: '空闲动作间隔（秒），每隔多少秒自动触发一次随机空闲动作',
    category: 'motion'
  },
  {
    key: 'motion_idle_randomize',
    value: 'true',
    desc: '是否随机选择空闲动作，false=按顺序循环播放',
    category: 'motion'
  },
  {
    key: 'motion_idle_enabled',
    value: 'zhaiyan,tuolian',
    desc: '启用的空闲动作名称列表（逗号分隔）',
    category: 'motion'
  },

  // ===== 触发动作映射: 关键词 → 动作 =====
  {
    key: 'motion_trigger_greet',
    value: '{"group":"Idle","index":0,"name":"眨眼","desc":"打招呼时触发"}',
    desc: '触发词 greet → 动作 Idle[0] 眨眼',
    category: 'motion'
  },
  {
    key: 'motion_trigger_welcome',
    value: '{"group":"Idle","index":1,"name":"托脸","desc":"欢迎游客时触发"}',
    desc: '触发词 welcome → 动作 Idle[1] 托脸',
    category: 'motion'
  },
  {
    key: 'motion_trigger_bye',
    value: '{"group":"Idle","index":0,"name":"眨眼","desc":"告别时触发"}',
    desc: '触发词 bye → 动作 Idle[0] 眨眼',
    category: 'motion'
  },
  {
    key: 'motion_trigger_happy',
    value: '{"group":"Idle","index":1,"name":"托脸","desc":"开心时触发"}',
    desc: '触发词 happy → 动作 Idle[1] 托脸',
    category: 'motion'
  },

  // ===== 动作列表元数据（供前端展示） =====
  {
    key: 'motion_list',
    value: '[{"group":"Idle","index":0,"name":"眨眼","filename":"zhaiyan.motion3.json","desc":"眼睛眨动，表现灵动自然的导游形象"},{"group":"Idle","index":1,"name":"托脸","filename":"zhaoxiang.motion3.json","desc":"手托脸颊，俏皮可爱的互动姿势"}]',
    desc: '可用动作列表（从模型读取）',
    category: 'motion'
  },

  // ===== 表情→动作联动 =====
  {
    key: 'motion_auto_play_on_emotion',
    value: 'true',
    desc: '表情切换时是否自动播放关联动作',
    category: 'motion'
  },
];

const upsert = db.prepare(`
  INSERT INTO character_configs (config_key, config_value, description, category, updated_at)
  VALUES (?, ?, ?, ?, datetime('now','localtime'))
  ON CONFLICT(config_key) DO UPDATE SET
    config_value = excluded.config_value,
    description = excluded.description,
    category = excluded.category,
    updated_at = datetime('now','localtime')
`);

const doAll = db.transaction(() => {
  configs.forEach(c => {
    upsert.run(c.key, c.value, c.desc, c.category);
    console.log(`  ✓ ${c.key} = ${c.value.substring(0, 40)}`);
  });
});

doAll();
console.log(`[Seed] 完成！共写入 ${configs.length} 条动作配置`);
db.close();
