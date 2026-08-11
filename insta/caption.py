#!/usr/bin/env python3
"""사진에 자막(캡션)을 얹어 인스타에 올릴 이미지를 만든다.

    python3 insta/caption.py 원본.jpg "탭샵바에서 헤어지자 하는 거니" \
        -o insta/media/2026-08-12.jpg

휴대폰 사진은 눕혀 찍혀도 EXIF 로만 세워두는 경우가 많다. 그대로 글자를
얹으면 옆으로 누운 그림이 나오므로, 먼저 EXIF 를 실제 픽셀에 반영한다.

Pillow 가 필요하다:  pip install Pillow
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont, ImageOps
except ModuleNotFoundError:
    sys.exit("Pillow 가 없다.  pip install Pillow")

# 굵고 둥근 서체가 자막에 잘 맞는다. 위에서부터 있는 것을 쓴다.
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf",
    "/usr/share/fonts/truetype/nanum/NanumSquareB.ttf",
    "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    "/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf",
    "/System/Library/Fonts/AppleSDGothicNeo.ttc",
    "C:/Windows/Fonts/malgunbd.ttf",
]


def find_font(explicit: str | None) -> str:
    for path in ([explicit] if explicit else []) + FONT_CANDIDATES:
        if path and Path(path).exists():
            return path
    sys.exit("한글 서체를 못 찾았다. --font 으로 ttf 경로를 직접 주거나 "
             "`apt-get install fonts-nanum` 을 하라.")


def wrap(text: str, font: ImageFont.FreeTypeFont, max_width: int,
         draw: ImageDraw.ImageDraw) -> list[str]:
    """한국어는 어절(띄어쓰기) 단위로 끊는다. 한 어절이 너무 길면 글자로 끊는다."""
    def width_of(s: str) -> int:
        return int(draw.textlength(s, font=font))

    lines: list[str] = []
    for paragraph in text.split("\n"):
        line = ""
        for word in paragraph.split(" "):
            trial = f"{line} {word}".strip()
            if width_of(trial) <= max_width or not line:
                line = trial
            else:
                lines.append(line)
                line = word
            # 어절 하나가 한 줄보다 길면 글자 단위로 잘라 넘긴다.
            while width_of(line) > max_width and len(line) > 1:
                cut = len(line) - 1
                while cut > 1 and width_of(line[:cut]) > max_width:
                    cut -= 1
                lines.append(line[:cut])
                line = line[cut:]
        lines.append(line)
    return lines


def balanced_wrap(text: str, font: ImageFont.FreeTypeFont, max_width: int,
                  draw: ImageDraw.ImageDraw) -> list[str]:
    """줄 수를 늘리지 않는 가장 좁은 폭으로 다시 끊는다.

    그냥 끊으면 마지막 줄에 '거니' 한 마디만 떨어져 보기 나쁘다. 같은 줄 수를
    유지하는 최소 폭을 찾으면 줄 길이가 저절로 고르게 맞는다.
    """
    lines = wrap(text, font, max_width, draw)
    if len(lines) < 2:
        return lines

    target, best = len(lines), lines
    lo, hi = 1, max_width
    while lo < hi:
        mid = (lo + hi) // 2
        trial = wrap(text, font, mid, draw)
        if len(trial) <= target:
            best, hi = trial, mid
        else:
            lo = mid + 1
    return best


def fit(text: str, draw: ImageDraw.ImageDraw, font_path: str,
        max_width: int, max_height: int, start: int, spacing: float
        ) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    """글자를 조금씩 줄여가며 주어진 칸에 들어가는 크기를 찾는다."""
    size = start
    while size > 12:
        font = ImageFont.truetype(font_path, size)
        lines = balanced_wrap(text, font, max_width, draw)
        line_h = int(size * spacing)
        if line_h * len(lines) <= max_height:
            return font, lines, line_h
        size = int(size * 0.94)
    font = ImageFont.truetype(font_path, 12)
    return font, balanced_wrap(text, font, max_width, draw), int(12 * spacing)


def square(im: Image.Image) -> Image.Image:
    """가운데를 기준으로 1:1 로 자른다 (인스타 피드 기본 비율)."""
    side = min(im.size)
    left = (im.width - side) // 2
    top = (im.height - side) // 2
    return im.crop((left, top, left + side, top + side))


def scrim(im: Image.Image, band: int, at_top: bool, strength: int) -> None:
    """글자가 놓이는 쪽을 서서히 어둡게 한다. 밝은 배경에서도 흰 글자가 읽힌다."""
    if strength <= 0 or band <= 0:
        return
    gradient = Image.new("L", (1, band))
    for y in range(band):
        ratio = (band - y) / band if at_top else y / band
        gradient.putpixel((0, y), int(strength * ratio ** 1.6))
    mask = gradient.resize((im.width, band))
    box = (0, 0) if at_top else (0, im.height - band)
    im.paste(Image.new("RGB", (im.width, band), (0, 0, 0)), box, mask)


def main() -> int:
    ap = argparse.ArgumentParser(description="사진에 자막을 얹는다")
    ap.add_argument("image", help="원본 사진")
    ap.add_argument("text", help="얹을 문구 (\\n 으로 줄바꿈)")
    ap.add_argument("-o", "--out", required=True, help="저장할 경로")
    ap.add_argument("--position", choices=["bottom", "top", "band"], default="bottom",
                    help="bottom/top 은 사진 위에 얹고, band 는 사진 아래 검은 띠에 "
                         "넣어 얼굴을 가리지 않는다")
    ap.add_argument("--width", type=int, default=1440,
                    help="가로 최대 픽셀 (기본 1440)")
    ap.add_argument("--square", action="store_true", help="1:1 로 자른다")
    ap.add_argument("--scale", type=float, default=0.082,
                    help="글자 크기 / 가로폭 비율 (기본 0.082)")
    ap.add_argument("--scrim", type=int, default=150,
                    help="글자 쪽 어둡게 하는 정도 0~255 (0 이면 안 함)")
    ap.add_argument("--font", help="ttf 경로를 직접 지정")
    args = ap.parse_args()

    source = Path(args.image)
    if not source.exists():
        sys.exit(f"사진이 없다: {source}")

    # 1) EXIF 방향을 픽셀에 반영한다. 이게 빠지면 그림이 누운 채로 나온다.
    im = ImageOps.exif_transpose(Image.open(source)).convert("RGB")

    if args.square:
        im = square(im)
    if im.width > args.width:
        im = im.resize((args.width, round(im.height * args.width / im.width)),
                       Image.LANCZOS)

    draw = ImageDraw.Draw(im)
    margin = round(im.width * 0.055)
    pad = round(im.width * 0.045)
    font_path = find_font(args.font)

    if args.position == "band":
        # 띠를 붙이면 세로가 길어진다. 인스타 하한 비율(4:5)을 넘지 않는
        # 만큼만 자막에 내주고, 넘칠 것 같으면 글자를 알아서 줄인다.
        max_height = max(round(im.width * 0.06),
                         round(im.width / 0.8) - im.height - pad * 2)
    else:
        max_height = round(im.height * 0.34)

    font, lines, line_h = fit(
        args.text, draw, font_path,
        max_width=im.width - margin * 2,
        max_height=max_height,
        start=round(im.width * args.scale),
        spacing=1.28,
    )

    block_h = line_h * len(lines)

    if args.position == "band":
        # 사진 아래에 띠를 덧붙인다. 얼굴 위에 글자가 겹치지 않는다.
        canvas = Image.new("RGB", (im.width, im.height + block_h + pad * 2), (0, 0, 0))
        canvas.paste(im, (0, 0))
        y, stroke = im.height + pad, 0
        im, draw = canvas, ImageDraw.Draw(canvas)
    else:
        at_top = args.position == "top"
        scrim(im, band=min(im.height, block_h + margin * 2), at_top=at_top,
              strength=args.scrim)
        y = margin if at_top else im.height - margin - block_h
        stroke = max(2, round(font.size * 0.11))

    for line in lines:
        draw.text((im.width / 2, y), line, font=font, fill="white",
                  anchor="ma", stroke_width=stroke, stroke_fill=(0, 0, 0))
        y += line_h

    # 인스타는 0.8(4:5) ~ 1.91 밖의 비율을 잘라낸다. 잘릴 것 같으면 미리 알려준다.
    ratio = im.width / im.height
    if not 0.8 <= ratio <= 1.91:
        print(f"! 비율이 {ratio:.2f} 다. 인스타가 0.8~1.91 밖은 잘라낸다 "
              "(자막이 길면 --scale 을 줄여라)", file=sys.stderr)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    im.save(out, "JPEG", quality=92, optimize=True, progressive=True)
    print(f"✓ {out}  {im.width}×{im.height}  글자 {font.size}px  {len(lines)}줄")
    return 0


if __name__ == "__main__":
    sys.exit(main())
