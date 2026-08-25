/**
 * 灵山胜境AI数字人导游系统 — 一体化服务器
 * 功能：前端静态服务 + 后端 API + TTS 语音合成代理
 * 单端口运行：http://localhost:3000
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');

// ===== 环境配置 =====
require('dotenv').config({ path: path.join(__dirname, '.env') });
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const WORKSPACE = __dirname;

// ===== HTTPS 自签名证书 =====
const SSL_DIR = path.join(__dirname, 'config', 'ssl');
const SSL_KEY = path.join(SSL_DIR, 'key.pem');
const SSL_CERT = path.join(SSL_DIR, 'cert.pem');

function ensureSslCerts() {
  try {
    if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) return true;
    fs.mkdirSync(SSL_DIR, { recursive: true });
    const subj = '/CN=lingshan-ai-guide.local/O=灵山胜境AI导游/C=CN';
    const result = spawnSync('openssl', [
      'req', '-x509', '-nodes', '-days', '365',
      '-newkey', 'rsa:2048',
      '-keyout', SSL_KEY,
      '-out', SSL_CERT,
      '-subj', subj
    ], { stdio: 'pipe' });
    if (result.status !== 0) {
      console.warn('[SSL] 生成自签名证书失败:', result.stderr?.toString() || 'unknown error');
      return false;
    }
    console.log('[SSL] 已生成自签名证书:', SSL_DIR);
    return true;
  } catch (e) {
    console.warn('[SSL] 证书初始化失败:', e.message);
    return false;
  }
}

const sslEnabled = ensureSslCerts();

// ===== 获取局域网 IP =====
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // 跳过内部地址和非 IPv4
      if (iface.internal || iface.family !== 'IPv4') continue;
      ips.push({ name, address: iface.address });
    }
  }
  return ips;
}

// ===== 数据库初始化 =====
require('./config/database');

// ===== Express 初始化 =====
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ===== 管理员后台静态文件（优先匹配 /admin 路径）=====
app.use('/admin', express.static(path.join(__dirname, 'public')));

// ===== 主前端静态文件（不自动返回 index.html，由 / 路由处理跳转逻辑）=====
app.use(express.static(path.join(__dirname, 'website'), { index: false }));

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

// ===== 手机版前端（完全隔离，目录不存在则不挂载）=====
const MOBILE_DIR = path.join(__dirname, 'mobile-apk', 'www');
let mobileEnabled = false;
if (fs.existsSync(MOBILE_DIR)) {
  app.use('/mobile', express.static(MOBILE_DIR));
  // /mobile 重定向到 /mobile/（确保相对路径 live2d-models/ 等正确解析）
  app.get('/mobile', (req, res) => {
    res.redirect(301, '/mobile/');
  });
  mobileEnabled = true;
}

// ===== 手机模拟器（电脑端演示用：逼真手机外壳 + iframe 嵌入手机版）=====
const SIMULATOR_DIR = path.join(__dirname, 'mobile-apk', 'simulator');
let simulatorEnabled = false;
if (fs.existsSync(SIMULATOR_DIR)) {
  app.use('/simulator', express.static(SIMULATOR_DIR));
  app.get('/simulator', (req, res) => {
    res.redirect(301, '/simulator/');
  });
  simulatorEnabled = true;
}

// ===== TTS 语音合成代理（HTTP API 架构）=====
// 架构对齐"桌面灵"验证过的方案：
//   1. 拉起 GPT-SoVITS HTTP API 服务（tts_api.py，等价官方 api_v2.py 的 /tts 端点）
//   2. 启动完成后自动预热一句，消除用户第一句话的全额热身成本
//   3. 每个请求挂 45 秒硬超时，卡死时返回 504 而不是永久挂起
//   4. API 进程崩溃自动重启（最多 3 次）
const GSV_CANDIDATES = [
  path.join(__dirname, 'GPT-SoVITS-v2pro-20250604-nvidia50'),
  path.join(__dirname, '..', 'Claw', '灵山胜境AI导游系统', 'GPT-SoVITS-v2pro-20250604-nvidia50'),
  path.join(__dirname, 'GPT-SoVITS'),
];
const GSV_DIR = GSV_CANDIDATES.find(d => {
  try { return fs.statSync(d).isDirectory(); } catch(e) { return false; }
});

const TTS_API_PORT = parseInt(process.env.TTS_API_PORT || '9880', 10);
const TTS_API_BASE = `http://127.0.0.1:${TTS_API_PORT}`;
const TTS_TIMEOUT_MS = parseInt(process.env.TTS_TIMEOUT_MS || '120000', 10);       // 单次合成硬超时（长文本实测可达 30-40s，留足余量）
const TTS_STARTUP_TIMEOUT_MS = parseInt(process.env.TTS_STARTUP_TIMEOUT_MS || '300000', 10); // 模型加载等待上限（5 分钟）
const TTS_MAX_RESTARTS = 3;          // API 进程崩溃自动重启上限

function findPython() {
  const candidates = [
    path.join(GSV_DIR || '', 'runtime', 'python.exe'),
    path.join(GSV_DIR || '', 'venv', 'Scripts', 'python.exe'),
    path.join(GSV_DIR || '', 'venv', 'bin', 'python'),
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

let ttsApiProc = null;       // TTS API 子进程
let ttsApiReady = false;     // 健康检查通过 + 预热完成后为 true
let ttsConfigured = false;   // GPT-SoVITS 目录与 tts_api.py 是否存在
let ttsRestarts = 0;         // 已自动重启次数
let ttsWaiting = null;       // 等待就绪的 Promise（避免并发等待）

function ttsApiEnv() {
  // 所有缓存重定向到 D 盘工作空间
  return Object.assign({}, process.env, {
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
    TTS_API_PORT: String(TTS_API_PORT),
  });
}

function spawnTtsApi() {
  if (!GSV_DIR) {
    console.log('[TTS] GPT-SoVITS not found — TTS disabled');
    return;
  }
  const pyPath = findPython();
  const apiPath = path.join(GSV_DIR, 'tts_api.py');
  if (!fs.existsSync(apiPath)) {
    console.log('[TTS] tts_api.py not found at', apiPath, '— TTS disabled');
    return;
  }
  ttsConfigured = true;
  console.log(`[TTS] 启动 GPT-SoVITS HTTP API: ${TTS_API_BASE} (python: ${pyPath})`);

  try {
    ttsApiProc = spawn(pyPath, [apiPath], {
      cwd: GSV_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: ttsApiEnv(),
    });
  } catch (e) {
    console.error('[TTS] 拉起 API 进程失败:', e.message);
    ttsConfigured = false;
    return;
  }

  ttsApiProc.stdout.on('data', d => {
    const s = d.toString().trim();
    if (s) console.log('[TTS API]', s);
  });
  ttsApiProc.stderr.on('data', d => {
    const s = d.toString().trimEnd();
    if (s) console.error('[TTS API]', s);
  });
  ttsApiProc.on('exit', (code) => {
    console.error('[TTS] API 进程退出, code:', code);
    ttsApiProc = null;
    ttsApiReady = false;
    ttsWaiting = null;
    if (ttsRestarts < TTS_MAX_RESTARTS) {
      ttsRestarts++;
      console.log(`[TTS] 5 秒后自动重启 API 进程（第 ${ttsRestarts}/${TTS_MAX_RESTARTS} 次）`);
      setTimeout(spawnTtsApi, 5000);
    } else {
      console.error('[TTS] 已达自动重启上限，TTS 停用');
    }
  });

  waitForTtsApi();
}

async function waitForTtsApi() {
  if (ttsWaiting) return ttsWaiting;
  ttsWaiting = (async () => {
    const deadline = Date.now() + TTS_STARTUP_TIMEOUT_MS;
    while (Date.now() < deadline && ttsApiProc) {
      try {
        const r = await fetch(`${TTS_API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (r.ok) {
          console.log('[TTS] API 服务已就绪，开始预热（消除第一句话的 CUDA 热身延迟）');
          await warmUpTts();
          return;
        }
      } catch (e) { /* 尚未启动，继续轮询 */ }
      await new Promise(r => setTimeout(r, 2000));
    }
    console.error('[TTS] API 服务启动超时（模型加载失败或超过等待上限）');
  })();
  return ttsWaiting;
}

