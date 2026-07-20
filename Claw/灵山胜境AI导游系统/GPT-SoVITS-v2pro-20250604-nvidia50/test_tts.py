"""测试 tts_worker.py 能否正常加载模型并生成语音"""
import sys, os, json, struct, time

# 工作空间基础路径 - 所有缓存和临时文件都放在 D 盘工作空间内，绝不写入 C 盘
_WORKSPACE = r"D:\workbuddyplace\Claw\灵山胜境AI导游系统"
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

# HuggingFace 缓存 - 重定向到工作空间
os.environ["HF_HOME"] = os.path.join(_WORKSPACE, "hf_cache")
os.environ["HF_DATASETS_CACHE"] = os.path.join(_WORKSPACE, "hf_cache", "datasets")
os.environ["TRANSFORMERS_CACHE"] = os.path.join(_WORKSPACE, "hf_cache", "transformers")
os.environ["HUGGINGFACE_HUB_CACHE"] = os.path.join(_WORKSPACE, "hf_cache", "hub")

# PyTorch 缓存
os.environ["TORCH_HOME"] = os.path.join(_WORKSPACE, "torch_cache")

# Matplotlib 缓存
os.environ["MPLCONFIGDIR"] = os.path.join(_WORKSPACE, "matplotlib_cache")

# pip 缓存
os.environ["PIP_CACHE_DIR"] = os.path.join(_WORKSPACE, "pip_cache")

# XDG 缓存
os.environ["XDG_CACHE_HOME"] = os.path.join(_WORKSPACE, "xdg_cache")

# 系统临时目录重定向到 D 盘（防止往 C:\Users\...\Temp 写文件）
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

# 切换到 GPT-SoVITS 目录
GSV_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(GSV_DIR)
# 优先加载 python_libs 里的 CUDA 版 torch（覆盖系统 CPU 版）
sys.path.insert(0, "python_libs")
sys.path.insert(0, ".")
sys.path.insert(0, "GPT_SoVITS")

# 修复 Windows 控制台中文输出
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# 显式添加 NLTK 数据路径（避免 g2p_en 尝试联网下载）
try:
    import nltk as _nltk
    _nltk_data = os.path.join(GSV_DIR, "nltk_data")
    if _nltk_data not in _nltk.data.path:
        _nltk.data.path.insert(0, _nltk_data)
except Exception:
    pass

# Monkey-patch: x_transformers RotaryEmbedding 缺少 forward_from_seq_len 方法（版本不兼容）
try:
    from x_transformers.x_transformers import RotaryEmbedding as _RotaryEmb
    if not hasattr(_RotaryEmb, 'forward_from_seq_len'):
        _RotaryEmb.forward_from_seq_len = lambda self, seq_len, device=None: self.forward(seq_len)
except Exception:
    pass

print("=" * 60)
print("TTS Worker 独立测试")
print("=" * 60)

# 1. 检查 Python 和 torch
import torch
print(f"[1/5] Python: {sys.version.split()[0]}")
print(f"      torch: {torch.__version__}")
print(f"      CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"      CUDA device: {torch.cuda.get_device_name(0)}")
    print(f"      CUDA version: {torch.version.cuda}")
else:
    print("      [警告] CUDA 不可用，将使用 CPU（非常慢）")

# 2. 检查权重文件
gpt_path = "GPT_weights_v3/March7th_v3-e15.ckpt"
sovits_path = "SoVITS_weights_v3/March7th_v3_e2_s200.pth"
ref_audio = "TEMP/march7_ref_audio/ref_audio.wav"

for p in [gpt_path, sovits_path, ref_audio]:
    if os.path.exists(p):
        size_mb = os.path.getsize(p) / 1024 / 1024
        print(f"[2/5] 权重存在: {p} ({size_mb:.1f} MB)")
    else:
        print(f"[2/5] [错误] 权重缺失: {p}")
        sys.exit(1)

# 3. 加载 TTS 模型
print("[3/5] 正在加载 TTS 模型（约 30-90 秒）...")
t0 = time.time()

import soundfile as sf
import torchaudio
# Patch torchaudio.load（避免 torchcodec 依赖）
_orig_taload = torchaudio.load
def _patched_taload(filepath, **kw):
    data, sr = sf.read(filepath, dtype='float32')
    return torch.from_numpy(data).T if len(data.shape) > 1 else torch.from_numpy(data).unsqueeze(0), sr
torchaudio.load = _patched_taload

# Patch huggingface_hub
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

from TTS_infer_pack.TTS import TTS, TTS_Config

device = "cuda" if torch.cuda.is_available() else "cpu"
is_half = device == "cuda"
config = TTS_Config({
    "custom": {
        "version": "v3",
        "t2s_weights_path": gpt_path,
        "vits_weights_path": sovits_path,
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
tts.set_ref_audio(ref_audio)

t1 = time.time()
print(f"      模型加载完成，耗时 {t1-t0:.1f} 秒")

# 4. 生成语音
test_text = "您好，我是小灵，灵山胜境AI数字人导游，很高兴为您服务。"
print(f"[4/5] 生成语音: {test_text}")

REF_PROMPT = {"prompt_text": "太卜大人，早哇，今天的工作还顺利吗？", "prompt_lang": "zh"}

t0 = time.time()
sr, audio = next(tts.run({
    "text": test_text,
    "text_lang": "zh",
    "ref_audio_path": ref_audio,
    **REF_PROMPT,
    "top_k": 15, "top_p": 1, "temperature": 1,
    "text_split_method": "cut5",
    "streaming_mode": False, "return_fragment": False,
}))
t1 = time.time()
print(f"      语音生成完成，耗时 {t1-t0:.1f} 秒，采样率 {sr}，长度 {len(audio)} 样本")

# 5. 保存 wav
output_path = "test_tts_output.wav"
import io
buf = io.BytesIO()
sf.write(buf, audio, sr, format="WAV")
with open(output_path, "wb") as f:
    f.write(buf.getvalue())
print(f"[5/5] 已保存测试音频: {output_path} ({len(buf.getvalue())} 字节)")
print("")
print("=" * 60)
print("测试成功！TTS worker 可以正常工作。")
print("=" * 60)
