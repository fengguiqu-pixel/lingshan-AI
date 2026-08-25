const BASE = 'http://127.0.0.1:9880';
async function test(label, text) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(45000),
  });
  const ms = Date.now() - t0;
  if (!r.ok) {
    console.log(`${label}: HTTP ${r.status} (${ms}ms) —`, await r.text());
    return;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const isWav = buf.subarray(0, 4).toString('ascii') === 'RIFF';
  console.log(`${label}: HTTP 200 (${ms}ms), ${(buf.length / 1024).toFixed(0)}KB, WAV头=${isWav}`);
}
await test('冷请求（热身句 嗯。）', '嗯。');
await test('热请求（用户第一句话）', '欢迎来到灵山胜境，我是您的AI导游小灵。');
await test('第三次请求（稳定验证）', '今天天气不错，适合游览。');
