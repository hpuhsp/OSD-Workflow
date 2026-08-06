from __future__ import annotations

import html
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "assets" / "readme"

BG = "#f8f6f3"
INK = "#1a1a1a"
MUTED = "#6a6a6a"
STROKE = "#4a4a4a"
ARROW = "#5a5a5a"
BLUE = "#a8c5e6"
TEAL = "#9dd4c7"
BEIGE = "#f4e4c1"
GRAY = "#e8e6e3"
CREAM = "#fffaf0"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/seguisb.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default()


F_TITLE = font(34, True)
F_SUBTITLE = font(18)
F_NODE = font(22, True)
F_SMALL = font(16)
F_TINY = font(14)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.ImageFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def centered_text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, fnt, fill=INK):
    w, h = text_size(draw, text, fnt)
    draw.text((xy[0] - w / 2, xy[1] - h / 2), text, font=fnt, fill=fill)


def multiline_center(draw: ImageDraw.ImageDraw, box, lines, fonts, fills=None, gap=8):
    x1, y1, x2, y2 = box
    fills = fills or [INK] * len(lines)
    heights = [text_size(draw, line, fnt)[1] for line, fnt in zip(lines, fonts)]
    total = sum(heights) + gap * (len(lines) - 1)
    y = y1 + ((y2 - y1) - total) / 2
    for line, fnt, fill, h in zip(lines, fonts, fills, heights):
        w, _ = text_size(draw, line, fnt)
        draw.text((x1 + ((x2 - x1) - w) / 2, y), line, font=fnt, fill=fill)
        y += h + gap


def rounded_box(draw, box, fill, radius=24, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=STROKE, width=width)


def arrow(draw, start, end, width=4, fill=ARROW):
    draw.line([start, end], fill=fill, width=width)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    size = 15
    points = [
        end,
        (end[0] - size * math.cos(angle - math.pi / 6), end[1] - size * math.sin(angle - math.pi / 6)),
        (end[0] - size * math.cos(angle + math.pi / 6), end[1] - size * math.sin(angle + math.pi / 6)),
    ]
    draw.polygon(points, fill=fill)


def save_png(name: str, size: tuple[int, int], render):
    img = Image.new("RGB", size, BG)
    draw = ImageDraw.Draw(img)
    render(draw)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png", quality=95)


class Svg:
    def __init__(self, width: int, height: int):
        self.width = width
        self.height = height
        self.lines = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
            "<defs>",
            '<marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="#5a5a5a"/></marker>',
            "</defs>",
            f'<rect width="{width}" height="{height}" fill="{BG}"/>',
            '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",Arial,sans-serif;}</style>',
        ]

    def text(self, x, y, content, size=16, weight=400, fill=INK, anchor="middle"):
        self.lines.append(
            f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" font-weight="{weight}" fill="{fill}">{html.escape(content)}</text>'
        )

    def box(self, x, y, w, h, fill, rx=18, stroke=STROKE, sw=2.5):
        self.lines.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'
        )

    def line_arrow(self, x1, y1, x2, y2, sw=2.5):
        self.lines.append(
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{ARROW}" stroke-width="{sw}" marker-end="url(#arrow)"/>'
        )

    def save(self, name: str):
        self.lines.append("</svg>")
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / f"{name}.svg").write_text("\n".join(self.lines), encoding="utf-8")


def title(draw, main, sub, w):
    centered_text(draw, (w / 2, 48), main, F_TITLE)
    centered_text(draw, (w / 2, 86), sub, F_SUBTITLE, MUTED)


