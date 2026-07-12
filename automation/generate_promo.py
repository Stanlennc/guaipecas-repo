#!/usr/bin/env python3
"""Gera imagens de divulgação do Guaipecaz para redes sociais."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

from site_config import SITE_NAME, SITE_URL_DISPLAY

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
QR_PATH = ASSETS / "qr-guaipecaz.png"
SITE_URL = SITE_URL_DISPLAY

# Cores da marca
PAPER = (10, 15, 20)
PAPER_LIGHT = (18, 26, 34)
RIVER = (61, 173, 184)
RIVER_DARK = (45, 143, 152)
GOLD = (232, 168, 124)
INK = (232, 237, 242)
INK_SOFT = (139, 154, 171)
WHITE = (255, 255, 255)


def load_fonts():
    candidates = [
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        ("/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"),
    ]
    for bold_path, regular_path in candidates:
        bold_p, regular_p = Path(bold_path), Path(regular_path)
        if bold_p.exists() and regular_p.exists():
            return (
                ImageFont.truetype(str(bold_p), 72),
                ImageFont.truetype(str(bold_p), 42),
                ImageFont.truetype(str(regular_p), 34),
                ImageFont.truetype(str(regular_p), 28),
                ImageFont.truetype(str(bold_p), 36),
                ImageFont.truetype(str(regular_p), 24),
            )
    default = ImageFont.load_default()
    return default, default, default, default, default, default


def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def draw_gradient_bg(img, top_color, bottom_color):
    width, height = img.size
    base = Image.new("RGB", (width, height), top_color)
    overlay = Image.new("RGB", (width, height), bottom_color)
    mask = Image.linear_gradient("L").resize((width, height))
    return Image.composite(overlay, base, mask)


def add_glow_orbs(img):
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse((-80, 120, 280, 480), fill=(61, 173, 184, 35))
    gdraw.ellipse((760, -60, 1180, 360), fill=(232, 168, 124, 28))
    gdraw.ellipse((620, 720, 1080, 1120), fill=(61, 173, 184, 22))
    glow = glow.filter(ImageFilter.GaussianBlur(40))
    return Image.alpha_composite(img.convert("RGBA"), glow)


def paste_qr(canvas, qr_img, box_size, center_xy):
    qr = qr_img.convert("RGB").resize((box_size, box_size), Image.Resampling.NEAREST)
    pad = 28
    frame_size = box_size + pad * 2
    frame = Image.new("RGB", (frame_size, frame_size), WHITE)
    frame.paste(qr, (pad, pad))

    shadow = Image.new("RGBA", (frame_size + 20, frame_size + 20), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sdraw.rounded_rectangle((10, 10, frame_size + 10, frame_size + 10), radius=24, fill=(0, 0, 0, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(12))

    cx, cy = center_xy
    sx = cx - frame_size // 2
    sy = cy - frame_size // 2
    canvas_rgba = canvas.convert("RGBA")
    canvas_rgba.paste(shadow, (sx - 6, sy + 4), shadow)
    canvas_rgba.paste(frame, (sx, sy))
    return canvas_rgba.convert("RGB")


def draw_feed():
    w, h = 1080, 1080
    img = draw_gradient_bg(Image.new("RGB", (w, h)), PAPER_LIGHT, PAPER)
    img = add_glow_orbs(img)
    draw = ImageDraw.Draw(img)

    font_brand, font_tag, font_feat, font_small, font_cta, font_url = load_fonts()

    # Faixa superior
    draw.rectangle((0, 0, w, 8), fill=RIVER)

    # Marca
    draw.text((72, 72), SITE_NAME, font=font_brand, fill=INK)
    draw.text((72, 152), "Guaíba em Dia", font=font_tag, fill=RIVER)
    draw.text((72, 206), "Portal cidadão · Guaíba/RS", font=font_small, fill=INK_SOFT)

    # Destaque
    draw.text((72, 300), "Fique por dentro do que", font=font_feat, fill=INK)
    draw.text((72, 342), "acontece em Guaíba.", font=font_feat, fill=GOLD)

    features = [
        "Notícias locais (GuaibaNews)",
        "Nível dos rios em tempo real",
        "Saúde e unidades de atendimento",
        "Editais, concursos e vagas",
        "Serviços e links oficiais",
    ]
    y = 430
    for line in features:
        rounded_rect(draw, (72, y, 600, y + 52), 12, PAPER_LIGHT)
        draw.ellipse((92, y + 20, 108, y + 36), fill=RIVER)
        draw.text((122, y + 10), line, font=font_small, fill=INK)
        y += 64

    # QR
    qr = Image.open(QR_PATH)
    img = paste_qr(img, qr, 300, (800, 560))

    # CTA
    rounded_rect(draw, (640, 780, 1010, 860), 16, RIVER_DARK)
    draw.text((670, 802), "Escaneie o QR Code", font=font_cta, fill=WHITE)
    draw.text((670, 844), "com a câmera do celular", font=font_url, fill=INK)

    draw.text((72, 960), SITE_URL, font=font_cta, fill=RIVER)
    draw.text((72, 1004), "Gratuito · Atualizado · Para quem mora em Guaíba", font=font_url, fill=INK_SOFT)

    out = ASSETS / "anuncio-guaipecas-feed.png"
    img.save(out, "PNG", optimize=True)
    print(f"Gerado: {out}")
    return out


def draw_story():
    w, h = 1080, 1920
    img = draw_gradient_bg(Image.new("RGB", (w, h)), (14, 22, 30), PAPER)
    img = add_glow_orbs(img)
    draw = ImageDraw.Draw(img)
    draw.rectangle((0, 0, w, 10), fill=RIVER)

    font_brand, font_tag, font_feat, font_small, font_cta, font_url = load_fonts()
    font_brand_big = font_brand.font_variant(size=96) if hasattr(font_brand, "font_variant") else font_brand

    try:
        bold_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        font_brand_big = ImageFont.truetype(bold_path, 96)
        font_hero = ImageFont.truetype(bold_path, 52)
    except OSError:
        font_hero = font_tag

    draw.text((80, 120), SITE_NAME, font=font_brand_big, fill=INK)
    draw.text((80, 230), "Guaíba em Dia", font=font_tag, fill=RIVER)
    draw.text((80, 290), "O essencial da cidade no seu bolso", font=font_small, fill=INK_SOFT)

    draw.text((80, 400), "Notícias · Rios · Saúde", font=font_hero, fill=GOLD)
    draw.text((80, 468), "Editais · Serviços · Contatos", font=font_hero, fill=INK)

    qr = Image.open(QR_PATH)
    img = paste_qr(img, qr, 420, (540, 920))

    rounded_rect(draw, (120, 1180, 960, 1280), 20, RIVER_DARK)
    draw.text((180, 1210), "Aponte a câmera e acesse agora", font=font_cta, fill=WHITE)

    draw.text((80, 1360), SITE_URL, font=font_cta, fill=RIVER)
    draw.text((80, 1420), "Compartilhe com quem mora em Guaíba", font=font_feat, fill=INK_SOFT)

    bullets = ["Gratuito", "Atualizado automaticamente", "Funciona no celular"]
    y = 1520
    for b in bullets:
        draw.ellipse((80, y + 10, 96, y + 26), fill=GOLD)
        draw.text((112, y), b, font=font_small, fill=INK)
        y += 56

    draw.text((80, 1780), "Iniciativa cidadã independente", font=font_url, fill=INK_SOFT)

    out = ASSETS / "anuncio-guaipecas-story.png"
    img.save(out, "PNG", optimize=True)
    print(f"Gerado: {out}")
    return out


def main():
    if not QR_PATH.exists():
        raise SystemExit(f"QR não encontrado: {QR_PATH}")
    draw_feed()
    draw_story()


if __name__ == "__main__":
    main()
