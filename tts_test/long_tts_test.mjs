const BASE = 'http://localhost:3000';

const longText = '灵山大佛通高八十八米，是神州大地上最大的青铜佛像之一，也是无锡的城市地标。如果您想更直观地感受它的雄伟，可以沿着二幺八级登云道拾级而上，登顶还能俯瞰太湖全景，非常震撼！小灵建议您留足时间慢慢参观。';

async function test(label, text) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(120000),
    });
    const ms = Date.now() - t0;
    if (!r.ok) {
      console.log(`${label}: HTTP ${r.status} (${ms}ms) —`, await r.text());
      return;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    const isWav = buf.subarray(0, 4).toString('ascii') === 'RIFF';
    console.log(`${label}: HTTP 200 (${ms}ms), ${(buf.length / 1024).toFixed(0)}KB, WAV头=${isWav}`);
  } catch (e) {
    console.log(`${label}: 失败 (${Date.now() - t0}ms) —`, e.name, e.message);
  }
}

await test('长文本（模拟第二次聊天）', longText);
await test('短文本（对比）', '欢迎来到灵山胜境，我是小灵。');
