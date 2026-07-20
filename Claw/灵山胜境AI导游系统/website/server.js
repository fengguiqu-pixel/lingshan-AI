const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const baseDir = __dirname;
const logPath = path.join(baseDir, 'tts.log');
function logMsg(msg) {
  try { fs.appendFileSync(logPath, msg, 'utf-8'); } catch(e) {}
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.vert': 'text/plain; charset=utf-8',
  '.frag': 'text/plain; charset=utf-8',
  '.moc3': 'application/octet-stream',
};

// Find GPT-SoVITS directory relative to this script
const gsvCandidates = [
  path.join(baseDir, '..', 'GPT-SoVITS-v2pro-20250604-nvidia50'),
  path.join(baseDir, '..', 'GPT-SoVITS'),
];
const GSV_DIR = gsvCandidates.find(d => fs.existsSync(d));

// Find python executable - prefer the one with CUDA torch installed
function findPython(gsvDir) {
  const candidates = [
    // 1. runtime 自带的 Python（如果完整的话）
    path.join(gsvDir, 'runtime', 'python.exe'),
    path.join(gsvDir, '..', 'runtime', 'python.exe'),
    // 2. 系统 Python D:\python\python.exe（已装 CUDA torch + peft）
    'D:\\python\\python.exe',
    // 3. 常见 conda 位置
    path.join(process.env.USERPROFILE || '', 'anaconda3', 'envs', 'gsv', 'python.exe'),
    path.join(process.env.USERPROFILE || '', 'miniconda3', 'envs', 'gsv', 'python.exe'),
    path.join('C:', 'ProgramData', 'anaconda3', 'envs', 'gsv', 'python.exe'),
    // 4. PATH 里的 python
    'python.exe',
  ];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) {
        console.log('[findPython] found:', c);
        return c;
      }
    } catch(e) {}
  }
  console.warn('[findPython] no python found, falling back to python.exe');
  return 'python.exe';
}

let ttsWorker = null;
let ttsQueue = [];
let ttsProcessing = false;
let workerBuf = Buffer.alloc(0);
let ttsEnabled = false;

function spawnWorker() {
  const pyPath = findPython(GSV_DIR);
  if (!fs.existsSync(GSV_DIR)) {
    console.log('GPT-SoVITS not found at', GSV_DIR, '- TTS disabled');
    return;
  }
  ttsEnabled = true;
  console.log('Starting TTS worker (python:', pyPath, ', gsv:', GSV_DIR + ')');

  // 所有缓存和临时文件都重定向到 D 盘工作空间，绝不写入 C 盘
  const WORKSPACE = path.join(baseDir, '..');
  const workerEnv = Object.assign({}, process.env, {
    HF_HOME:          path.join(WORKSPACE, 'hf_cache'),
    HF_DATASETS_CACHE: path.join(WORKSPACE, 'hf_cache', 'datasets'),
    TRANSFORMERS_CACHE: path.join(WORKSPACE, 'hf_cache', 'transformers'),
    HUGGINGFACE_HUB_CACHE: path.join(WORKSPACE, 'hf_cache', 'hub'),
    TORCH_HOME:       path.join(WORKSPACE, 'torch_cache'),
    MPLCONFIGDIR:     path.join(WORKSPACE, 'matplotlib_cache'),
    PIP_CACHE_DIR:    path.join(WORKSPACE, 'pip_cache'),
    XDG_CACHE_HOME:   path.join(WORKSPACE, 'xdg_cache'),
    NUMBA_CACHE_DIR:  path.join(GSV_DIR, 'numba_cache'),
    NLTK_DATA:        path.join(GSV_DIR, 'nltk_data'),
    PYTHONIOENCODING: 'utf-8',
  });

  ttsWorker = spawn(pyPath, ['tts_worker.py'], {
    cwd: GSV_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: workerEnv,
  });
  workerBuf = Buffer.alloc(0);
  ttsWorker.stdout.on('data', d => {
    workerBuf = Buffer.concat([workerBuf, d]);
    drainWorkerBuf();
  });
  ttsWorker.stderr.on('data', d => logMsg('[tts] ' + d));
  ttsWorker.on('exit', (code) => {
    console.error('TTS worker exited:', code);
    ttsWorker = null;
    ttsQueue.forEach(r => { try { r.res.writeHead(503); r.res.end('TTS worker died'); } catch(e){} });
    ttsQueue = [];
    ttsProcessing = false;
  });
}

function drainWorkerBuf() {
  while (workerBuf.length >= 4 && ttsQueue.length > 0) {
    const len = workerBuf.readUInt32LE(0);
    if (len > 0 && workerBuf.length < 4 + len) break;
    const { res } = ttsQueue[0];
    try {
      if (len === 0) {
        const errMsg = workerBuf.toString('utf-8', 4);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: errMsg }));
      } else {
        const wav = workerBuf.subarray(4, 4 + len);
        res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' });
        res.end(wav);
      }
    } catch(e) {
      try { res.writeHead(500); res.end('Internal error'); } catch(e2){}
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

function handleTTS(req, res) {
  if (!ttsEnabled) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ error: 'GPT-SoVITS not found', fallback: true }));
    return;
  }
  let body = '';
  req.on('data', c => { body += c });
  req.on('end', () => {
    try {
      const { text } = JSON.parse(body);
      if (!text) throw new Error('Missing text');
      ttsQueue.push({ text, res });
      processNext();
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad request: ' + e.message }));
    }
  });
}

spawnWorker();

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const cors = { 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type' };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors); res.end(); return;
  }
  if (req.method === 'POST' && urlPath === '/api/tts') {
    handleTTS(req, res); return;
  }
  let filePath = urlPath;
  if (filePath === '/') filePath = '/index.html';
  filePath = path.join(baseDir, filePath);
  const ext = path.extname(filePath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const mime = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, ...cors });
    res.end(data);
  });
}).listen(3000, () => console.log('Server running at http://localhost:3000'));
