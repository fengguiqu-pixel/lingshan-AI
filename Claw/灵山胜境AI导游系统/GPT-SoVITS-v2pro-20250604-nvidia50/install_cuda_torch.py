#!/usr/bin/env python
"""安装 CUDA torch 到 python_libs 目录，所有缓存和临时文件都在工作空间内"""
import os
import sys
import subprocess

# 工作空间基础路径
BASE = r"D:\workbuddyplace\Claw\灵山胜境AI导游系统"
GPT_DIR = os.path.join(BASE, "GPT-SoVITS-v2pro-20250604-nvidia50")
PIP_CACHE = os.path.join(BASE, "pip_cache")
PIP_TEMP = os.path.join(BASE, "pip_temp")

# 创建目录
os.makedirs(PIP_CACHE, exist_ok=True)
os.makedirs(PIP_TEMP, exist_ok=True)

# 设置环境变量 - 所有缓存和临时文件都重定向到 D 盘工作空间
os.environ["PIP_CACHE_DIR"] = PIP_CACHE
os.environ["TEMP"] = PIP_TEMP
os.environ["TMP"] = PIP_TEMP
os.environ["TMPDIR"] = PIP_TEMP
os.environ["HF_HOME"] = os.path.join(BASE, "hf_cache")
os.environ["TORCH_HOME"] = os.path.join(BASE, "torch_cache")
os.environ["MPLCONFIGDIR"] = os.path.join(BASE, "matplotlib_cache")

PYTHON = r"D:\python\python.exe"
TARGET = os.path.join(GPT_DIR, "python_libs")

print("=" * 60)
print("安装 CUDA torch 到工作空间 python_libs")
print(f"  Python: {PYTHON}")
print(f"  Target: {TARGET}")
print(f"  Cache:  {PIP_CACHE}")
print(f"  Temp:   {PIP_TEMP}")
print("=" * 60)

# 安装 CUDA torch
cmd = [
    PYTHON, "-m", "pip", "install",
    "--target", TARGET,
    "--cache-dir", PIP_CACHE,
    "--timeout", "120",
    "--retries", "5",
    "--no-cache-dir",  # 不使用 pip 全局缓存，直接下载安装
    "torch==2.13.0+cu126",
    "--index-url", "https://download.pytorch.org/whl/cu126",
]

print(f"\n运行命令: {' '.join(cmd)}\n")
result = subprocess.run(cmd, env=os.environ.copy())
print(f"\n退出码: {result.returncode}")

if result.returncode == 0:
    print("\n✅ CUDA torch 安装成功！")
    # 验证
    sys.path.insert(0, TARGET)
    try:
        import torch
        print(f"  torch version: {torch.__version__}")
        print(f"  CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"  CUDA device: {torch.cuda.get_device_name(0)}")
            print(f"  CUDA version: {torch.version.cuda}")
    except Exception as e:
        print(f"  验证失败: {e}")
else:
    print("\n❌ CUDA torch 安装失败！")
    sys.exit(1)
