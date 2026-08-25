const BASE = 'http://localhost:3000';
async function test(label, text) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, character: '三月七' }),
    signal: AbortSignal.timeout(45000),
  });
  const ms = Date.now() - t0;
  if (!r.ok) {
    console.log(`${label}: HTTP ${r.status} (${ms}ms) —`, await r.text());
    return;
  }
  const buf = Buffer.from(await r.arrayBuffer());
  const isWav = buf.subarray(0, 4).toString('ascii') === 'RIFF';
  console.log(`${label}: HTTP 200 (${(ms / 1000).toFixed(1)}s), ${(buf.length / 1024).toFixed(0)}KB, WAV头=${isWav}`);
}
// 用户第一句话（预热后，应直接命中热状态）
await test('端到端·第一句话（预热后）', '欢迎来到灵山胜境，我是您的AI导游小灵。');
await test('端到端·中英混合', 'AR实景导航功能已开启，请查看屏幕上的路线指引。');
await test('端到端·长句', '灵山大佛通高八十八米，是神州大地上最大的青铜佛像之一，也是无锡的城市地标。');
