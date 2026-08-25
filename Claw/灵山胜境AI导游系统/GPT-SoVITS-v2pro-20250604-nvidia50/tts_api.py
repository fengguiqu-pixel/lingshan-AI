# -*- coding: utf-8 -*-
"""
tts_api.py — GPT-SoVITS HTTP API 服务（替代 tts_worker.py 的 stdin/stdout 管道协议）

架构对齐"桌面灵"验证过的方案：
  - HTTP 常驻服务，模型常驻显存
  - GET  /health — 健康检查（模型加载完成后才监听端口，能响应即为就绪）
  - POST /tts    — {"text": "...", "text_lang": "zh", "speed": 1.0} → audio/wav
  - 推理串行化（threading.Lock），GPU 单卡不被并发请求踩踏

由 lingshan-ai-guide/server.js 自动拉起并管理生命周期，
父进程通过 HTTP 调用（带超时），彻底消灭 stdin/stdout 死锁问题。
"""
import sys, os, io, threading

# 工作空间基础路径 - 所有缓存和临时文件都放在 D 盘工作空间内，绝不写入 C 盘
_WORKSPACE = r"D:\lingshandaolan_live2d1\Claw\灵山胜境AI导游系统"
_GPT_DIR = os.path.dirname(os.path.abspath(__file__))

# 必须在 import 任何库之前设置所有缓存路径
os.environ["TQDM_DISABLE"] = "1"
os.environ["BROWSER"] = "none"
os.environ["PYTHONIOENCODING"] = "utf-8"

# numba 缓存
os.environ["NUMBA_CACHE_DIR"] = os.path.join(_GPT_DIR, "numba_cache")
os.environ["NUMBA_DISABLE_JIT_WARNINGS"] = "1"

# NLTK 数据
os.environ["NLTK_DATA"] = os.path.join(_GPT_DIR, "nltk_data")

# HuggingFace 缓存 - 模型下载/缓存重定向到工作空间
os.environ["HF_HOME"] = os.path.join(_WORKSPACE, "hf_cache")
os.environ["HF_DATASETS_CACHE"] = os.path.join(_WORKSPACE, "hf_cache", "datasets")
os.environ["TRANSFORMERS_CACHE"] = os.path.join(_WORKSPACE, "hf_cache", "transformers")
os.environ["HUGGINGFACE_HUB_CACHE"] = os.path.join(_WORKSPACE, "hf_cache", "hub")

# PyTorch 缓存
os.environ["TORCH_HOME"] = os.path.join(_WORKSPACE, "torch_cache")

# Matplotlib 缓存
os.environ["MPLCONFIGDIR"] = os.path.join(_WORKSPACE, "matplotlib_cache")

# pip 缓存（以防运行时安装）
os.environ["PIP_CACHE_DIR"] = os.path.join(_WORKSPACE, "pip_cache")

# XDG 缓存（一些库会用这个）
os.environ["XDG_CACHE_HOME"] = os.path.join(_WORKSPACE, "xdg_cache")

# 系统临时目录重定向到 D 盘（防止 pip/torch 往 C:\Users\...\Temp 写文件）
os.environ["TEMP"] = os.path.join(_WORKSPACE, "system_temp")
os.environ["TMP"] = os.path.join(_WORKSPACE, "system_temp")
os.environ["TMPDIR"] = os.path.join(_WORKSPACE, "system_temp")

# 创建所有缓存目录
for _d in [
    os.environ["NUMBA_CACHE_DIR"],
    os.environ["NLTK_DATA"],
    os.environ["HF_HOME"],
    os.environ["TORCH_HOME"],
    os.environ["MPLCONFIGDIR"],
    os.environ["PIP_CACHE_DIR"],
    os.environ["XDG_CACHE_HOME"],
    os.environ["TEMP"],
]:
    os.makedirs(_d, exist_ok=True)

# 修复 Windows 控制台中文输出
try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    sys.stdin.reconfigure(encoding='utf-8')
except Exception:
    pass

# 把库内部的 print 全部导向 stderr（HTTP 协议不再依赖 stdout，但保持日志干净）
sys.stdout = sys.stderr

import soundfile as sf
os.chdir(os.path.dirname(os.path.abspath(__file__)))
# 优先加载 python_libs 里的 CUDA 版 torch（覆盖系统 CPU 版）
sys.path.insert(0, "python_libs")
sys.path.insert(0, ".")
sys.path.insert(0, "GPT_SoVITS")

# 显式添加 NLTK 数据路径（避免 g2p_en 尝试联网下载）
try:
    import nltk as _nltk
    _nltk_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nltk_data")
    if _nltk_data not in _nltk.data.path:
        _nltk.data.path.insert(0, _nltk_data)
