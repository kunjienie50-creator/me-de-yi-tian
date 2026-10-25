#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
make-task-check-art.py — 重新生成「点亮事」勾选图标资源

输入（美术素材）:
    美术素材（art）/dg.png  ->  src/assets/task-check/check.webp
    美术素材（art）/c.png   ->  src/assets/task-check/cross.webp

输出:
    src/assets/task-check/check.webp   256x256 RGBA WebP
    src/assets/task-check/cross.webp   256x256 RGBA WebP
    .dsh-check/task-check-art-preview.png  512/256/96/44/36 五档 x 浅/深背景 对照图

用法（仓库根目录）:
    C:\\Users\\Administrator\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe .dsh-check\\make-task-check-art.py

设计要点:
  * alpha 精确裁切: 阈值 6/255 之下的不可见噪点清零后取 bbox, 保留全部可见像素与柔和边缘/飘散小点
  * 体量归一: 用「可见 alpha 面积」而不是长边对齐, 两张图在 256 画布上面积相同, 因此 44px 下墨量一致
  * 两段缩放: 大图先 reduce() 整数盒式降采样 -> LANCZOS 到 2x 目标 -> LANCZOS 到目标
  * 边缘处理: 低 alpha 区域做颜色外扩(bleed), 避免透明像素的黑/白 RGB 被重采样拉进边缘形成白边/黑边
  * WebP quality 92 + alpha_quality 100, 体积超过 45KB 时按梯度降 quality
