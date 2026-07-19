@echo off
chcp 65001 >nul 2>&1
pushd "%~dp0"
echo ========================================
echo  灵山胜境 AI数字人导游系统
echo ========================================
echo.
where node >nul 2>&1 || (echo [错误] 未找到 Node.js ^& pause ^& exit /b 1)
echo 清理残留进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo 启动服务器...
start /B /MIN "" node server.js
timeout /t 4 /nobreak >nul
start http://localhost:3000
echo.
echo 浏览器已打开，首次加载模型需要 1-2 分钟
echo ========================================
pause
