# 灵山胜境AI数字人导游系统 - 项目记忆

## 项目结构
- **主目录**: `D:\lingshandaolan_live2d1`
- **Web服务**: `lingshan-ai-guide/` (Node.js Express, server.js, 用 runtime/node.exe 启动)
- **TTS引擎**: `Claw/灵山胜境AI导游系统/GPT-SoVITS-v2pro-20250604-nvidia50/` (Python, **tts_api.py** — HTTP API, 2026-08-21 起; 旧 tts_worker.py 已弃用但保留)
- **Live2D模型**: `lingshan-ai-guide/website/live2d-models/ling/` (ling.model3.json, ParamMouthOpenY)
- **数据库**: `data/` (1个 .db 文件)

## TTS 架构 (2026-08-21 重构, 对齐桌面灵方案)
- `tts_api.py`: FastAPI + uvicorn, 监听 `127.0.0.1:9880`, 由 server.js 自动 spawn 管理
  - `GET /health` 健康检查; `POST /tts` (text/text_lang/speed) → WAV
  - 复用旧 worker 的环境重定向 + 3 个 monkey-patch (torchaudio.load/hub_mixin/x_transformers)
  - threading.Lock 串行化 GPU 推理
- server.js: 健康检查通过后预热"嗯。"一句 → ttsApiReady; 每请求 **120s** 硬超时→504
- 模型加载期间 /api/tts 返回 503+fallback 快速失败; API 崩溃自动重启 (最多3次)
- 前端 speakTTS: 新请求 abort 旧请求 + **130s** 前端超时
- **预合成音频**: AI导游页 5 个快捷问题已预合成 WAV (`website/audio/prebuilt/q0~q4.wav`), 点击直接播放, 不走实时 TTS
- 可配环境变量: TTS_API_PORT / TTS_TIMEOUT_MS / TTS_STARTUP_TIMEOUT_MS

## 关键配置
- Python: `GPT-SoVITS.../venv/Scripts/python.exe` (venv, Python 3.13.10, system-site-packages=true)
- GPT模型: `GPT_weights_v3/March7th_v3-e15.ckpt` (三月七声音)
- SoVITS模型: `SoVITS_weights_v3/March7th_v3_e2_s200.pth`
- 参考音频: `TEMP/march7_ref_audio/ref_audio.wav`
- 设备: GPU模式 (torch 2.13.0+cu126, CUDA 12.6), 单句合成约3-6秒
- TTS API: POST `/api/tts` → 返回 audio/wav
- venv 已补装: wordsegment, g2p_en (中英混合文本必需); nltk_data 已含 averaged_perceptron_tagger_eng

## 口型同步方案
- Web Audio API: `MediaElementSource → AnalyserNode → destination`
- `getAudioAmplitude()` 读取 RMS 振幅 → 驱动 `ParamMouthOpenY`
- 回退: TTS等待期间用 0.4x 正弦波, 音频播放后切换真实振幅
- 参数: speakParamValue=0.6, pollInterval=50ms, smoothFactor=0.15

## 已知问题
- pip.ini 已修复编码 (改用 ASCII 路径 `C:\Users\18418\AppData\Local\pip\cache`)
- numba 缓存问题需设置 `NUMBA_CACHE_DIR`
- GPU: NVIDIA GeForce RTX 4060 Laptop, 8GB VRAM, 模型占 2.5GB (FP16)
- pip 下载 CUDA torch 慢, 建议用 curl 直接下载 wheel 到工作区再 pip install --no-deps

## 技术栈
- 前端: Live2D Cubism SDK + 原生 JS
- 后端: Node.js Express (SSL, 静态文件, TTS 代理)
- TTS: GPT-SoVITS v2pro (HTTP API: server.js → tts_api.py FastAPI → GPU 推理)