except Exception:
    pass

# Patch torchaudio.load to use soundfile instead (torchaudio 2.11 requires torchcodec)
import torchaudio, torch
_orig_taload = torchaudio.load
def _patched_taload(filepath, **kw):
    data, sr = sf.read(filepath, dtype='float32')
    return torch.from_numpy(data).T if len(data.shape) > 1 else torch.from_numpy(data).unsqueeze(0), sr
torchaudio.load = _patched_taload

# Monkey-patch: replace from_pretrained to pass proxies/resume_download to _from_pretrained
import huggingface_hub.hub_mixin as hbm
_orig_fp = hbm.PyTorchModelHubMixin.from_pretrained
@classmethod
def _patched_fp(cls, pretrained_model_name_or_path, *, force_download=False, resume_download=False,
                proxies=None, token=None, cache_dir=None, local_files_only=False, revision=None, **model_kwargs):
    return cls._from_pretrained(
        model_id=pretrained_model_name_or_path, revision=revision, cache_dir=cache_dir,
        force_download=force_download, local_files_only=local_files_only, token=token,
        proxies=proxies, resume_download=resume_download, **model_kwargs)
hbm.PyTorchModelHubMixin.from_pretrained = _patched_fp

# Monkey-patch: x_transformers RotaryEmbedding 缺少 forward_from_seq_len 方法（版本不兼容）
try:
    from x_transformers.x_transformers import RotaryEmbedding as _RotaryEmb
    if not hasattr(_RotaryEmb, 'forward_from_seq_len'):
        _RotaryEmb.forward_from_seq_len = lambda self, seq_len, device=None: self.forward(seq_len)
except Exception:
    pass

from TTS_infer_pack.TTS import TTS, TTS_Config

print("[tts_api] 正在加载模型（约 1-2 分钟）...", flush=True)
device = "cuda" if torch.cuda.is_available() else "cpu"
is_half = device == "cuda"
config = TTS_Config({
    "custom": {
        "version": "v3",
        "t2s_weights_path": "GPT_weights_v3/March7th_v3-e15.ckpt",
        "vits_weights_path": "SoVITS_weights_v3/March7th_v3_e2_s200.pth",
        "cnhuhbert_base_path": "GPT_SoVITS/pretrained_models/chinese-hubert-base",
        "bert_base_path": "GPT_SoVITS/pretrained_models/chinese-roberta-wwm-ext-large",
        "device": device,
        "is_half": is_half,
    }
})
tts = TTS(config)
if device == "cpu":
    tts.bert_model = tts.bert_model.float()
    tts.cnhuhbert_model = tts.cnhuhbert_model.float()
tts.set_ref_audio("TEMP/march7_ref_audio/ref_audio.wav")
print(f"[tts_api] 模型加载完成 device={device} is_half={is_half}", flush=True)

REF_PROMPT = {"prompt_text": "太卜大人，早哇，今天的工作还顺利吗？", "prompt_lang": "zh"}
REF_AUDIO = "TEMP/march7_ref_audio/ref_audio.wav"

# GPU 推理串行锁：FastAPI 同步端点跑在线程池里，必须保证同一时刻只有一次推理
_infer_lock = threading.Lock()

from fastapi import FastAPI
from fastapi.responses import Response, JSONResponse

app = FastAPI(title="Lingshan TTS API", docs_url=None, redoc_url=None)

@app.get("/health")
def health():
    return {"status": "ok", "model": "March7th_v3", "device": device}

@app.post("/tts")
def tts_endpoint(payload: dict):
    text = (payload.get("text") or "").strip()
    if not text:
        return JSONResponse(status_code=400, content={"error": "Missing text parameter"})
    text_lang = payload.get("text_lang", "zh")
    try:
        speed = float(payload.get("speed", 1.0))
    except (TypeError, ValueError):
        speed = 1.0
    try:
        with _infer_lock:
            sr, audio = next(tts.run({
                "text": text,
                "text_lang": text_lang,
                "ref_audio_path": REF_AUDIO,
                **REF_PROMPT,
                "top_k": 15, "top_p": 1, "temperature": 1,
                "speed_factor": speed,
                "text_split_method": "cut5",
                "streaming_mode": False, "return_fragment": False,
            }))
        buf = io.BytesIO()
        sf.write(buf, audio, sr, format="WAV")
        return Response(content=buf.getvalue(), media_type="audio/wav")
    except Exception as e:
        print(f"[tts_api] 合成失败: {e}", flush=True)
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("TTS_API_PORT", "9880"))
    print(f"[tts_api] HTTP 服务启动 http://127.0.0.1:{port} (POST /tts, GET /health)", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)
