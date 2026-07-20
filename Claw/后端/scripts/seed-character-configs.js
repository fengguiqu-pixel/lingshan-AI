// ===== 数字人形象管理 - 种子数据 =====
// 运行: node scripts/seed-character-configs.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const db = require('../config/database');

console.log('=== 数字人形象配置种子数据 ===\n');

// 使用 INSERT OR REPLACE 避免重复
const upsert = db.prepare(`
  INSERT INTO character_configs (config_key, config_value, description, category, updated_at)
  VALUES (?, ?, ?, ?, datetime('now','localtime'))
  ON CONFLICT(config_key) DO UPDATE SET
    config_value = excluded.config_value,
    description = excluded.description,
    category = excluded.category,
    updated_at = datetime('now','localtime')
`);

// ----------------------------- 外观配置 -----------------------------
const appearanceConfigs = [
  ['avatar_name', '小灵', '数字人名称', 'appearance'],
  ['avatar_subtitle', 'AI Digital Guide', '数字人副标题', 'appearance'],
  ['avatar_gender', 'female', '性别: female/male', 'appearance'],
  ['avatar_style', 'traditional', '形象风格: traditional/modern/cute', 'appearance'],
  ['avatar_color', '#C8A357', '主题色', 'appearance'],
  ['avatar_image', 'assets/march7th-avatar.png', '头像图片路径', 'appearance'],
  ['avatar_bg_color', '#f5f0e8', '形象背景色', 'appearance'],
];

// ----------------------------- 服装配置 -----------------------------
const clothingConfigs = [
  ['current_outfit', 'chan-yi-hanfu', '当前选中的服装ID', 'clothing'],
  ['outfit_chan_yi_hanfu', '禅意汉服', '服装方案: 禅意汉服 - 淡雅青白配色，宽袖飘逸，彰显佛门静雅之气', 'clothing'],
  ['outfit_su_ya_jushi', '素雅居士', '服装方案: 素雅居士 - 米白素衣，简约不染，体现修行者朴实本色', 'clothing'],
  ['outfit_lian_hua_xian', '莲花仙裙', '服装方案: 莲花仙裙 - 淡粉渐变长裙，裙摆绣莲花纹样，优雅灵动', 'clothing'],
  ['outfit_tang_zhuang', '唐装古典', '服装方案: 唐装古典 - 金色祥云纹唐装，庄重华贵，与梵宫艺术呼应', 'clothing'],
  ['outfit_yun_shui_chan', '云水禅心', '服装方案: 云水禅心 - 渐变蓝白长袍，如水墨晕染，空灵通透', 'clothing'],
  ['outfit_lingshan_zhuan', '灵山专属', '服装方案: 灵山专属 - 景区定制款，金色灵山LOGO刺绣，职业导览风', 'clothing'],
];

// ----------------------------- 声音配置 -----------------------------
const voiceConfigs = [
  ['voice_type', 'march7th', '当前声线ID', 'voice'],
  ['voice_name', '三月七 (March 7th) v3', '声线显示名称', 'voice'],
  ['voice_speed', '1.0', '语速: 0.5-2.0', 'voice'],
  ['voice_pitch', '1.0', '音调: 0.5-2.0', 'voice'],
  ['voice_volume', '0.8', '音量: 0.0-1.0', 'voice'],
  ['voice_emotion', 'warm', '情感风格: warm/gentle/professional/lively', 'voice'],
  ['voice_engine', 'GPT-SoVITS', 'TTS引擎', 'voice'],
];

// ----------------------------- 行为配置 -----------------------------
const behaviorConfigs = [
  ['response_delay', '1000', '回复延迟(毫秒)', 'behavior'],
  ['greeting', '您好！我是小灵，灵山胜境AI数字人导游，很高兴为您服务。', '默认欢迎语', 'behavior'],
  ['auto_greet', 'true', '是否自动欢迎', 'behavior'],
  ['expression_default', 'smile', '默认表情', 'behavior'],
  ['speaking_animation', 'true', '说话时启用动画', 'behavior'],
];

// 写入全部配置
const allConfigs = [
  ...appearanceConfigs,
  ...clothingConfigs,
  ...voiceConfigs,
  ...behaviorConfigs,
];

const insertAll = db.transaction(() => {
  for (const [key, value, desc, cat] of allConfigs) {
    upsert.run(key, value, desc, cat);
  }
});

insertAll();

// 验证
const count = db.prepare('SELECT COUNT(*) as cnt FROM character_configs').get().cnt;
console.log('已写入/更新 ' + allConfigs.length + ' 条配置');
console.log('配置表总计 ' + count + ' 条记录\n');

// 按分类显示
const categories = db.prepare('SELECT DISTINCT category, COUNT(*) as cnt FROM character_configs GROUP BY category').all();
console.log('=== 分类统计 ===');
categories.forEach(c => console.log('  ' + c.category + ': ' + c.cnt + ' 项'));

console.log('\n种子数据写入完成！');
