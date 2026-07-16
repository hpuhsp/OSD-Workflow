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
        ("Requirement", "需求", BLUE),
        ("Specification", "规格", TEAL),
        ("Plan", "计划", BEIGE),
        ("Implementation", "实现", TEAL),
        ("Verification", "验证", BLUE),
        ("Knowledge Archive", "知识归档", GRAY),
    ]

    def render(draw):
        title(draw, "Traceable Engineering Loop", "从需求到知识归档的可追溯研发闭环", size[0])
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
        centered_text(draw, (590, 590), "OpenSpec records why and what; Superpowers guides how", F_SMALL, MUTED)

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "Traceable Engineering Loop", 34, 700)
    svg.text(size[0] / 2, 92, "从需求到知识归档的可追溯研发闭环", 18, 400, MUTED)
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
    svg.text(590, 597, "OpenSpec records why and what; Superpowers guides how", 16, 400, MUTED)
    svg.save(name)


def runtime_contract():
    name, size = "runtime-contract", (1280, 720)

    def render(draw):
        title(draw, "Runtime Responsibility Contract", "用户级 Superpowers 与项目级 OpenSpec 的职责分层", size[0])
        columns = [
            (110, 150, 560, 630, "User Level", "用户级", TEAL, ["Superpowers", "Execution discipline", "Planning / coding / verification", "Reusable personal workflow"]),
            (720, 150, 1170, 630, "Project Level", "项目级", BLUE, ["OpenSpec", ".ai workflow contract", "openspec/changes", "knowledge/archive"]),
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
        arrow(draw, (560, 390), (720, 390), 4)
        centered_text(draw, (640, 350), "project context", F_TINY, MUTED)

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "Runtime Responsibility Contract", 34, 700)
    svg.text(size[0] / 2, 92, "用户级 Superpowers 与项目级 OpenSpec 的职责分层", 18, 400, MUTED)
    for x1, y1, x2, y2, en, zh, fill, items in [
        (110, 150, 560, 630, "User Level", "用户级", TEAL, ["Superpowers", "Execution discipline", "Planning / coding / verification", "Reusable personal workflow"]),
        (720, 150, 1170, 630, "Project Level", "项目级", BLUE, ["OpenSpec", ".ai workflow contract", "openspec/changes", "knowledge/archive"]),
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
    svg.line_arrow(560, 390, 720, 390, 4)
    svg.text(640, 350, "project context", 14, 400, MUTED)
    svg.save(name)


def project_structure():
    name, size = "project-structure", (1280, 860)

    def render(draw):
        title(draw, "Project Template Structure", "一键接入后写入目标项目的核心目录", size[0])
        rounded_box(draw, (490, 125, 790, 205), BEIGE, radius=22)
        centered_text(draw, (640, 165), "OSD Workflow", F_NODE)
        branches = [
            (105, 290, ".ai/", "Workflow contract", TEAL, ["rules/", "workflows/", "skills/", "agents/", "AI_WORKFLOW.md"]),
            (500, 290, "openspec/", "Project specs", BLUE, ["README.md", "changes/"]),
            (855, 290, "knowledge/", "Requirement archive", GRAY, ["archive/"]),
        ]
        for x, y, head, sub, fill, items in branches:
            arrow(draw, (640, 205), (x + 160, y - 28), 4)
            rounded_box(draw, (x, y, x + 320, y + 90), fill, radius=22)
            multiline_center(draw, (x, y, x + 320, y + 90), [head, sub], [F_NODE, F_TINY], [INK, MUTED])
            yy = y + 125
            for item in items:
                rounded_box(draw, (x + 28, yy, x + 292, yy + 52), CREAM, radius=14, width=2)
                centered_text(draw, (x + 160, yy + 26), item, F_SMALL)
                yy += 65

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "Project Template Structure", 34, 700)
    svg.text(size[0] / 2, 92, "一键接入后写入目标项目的核心目录", 18, 400, MUTED)
    svg.box(490, 125, 300, 80, BEIGE, 22)
    svg.text(640, 174, "OSD Workflow", 22, 700)
    for x, y, head, sub, fill, items in [
        (105, 290, ".ai/", "Workflow contract", TEAL, ["rules/", "workflows/", "skills/", "agents/", "AI_WORKFLOW.md"]),
        (500, 290, "openspec/", "Project specs", BLUE, ["README.md", "changes/"]),
        (855, 290, "knowledge/", "Requirement archive", GRAY, ["archive/"]),
    ]:
        svg.line_arrow(640, 205, x + 160, y - 28, 4)
        svg.box(x, y, 320, 90, fill, 22)
        svg.text(x + 160, y + 42, head, 22, 700)
        svg.text(x + 160, y + 70, sub, 14, 400, MUTED)
        yy = y + 125
        for item in items:
            svg.box(x + 28, yy, 264, 52, CREAM, 14, STROKE, 2)
            svg.text(x + 160, yy + 33, item, 16, 600)
            yy += 65
    svg.save(name)


