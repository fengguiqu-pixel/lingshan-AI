@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo  灵山胜境 AI数字人导游系统 - 本地服务器
echo ========================================
echo.
echo 访问地址: http://localhost:3000
echo.
echo 首次启动需加载 TTS 模型（约 2 分钟），请耐心等待
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.
node server.js
pause
