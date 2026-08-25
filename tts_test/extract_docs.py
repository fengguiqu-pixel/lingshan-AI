# -*- coding: utf-8 -*-
"""提取 pptx 和 docx 的全部文字内容，输出到 UTF-8 文件"""
import zipfile, xml.etree.ElementTree as ET, os, io

OUT = r"D:\lingshandaolan_live2d1\tts_test\extracted_text.txt"
buf = io.StringIO()
def p(s=''):
    buf.write(s + '\n')

A_T = '{http://schemas.openxmlformats.org/drawingml/2006/main}t'
W_T = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t'

def extract_pptx(path):
    p('=' * 60)
    p(f"PPT 文件: {path}")
    p('=' * 60)
    with zipfile.ZipFile(path, 'r') as z:
        slides = sorted(
            [n for n in z.namelist() if n.startswith('ppt/slides/slide') and n.endswith('.xml')],
            key=lambda x: int(x.replace('ppt/slides/slide','').replace('.xml',''))
        )
        for idx, slide_name in enumerate(slides, 1):
            p(f"\n--- 第 {idx} 页 ({slide_name}) ---")
            data = z.read(slide_name)
            root = ET.fromstring(data)
            texts = []
            for t in root.iter(A_T):
                if t.text and t.text.strip():
                    texts.append(t.text.strip())
            p('\n'.join(texts) if texts else '(无文字)')
        notes = sorted(
            [n for n in z.namelist() if n.startswith('ppt/notesSlides/notesSlide') and n.endswith('.xml')],
            key=lambda x: int(x.replace('ppt/notesSlides/notesSlide','').replace('.xml',''))
        )
        if notes:
            p(f"\n\n{'='*60}\n备注页 (Speaker Notes)\n{'='*60}")
            for idx, note_name in enumerate(notes, 1):
                data = z.read(note_name)
                root = ET.fromstring(data)
                texts = []
                for t in root.iter(A_T):
                    if t.text and t.text.strip():
                        texts.append(t.text.strip())
                if texts:
                    p(f"\n--- 第 {idx} 页备注 ---")
                    p('\n'.join(texts))

def extract_docx(path):
    p("\n\n" + '=' * 60)
    p(f"DOCX 文件: {path}")
    p('=' * 60)
    with zipfile.ZipFile(path, 'r') as z:
        data = z.read('word/document.xml')
        root = ET.fromstring(data)
        for para in root.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p'):
            texts = []
            for t in para.iter(W_T):
                if t.text:
                    texts.append(t.text)
            line = ''.join(texts).strip()
            if line:
                p(line)

pptx_path = r"D:\lingshandaolan_live2d1\2026-07-20-13-24-47\灵山胜境AI数字人导游系统 .pptx"
docx_path = r"D:\lingshandaolan_live2d1\2026-07-20-13-24-47\演讲稿.docx"

if os.path.exists(pptx_path):
    extract_pptx(pptx_path)
else:
    p(f"PPT 不存在: {pptx_path}")

if os.path.exists(docx_path):
    extract_docx(docx_path)
else:
    p(f"DOCX 不存在: {docx_path}")

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(buf.getvalue())
print(f"已写入: {OUT} ({len(buf.getvalue())} 字符)")
