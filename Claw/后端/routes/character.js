const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');

// 头像上传存储配置
const AVATAR_DIR = path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(AVATAR_DIR)) {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 同步到 website 的 assets 目录
    const webAssetsDir = path.join(__dirname, '..', '..', '灵山胜境AI导游系统', 'website', 'assets');
    if (!fs.existsSync(webAssetsDir)) {
      fs.mkdirSync(webAssetsDir, { recursive: true });
    }
    cb(null, webAssetsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'march7th-avatar' + ext);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: function (req, file, cb) {
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 PNG/JPG/GIF/WEBP 格式图片'));
    }
  }
});

router.get('/config', (req, res) => {
  try {
    const { category } = req.query;
    
    let query = `SELECT * FROM character_configs ORDER BY category, id`;
    
    if (category) {
      query = `SELECT * FROM character_configs WHERE category = ? ORDER BY id`;
      const configs = db.prepare(query).all(category);
      
      const result = {};
      configs.forEach(config => {
        if (!result[config.category]) {
          result[config.category] = [];
        }
        result[config.category].push({
          key: config.config_key,
          value: config.config_value,
          description: config.description
        });
      });
      
      res.json({ success: true, data: result });
    } else {
      const configs = db.prepare(query).all();
      
      const result = {};
      configs.forEach(config => {
        if (!result[config.category]) {
          result[config.category] = [];
        }
        result[config.category].push({
          key: config.config_key,
          value: config.config_value,
          description: config.description
        });
      });
      
      res.json({ success: true, data: result });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config/:key', (req, res) => {
  try {
    const config = db.prepare(`SELECT * FROM character_configs WHERE config_key = ?`).get(req.params.key);
    
    if (!config) {
      return res.status(404).json({ error: '配置项不存在' });
    }
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config/:key', (req, res) => {
  try {
    const { value, description } = req.body;
    
    const result = db.prepare(
      `UPDATE character_configs SET config_value = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE config_key = ?`
    ).run(value, description, req.params.key);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '配置项不存在' });
    }
    res.json({ success: true, message: '配置更新成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/config', (req, res) => {
  try {
    const { key, value, description, category } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: '配置键不能为空' });
    }
    
    const result = db.prepare(
      `INSERT INTO character_configs (config_key, config_value, description, category) VALUES (?, ?, ?, ?)`
    ).run(key, value || '', description || '', category || 'appearance');
    
    res.json({ success: true, id: result.lastInsertRowid, message: '配置项创建成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/config/:key', (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM character_configs WHERE config_key = ?`).run(req.params.key);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: '配置项不存在' });
    }
    res.json({ success: true, message: '配置项删除成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', (req, res) => {
  try {
    const categories = db.prepare(`SELECT DISTINCT category FROM character_configs`).all();
    const result = categories.map(c => c.category);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 获取完整形象方案（结构化的配置对象）
// ============================================================
router.get('/profile', (req, res) => {
  try {
    const all = db.prepare('SELECT * FROM character_configs ORDER BY category, id').all();

    const profile = {
      appearance: {},
      clothing: {},
      voice: {},
      behavior: {}
    };

    const outfits = [];
    const voices = [];

    all.forEach(c => {
      const val = c.config_value;
      const desc = c.description || '';

      // 分类存储
      if (c.category === 'appearance') profile.appearance[c.config_key] = val;
      else if (c.category === 'clothing') {
        if (c.config_key === 'current_outfit') {
          profile.clothing.current = val;
        } else if (c.config_key.startsWith('outfit_')) {
          outfits.push({
            id: c.config_key.replace('outfit_', ''),
            name: val,
            description: desc.replace('服装方案: ' + val + ' - ', '')
          });
        }
      }
      else if (c.category === 'voice') {
        if (['voice_type', 'voice_name', 'voice_engine'].includes(c.config_key)) {
          profile.voice[c.config_key] = val;
        } else {
          profile.voice[c.config_key] = isNaN(parseFloat(val)) ? val : parseFloat(val);
        }
      }
      else if (c.category === 'behavior') profile.behavior[c.config_key] = val;
    });

    profile.clothing.outfits = outfits;
    profile.clothing_count = outfits.length;

    // 预设声线列表
    const presetVoices = [
      { id: 'march7th', name: '三月七 (March 7th) v3', description: '年轻活泼女声，适合导览讲解' },
    ];
    profile.available_voices = presetVoices;

    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 批量保存形象方案
// ============================================================
router.post('/profile', (req, res) => {
  try {
    const { appearance, clothing, voice, behavior } = req.body;
    const updates = [];

    const upsertStmt = db.prepare(`
      UPDATE character_configs SET config_value = ?, updated_at = datetime('now','localtime')
      WHERE config_key = ?
    `);

    const doUpsert = db.transaction(() => {
      // 外观
      if (appearance && typeof appearance === 'object') {
        for (const [key, val] of Object.entries(appearance)) {
          upsertStmt.run(String(val), key);
          updates.push('appearance.' + key);
        }
      }
      // 服装
      if (clothing && typeof clothing === 'object') {
        for (const [key, val] of Object.entries(clothing)) {
          upsertStmt.run(String(val), key);
          updates.push('clothing.' + key);
        }
      }
      // 声音
      if (voice && typeof voice === 'object') {
        for (const [key, val] of Object.entries(voice)) {
          upsertStmt.run(String(val), key);
          updates.push('voice.' + key);
        }
      }
      // 行为
      if (behavior && typeof behavior === 'object') {
        for (const [key, val] of Object.entries(behavior)) {
          upsertStmt.run(String(val), key);
          updates.push('behavior.' + key);
        }
      }
    });

    doUpsert();

    res.json({
      success: true,
      message: '形象方案已保存',
      updated: updates.length,
      fields: updates
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 上传头像图片
// ============================================================
router.post('/avatar', avatarUpload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的头像图片' });
    }

    const ext = path.extname(req.file.originalname);
    const avatarPath = 'assets/march7th-avatar' + ext;

    // 更新数据库配置
    db.prepare(`
      UPDATE character_configs SET config_value = ?, updated_at = datetime('now','localtime')
      WHERE config_key = 'avatar_image'
    `).run(avatarPath);

    // 也复制一份到后端 public 目录
    const srcPath = req.file.path;
    const destPath = path.join(AVATAR_DIR, 'march7th-avatar' + ext);
    fs.copyFileSync(srcPath, destPath);

    res.json({
      success: true,
      message: '头像上传成功',
      avatar_url: '/avatars/march7th-avatar' + ext,
      frontend_path: avatarPath
    });
  } catch (err) {
    res.status(500).json({ error: '头像上传失败: ' + err.message });
  }
});

// ============================================================
// 获取所有预设服装方案
// ============================================================
router.get('/outfits', (req, res) => {
  try {
    const configs = db.prepare(
      "SELECT * FROM character_configs WHERE config_key LIKE 'outfit_%' ORDER BY id"
    ).all();

    const currentOutfit = db.prepare(
      "SELECT config_value FROM character_configs WHERE config_key = 'current_outfit'"
    ).get();

    const outfits = configs.map(c => {
      const id = c.config_key.replace('outfit_', '');
      const desc = (c.description || '').replace('服装方案: ' + c.config_value + ' - ', '');
      return {
        id: id,
        name: c.config_value,
        description: desc,
        isCurrent: (currentOutfit && currentOutfit.config_value === id)
      };
    });

    res.json({
      success: true,
      current: currentOutfit ? currentOutfit.config_value : null,
      outfits: outfits
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 切换服装
// ============================================================
router.put('/outfit', (req, res) => {
  try {
    const { outfitId } = req.body;
    if (!outfitId) {
      return res.status(400).json({ error: '请指定服装ID' });
    }

    // 验证服装ID是否存在
    const outfit = db.prepare(
      "SELECT * FROM character_configs WHERE config_key = ?"
    ).get('outfit_' + outfitId);

    if (!outfit) {
      return res.status(404).json({ error: '未找到该服装方案' });
    }

    db.prepare(`
      UPDATE character_configs SET config_value = ?, updated_at = datetime('now','localtime')
      WHERE config_key = 'current_outfit'
    `).run(outfitId);

    res.json({
      success: true,
      message: '服装已切换为: ' + outfit.config_value,
      outfit: { id: outfitId, name: outfit.config_value }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 获取声音配置
// ============================================================
router.get('/voice', (req, res) => {
  try {
    const voiceConfigs = db.prepare(
      "SELECT * FROM character_configs WHERE category = 'voice' ORDER BY id"
    ).all();

    const voice = {};
    voiceConfigs.forEach(c => {
      voice[c.config_key] = isNaN(parseFloat(c.config_value))
        ? c.config_value
        : parseFloat(c.config_value);
    });

    // 可用声线
    voice.available = [
      { id: 'march7th', name: '三月七 (March 7th) v3', description: '年轻活泼女声，GPT-SoVITS v3 权重，适合导览讲解' },
    ];

    res.json({ success: true, data: voice });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 更新声音设置
// ============================================================
router.put('/voice', (req, res) => {
  try {
    const { voice_type, voice_speed, voice_pitch, voice_volume, voice_emotion } = req.body;

    const updates = {
      voice_type, voice_speed, voice_pitch, voice_volume, voice_emotion
    };

    const upsertStmt = db.prepare(`
      UPDATE character_configs SET config_value = ?, updated_at = datetime('now','localtime')
      WHERE config_key = ?
    `);

    const doUpdate = db.transaction(() => {
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) {
          upsertStmt.run(String(val), key);
        }
      }
    });

    doUpdate();

    res.json({ success: true, message: '声音设置已更新', updates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 表情映射管理
// ============================================================

// 获取所有表情映射
router.get('/expressions', (req, res) => {
  try {
    const mappings = db.prepare(
      "SELECT * FROM character_configs WHERE category = 'expression' ORDER BY config_key"
    ).all();

    const result = mappings.map(m => {
      let parsed;
      try { parsed = JSON.parse(m.config_value); } catch (e) { parsed = { kind: 'expression', name: 'normal' }; }
      return {
        trigger: m.config_key.replace('expr_', ''),
        kind: parsed.kind || 'expression',
        name: parsed.name || 'normal',
        group: parsed.group || '',
        index: parsed.index !== undefined ? parsed.index : 0,
        description: m.description || ''
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 创建/更新单条表情映射
router.post('/expressions', (req, res) => {
  try {
    const { trigger, kind, name, group, index, description } = req.body;
    if (!trigger) {
      return res.status(400).json({ error: '请指定触发情绪 (trigger)' });
    }

    const configKey = 'expr_' + trigger;
    const value = JSON.stringify({
      kind: kind || 'expression',
      name: name || 'normal',
      group: group || '',
      index: index !== undefined ? index : 0
    });

    db.prepare(`
      INSERT INTO character_configs (config_key, config_value, description, category, updated_at)
      VALUES (?, ?, ?, 'expression', datetime('now','localtime'))
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        description = excluded.description,
        updated_at = datetime('now','localtime')
    `).run(configKey, value, description || '');

    res.json({ success: true, message: '表情映射已保存', trigger });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除单条表情映射
router.delete('/expressions/:trigger', (req, res) => {
  try {
    const configKey = 'expr_' + req.params.trigger;
    const result = db.prepare("DELETE FROM character_configs WHERE config_key = ?").run(configKey);

    if (result.changes === 0) {
      return res.status(404).json({ error: '未找到该表情映射' });
    }
    res.json({ success: true, message: '表情映射已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 口型同步配置管理
// ============================================================

// 获取口型同步配置
router.get('/lip-sync', (req, res) => {
  try {
    const configs = db.prepare(
      "SELECT * FROM character_configs WHERE category = 'lipsync' ORDER BY id"
    ).all();

    const result = {};
    configs.forEach(c => {
      const shortKey = c.config_key.replace('lipsync_', '');
      result[shortKey] = isNaN(parseFloat(c.config_value))
        ? c.config_value
        : parseFloat(c.config_value);
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新口型同步配置
router.put('/lip-sync', (req, res) => {
  try {
    const updates = req.body;
    const upsertStmt = db.prepare(`
      INSERT INTO character_configs (config_key, config_value, description, category, updated_at)
      VALUES (?, ?, ?, 'lipsync', datetime('now','localtime'))
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        updated_at = datetime('now','localtime')
    `);

    const doUpdate = db.transaction(() => {
      for (const [key, val] of Object.entries(updates)) {
        const fullKey = 'lipsync_' + key;
        upsertStmt.run(fullKey, String(val), '口型同步参数: ' + key);
      }
    });

    doUpdate();

    res.json({ success: true, message: '口型配置已更新', fields: Object.keys(updates) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 动作管理 API
// ============================================================

// 获取可用动作列表
router.get('/motions', (req, res) => {
  try {
    const listRow = db.prepare(
      "SELECT config_value FROM character_configs WHERE config_key = 'motion_list'"
    ).get();

    let motions = [];
    if (listRow) {
      try { motions = JSON.parse(listRow.config_value); } catch (e) {}
    }

    // 也尝试从 live2d-models 目录读取
    if (motions.length === 0) {
      // 返回默认已知动作
      motions = [
        { group: 'Idle', index: 0, name: '眨眼', filename: 'zhaiyan.motion3.json', desc: '眼睛眨动' },
        { group: 'Idle', index: 1, name: '照相', filename: 'zhaoxiang.motion3.json', desc: '照相姿势' }
      ];
    }

    res.json({ success: true, data: motions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取全部动作配置
router.get('/motion-config', (req, res) => {
  try {
    const configs = db.prepare(
      "SELECT * FROM character_configs WHERE category = 'motion' ORDER BY id"
    ).all();

    const result = { triggers: [] };
    configs.forEach(c => {
      const key = c.config_key;

      if (key === 'motion_idle_auto') result.idleAuto = c.config_value === 'true';
      else if (key === 'motion_idle_interval') result.idleInterval = parseInt(c.config_value) || 12;
      else if (key === 'motion_idle_randomize') result.idleRandomize = c.config_value === 'true';
      else if (key === 'motion_idle_enabled') result.idleEnabled = c.config_value.split(',').filter(Boolean);
      else if (key === 'motion_auto_play_on_emotion') result.autoPlayOnEmotion = c.config_value === 'true';
      else if (key === 'motion_list') {
        try { result.motions = JSON.parse(c.config_value); } catch (e) {}
      }
      else if (key.startsWith('motion_trigger_')) {
        const trigger = key.replace('motion_trigger_', '');
        let parsed = {};
        try { parsed = JSON.parse(c.config_value); } catch (e) {}
        result.triggers.push({
          trigger,
          group: parsed.group || 'Idle',
          index: parsed.index !== undefined ? parsed.index : 0,
          name: parsed.name || '',
          desc: parsed.desc || ''
        });
      }
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 更新动作配置
router.put('/motion-config', (req, res) => {
  try {
    const { idleAuto, idleInterval, idleRandomize, idleEnabled, autoPlayOnEmotion } = req.body;
    const upsert = db.prepare(`
      INSERT INTO character_configs (config_key, config_value, description, category, updated_at)
      VALUES (?, ?, ?, 'motion', datetime('now','localtime'))
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        updated_at = datetime('now','localtime')
    `);

    const doUpdate = db.transaction(() => {
      if (idleAuto !== undefined) upsert.run('motion_idle_auto', String(idleAuto), '自动空闲动作开关');
      if (idleInterval !== undefined) upsert.run('motion_idle_interval', String(idleInterval), '空闲动作间隔(秒)');
      if (idleRandomize !== undefined) upsert.run('motion_idle_randomize', String(idleRandomize), '随机选择空闲动作');
      if (idleEnabled !== undefined) upsert.run('motion_idle_enabled', Array.isArray(idleEnabled) ? idleEnabled.join(',') : String(idleEnabled), '启用的空闲动作');
      if (autoPlayOnEmotion !== undefined) upsert.run('motion_auto_play_on_emotion', String(autoPlayOnEmotion), '表情切换时自动播放动作');
    });

    doUpdate();
    res.json({ success: true, message: '动作配置已更新' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 添加触发动作映射
router.post('/motion-trigger', (req, res) => {
  try {
    const { trigger, group, index, name, desc } = req.body;
    if (!trigger) return res.status(400).json({ error: '请指定触发词' });

    const configKey = 'motion_trigger_' + trigger;
    const value = JSON.stringify({
      group: group || 'Idle',
      index: index !== undefined ? index : 0,
      name: name || '',
      desc: desc || ''
    });

    db.prepare(`
      INSERT INTO character_configs (config_key, config_value, description, category, updated_at)
      VALUES (?, ?, ?, 'motion', datetime('now','localtime'))
      ON CONFLICT(config_key) DO UPDATE SET
        config_value = excluded.config_value,
        description = excluded.description,
        updated_at = datetime('now','localtime')
    `).run(configKey, value, `触发动作: ${trigger} → ${name}`);

    res.json({ success: true, message: '触发动作已保存', trigger });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 删除触发动作映射
router.delete('/motion-trigger/:trigger', (req, res) => {
  try {
    const configKey = 'motion_trigger_' + req.params.trigger;
    const result = db.prepare("DELETE FROM character_configs WHERE config_key = ?").run(configKey);
    if (result.changes === 0) return res.status(404).json({ error: '未找到该触发动作' });
    res.json({ success: true, message: '触发动作已删除' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 预览/触发动作（供前端调用，通过 Live2D API 执行）
router.post('/motion-preview', (req, res) => {
  // 此接口仅返回动作参数，实际播放由前端 Live2D 执行
  const { group, index } = req.body;
  res.json({
    success: true,
    message: `请在数字人面板上预览动作: ${group}[${index}]`,
    action: { group: group || 'Idle', index: index || 0 }
  });
});

module.exports = router;
