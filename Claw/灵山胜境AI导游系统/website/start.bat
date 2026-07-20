@echo off
chcp 65001 >nul 2>&1
title 灵山胜境AI导游系统 - TTS服务器

echo ============================================================
echo   灵山胜境AI导游系统 - 启动脚本
echo ============================================================
echo.

:: 切换到 website 目录
cd /d "%~dp0"

:: 设置工作空间路径
set "WORKSPACE=%~dp0.."
set "GSV_DIR=%WORKSPACE%\GPT-SoVITS-v2pro-20250604-nvidia50"

:: ============================================================
:: 所有缓存和临时文件都重定向到 D 盘工作空间，绝不写入 C 盘
:: ============================================================
set "HF_HOME=%WORKSPACE%\hf_cache"
set "HF_DATASETS_CACHE=%WORKSPACE%\hf_cache\datasets"
set "TRANSFORMERS_CACHE=%WORKSPACE%\hf_cache\transformers"
set "HUGGINGFACE_HUB_CACHE=%WORKSPACE%\hf_cache\hub"
set "TORCH_HOME=%WORKSPACE%\torch_cache"
set "MPLCONFIGDIR=%WORKSPACE%\matplotlib_cache"
set "PIP_CACHE_DIR=%WORKSPACE%\pip_cache"
set "XDG_CACHE_HOME=%WORKSPACE%\xdg_cache"
set "NUMBA_CACHE_DIR=%GSV_DIR%\numba_cache"
set "NLTK_DATA=%GSV_DIR%\nltk_data"
set "PYTHONIOENCODING=utf-8"

:: 创建缓存目录（如果不存在）
if not exist "%HF_HOME%" mkdir "%HF_HOME%"
if not exist "%TORCH_HOME%" mkdir "%TORCH_HOME%"
if not exist "%MPLCONFIGDIR%" mkdir "%MPLCONFIGDIR%"
if not exist "%PIP_CACHE_DIR%" mkdir "%PIP_CACHE_DIR%"
if not exist "%NUMBA_CACHE_DIR%" mkdir "%NUMBA_CACHE_DIR%"

:: 检查 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 16+
    pause
    exit /b 1
)

:: 检查 GPT-SoVITS 目录
if not exist "%GSV_DIR%\tts_worker.py" (
    echo [错误] 未找到 GPT-SoVITS TTS worker: %GSV_DIR%\tts_worker.py
    pause
    exit /b 1
)

:: 检查权重文件
if not exist "%GSV_DIR%\GPT_weights_v3\March7th_v3-e15.ckpt" (
    echo [错误] 未找到 GPT 权重: March7th_v3-e15.ckpt
    pause
    exit /b 1
)
if not exist "%GSV_DIR%\SoVITS_weights_v3\March7th_v3_e2_s200.pth" (
    echo [错误] 未找到 SoVITS 权重: March7th_v3_e2_s200.pth
    pause
    exit /b 1
)

echo [OK] Node.js 已就绪
echo [OK] GPT-SoVITS 目录: %GSV_DIR%
echo [OK] 权重文件已确认
echo [OK] 缓存目录: %WORKSPACE%\*_cache
echo.

:: 检查 Python
set "PYTHON_PATH=D:\python\python.exe"
if not exist "%PYTHON_PATH%" (
    echo [警告] 系统 Python 不在 D:\python\python.exe
    echo        尝试使用 PATH 中的 python...
    set "PYTHON_PATH=python"
)

:: 检查 CUDA torch 是否安装
echo 正在检查 GPU 支持...
"%PYTHON_PATH%" -c "import sys; sys.path.insert(0, r'%GSV_DIR%\python_libs'); import torch; print('torch:', torch.__version__); print('CUDA:', '可用' if torch.cuda.is_available() else '不可用'); print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else '无')" 2>nul
if errorlevel 1 (
    echo [警告] 无法加载 CUDA torch，将使用 CPU 模式
    echo        如需 GPU 加速，请运行: %GSV_DIR%\install_cuda_torch.py
)
echo.

echo Python: %PYTHON_PATH%
echo.

:: 启动服务器
echo 正在启动服务器...
echo 首次启动需要加载 TTS 模型（约 15-30 秒 GPU / 30-90 秒 CPU），请耐心等待。
echo 启动完成后请在浏览器访问: http://localhost:3000
echo.
echo 按 Ctrl+C 可停止服务器
echo ============================================================
echo.

node server.js

pause
