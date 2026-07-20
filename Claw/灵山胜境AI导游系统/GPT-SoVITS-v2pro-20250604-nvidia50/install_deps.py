"""手动下载并解压 GPT-SoVITS 缺失的纯 Python 依赖到 python_libs"""
import urllib.request, tarfile, io, os, zipfile, json, sys

target = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'python_libs')
os.makedirs(target, exist_ok=True)

# 修复 Windows 控制台编码
sys.stdout.reconfigure(encoding='utf-8')

packages = ['jieba', 'pypinyin', 'wordlevel', 'LangSegment']

for pkg in packages:
    print(f'\n=== {pkg} ===')
    try:
        api_url = f'https://pypi.org/pypi/{pkg}/json'
        with urllib.request.urlopen(api_url, timeout=30) as r:
            data = json.loads(r.read())
        urls = data['urls']
        # 优先 wheel，其次 sdist
        chosen = None
        for u in urls:
            if u['packagetype'] == 'bdist_wheel':
                chosen = u
                break
        if not chosen:
            for u in urls:
                if u['packagetype'] == 'sdist':
                    chosen = u
                    break
        if not chosen:
            print(f'  No download URL found for {pkg}')
            continue
        url = chosen['url']
        print(f'  URL: {url}')
        with urllib.request.urlopen(url, timeout=120) as r:
            content = r.read()
        print(f'  Downloaded {len(content)} bytes')
        if url.endswith('.whl') or url.endswith('.zip'):
            z = zipfile.ZipFile(io.BytesIO(content))
            z.extractall(target)
            print(f'  Extracted wheel to {target}')
        elif url.endswith('.tar.gz') or url.endswith('.tgz'):
            t = tarfile.open(fileobj=io.BytesIO(content), mode='r:gz')
            members = t.getmembers()
            pkg_dir = f'{pkg}-'
            for m in members:
                if m.name.startswith(pkg_dir):
                    parts = m.name.split('/', 1)
                    if len(parts) >= 2:
                        m.name = parts[1]
                        if m.name:
                            t.extract(m, target)
            print(f'  Extracted sdist to {target}')
    except Exception as e:
        print(f'  Error: {e}')

# 验证
print('\n=== 验证安装 ===')
sys.path.insert(0, target)
for pkg in packages:
    try:
        m = __import__(pkg)
        ver = getattr(m, '__version__', '?')
        print(f'  [OK] {pkg}: {ver}')
    except ImportError as e:
        print(f'  [FAIL] {pkg}: {e}')