def openspec_change():
    name, size = "openspec-change", (1100, 500)

    def render(draw):
        title(draw, "OpenSpec Change Package", "每个需求对应一个项目级变更包", size[0])
        rounded_box(draw, (110, 155, 990, 405), CREAM, radius=28, width=3)
        rounded_box(draw, (360, 190, 740, 260), BLUE, radius=18)
        centered_text(draw, (550, 225), "openspec/changes/{feature}/", F_SMALL)
        for i, (label, sub, fill) in enumerate([
            ("proposal.md", "Why and scope", BEIGE),
            ("spec.md", "Behavior and acceptance", TEAL),
            ("design.md", "Approach and risks", GRAY),
        ]):
            x = 245 + i * 230
            rounded_box(draw, (x, 310, x + 175, 380), fill, radius=18)
            multiline_center(draw, (x, 310, x + 175, 380), [label, sub], [F_SMALL, F_TINY], [INK, MUTED])
            arrow(draw, (550, 260), (x + 88, 305), 3)

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "OpenSpec Change Package", 34, 700)
    svg.text(size[0] / 2, 92, "每个需求对应一个项目级变更包", 18, 400, MUTED)
    svg.box(110, 155, 880, 250, CREAM, 28)
    svg.box(360, 190, 380, 70, BLUE, 18)
    svg.text(550, 233, "openspec/changes/{feature}/", 16, 600)
    for i, (label, sub, fill) in enumerate([
        ("proposal.md", "Why and scope", BEIGE),
        ("spec.md", "Behavior and acceptance", TEAL),
        ("design.md", "Approach and risks", GRAY),
    ]):
        x = 245 + i * 230
        svg.box(x, 310, 175, 70, fill, 18)
        svg.text(x + 88, 342, label, 16, 700)
        svg.text(x + 88, 365, sub, 13, 400, MUTED)
        svg.line_arrow(550, 260, x + 88, 305, 3)
    svg.save(name)


def knowledge_archive():
    name, size = "knowledge-archive", (1180, 620)

    def render(draw):
        title(draw, "Knowledge Archive Unit", "一个需求沉淀为一个完整研发知识单元", size[0])
        rounded_box(draw, (120, 145, 1060, 500), CREAM, radius=28, width=3)
        rounded_box(draw, (350, 185, 830, 255), GRAY, radius=18)
        centered_text(draw, (590, 220), "knowledge/archive/{feature}/", F_SMALL)
        docs = [
            ("requirement.md", BLUE),
            ("spec.md", TEAL),
            ("design.md", BEIGE),
            ("implementation.md", TEAL),
            ("test-report.md", BLUE),
            ("review-report.md", GRAY),
        ]
        centered_text(draw, (590, 292), "contains / 包含", F_TINY, MUTED)
        for i, (label, fill) in enumerate(docs):
            row, col = divmod(i, 3)
            x = 230 + col * 250
            y = 315 + row * 95
            rounded_box(draw, (x, y, x + 190, y + 60), fill, radius=16)
            centered_text(draw, (x + 95, y + 30), label, F_TINY, INK)

    save_png(name, size, render)
    svg = Svg(*size)
    svg.text(size[0] / 2, 58, "Knowledge Archive Unit", 34, 700)
    svg.text(size[0] / 2, 92, "一个需求沉淀为一个完整研发知识单元", 18, 400, MUTED)
    svg.box(120, 145, 940, 355, CREAM, 28)
    svg.box(350, 185, 480, 70, GRAY, 18)
    svg.text(590, 228, "knowledge/archive/{feature}/", 16, 600)
    svg.text(590, 299, "contains / 包含", 14, 400, MUTED)
    for i, (label, fill) in enumerate([
        ("requirement.md", BLUE),
        ("spec.md", TEAL),
        ("design.md", BEIGE),
        ("implementation.md", TEAL),
        ("test-report.md", BLUE),
        ("review-report.md", GRAY),
    ]):
        row, col = divmod(i, 3)
        x = 230 + col * 250
        y = 315 + row * 95
        svg.box(x, y, 190, 60, fill, 16)
        svg.text(x + 95, y + 37, label, 14, 600)
    svg.save(name)


def main():
    workflow()
    runtime_contract()
    project_structure()
    openspec_change()
    knowledge_archive()
    print(f"Generated README diagrams in {OUT}")


if __name__ == "__main__":
    main()
