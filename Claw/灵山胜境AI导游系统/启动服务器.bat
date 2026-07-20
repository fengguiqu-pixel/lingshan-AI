@echo off
chcp 65001 >nul 2>&1
pushd "%~dp0"
echo ========================================
echo  灵山胜境 AI数字人导游系统
echo ========================================
echo.
where node >nul 2>&1 || (echo [错误] 未找到 Node.js，请先安装 https://nodejs.org/ ^& pause ^& exit /b 1)
echo [1/3] 检查 Node.js... OK
echo [2/3] 清理残留进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
  taskkill /F /PID %%a >nul 2>&1
)
echo [3/3] 启动服务器...
start /B /MIN "" node "website\server.js"
timeout /t 4 /nobreak >nul
echo 正在打开浏览器...
start http://localhost:3000
echo.
echo  站点已就绪！
echo  如果浏览器未自动打开：http://localhost:3000
echo  关闭此窗口不会停止服务器
echo  停止服务器请按 Ctrl+C 或重启电脑
echo ========================================
echo.
pause