def workflow():
    name, size = "workflow-loop", (1180, 680)
    steps = [
        ("User Task", "任务", BLUE),
        ("OSD Route", "路由", TEAL),
        ("OpenSpec", "规格权威", BEIGE),
        ("Superpowers", "执行方法", TEAL),
        ("Verification", "验证证据", BLUE),
        ("Delivery Record", "交付记录", GRAY),
    ]

    def render(draw):
        title(draw, "Adaptive OSD Delivery Route", "OSD 按风险选择流程深度，OpenSpec 定义规格，Superpowers 执行交付", size[0])
        box_w, box_h = 260, 96
        positions = [
            (80, 190),
            (460, 190),
            (840, 190),
            (840, 410),
            (460, 410),
            (80, 410),
        ]
        for i, (en, zh, fill) in enumerate(steps):
            x, y = positions[i]
            rounded_box(draw, (x, y, x + box_w, y + box_h), fill)
            multiline_center(draw, (x, y, x + box_w, y + box_h), [en, zh], [F_NODE, F_SMALL], [INK, MUTED])
        connectors = [
            ((340, 238), (460, 238)),
            ((720, 238), (840, 238)),
            ((970, 286), (970, 410)),
            ((840, 458), (720, 458)),
            ((460, 458), (340, 458)),
        ]
        for start, end in connectors:
            arrow(draw, start, end)
        draw.rounded_rectangle((260, 565, 920, 615), radius=18, fill=CREAM, outline="#e3cfa4", width=2)
        centered_text(draw, (590, 590), "OSD selects depth; OpenSpec defines what; Superpowers guides how", F_SMALL, MUTED)

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "Adaptive OSD Delivery Route", 34, 700)
    svg.text(size[0] / 2, 92, "OSD 按风险选择流程深度，OpenSpec 定义规格，Superpowers 执行交付", 18, 400, MUTED)
    box_w, box_h = 260, 96
    positions = [(80, 190), (460, 190), (840, 190), (840, 410), (460, 410), (80, 410)]
    for i, (en, zh, fill) in enumerate(steps):
        x, y = positions[i]
        svg.box(x, y, box_w, box_h, fill)
        svg.text(x + box_w / 2, y + 40, en, 22, 700)
        svg.text(x + box_w / 2, y + 70, zh, 16, 400, MUTED)
    for start, end in [((340, 238), (460, 238)), ((720, 238), (840, 238)), ((970, 286), (970, 410)), ((840, 458), (720, 458)), ((460, 458), (340, 458))]:
        svg.line_arrow(start[0], start[1], end[0], end[1], 4)
    svg.box(260, 565, 660, 50, CREAM, 18, "#e3cfa4", 2)
    svg.text(590, 597, "OSD selects depth; OpenSpec defines what; Superpowers guides how", 16, 400, MUTED)
    svg.save(name)


def runtime_contract():
    name, size = "runtime-contract", (1440, 760)

    def render(draw):
        title(draw, "Runtime Responsibility Contract", "OSD 控制路由；OpenSpec 提供规格工具链；Superpowers 由 Agent/Harness 提供执行方法", size[0])
        columns = [
            (70, 150, 450, 650, "OSD Workflow", "项目控制层", TEAL, ["Task routing", "Mode + strategy", "Stage order", "Minimum evidence"]),
            (530, 150, 910, 650, "OpenSpec CLI", "全局规格工具", BEIGE, ["npm install -g", "openspec init", "Native lifecycle", "Specification authority"]),
            (990, 150, 1370, 650, "Superpowers", "Agent/Harness 执行", BLUE, ["Planning", "Implementation", "TDD / test-first", "Verification + review"]),
        ]
        for x1, y1, x2, y2, en, zh, fill, items in columns:
            rounded_box(draw, (x1, y1, x2, y2), CREAM, radius=28, width=3)
            rounded_box(draw, (x1 + 30, y1 + 35, x2 - 30, y1 + 120), fill, radius=22)
            multiline_center(draw, (x1 + 30, y1 + 35, x2 - 30, y1 + 120), [en, zh], [F_NODE, F_SMALL], [INK, MUTED])
            yy = y1 + 150
            for idx, item in enumerate(items):
                color = [TEAL, BEIGE, GRAY, BLUE][idx % 4]
                rounded_box(draw, (x1 + 55, yy, x2 - 55, yy + 62), color, radius=16, width=2)
                centered_text(draw, ((x1 + x2) / 2, yy + 31), item, F_SMALL, INK)
                yy += 82
        arrow(draw, (450, 390), (530, 390), 4)
        arrow(draw, (910, 390), (990, 390), 4)
        centered_text(draw, (490, 350), "uses", F_TINY, MUTED)
        centered_text(draw, (950, 350), "runs within", F_TINY, MUTED)

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "Runtime Responsibility Contract", 34, 700)
    svg.text(size[0] / 2, 92, "OSD 控制路由；OpenSpec 提供规格工具链；Superpowers 由 Agent/Harness 提供执行方法", 18, 400, MUTED)
    for x1, y1, x2, y2, en, zh, fill, items in [
        (70, 150, 450, 650, "OSD Workflow", "项目控制层", TEAL, ["Task routing", "Mode + strategy", "Stage order", "Minimum evidence"]),
        (530, 150, 910, 650, "OpenSpec CLI", "全局规格工具", BEIGE, ["npm install -g", "openspec init", "Native lifecycle", "Specification authority"]),
        (990, 150, 1370, 650, "Superpowers", "Agent/Harness 执行", BLUE, ["Planning", "Implementation", "TDD / test-first", "Verification + review"]),
    ]:
        svg.box(x1, y1, x2 - x1, y2 - y1, CREAM, 28)
        svg.box(x1 + 30, y1 + 35, x2 - x1 - 60, 85, fill, 22)
        svg.text((x1 + x2) / 2, y1 + 78, en, 22, 700)
        svg.text((x1 + x2) / 2, y1 + 106, zh, 16, 400, MUTED)
        yy = y1 + 150
        for idx, item in enumerate(items):
            color = [TEAL, BEIGE, GRAY, BLUE][idx % 4]
            svg.box(x1 + 55, yy, x2 - x1 - 110, 62, color, 16, STROKE, 2)
            svg.text((x1 + x2) / 2, yy + 38, item, 16, 600)
            yy += 82
    svg.line_arrow(450, 390, 530, 390, 4)
    svg.line_arrow(910, 390, 990, 390, 4)
    svg.text(490, 350, "uses", 14, 400, MUTED)
    svg.text(950, 350, "runs within", 14, 400, MUTED)
    svg.save(name)


