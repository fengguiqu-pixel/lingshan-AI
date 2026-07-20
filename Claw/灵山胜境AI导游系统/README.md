# 灵山胜境AI导游系统

基于 GPT-SoVITS v2pro 本地语音合成 + Live2D 数字人 + DeepSeek AI 对话的景区智能导游系统。

## 功能

- **Live2D 数字人导游**：基于"小灵"模型，支持口型同步、表情切换
- **本地 TTS 语音合成**：使用 GPT-SoVITS v2pro + 三月七音色，本地 GPU/CPU 推理
- **DeepSeek AI 对话**：集成 DeepSeek 大模型实现智能问答
- **腾讯地图集成**：景区地图展示与景点定位

## 目录结构

```
灵山胜境AI导游系统/
├── GPT-SoVITS-v2pro-20250604-nvidia50/   # TTS 引擎
│   ├── GPT_weights_v3/March7th_v3-e15.ckpt       # GPT t2s 权重
│   ├── SoVITS_weights_v3/March7th_v3_e2_s200.pth # SoVITS vits 权重
│   ├── GPT_SoVITS/pretrained_models/              # 预训练模型
│   ├── TEMP/march7_ref_audio/ref_audio.wav        # 参考音频
│   ├── python_libs/                               # 额外 Python 依赖
│   ├── tts_worker.py                              # TTS Worker 进程
│   └── test_tts.py                                # 独立测试脚本
├── website/                               # Web 前端 + 服务器
│   ├── index.html                         # 主页面
│   ├── css/style.css                      # 样式
│   ├── js/app.js                          # 主应用逻辑
│   ├── js/live2d-integration.js           # Live2D 集成
│   ├── js/data.js                         # 景点数据
│   ├── server.js                          # Node.js HTTP 服务器
│   ├── start.bat                          # Windows 启动脚本
│   ├── live2d-models/ling/                # Live2D 模型
│   └── vendor/cubism/                     # Live2D Cubism SDK
└── README.md
```

## 快速开始

### 1. 环境要求

- **Node.js** 16+（用于 Web 服务器）
- **Python** 3.13+（用于 TTS 推理），需安装以下包：
  - torch, torchaudio, transformers, peft, pytorch_lightning
  - soundfile, librosa, numba, numpy, scipy
  - cn2an, pypinyin, jieba, jieba_fast
  - LangSegment, wordlevel
- **NVIDIA GPU**（可选，推荐 RTX 3060+ 8GB 显存）
  - 有 GPU 时使用 CUDA 加速推理，延迟约 1-3 秒/句
  - 无 GPU 时使用 CPU 推理，延迟约 10-30 秒/句

### 2. 启动服务

**Windows:**
```bat
cd website
start.bat
```

**手动启动:**
```bash
cd website
node server.js
```

### 3. 访问

浏览器打开 http://localhost:3000

## 架构说明

### TTS 工作流

1. 浏览器前端发送文本到 `/api/tts`
2. `server.js` 将请求转发给 `tts_worker.py`（通过 stdin/stdout 管道）
3. `tts_worker.py` 使用 GPT-SoVITS 模型合成语音
4. WAV 音频以二进制帧格式返回（4字节长度前缀 + WAV 数据）
5. 前端播放音频并驱动 Live2D 口型同步

### TTS Worker 通信协议

- **输入**：JSON 行 `{"text": "要合成的文本", "text_language": "zh"}`
- **输出**：二进制帧 `<4字节小端长度><WAV数据>` 或 `<0x00000000><JSON错误信息>`

## 配置

### DeepSeek API

在 `js/app.js` 中配置：
```javascript
const DEEPSEEK_CONFIG = {
    apiKey: 'your-api-key',
    apiUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat'
};
```

### TTS 音色

在 `tts_worker.py` 中配置参考音频和提示文本：
```python
REF_PROMPT = {"prompt_text": "太卜大人，早哇，今天的工作还顺利吗？", "prompt_lang": "zh"}
# 参考音频: TEMP/march7_ref_audio/ref_audio.wav
```

## 故障排除

### TTS worker 启动失败

1. 运行 `python test_tts.py` 检查模型是否能正常加载
2. 查看 `website/tts.log` 排查错误
3. 确保 Python 和所有依赖已正确安装

### CUDA 不可用（使用 CPU）

系统会自动回退到 CPU 模式。如需启用 GPU 加速：

1. 运行 CUDA torch 安装脚本（所有文件都安装到工作空间内，不写入 C 盘）：
   ```bat
   cd GPT-SoVITS-v2pro-20250604-nvidia50
   D:\python\python.exe install_cuda_torch.py
   ```
2. 确保 NVIDIA 驱动已安装且支持 CUDA 12.x
3. 安装完成后，`python_libs/torch/` 会包含 CUDA 版 torch，优先于系统 CPU 版加载
4. 重启服务器即可使用 GPU 推理

### 缓存路径（全部在 D 盘工作空间内）

为避免占用 C 盘空间，所有缓存和临时文件都已重定向到工作空间：

| 环境变量 | 路径 | 用途 |
|----------|------|------|
| `HF_HOME` | `hf_cache/` | HuggingFace 模型缓存 |
| `TORCH_HOME` | `torch_cache/` | PyTorch 模型缓存 |
| `MPLCONFIGDIR` | `matplotlib_cache/` | Matplotlib 配置 |
| `PIP_CACHE_DIR` | `pip_cache/` | pip 下载缓存 |
| `XDG_CACHE_HOME` | `xdg_cache/` | 通用 XDG 缓存 |
| `NUMBA_CACHE_DIR` | `GPT-SoVITS.../numba_cache/` | numba JIT 编译缓存 |
| `NLTK_DATA` | `GPT-SoVITS.../nltk_data/` | NLTK 数据文件 |

这些环境变量在 `tts_worker.py`、`server.js`、`start.bat` 中均已配置。

### Live2D 模型不显示

1. 检查 `live2d-models/ling/ling.model3.json` 是否存在
2. 检查 `vendor/cubism/` 下的 Cubism SDK 文件是否完整
3. 查看浏览器控制台是否有报错

## 技术栈

- **TTS**: GPT-SoVITS v2pro (v3 权重, 三月七音色)
- **LLM**: DeepSeek Chat API
- **数字人**: Live2D Cubism SDK 5
- **地图**: 腾讯地图 GL JSAPI
- **后端**: Node.js HTTP Server
- **前端**: 原生 HTML/CSS/JS
