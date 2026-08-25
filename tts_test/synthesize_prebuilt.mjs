// 把 quick_answers.json 里的回答提前合成 WAV，保存到 website/audio/prebuilt/
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:3000';
const OUT_DIR = 'D:/lingshandaolan_live2d1/lingshan-ai-guide/website/audio/prebuilt';

fs.mkdirSync(OUT_DIR, { recursive: true });

const items = JSON.parse(fs.readFileSync('D:/lingshandaolan_live2d1/tts_test/quick_answers.json', 'utf8'));

for (let i = 0; i < items.length; i++) {
  const { question, answer } = items[i];
  if (!answer) {
    console.log(`跳过 Q${i + 1}: 无回答`);
    continue;
  }
  console.log(`\n合成 Q${i + 1}: ${question} (${answer.length} 字)`);
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: answer, character: '三月七' }),
      signal: AbortSignal.timeout(180000)
    });
    const ms = Date.now() - t0;
    if (!r.ok) {
      const txt = await r.text();
      console.error(`  失败 HTTP ${r.status} (${ms}ms): ${txt.slice(0, 200)}`);
      continue;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const outPath = path.join(OUT_DIR, `q${i}.wav`);
    fs.writeFileSync(outPath, buf);
    console.log(`  成功 (${ms}ms, ${(buf.length / 1024).toFixed(0)}KB) -> ${outPath}`);
  } catch (e) {
    console.error(`  异常: ${e.message}`);
  }
}

console.log('\n全部完成');
