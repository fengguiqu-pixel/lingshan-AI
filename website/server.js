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

// Find python executable
function findPython(gsvDir) {
  const candidates = [
    path.join(gsvDir, 'runtime', 'python.exe'),
    path.join(gsvDir, '..', 'runtime', 'python.exe'),
  ];
  // Try common conda locations
  const home = process.env.USERPROFILE || process.env.HOME;
  if (home) {
    candidates.push(path.join(home, 'anaconda3', 'envs', 'gsv', 'python.exe'));
    candidates.push(path.join(home, 'miniconda3', 'envs', 'gsv', 'python.exe'));
  }
  candidates.push(path.join('C:', 'ProgramData', 'anaconda3', 'envs', 'gsv', 'python.exe'));
  candidates.push('python.exe');
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

function spawnWorker() {
  const pyPath = findPython(GSV_DIR);
  if (!fs.existsSync(GSV_DIR)) {
    console.log('GPT-SoVITS not found at', GSV_DIR, '- TTS disabled');
    return;
  }
  ttsEnabled = true;
  console.log('Starting TTS worker (python:', pyPath, ', gsv:', GSV_DIR + ')');
  ttsWorker = spawn(pyPath, ['tts_worker.py'], {
    cwd: GSV_DIR,
    stdio: ['pipe', 'pipe', 'pipe']
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