"""

import io
import math
import os
import shutil
import sys
from datetime import datetime

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageStat

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# ---------------------------------------------------------------- 参数
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART_DIR = os.path.join(ROOT, "美术素材（art）")
OUT_DIR = os.path.join(ROOT, "src", "assets", "task-check")
TMP_DIR = os.path.join(ROOT, ".dsh-check")

CANVAS = 256
MAX_BBOX = 224           # 内容 bbox 最长边上限 -> 最小留白 16px (6.25%)
AREA_MAX_RATIO = 0.200   # 可见面积占比上限（安全阀）
AREA_MIN_RATIO = 0.090   # 可见面积占比下限（安全阀）
ALPHA_FLOOR = 6          # < 6/255 视为不可见，清零
HAZE_GAMMA = 1.12        # 极淡 alpha 轻微压暗，避免 CSS 遮罩挤出时出现紫色雾气
WEBP_QUALITY = 92
WEBP_ALPHA_QUALITY = 100
SIZE_LIMIT = 45 * 1024

LIGHT_BG = (247, 242, 250)
DARK_BG = (27, 20, 32)
LIGHT_INK = (58, 44, 64)
DARK_INK = (238, 228, 245)


# ---------------------------------------------------------------- 基础工具
def log(msg=""):
    print(msg, flush=True)


def alpha_histogram(im):
    return im.getchannel("A").histogram()


def alpha_area(im):
    """可见 alpha 面积（等价于完全透明=0 / 完全不透明=1 的像素数）"""
    hist = alpha_histogram(im)
    return sum(i * c for i, c in enumerate(hist)) / 255.0


def alpha_bbox(im, floor=0):
    a = im.getchannel("A")
    if floor > 0:
        a = a.point([0 if v < floor else 255 for v in range(256)])
    return a.getbbox()


def ensure_alpha(im):
    """源图若没有 alpha（白底不透明），退化为按「离白的距离」提取 alpha。"""
    a = im.getchannel("A")
    if a.getextrema()[0] < 250:
        return im, False
    rgb = im.convert("RGB")
    r, g, b = rgb.split()
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    d = ImageChops.invert(mn)  # 白=0, 墨色越深越大
    hist = d.histogram()
    total = max(1, sum(hist))
    acc, p = 0, 255
    for v in range(255, -1, -1):
        acc += hist[v]
        if acc >= total * 0.005:
            p = v
            break
    p = max(8, p)
    lut = [0 if v <= 2 else min(255, int(round((v - 2) * 255.0 / (p - 2)))) for v in range(256)]
    return Image.merge("RGBA", (r, g, b, d.point(lut))), True


def suppress_white_edges(im):
    """低 alpha 且接近纯白的像素：按白度衰减 alpha（去白边/白雾）。"""
    r, g, b, a = im.split()
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    guard_lut = []
    for v in range(256):
        if v <= 230:
            guard_lut.append(255)
        else:
            guard_lut.append(max(0, min(255, int(round((255 - v) * 255.0 / 25.0)))))
    guard = mn.point(guard_lut)
    low = a.point([255 if v < 140 else 0 for v in range(256)])
    a2 = ImageChops.multiply(a, guard)
    a3 = Image.composite(a2, a, low)  # 只在 a<140 处生效
    return Image.merge("RGBA", (r, g, b, a3))


def trim_haze(alpha):
    """极淡 alpha 清零 + gamma 轻度压缩，减轻遮罩挤出时的雾气。"""
    lut = []
    for v in range(256):
        if v < ALPHA_FLOOR:
            lut.append(0)
        else:
            t = (v - ALPHA_FLOOR) / (255.0 - ALPHA_FLOOR)
            lut.append(int(round(255.0 * (t ** HAZE_GAMMA))))
    return alpha.point(lut)


def bleed_colors(im):
    """把墨色向低 alpha / 全透明区域外扩，重采样时不会拉进黑/白 RGB。"""
    rgb = im.convert("RGB")
    a = im.getchannel("A")
    core = a.point([255 if v >= 200 else 0 for v in range(256)])
    stat = ImageStat.Stat(rgb, core)
    if stat.count and stat.count[0] > 0:
        base_rgb = tuple(int(round(c)) for c in stat.mean)
    else:
        base_rgb = (120, 80, 130)
    base = Image.new("RGB", im.size, base_rgb)
    visible = a.point([255 if v > 0 else 0 for v in range(256)])
    filled = Image.composite(rgb, base, visible)
    known = a.point([255 if v >= 64 else 0 for v in range(256)])
    for _ in range(3):
        filled = Image.composite(filled, filled.filter(ImageFilter.GaussianBlur(3)), known)
    return Image.merge("RGBA", filled.split() + (a,))


def shrink(img, tw, th):
    """两段缩放：整数 reduce 预降采样 -> LANCZOS 2x -> LANCZOS 目标。"""
    tw, th = max(1, tw), max(1, th)
    w, h = img.size
    guard = 0
    while max(w, h) > 8 * max(tw, th) and guard < 12:
        f = max(2, int(max(w, h) // (4 * max(tw, th))))
        img = img.reduce(f)
        w, h = img.size
        guard += 1
    mid = (max(2, tw * 2), max(2, th * 2))
    if (w, h) != mid:
        img = img.resize(mid, Image.Resampling.LANCZOS)
    return img.resize((tw, th), Image.Resampling.LANCZOS)


def center_on_canvas(glyph):
    """先按可见 alpha 再裁一次，再居中 -> 四边留白差 <= 1px。"""
    box = glyph.getchannel("A").getbbox()
    if box:
        glyph = glyph.crop(box)
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    gw, gh = glyph.size
    left = (CANVAS - gw) // 2
    top = (CANVAS - gh) // 2
    canvas.paste(glyph, (left, top), glyph)
    return canvas


def clip_faint(im, floor=3):
    """重采样会在边缘外产生 1..2/255 的极小 alpha 涟漪，清掉（视觉上不可见）。"""
    a = im.getchannel("A")
    a2 = a.point([0 if v < floor else v for v in range(256)])
    return Image.merge("RGBA", im.split()[:3] + (a2,))


def near_white_edge_pixels(im):
    r, g, b, a = im.split()
    mn = ImageChops.darker(ImageChops.darker(r, g), b)
    low = a.point([255 if 0 < v < 140 else 0 for v in range(256)])
    sel = Image.composite(mn, Image.new("L", im.size, 0), low)
    hist = sel.histogram()
    return sum(hist[236:]), sum(hist[1:])


# ---------------------------------------------------------------- 单张处理
def prepare(src_path, name):
    raw = Image.open(src_path)
    raw.load()
    im = raw.convert("RGBA")
    info = {"name": name, "src": src_path, "src_size": raw.size, "fallback_alpha": False}

    im, info["fallback_alpha"] = ensure_alpha(im)
    before = alpha_histogram(im)
    before_soft = sum(before[1:140]) / max(1, sum(before[1:]))
    before_visible = max(1, sum(before[1:]))

    im = suppress_white_edges(im)
    a = trim_haze(im.getchannel("A"))
    im = Image.merge("RGBA", im.split()[:3] + (a,))
    after = a.histogram()
    info["soft_before"] = before_soft
    info["soft_after"] = sum(after[1:140]) / max(1, sum(after[1:]))
    info["visible_px_before"] = before_visible
    info["visible_px_after"] = sum(after[1:])

    box = im.getchannel("A").getbbox()
    if box is None:
        raise RuntimeError("%s: alpha 全为 0，无法处理" % name)
    im = im.crop(box)
    im = bleed_colors(im)

    info["src_bbox"] = box
    info["crop"] = im
    info["crop_size"] = im.size
    info["area"] = alpha_area(im)
    info["equiv_d_src"] = 2.0 * math.sqrt(info["area"] / math.pi)
    return info


def plan_target_area(items):
    caps = []
    for it in items:
        bw, bh = it["crop_size"]
        s_cap = MAX_BBOX / float(max(bw, bh))
        caps.append(it["area"] * s_cap * s_cap)
    common = min(caps)
    common = min(common, AREA_MAX_RATIO * CANVAS * CANVAS)
    common = max(common, AREA_MIN_RATIO * CANVAS * CANVAS)
    return common


def render_item(it, target_area):
    crop = it["crop"]
    bw, bh = it["crop_size"]
    a_src = it["area"]
    best = None
    target = target_area
    for _ in range(3):
        s = math.sqrt(target / a_src)
        tw = max(1, int(round(bw * s)))
        th = max(1, int(round(bh * s)))
        if max(tw, th) > MAX_BBOX:
            k = MAX_BBOX / float(max(tw, th))
            tw, th = max(1, int(round(tw * k))), max(1, int(round(th * k)))
        glyph = shrink(crop, tw, th)
        glyph = clip_faint(glyph, 3)
        canvas = center_on_canvas(glyph)
        got = alpha_area(canvas)
        err = abs(got - target_area) / target_area
        if best is None or err < best[0]:
            best = (err, canvas, (tw, th))
        if err < 0.01:
            break
        target = target * (target_area / max(1e-6, got))
    it["bbox"] = (best[2][0], best[2][1])
    return best[1]


def encode_webp(im):
    data, used_q = None, WEBP_QUALITY
    for q in (92, 91, 90, 89, 88, 86):
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6, alpha_quality=WEBP_ALPHA_QUALITY)
        data, used_q = buf.getvalue(), q
        if len(data) <= SIZE_LIMIT:
            break
    return data, used_q


# ---------------------------------------------------------------- 预览图
def load_font(size, bold=False):
    candidates = [
        r"C:\Windows\Fonts\seguisb.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def text_center(draw, cx, cy, s, font, fill):
    box = draw.textbbox((0, 0), s, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    draw.text((cx - w / 2.0 - box[0], cy - h / 2.0 - box[1]), s, font=font, fill=fill)


def build_preview(items, finals, path):
    sizes = [512, 256, 96, 44, 36]
    m, gap = 44, 36
    w = m * 2 + sum(sizes) + gap * (len(sizes) - 1)
    header_h, axis_h, label_h, band, row_pad = 64, 34, 26, 512, 18
    zoom_h, footer_h = 286, 56
    h = header_h + axis_h + 4 * (label_h + band + row_pad) + zoom_h + footer_h

    canvas = Image.new("RGB", (w, h), (250, 247, 252))
    draw = ImageDraw.Draw(canvas)
    f_title = load_font(20, True)
    f_sub = load_font(13)
    f_label = load_font(13, True)
    f_small = load_font(11)

    cols = []
    x = m
    for s in sizes:
        cols.append((x, s))
        x += s + gap

    draw.text((m, 16), "task-check art preview  —  256x256 RGBA WebP, rendered at 512 / 256 / 96 / 44 / 36 px",
              font=f_title, fill=(48, 36, 54))
    draw.text((m, 42), "top rows: light background (#F7F2FA)   bottom rows: dark background (#1B1420)   each glyph rendered from the shipped 256px asset",
              font=f_sub, fill=(120, 104, 126))
    for cx0, s in cols:
        text_center(draw, cx0 + s / 2.0, header_h + 10, "%d px" % s, f_sub, (110, 96, 118))

    rows = [("LIGHT  check.webp", LIGHT_BG, LIGHT_INK, finals["check"]),
            ("LIGHT  cross.webp", LIGHT_BG, LIGHT_INK, finals["cross"]),
            ("DARK   check.webp", DARK_BG, DARK_INK, finals["check"]),
            ("DARK   cross.webp", DARK_BG, DARK_INK, finals["cross"])]

    y = header_h + axis_h
    for label, bg, ink, img in rows:
        draw.text((m, y + 6), label, font=f_label, fill=(90, 76, 98))
        by = y + label_h
        draw.rounded_rectangle((m - 12, by - 4, w - m + 12, by + band + 4), radius=16, fill=bg)
        for cx0, s in cols:
            glyph = img.resize((s, s), Image.Resampling.LANCZOS)
            px = cx0
            py = by + (band - s) // 2
            canvas.paste(glyph, (px, py), glyph)
        y += label_h + band + row_pad

    # 放大检查区
    zy = y + 12
    draw.rounded_rectangle((m - 12, zy, w - m + 12, zy + zoom_h - 24), radius=16, fill=DARK_BG)
    draw.text((m, zy + 12), "pixel inspection on dark  —  44 px x4 nearest  /  36 px x4 nearest", font=f_small, fill=(196, 182, 205))
    base_y = zy + 54
    for idx, key in enumerate(("check", "cross")):
        bx = m + 30 + idx * 470
        img = finals[key]
        for j, (s, zoom) in enumerate(((44, 4), (36, 4))):
            g = img.resize((s, s), Image.Resampling.LANCZOS)
            g = g.resize((s * zoom, s * zoom), Image.Resampling.NEAREST)
            px = bx + j * 210
            canvas.paste(g, (px, base_y), g)
            draw.text((px, base_y + s * zoom + 8), "%s %dpx x%d" % (key, s, zoom), font=f_small, fill=(196, 182, 205))

    draw.text((m, h - footer_h + 14),
              "generated %s   |   bbox <= %dpx   |   webp q%d / alpha_quality %d   |   <= 45KB per asset"
              % (datetime.now().strftime("%Y-%m-%d %H:%M"), MAX_BBOX, WEBP_QUALITY, WEBP_ALPHA_QUALITY),
              font=f_small, fill=(130, 116, 138))

    canvas.save(path, "PNG", optimize=True)
    return path


# ---------------------------------------------------------------- main
def main():
    os.makedirs(TMP_DIR, exist_ok=True)
    log("=" * 78)
    log("task-check art pipeline")
    log("  repo : %s" % ROOT)
    log("  out  : %s" % OUT_DIR)
    log("=" * 78)

    jobs = [("check", os.path.join(ART_DIR, "dg.png"), os.path.join(OUT_DIR, "check.webp")),
            ("cross", os.path.join(ART_DIR, "c.png"), os.path.join(OUT_DIR, "cross.webp"))]

    items, finals, results = [], {}, {}
    for key, src, dst in jobs:
        if not os.path.isfile(src):
            raise SystemExit("MISSING SOURCE: %s" % src)
        it = prepare(src, key)
        it["dst"] = dst
        items.append(it)
        log("[%s] src %dx%d -> bbox %s (crop %dx%d), visible alpha area %.0f px^2, soft(1..139) %.1f%% -> %.1f%%%s"
            % (key, it["src_size"][0], it["src_size"][1], it["src_bbox"], it["crop_size"][0], it["crop_size"][1],
               it["area"], it["soft_before"] * 100, it["soft_after"] * 100,
               "  [WARN: source had no alpha]" if it["fallback_alpha"] else ""))

    target = plan_target_area(items)
    log("")
    log("target visible alpha area = %.0f px^2  (ratio %.4f of %dx%d canvas)"
        % (target, target / (CANVAS * CANVAS), CANVAS, CANVAS))

    rendered = []
    for it in items:
        canvas = render_item(it, target)
        data, q = encode_webp(canvas)
        rendered.append((it, data, q))

    # 两张都渲染成功后再落盘，失败不会破坏现有资源；旧文件先备份到 .dsh-check/prev/
    prev_dir = os.path.join(TMP_DIR, "prev")
    os.makedirs(prev_dir, exist_ok=True)
    for it, data, q in rendered:
        if os.path.isfile(it["dst"]):
            try:
                shutil.copy2(it["dst"], os.path.join(prev_dir, os.path.basename(it["dst"])))
            except Exception:
                pass
        with open(it["dst"], "wb") as fh:
            fh.write(data)
        finals[it["name"]] = Image.open(io.BytesIO(data)).convert("RGBA")
        results[it["name"]] = {"img": finals[it["name"]], "bytes": len(data), "q": q, "dst": it["dst"]}

    # ---- 指标
    log("")
    log("=" * 78)
    log("FINAL METRICS")
    log("=" * 78)
    rows = []
    for name in ("check", "cross"):
        r = results[name]
        im = r["img"]
        a = im.getchannel("A")
        box = a.getbbox()
        area = alpha_area(im)
        ratio = area / (CANVAS * CANVAS)
        eq = 2.0 * math.sqrt(area / math.pi)
        corners = [a.getpixel((0, 0)), a.getpixel((CANVAS - 1, 0)),
                   a.getpixel((0, CANVAS - 1)), a.getpixel((CANVAS - 1, CANVAS - 1))]
        wpx = box[2] - box[0]
        hpx = box[3] - box[1]
        margins = (box[0], CANVAS - box[2], box[1], CANVAS - box[3])
        white_px, edge_px = near_white_edge_pixels(im)
        hist = a.histogram()
        soft = sum(hist[1:140]) / max(1, sum(hist[1:]))
        rows.append((name, im, r, box, area, ratio, eq, corners, margins, wpx, hpx, soft, white_px, edge_px))

        log("")
        log("[%s]" % name)
        log("  file        : %s" % os.path.relpath(r["dst"], ROOT))
        log("  size        : %d x %d px  (mode RGBA)" % im.size)
        log("  bytes       : %d  (limit %d, %.1f%% used, webp q%d / alpha_quality %d)"
            % (r["bytes"], SIZE_LIMIT, r["bytes"] * 100.0 / SIZE_LIMIT, r["q"], WEBP_ALPHA_QUALITY))
        log("  alpha bbox  : (%d, %d, %d, %d)   content %d x %d px" % (box[0], box[1], box[2], box[3], wpx, hpx))
        log("  margins     : L=%d R=%d T=%d B=%d" % margins)
        log("  area ratio  : %.4f  (%.2f%% of canvas)" % (ratio, ratio * 100))
        log("  eq diameter : %.1f px @256   %.2f px @44   %.2f px @36" % (eq, eq * 44 / 256.0, eq * 36 / 256.0))
        log("  corners a   : TL=%d TR=%d BL=%d BR=%d" % tuple(corners))
        log("  max alpha   : %d   soft(1..139) share of ink: %.1f%%" % (a.getextrema()[1], soft * 100))
        log("  near-white edge px (a<140, min(rgb)>235): %d / %d (%.2f%%)"
            % (white_px, edge_px, white_px * 100.0 / max(1, edge_px)))

    check_r, cross_r = rows[0][5], rows[1][5]
    delta = abs(check_r - cross_r) / max(check_r, cross_r) * 100.0
    log("")
    log("[pair]  visible area ratio  check %.4f  vs  cross %.4f   -> delta %.2f%%"
        % (check_r, cross_r, delta))
    log("[pair]  bbox  check %dx%d   cross %dx%d" % (rows[0][9], rows[0][10], rows[1][9], rows[1][10]))

    # ---- 断言
    log("")
    log("CHECKS")
    ok = True
    checks = []
    for name, im, r, box, area, ratio, eq, corners, margins, wpx, hpx, soft, white_px, edge_px in rows:
        checks.append(("%s size 256x256" % name, im.size == (CANVAS, CANVAS)))
        checks.append(("%s bytes <= 45KB" % name, r["bytes"] <= SIZE_LIMIT))
        checks.append(("%s corners alpha == 0" % name, all(c == 0 for c in corners)))
        checks.append(("%s max alpha == 255" % name, im.getchannel("A").getextrema()[1] == 255))
        checks.append(("%s bbox margin >= 6px" % name, min(margins) >= 6))
        checks.append(("%s margins symmetric (<=1px)" % name, max(margins) - min(margins) <= 1))
        checks.append(("%s near-white edge < 1%%" % name, white_px * 100.0 / max(1, edge_px) < 1.0))
    checks.append(("area parity delta <= 1.5%", delta <= 1.5))
    for label, passed in checks:
        log("  %-4s %s" % ("PASS" if passed else "FAIL", label))
        ok = ok and passed

    # ---- 预览
    preview = os.path.join(TMP_DIR, "task-check-art-preview.png")
    build_preview(items, finals, preview)
    log("")
    log("preview : %s  (%d bytes, %dx%d)" % (preview, os.path.getsize(preview),
                                             *Image.open(preview).size))
    log("")
    log("RESULT: %s" % ("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED — see FAIL lines above"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
