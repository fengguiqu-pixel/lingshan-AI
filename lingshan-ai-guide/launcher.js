// 灵山AI导游启动器 — 编译为 .exe 的入口
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.dirname(process.execPath);
const NODE_EXE = path.join(APP_DIR, 'runtime', 'node.exe');
const SERVER_JS = path.join(APP_DIR, 'server.js');

// 检查文件存在
if (!fs.existsSync(NODE_EXE)) {
  console.error('[启动失败] 找不到运行时: ' + NODE_EXE);
  process.exit(1);
}
if (!fs.existsSync(SERVER_JS)) {
  console.error('[启动失败] 找不到服务器: ' + SERVER_JS);
  process.exit(1);
}

console.log('');
console.log('  ╔══════════════════════════════════╗');
console.log('  ║    灵山胜境 · AI 导游系统       ║');
console.log('  ║    Lingshan AI Tour Guide       ║');
console.log('  ╚══════════════════════════════════╝');
console.log('');
console.log('[启动] 服务器目录: ' + APP_DIR);
console.log('[启动] 正在初始化...');

// 清理可能残留的端口占用
try {
  const { execSync } = require('child_process');
  execSync('netstat -ano | findstr ":3000 " | findstr "LISTENING"', { 
    cwd: APP_DIR, timeout: 3000, stdio: 'pipe' 
  }).toString().split('\n').filter(Boolean).forEach(line => {
    const pid = line.trim().split(/\s+/).pop();
    if (pid) {
      try { execSync('taskkill /F /PID ' + pid + ' 2>nul', { cwd: APP_DIR, timeout: 2000, stdio: 'pipe' }); } catch (e) {}
    }
  });
} catch (e) { /* 没有进程占用端口 */ }

// 启动 Node.js 服务器
console.log('[启动] 正在启动服务器...');

const child = spawn(NODE_EXE, [SERVER_JS], {
  cwd: APP_DIR,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('error', (err) => {
  console.error('[错误] 无法启动服务器: ' + err.message);
  console.error('');
  console.error('请确认以下文件存在:');
  console.error('  ' + NODE_EXE);
  console.error('  ' + SERVER_JS);
  console.error('');
  console.error('按任意键退出...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(1));
});

// 3 秒后自动打开浏览器
setTimeout(() => {
  console.log('[启动] 正在打开浏览器...');
  const url = 'http://localhost:3000';
  const cmd = process.platform === 'win32' 
    ? 'start "" "' + url + '"' 
    : 'open "' + url + '"';
  exec(cmd, (err) => {
    if (err) {
      console.log('[启动] 请手动打开: ' + url);
    } else {
      console.log('[启动] 浏览器已打开!');
    }
  });
  console.log('');
  console.log('  ┌──────────────────────────────────┐');
  console.log('  │  主前端:   http://localhost:3000  │');
  console.log('  │  管理后台: http://localhost:3000/admin  │');
  console.log('  │  数据大屏: http://localhost:3000/admin/visualization  │');
  console.log('  │  关闭此窗口将停止服务            │');
  console.log('  └──────────────────────────────────┘');
  console.log('');
}, 3000);

// 等待子进程退出
child.on('exit', (code) => {
  console.log('[退出] 服务器已停止 (code: ' + code + ')');
  console.log('按任意键关闭此窗口...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(0));
  // 5 秒后自动退出
  setTimeout(() => process.exit(0), 5000);
});