async function warmUpTts() {
  const t0 = Date.now();
  try {
    const r = await fetch(`${TTS_API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '嗯。' }),
      signal: AbortSignal.timeout(120000),
    });
    if (r.ok) {
      const wav = await r.arrayBuffer();
      ttsApiReady = true;
      console.log(`[TTS] 预热完成: 耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s, 返回 ${(wav.byteLength / 1024).toFixed(0)}KB`);
    } else {
      ttsApiReady = true; // 服务能响应就算就绪，预热失败不阻塞
      console.warn('[TTS] 预热请求失败:', r.status);
    }
  } catch (e) {
    ttsApiReady = true;
    console.warn('[TTS] 预热请求异常:', e.message);
  }
}

app.post('/api/tts', async (req, res) => {
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'Missing text parameter' });
  if (!ttsConfigured) {
    return res.status(404).json({ error: 'TTS service not available (GPT-SoVITS not found)', fallback: true });
  }
  if (!ttsApiReady || !ttsApiProc) {
    return res.status(503).json({ error: 'TTS service not ready (model loading, please retry)', fallback: true });
  }
  try {
    const r = await fetch(`${TTS_API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, text_lang: 'zh' }),
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      let msg = `TTS synthesis failed (${r.status})`;
      try { msg = JSON.parse(errText).error || msg; } catch (e) { if (errText) msg = errText.substring(0, 200); }
      return res.status(502).json({ error: msg, fallback: true });
    }
    const wavBuf = Buffer.from(await r.arrayBuffer());
    res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' });
    return res.send(wavBuf);
  } catch (e) {
    const timedOut = e.name === 'TimeoutError' || e.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? `语音生成超时（${TTS_TIMEOUT_MS / 1000} 秒），请稍后重试` : e.message,
      fallback: true,
    });
  }
});

