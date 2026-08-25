// 预合成欢迎语音：合成 3 个候选版本，挑语速正常（时长最短）的保存为 welcome.wav
import fs from 'fs';

const API = 'http://127.0.0.1:9880/tts';
const OUT = 'D:/lingshandaolan_live2d1/lingshan-ai-guide/website/audio/prebuilt/welcome.wav';
const TEXT = '您好！我是小灵，很高兴为您服务！';

function wavDuration(buf) {
  // 解析 WAV 头计算时长（秒）
  const dataPos = buf.indexOf('data', 8, 'ascii');
  if (dataPos < 0) return null;
  const dataLen = buf.readUInt32LE(dataPos + 4);
  const fmtPos = buf.indexOf('fmt ', 8, 'ascii');
  const byteRate = buf.readUInt32LE(fmtPos + 16);
  if (!byteRate) return null;
  return dataLen / byteRate;
}

async function synth() {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: TEXT, text_lang: 'zh', speed: 1.0 }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return Buffer.from(await r.arrayBuffer());
}

const candidates = [];
for (let i = 0; i < 3; i++) {
  const buf = await synth();
  const dur = wavDuration(buf);
  console.log(`候选 ${i + 1}: ${(buf.length / 1024).toFixed(0)}KB, 时长 ${dur.toFixed(2)}s`);
  candidates.push({ buf, dur });
}

// 挑时长最短的（语速最正常、最不容易拖沓的版本）
candidates.sort((a, b) => a.dur - b.dur);
const best = candidates[0];
console.log(`\n选中版本: 时长 ${best.dur.toFixed(2)}s（3 个候选中最快）`);

fs.writeFileSync(OUT, best.buf);
console.log('已保存:', OUT);

// 校验 WAV 头
const saved = fs.readFileSync(OUT);
console.log('RIFF =', saved.subarray(0, 4).toString('ascii'),
  '| WAVE =', saved.subarray(8, 12).toString('ascii'),
  '| 时长 =', wavDuration(saved).toFixed(2) + 's');
