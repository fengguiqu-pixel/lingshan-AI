/**
 * 灵山胜境AI数字人导游系统 — 一体化服务器
 * 功能：前端静态服务 + 后端 API + TTS 语音合成代理
 * 单端口运行：http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// ===== 环境配置 =====
require('dotenv').config({ path: path.join(__dirname, '.env') });
const PORT = process.env.PORT || 3000;
const WORKSPACE = __dirname;

// ===== 数据库初始化 =====
require('./config/database');

// ===== Express 初始化 =====
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ===== 管理员后台静态文件（优先匹配 /admin 路径）=====
app.use('/admin', express.static(path.join(__dirname, 'public')));

// ===== 主前端静态文件（匹配 / 路径）=====
app.use(express.static(path.join(__dirname, 'website')));

// ===== API 路由注册 =====
app.use('/api/scenic-spots', require('./routes/scenic-spots'));
app.use('/api/faqs', require('./routes/faqs'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/character', require('./routes/character'));
app.use('/api/ticket', require('./routes/ticket'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/visualization', require('./routes/visualization'));
app.use('/api/knowledge', require('./routes/knowledge'));

// ===== 健康检查 =====
app.get('/api/health', (req, res) => {
  const db = require('./config/database');
  try {
    const spotCount = db.prepare('SELECT COUNT(*) as count FROM scenic_spots').get().count;
    res.json({ success: true, message: '灵山胜境AI导游系统运行正常', spots: spotCount });
  } catch (e) {
    res.json({ success: true, message: '灵山胜境AI导游系统运行正常（数据库未就绪）' });
  }
});

// ===== 统计概览 =====
app.get('/api/stats/overview', (req, res) => {
  const db = require('./config/database');
  try {
    const spotCount = db.prepare('SELECT COUNT(*) as count FROM scenic_spots').get().count;
    const faqCount = db.prepare('SELECT COUNT(*) as count FROM faqs').get().count;
    const chatCount = db.prepare('SELECT COUNT(*) as count FROM chat_interactions').get().count;
    const routeCount = db.prepare('SELECT COUNT(*) as count FROM routes').get().count;
    const knowledgeCount = db.prepare("SELECT COUNT(*) as count FROM knowledge_documents WHERE status = 'published'").get().count;
    let vbStats = { totalRecords: 0 };
    try { vbStats.totalRecords = db.prepare('SELECT COUNT(*) as cnt FROM visitor_behavior').get().cnt; } catch(e) {}
    const todayChats = db.prepare("SELECT COUNT(*) as count FROM chat_interactions WHERE DATE(created_at) = DATE('now')").get().count;
    const visitorCount = db.prepare('SELECT COUNT(*) as count FROM visitor_stats').get().count;
    const spotStats = db.prepare(
      'SELECT ss.name, COUNT(vs.id) as visits FROM scenic_spots ss LEFT JOIN visitor_stats vs ON ss.id = vs.spot_id GROUP BY ss.id ORDER BY visits DESC'
    ).all();
    const dailyChatStats = db.prepare(
      "SELECT DATE(created_at) as date, COUNT(*) as count FROM chat_interactions WHERE created_at >= DATE('now', '-7 days') GROUP BY DATE(created_at) ORDER BY date"
    ).all();
    const chatHistory = db.prepare('SELECT * FROM chat_interactions ORDER BY created_at DESC LIMIT 10').all();
    res.json({
      success: true,
      data: {
        overview: { totalSpots: spotCount, totalFaqs: faqCount, totalChats: chatCount, totalRoutes: routeCount, totalKnowledge: knowledgeCount, visitorBehaviorRecords: vbStats.totalRecords, todayChats, totalVisitors: visitorCount },
        spotStats, dailyChatStats, recentChats: chatHistory
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== 管理员后台页面路由 =====
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/admin/visualization', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'visualization.html'));
});

// ===== TTS 语音合成代理 =====
const GSV_CANDIDATES = [
  path.join(__dirname, 'GPT-SoVITS-v2pro-20250604-nvidia50'),
  path.join(__dirname, '..', 'Claw', '灵山胜境AI导游系统', 'GPT-SoVITS-v2pro-20250604-nvidia50'),
  path.join(__dirname, 'GPT-SoVITS'),
];
const GSV_DIR = GSV_CANDIDATES.find(d => {
  try { return fs.statSync(d).isDirectory(); } catch(e) { return false; }
});

function findPython() {
  const candidates = [
    path.join(GSV_DIR, 'runtime', 'python.exe'),
    'D:\\python\\python.exe',
    path.join(process.env.USERPROFILE || '', 'anaconda3', 'envs', 'gsv', 'python.exe'),
    path.join(process.env.USERPROFILE || '', 'miniconda3', 'envs', 'gsv', 'python.exe'),
    'python.exe',
  ];
  for (const c of candidates) {
    try { if (fs.statSync(c).isFile()) return c; } catch(e) {}
  }
  return 'python.exe';
}

let ttsWorker = null;
let ttsQueue = [];
let ttsProcessing = false;
let workerBuf = Buffer.alloc(0);
let ttsEnabled = false;

function spawnTtsWorker() {
  if (!GSV_DIR) {
    console.log('[TTS] GPT-SoVITS not found — TTS disabled');
    return;
  }
  const pyPath = findPython();
  const workerPath = path.join(GSV_DIR, 'tts_worker.py');
  if (!fs.existsSync(workerPath)) {
    console.log('[TTS] tts_worker.py not found at', workerPath, '— TTS disabled');
    return;
  }
  ttsEnabled = true;
  console.log('[TTS] Starting worker:', pyPath, workerPath);

  // 所有缓存重定向到 D 盘工作空间
  const workerEnv = Object.assign({}, process.env, {
    HF_HOME: path.join(WORKSPACE, 'hf_cache'),
    HF_DATASETS_CACHE: path.join(WORKSPACE, 'hf_cache', 'datasets'),
    TRANSFORMERS_CACHE: path.join(WORKSPACE, 'hf_cache', 'transformers'),
    HUGGINGFACE_HUB_CACHE: path.join(WORKSPACE, 'hf_cache', 'hub'),
    TORCH_HOME: path.join(WORKSPACE, 'torch_cache'),
    MPLCONFIGDIR: path.join(WORKSPACE, 'matplotlib_cache'),
    PIP_CACHE_DIR: path.join(WORKSPACE, 'pip_cache'),
    XDG_CACHE_HOME: path.join(WORKSPACE, 'xdg_cache'),
    NUMBA_CACHE_DIR: path.join(GSV_DIR, 'numba_cache'),
    NLTK_DATA: path.join(GSV_DIR, 'nltk_data'),
    TEMP: path.join(WORKSPACE, 'system_temp'),
    TMP: path.join(WORKSPACE, 'system_temp'),
    TMPDIR: path.join(WORKSPACE, 'system_temp'),
    PYTHONIOENCODING: 'utf-8',
  });

  try {
    ttsWorker = spawn(pyPath, [workerPath], {
      cwd: GSV_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: workerEnv,
    });
    workerBuf = Buffer.alloc(0);
    ttsWorker.stdout.on('data', d => {
      workerBuf = Buffer.concat([workerBuf, d]);
      drainWorkerBuf();
    });
    ttsWorker.stderr.on('data', d => console.error('[TTS stderr]', d.toString()));
    ttsWorker.on('exit', (code) => {
      console.error('[TTS] Worker exited with code:', code);
      ttsWorker = null;
      ttsQueue.forEach(r => { try { r.res.status(503).json({ error: 'TTS worker died' }); } catch(e){} });
      ttsQueue = [];
      ttsProcessing = false;
    });
    console.log('[TTS] Worker started successfully');
  } catch (e) {
    console.error('[TTS] Failed to spawn worker:', e.message);
    ttsEnabled = false;
  }
}

function drainWorkerBuf() {
  while (workerBuf.length >= 4 && ttsQueue.length > 0) {
    const len = workerBuf.readUInt32LE(0);
    if (len > 0 && workerBuf.length < 4 + len) break;
    const { res } = ttsQueue[0];
    try {
      if (len === 0) {
        const errMsg = workerBuf.toString('utf-8', 4);
        res.status(500).json({ error: errMsg });
      } else {
        const wav = workerBuf.subarray(4, 4 + len);
        res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' });
        res.send(Buffer.from(wav));
      }
    } catch(e) {
      try { res.status(500).json({ error: 'Internal TTS error' }); } catch(e2) {}
    }
    workerBuf = workerBuf.subarray(4 + len);
    ttsQueue.shift();
    ttsProcessing = false;
    processNext();
  }
}

function processNext() {
  if (ttsProcessing || ttsQueue.length === 0 || !ttsWorker) return;
  ttsProcessing = true;
  const { text } = ttsQueue[0];
  ttsWorker.stdin.write(JSON.stringify({ text, text_language: 'zh' }) + '\n');
}

app.post('/api/tts', (req, res) => {
  if (!ttsEnabled) {
    return res.status(404).json({ error: 'TTS service not available (GPT-SoVITS not found)', fallback: true });
  }
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text parameter' });
  ttsQueue.push({ text, res });
  processNext();
});

// ===== 主前端页面 =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// SPA fallback：所有非 API 非静态文件的路由都返回主页面
app.get('*', (req, res, next) => {
  // 跳过 API 和静态资源
  if (req.path.startsWith('/api/')) return next();
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') return next();
  // 尝试发送对应的 HTML，否则返回主页
  const filePath = path.join(__dirname, 'website', req.path === '/' ? 'index.html' : req.path);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, 'website', 'index.html'));
  }
});

// ===== 全局错误处理 =====
app.use((err, req, res, next) => {
  console.error('[Server Error]', err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

// ===== 启动服务器 =====
spawnTtsWorker();
app.listen(PORT, '0.0.0.0', () => {
  console.log('═══════════════════════════════════════════');
  console.log('  灵山胜境AI数字人导游系统 v2.0');
  console.log('  一体化服务器已启动');
  console.log(`  主页面:    http://localhost:${PORT}/`);
  console.log(`  管理后台:  http://localhost:${PORT}/admin`);
  console.log(`  数据大屏:  http://localhost:${PORT}/admin/visualization`);
  console.log(`  API 健康:  http://localhost:${PORT}/api/health`);
  console.log(`  TTS 状态:  ${ttsEnabled ? '已启用' : '未启用（GPT-SoVITS 未找到）'}`);
  console.log('═══════════════════════════════════════════');
});
