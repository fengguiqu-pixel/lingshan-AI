@echo off
chcp 65001 >nul 2>&1
title 灵山胜境AI数字人导游系统
color 0A

:: ===== 定位工作目录 =====
cd /d "%~dp0"

:: ===== 缓存路径全部指向 D 盘（不写 C 盘） =====
set "WORKSPACE=%~dp0"
set "HF_HOME=%WORKSPACE%hf_cache"
set "HF_DATASETS_CACHE=%WORKSPACE%hf_cache\datasets"
set "TRANSFORMERS_CACHE=%WORKSPACE%hf_cache\transformers"
set "HUGGINGFACE_HUB_CACHE=%WORKSPACE%hf_cache\hub"
set "TORCH_HOME=%WORKSPACE%torch_cache"
set "MPLCONFIGDIR=%WORKSPACE%matplotlib_cache"
set "PIP_CACHE_DIR=%WORKSPACE%pip_cache"
set "XDG_CACHE_HOME=%WORKSPACE%xdg_cache"
set "NUMBA_CACHE_DIR=%WORKSPACE%..\Claw\灵山胜境AI导游系统\GPT-SoVITS-v2pro-20250604-nvidia50\numba_cache"
set "NLTK_DATA=%WORKSPACE%..\Claw\灵山胜境AI导游系统\GPT-SoVITS-v2pro-20250604-nvidia50\nltk_data"
set "TEMP=%WORKSPACE%system_temp"
set "TMP=%WORKSPACE%system_temp"
set "TMPDIR=%WORKSPACE%system_temp"

:: ===== 创建缓存目录 =====
mkdir "%WORKSPACE%hf_cache" 2>nul
mkdir "%WORKSPACE%torch_cache" 2>nul
mkdir "%WORKSPACE%system_temp" 2>nul

:: ===== 查找 Node.js =====
set "NODE=%~dp0runtime\node.exe"
if not exist "%NODE%" (
    where node >nul 2>&1
    if %errorlevel% equ 0 (
        set "NODE=node"
    ) else (
        echo [错误] 未找到 Node.js，请安装 Node.js 或将 node.exe 放入 runtime\ 目录
        pause
        exit /b 1
    )
)

:: ===== 清理残留进程 =====
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000.*LISTENING" 2^>nul') do (
    taskkill /F /PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: ===== 启动提示 =====
echo.
echo ═══════════════════════════════════════════════
echo.
echo       灵 山 胜 境  AI 数 字 人 导 游 系 统
echo                     v2.0
echo.
echo ═══════════════════════════════════════════════
echo.
echo   [*] 正在启动服务器，请稍候...
echo   [*] 浏览器将自动打开 http://localhost:3000
echo.
echo   按 Ctrl+C 或关闭此窗口即可停止服务器
echo.

:: ===== 打开浏览器（延迟 3 秒等服务器就绪） =====
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: ===== 启动一体化服务器 =====
"%NODE%" server.js

:: ===== 服务器退出 =====
echo.
echo ═══════════════════════════════════════════════
echo   服务器已停止。
echo ═══════════════════════════════════════════════
echo.
pause
