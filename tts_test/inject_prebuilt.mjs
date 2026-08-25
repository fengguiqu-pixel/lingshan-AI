// 把 quick_answers.json 注入到 app.js 作为 PREBUILT_RESPONSES 映射
import fs from 'fs';

const APP_JS = 'D:/lingshandaolan_live2d1/lingshan-ai-guide/website/js/app.js';
const ANSWERS = JSON.parse(fs.readFileSync('D:/lingshandaolan_live2d1/tts_test/quick_answers.json', 'utf8'));

function jsString(s) {
  return JSON.stringify(s);
}

const lines = ANSWERS.map((item, idx) => {
  return `  {
    question: ${jsString(item.question)},
    answer: ${jsString(item.answer)},
    audioUrl: 'audio/prebuilt/q${idx}.wav'
  }`;
});

const block = `const PREBUILT_RESPONSES = [
${lines.join(',\n')}
];
`;

let content = fs.readFileSync(APP_JS, 'utf8');

// 如果已存在 PREBUILT_RESPONSES，先移除
const markerStart = '// ===== 预合成快捷问题回复 =====\n';
const markerEnd = '// ===== 预合成快捷问题回复结束 =====\n';
const startIdx = content.indexOf(markerStart);
if (startIdx >= 0) {
  const endIdx = content.indexOf(markerEnd, startIdx);
  if (endIdx >= 0) {
    content = content.slice(0, startIdx) + content.slice(endIdx + markerEnd.length);
  }
}

// 插入到 QUICK_QUESTIONS 后面
const insertAfter = 'const QUICK_QUESTIONS = [\n';
const insertIdx = content.indexOf(insertAfter);
if (insertIdx < 0) throw new Error('找不到 QUICK_QUESTIONS');
const bracketEnd = content.indexOf('];', insertIdx) + 2;
const fullBlock = content.slice(insertIdx, bracketEnd) + '\n\n' + markerStart + block + markerEnd;
content = content.slice(0, insertIdx) + fullBlock + content.slice(bracketEnd);

fs.writeFileSync(APP_JS, content, 'utf8');
console.log('已注入 PREBUILT_RESPONSES');
