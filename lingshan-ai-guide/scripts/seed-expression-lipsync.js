/**
 * 种子数据：表情映射 + 口型同步配置
 * 写入 character_configs 表
 */

const db = require('../config/database');

// 确保唯一索引
db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_character_configs_key ON character_configs(config_key)').run();

const expressionMappings = [
  {
    key: 'expr_smile',
    value: '{"kind":"expression","name":"smile","group":"","index":0}',
    description: '当AI判断为"微笑/友好"情绪时触发'
  },
  {
    key: 'expr_happy',
    value: '{"kind":"expression","name":"smile","group":"","index":0}',
    description: '当AI判断为"开心/高兴"情绪时触发'
  },
  {
    key: 'expr_think',
    value: '{"kind":"expression","name":"think","group":"","index":0}',
    description: '当AI判断为"思考/疑惑"情绪时触发'
  },
  {
    key: 'expr_wave',
    value: '{"kind":"expression","name":"normal","group":"","index":0}',
    description: '当AI判断为"问候/再见"时触发'
  },
  {
    key: 'expr_agree',
    value: '{"kind":"expression","name":"smile","group":"","index":0}',
    description: '当AI判断为"赞同/肯定"时触发'
  },
  {
    key: 'expr_sad',
    value: '{"kind":"expression","name":"sad","group":"","index":0}',
    description: '当AI判断为"遗憾/惋惜"时触发'
  },
  {
    key: 'expr_surprise',
    value: '{"kind":"expression","name":"surprise","group":"","index":0}',
    description: '当AI判断为"惊讶/惊喜"时触发'
  },
  {
    key: 'expr_shy',
    value: '{"kind":"expression","name":"shy","group":"","index":0}',
    description: '当AI判断为"害羞/难为情"时触发'
  },
  {
    key: 'expr_angry',
    value: '{"kind":"expression","name":"angry","group":"","index":0}',
    description: '当AI判断为"生气/严肃"时触发'
  },
  {
    key: 'expr_default',
    value: '{"kind":"expression","name":"normal","group":"","index":0}',
    description: '默认/未知情绪的表情映射'
  },
  {
    key: 'expr_greet',
    value: '{"kind":"motion","name":"","group":"Greeting","index":0}',
    description: '欢迎/打招呼动作映射'
  },
  {
    key: 'expr_idle',
    value: '{"kind":"motion","name":"","group":"Idle","index":0}',
    description: '空闲时随机动作组'
  }
];

const lipSyncConfigs = [
  {
    key: 'lipsync_param_id',
    value: 'ParamMouthOpenY',
    description: '口型同步参数ID（Live2D SDK参数名）'
  },
  {
    key: 'lipsync_amplitude',
    value: '0.6',
    description: '嘴巴张合幅度 (0.0-1.0)，值越大嘴巴张得越开'
  },
  {
    key: 'lipsync_smooth_factor',
    value: '0.15',
    description: '口型平滑因子 (0.01-0.5)，值越小过渡越平滑'
  },
  {
    key: 'lipsync_poll_interval',
    value: '50',
    description: '口型更新间隔(ms)，值越小动画越细腻但消耗资源'
  },
  {
    key: 'lipsync_speed_base',
    value: '10',
    description: '基础嘴部张合速度，影响说话节奏感 (4-20)'
  },
  {
    key: 'lipsync_volume_smooth',
    value: '0.3',
    description: '音量平滑因子，用于音频驱动的口型过渡'
  }
];

const upsertStmt = db.prepare(`
  INSERT INTO character_configs (config_key, config_value, description, category, updated_at)
  VALUES (?, ?, ?, ?, datetime('now','localtime'))
  ON CONFLICT(config_key) DO UPDATE SET
    config_value = excluded.config_value,
    description = excluded.description,
    category = excluded.category,
    updated_at = datetime('now','localtime')
`);

const doUpsert = db.transaction(() => {
  // 表情映射
  expressionMappings.forEach(m => {
    upsertStmt.run(m.key, m.value, m.description, 'expression');
  });
  console.log('  写入 ' + expressionMappings.length + ' 条表情映射');

  // 口型同步
  lipSyncConfigs.forEach(c => {
    upsertStmt.run(c.key, c.value, c.description, 'lipsync');
  });
  console.log('  写入 ' + lipSyncConfigs.length + ' 条口型配置');
});

doUpsert();

console.log('表情映射和口型同步种子数据写入完成！');
db.close();
