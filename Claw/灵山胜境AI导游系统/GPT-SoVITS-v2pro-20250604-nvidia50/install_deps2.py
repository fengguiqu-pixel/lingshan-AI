import sys, os
sys.stdout.reconfigure(encoding='utf-8')
print('Step 1')
target = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'python_libs')
os.makedirs(target, exist_ok=True)
print('Step 2: target =', target)

import urllib.request, json
api_url = 'https://pypi.org/pypi/jieba/json'
print('Step 3: fetching', api_url)
with urllib.request.urlopen(api_url, timeout=30) as r:
    data = json.loads(r.read())
print('Step 4: got response, urls:', len(data['urls']))
for u in data['urls']:
    print('  ', u['packagetype'], u['url'][:80])

# Download jieba sdist
chosen = None
for u in data['urls']:
    if u['packagetype'] == 'sdist':
        chosen = u
        break
url = chosen['url']
print('Step 5: downloading', url[:80])
with urllib.request.urlopen(url, timeout=120) as r:
    content = r.read()
print('Step 6: downloaded', len(content), 'bytes')

import tarfile, io
t = tarfile.open(fileobj=io.BytesIO(content), mode='r:gz')
print('Step 7: tar opened, members:', len(t.getmembers()))
for m in t.getmembers():
    if m.name.startswith('jieba-'):
        parts = m.name.split('/', 1)
        if len(parts) >= 2 and parts[1]:
            m.name = parts[1]
            t.extract(m, target)
print('Step 8: jieba extracted')

# Download pypinyin wheel
print('Step 9: pypinyin')
api_url2 = 'https://pypi.org/pypi/pypinyin/json'
with urllib.request.urlopen(api_url2, timeout=30) as r:
    data2 = json.loads(r.read())
chosen2 = None
for u in data2['urls']:
    if u['packagetype'] == 'bdist_wheel':
        chosen2 = u
        break
url2 = chosen2['url']
print('Step 10: downloading', url2[:80])
with urllib.request.urlopen(url2, timeout=120) as r:
    content2 = r.read()
print('Step 11: downloaded', len(content2), 'bytes')

import zipfile
zipfile.ZipFile(io.BytesIO(content2)).extractall(target)
print('Step 12: pypinyin extracted')

# Verify
print('Step 13: verifying')
sys.path.insert(0, target)
import jieba
print('  jieba OK')
import pypinyin
print('  pypinyin OK')
print('Done!')