// ===== 服务器退出时清理 TTS API 子进程 =====
function killTtsApi() {
  if (ttsApiProc) {
    try { ttsApiProc.kill(); } catch (e) {}
    ttsApiProc = null;
  }
}
process.on('exit', killTtsApi);
process.on('SIGINT', () => { killTtsApi(); process.exit(0); });
process.on('SIGTERM', () => { killTtsApi(); process.exit(0); });

// ===== 主前端页面（手机自动跳转 /mobile/）=====
app.get('/', (req, res) => {
  // 手机 UA 检测：自动跳转手机版（可用 ?desktop=1 强制电脑版）
  if (mobileEnabled && !req.query.desktop) {
    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isMobile = /mobile|android|iphone|ipod|ipad|windows phone|blackberry|opera mini|iemobile/.test(ua)
      && !/tablet/.test(ua); // 平板走电脑版
    if (isMobile) {
      return res.redirect(302, '/mobile/');
    }
  }
  res.sendFile(path.join(__dirname, 'website', 'index.html'));
});

// ===== 手机访问引导页 =====
app.get('/qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'website', 'qr.html'));
});

// ===== 局域网 IP 信息接口（供手机端获取连接地址）=====
app.get('/api/network', (req, res) => {
  res.json({
    success: true,
    port: PORT,
    ips: getLocalIPs(),
  });
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
spawnTtsApi();

function printStartupBanner(httpsOn) {
  const localIPs = getLocalIPs();
  console.log('═══════════════════════════════════════════');
  console.log('  灵山胜境AI数字人导游系统 v2.0');
  console.log('  一体化服务器已启动');
  console.log('───────────────────────────────────────────');
  console.log('  本机访问:');
  console.log(`    主页面:   http://localhost:${PORT}/`);
  if (httpsOn) console.log(`    安全访问: https://localhost:${HTTPS_PORT}/`);
  console.log(`    管理后台: http://localhost:${PORT}/admin`);
  console.log(`    数据大屏: http://localhost:${PORT}/admin/visualization`);
  if (simulatorEnabled) console.log(`    手机模拟: http://localhost:${PORT}/simulator/  (电脑端演示手机版)`);
  if (localIPs.length > 0) {
    console.log('───────────────────────────────────────────');
    console.log('  手机/局域网访问 (手机需连同一WiFi):');
    localIPs.forEach(({ name, address }) => {
      console.log(`    [${name}]  电脑版: http://${address}:${PORT}/`);
      if (httpsOn) console.log(`    [${name}]  电脑版(Https): https://${address}:${HTTPS_PORT}/`);
      if (mobileEnabled) {
        console.log(`    [${name}]  手机版: http://${address}:${PORT}/mobile/`);
        if (httpsOn) console.log(`    [${name}]  手机版(Https): https://${address}:${HTTPS_PORT}/mobile/`);
      }
    });
    console.log(`  扫码安装:  http://localhost:${PORT}/qr`);
  }
  console.log('───────────────────────────────────────────');
  console.log(`  API 健康:  http://localhost:${PORT}/api/health`);
  const ttsStatus = !ttsConfigured ? '未启用（GPT-SoVITS 未找到）'
    : ttsApiReady ? '已就绪（HTTP API + 预热完成）'
    : '启动中（模型加载 + 预热，约 1-2 分钟）';
  console.log(`  TTS 状态:  ${ttsStatus}`);
  if (!httpsOn) {
    console.log('───────────────────────────────────────────');
    console.log('  ⚠️  HTTPS 未启用：AR 摄像头/定位需要 HTTPS 或 localhost');
  }
  console.log('═══════════════════════════════════════════');
}

app.listen(PORT, '0.0.0.0', () => {
  if (sslEnabled) {
    try {
      const sslOptions = { key: fs.readFileSync(SSL_KEY), cert: fs.readFileSync(SSL_CERT) };
      https.createServer(sslOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
        printStartupBanner(true);
      });
      return;
    } catch (e) {
      console.warn('[HTTPS] 启动失败，回退到 HTTP:', e.message);
    }
  }
  printStartupBanner(false);
});
