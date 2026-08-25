// 获取 5 个快捷问题的 AI 回答文本（不污染用户对话历史，用空 history）
const BASE = 'http://localhost:3000';

const QUESTIONS = [
  '灵山大佛有多高？',
  '推荐一条亲子游览路线',
  '灵山梵宫有什么看点？',
  '门票多少钱？',
  '九龙灌浴几点开始？'
];

async function getAnswer(q, idx) {
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: q,
      user_id: 'prebuild_bot',
      history: [],
      preferences: '',
      interests: ''
    })
  });
  const ms = Date.now() - t0;
  if (!r.ok) throw new Error(`Q${idx} HTTP ${r.status}`);
  const data = await r.json();
  console.log(`\n=== 问题 ${idx + 1}: ${q} ===`);
  console.log(`耗时: ${ms}ms`);
  console.log(`回答: ${data.reply}`);
  return { question: q, answer: data.reply };
}

const results = [];
for (let i = 0; i < QUESTIONS.length; i++) {
  try {
    results.push(await getAnswer(QUESTIONS[i], i));
  } catch (e) {
    console.error(`Q${i + 1} 失败:`, e.message);
    results.push({ question: QUESTIONS[i], answer: '' });
  }
}

import fs from 'fs';
fs.writeFileSync('D:/lingshandaolan_live2d1/tts_test/quick_answers.json', JSON.stringify(results, null, 2), 'utf8');
console.log('\n已保存到 tts_test/quick_answers.json');
