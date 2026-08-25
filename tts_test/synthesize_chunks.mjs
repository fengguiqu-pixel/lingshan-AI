// 对长回答按句切分 chunk 分别合成，再合并 WAV
import fs from 'fs';
import path from 'path';

const BASE = 'http://127.0.0.1:9880'; // 直接调 TTS API，绕过 Express 超时
const OUT_DIR = 'D:/lingshandaolan_live2d1/lingshan-ai-guide/website/audio/prebuilt';

fs.mkdirSync(OUT_DIR, { recursive: true });

function splitText(text, maxLen = 220) {
  const sentences = text.split(/([。！？\n]+)/);
  const chunks = [];
  let cur = '';
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (!s) continue;
    if ((cur + s).length > maxLen && cur.length > 0) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function synth(text, idx) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(300000)
  });
  const ms = Date.now() - t0;
  if (!r.ok) throw new Error(`HTTP ${r.status} (${ms}ms): ${await r.text()}`);
  const buf = Buffer.from(await r.arrayBuffer());
  console.log(`  chunk ${idx}: ${text.length}字 -> ${(buf.length / 1024).toFixed(0)}KB (${ms}ms)`);
  return buf;
}

function parseWav(buf) {
  let offset = 12;
  let fmt = null, dataOffset = null, dataLen = null;
  while (offset < buf.length - 8) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      fmt = buf.subarray(offset, offset + 8 + size);
    } else if (id === 'data') {
      dataOffset = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size;
    if (size % 2 === 1) offset += 1;
  }
  if (!fmt || dataOffset == null) throw new Error('Invalid WAV');
  return { fmt, dataOffset, dataLen, buf };
}

function mergeWavs(parsedList) {
  const fmt = parsedList[0].fmt;
  const totalData = parsedList.reduce((sum, p) => sum + p.dataLen, 0);
  const out = Buffer.alloc(12 + fmt.length + 8 + totalData);
  out.write('RIFF', 0);
  out.writeUInt32LE(out.length - 8, 4);
  out.write('WAVE', 8);
  fmt.copy(out, 12);
  let off = 12 + fmt.length;
  out.write('data', off);
  out.writeUInt32LE(totalData, off + 4);
  off += 8;
  for (const p of parsedList) {
    p.buf.copy(out, off, p.dataOffset, p.dataOffset + p.dataLen);
    off += p.dataLen;
  }
  return out;
}

const items = JSON.parse(fs.readFileSync('D:/lingshandaolan_live2d1/tts_test/quick_answers.json', 'utf8'));

for (let i = 0; i < items.length; i++) {
  const outPath = path.join(OUT_DIR, `q${i}.wav`);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 100000) {
    console.log(`Q${i + 1} 已存在，跳过`);
    continue;
  }
  const { question, answer } = items[i];
  console.log(`\n合成 Q${i + 1}: ${question} (${answer.length}字)`);
  const chunks = splitText(answer, 220);
  console.log(`  切分为 ${chunks.length} 段`);
  try {
    const bufs = [];
    for (let j = 0; j < chunks.length; j++) {
      bufs.push(await synth(chunks[j], j));
    }
    const parsed = bufs.map(parseWav);
    const merged = mergeWavs(parsed);
    fs.writeFileSync(outPath, merged);
    console.log(`  合并完成 -> ${outPath} (${(merged.length / 1024).toFixed(0)}KB)`);
  } catch (e) {
    console.error(`  失败: ${e.message}`);
  }
}
