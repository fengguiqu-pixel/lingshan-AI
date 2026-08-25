"""
灵山胜境 AI 导游 - PWA 图标生成脚本
生成多种尺寸的应用图标，风格：深蓝背景 + 金色莲花
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter

# 灵山主题色
BG_TOP = (26, 26, 46)        # #1a1a2e
BG_BOTTOM = (22, 33, 62)     # #16213e
GOLD = (200, 163, 87)        # #C8A357
GOLD_LIGHT = (230, 200, 130) # 高光金
GOLD_DARK = (160, 130, 60)   # 阴影金


def make_gradient_bg(size):
    """生成垂直渐变背景"""
    img = Image.new('RGB', (size, size), BG_TOP)
    pixels = img.load()
    for y in range(size):
        ratio = y / max(size - 1, 1)
        r = int(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * ratio)
        g = int(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * ratio)
        b = int(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * ratio)
        for x in range(size):
            pixels[x, y] = (r, g, b)
    return img


def draw_lotus(draw, cx, cy, petal_len, petal_w, color, highlight_color, shadow_color):
    """画一朵莲花（俯视，8 片花瓣）"""
    # 外层 8 片花瓣
    for i in range(8):
        angle = i * (math.pi / 4) - math.pi / 2
        # 花瓣用椭圆近似
        px = cx + math.cos(angle) * petal_len * 0.45
        py = cy + math.sin(angle) * petal_len * 0.45
        bbox = [
            px - petal_w / 2,
            py - petal_len * 0.55,
            px + petal_w / 2,
            py + petal_len * 0.55,
        ]
        # 旋转花瓣：用扇形近似
        draw.ellipse(bbox, fill=color, outline=shadow_color)

    # 旋转每个花瓣到正确角度
    # 上面用椭圆太简陋，改用多边形画花瓣
    pass


def draw_lotus_polygon(draw, cx, cy, outer_r, inner_r, n_petals=8):
    """用多边形画莲花（侧视，更像佛座莲花）"""
    # 莲花座：下半圆 + 上方花瓣
    # 画 8 片花瓣围绕中心
    for i in range(n_petals):
        angle = i * (2 * math.pi / n_petals) - math.pi / 2
        next_angle = (i + 1) * (2 * math.pi / n_petals) - math.pi / 2
        # 花瓣顶点
        tip_x = cx + math.cos(angle) * outer_r
        tip_y = cy + math.sin(angle) * outer_r
        # 花瓣根部
        base_angle1 = angle - 0.25
        base_angle2 = angle + 0.25
        base_x1 = cx + math.cos(base_angle1) * inner_r
        base_y1 = cy + math.sin(base_angle1) * inner_r
        base_x2 = cx + math.cos(base_angle2) * inner_r
        base_y2 = cy + math.sin(base_angle2) * inner_r
        # 花瓣两侧控制点（让它有弧度）
        side_r = (outer_r + inner_r) / 2
        side_angle1 = angle - 0.15
        side_angle2 = angle + 0.15
        side_x1 = cx + math.cos(side_angle1) * side_r
        side_y1 = cy + math.sin(side_angle1) * side_r
        side_x2 = cx + math.cos(side_angle2) * side_r
        side_y2 = cy + math.sin(side_angle2) * side_r

        draw.polygon(
            [(base_x1, base_y1), (side_x1, side_y1), (tip_x, tip_y),
             (side_x2, side_y2), (base_x2, base_y2)],
            fill=GOLD, outline=GOLD_DARK,
        )


def draw_temple(draw, cx, cy, w, h):
    """画一个简化的佛塔轮廓（金色）"""
    # 塔顶（三角形）
    top = [(cx, cy - h * 0.5), (cx - w * 0.3, cy - h * 0.2), (cx + w * 0.3, cy - h * 0.2)]
    draw.polygon(top, fill=GOLD, outline=GOLD_DARK)
    # 塔身（矩形）
    body = [cx - w * 0.25, cy - h * 0.2, cx + w * 0.25, cy + h * 0.15]
    draw.rectangle(body, fill=GOLD, outline=GOLD_DARK)
    # 塔基（梯形）
    base = [
        (cx - w * 0.4, cy + h * 0.15),
        (cx + w * 0.4, cy + h * 0.15),
        (cx + w * 0.5, cy + h * 0.4),
        (cx - w * 0.5, cy + h * 0.4),
    ]
    draw.polygon(base, fill=GOLD, outline=GOLD_DARK)


def make_icon(size, with_rounded=True, with_temple=False):
    """生成一个灵山风格图标"""
    img = make_gradient_bg(size)
    draw = ImageDraw.Draw(img, 'RGBA')

    cx, cy = size / 2, size / 2

    if with_temple:
        # 佛塔版
        draw_temple(draw, cx, cy + size * 0.05, size * 0.5, size * 0.6)
    else:
        # 莲花版
        outer_r = size * 0.34
        inner_r = size * 0.12
        # 外层 8 瓣
        draw_lotus_polygon(draw, cx, cy, outer_r, inner_r, 8)
        # 内层 8 瓣（小一圈，旋转半角）
        draw_lotus_polygon(draw, cx, cy, outer_r * 0.65, inner_r * 0.6, 8)

        # 中心圆点（金色高光）
        dot_r = size * 0.05
        draw.ellipse(
            [cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r],
            fill=GOLD_LIGHT, outline=GOLD_DARK,
        )

    # 圆角处理（仅 Android 风格需要，iOS 用方形）
    if with_rounded and size >= 192:
        # 用 mask 做圆角
        mask = Image.new('L', (size, size), 0)
        mdraw = ImageDraw.Draw(mask)
        radius = int(size * 0.18)  # 圆角半径
        mdraw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
        rounded = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        rounded.paste(img, (0, 0), mask)
        img = rounded

    return img


def main():
    out_dir = os.path.join(os.path.dirname(__file__), 'icons')
    os.makedirs(out_dir, exist_ok=True)

    # PWA 标准尺寸
    sizes = {
        'icon-192.png': 192,       # PWA 标准图标
        'icon-512.png': 512,       # PWA 标准图标
        'icon-256.png': 256,       # 备用
        'apple-touch-icon.png': 180,  # iOS
        'favicon-32.png': 32,      # 浏览器标签
        'favicon-16.png': 16,      # 浏览器标签
    }

    for name, size in sizes.items():
        # 小尺寸不加圆角，避免看不清；大尺寸加圆角
        rounded = size >= 192
        img = make_icon(size, with_rounded=rounded)
        img.save(os.path.join(out_dir, name), 'PNG')
        print(f'  生成 {name} ({size}x{size})')

    # 同时生成一个无圆角的 maskable 图标（Android 自适应图标）
    img = make_icon(512, with_rounded=False)
    img.save(os.path.join(out_dir, 'maskable-512.png'), 'PNG')
    print('  生成 maskable-512.png (512x512)')

    print(f'\n图标已生成到: {out_dir}')


if __name__ == '__main__':
    main()