def project_structure():
    name, size = "project-structure", (1280, 860)

    def render(draw):
        title(draw, "Project Template Structure", "一键接入后写入目标项目的核心目录", size[0])
        rounded_box(draw, (490, 110, 790, 190), BEIGE, radius=22)
        centered_text(draw, (640, 150), "OSD Workflow", F_NODE)
        branches = [
            (45, 270, ".ai/", "Workflow contract", TEAL, ["workflow-manifest.json", "workflows/", "rules/", "templates/"]),
            (355, 270, "openspec/", "Project specs", BLUE, ["README.md", "changes/"]),
            (665, 270, "knowledge/", "Delivery evidence", GRAY, ["archive/"]),
            (975, 270, "runtime", "Install + verify", BEIGE, ["bin/", "scripts/", "docs/", "AGENTS.md"]),
        ]
        for x, y, head, sub, fill, items in branches:
            arrow(draw, (640, 190), (x + 130, y - 28), 4)
            rounded_box(draw, (x, y, x + 260, y + 90), fill, radius=22)
            multiline_center(draw, (x, y, x + 260, y + 90), [head, sub], [F_NODE, F_TINY], [INK, MUTED])
            yy = y + 125
            for item in items:
                rounded_box(draw, (x + 18, yy, x + 242, yy + 52), CREAM, radius=14, width=2)
                centered_text(draw, (x + 130, yy + 26), item, F_SMALL)
                yy += 65

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "Project Template Structure", 34, 700)
    svg.text(size[0] / 2, 92, "一键接入后写入目标项目的核心目录", 18, 400, MUTED)
    svg.box(490, 110, 300, 80, BEIGE, 22)
    svg.text(640, 159, "OSD Workflow", 22, 700)
    for x, y, head, sub, fill, items in [
        (45, 270, ".ai/", "Workflow contract", TEAL, ["workflow-manifest.json", "workflows/", "rules/", "templates/"]),
        (355, 270, "openspec/", "Project specs", BLUE, ["README.md", "changes/"]),
        (665, 270, "knowledge/", "Delivery evidence", GRAY, ["archive/"]),
        (975, 270, "runtime", "Install + verify", BEIGE, ["bin/", "scripts/", "docs/", "AGENTS.md"]),
    ]:
        svg.line_arrow(640, 190, x + 130, y - 28, 4)
        svg.box(x, y, 260, 90, fill, 22)
        svg.text(x + 130, y + 42, head, 22, 700)
        svg.text(x + 130, y + 70, sub, 14, 400, MUTED)
        yy = y + 125
        for item in items:
            svg.box(x + 18, yy, 224, 52, CREAM, 14, STROKE, 2)
            svg.text(x + 130, yy + 33, item, 16, 600)
            yy += 65
    svg.save(name)


def main():
    workflow()
    runtime_contract()
    project_structure()
    print(f"Generated README diagrams in {OUT}")


if __name__ == "__main__":
    main()
