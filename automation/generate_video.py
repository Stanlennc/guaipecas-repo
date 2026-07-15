#!/usr/bin/env python3
"""Gera vídeo promocional de 30s do Guaipecaz para redes sociais."""

from __future__ import annotations

import math
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from site_config import SITE_NAME, SITE_URL_DISPLAY

try:
    import imageio_ffmpeg
except ImportError:
    imageio_ffmpeg = None

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
AUDIOS = ROOT / "audios"
OUT_VIDEO = ASSETS / "video-guaipecaz-30s.mp4"
QR_PATH = ASSETS / "qr-guaipecaz.png"
# Mixkit Stock Music Free License — Hip Hop 02 (Lily J)
AUDIO_TRACK = AUDIOS / "mixkit-hip-hop-02-738.mp3"
SITE_URL = SITE_URL_DISPLAY

W, H = 1080, 1920
FPS = 30
DURATION = 30.0
AUDIO_VOLUME = 0.3
AUDIO_FADE_IN = 1.5
AUDIO_FADE_OUT = 2.5
SLIDE_COUNT = 6
SLIDE_FRAMES = int(DURATION / SLIDE_COUNT * FPS)  # 150 frames = 5s each

# Cores
PAPER = (10, 15, 20)
PAPER_LIGHT = (18, 26, 34)
PAPER_CARD = (24, 34, 44)
RIVER = (61, 173, 184)
RIVER_DARK = (45, 143, 152)
GOLD = (232, 168, 124)
INK = (232, 237, 242)
INK_SOFT = (139, 154, 171)
WHITE = (255, 255, 255)
GREEN = (78, 201, 160)
ORANGE = (232, 168, 124)
RED = (232, 93, 93)


def fonts():
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    reg = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    if Path(bold).exists():
        return {
            "hero": ImageFont.truetype(bold, 88),
            "title": ImageFont.truetype(bold, 62),
            "subtitle": ImageFont.truetype(bold, 44),
            "body": ImageFont.truetype(reg, 34),
            "small": ImageFont.truetype(reg, 28),
            "badge": ImageFont.truetype(bold, 30),
            "cta": ImageFont.truetype(bold, 40),
            "url": ImageFont.truetype(bold, 36),
            "mock": ImageFont.truetype(reg, 26),
            "mock_bold": ImageFont.truetype(bold, 28),
        }
    d = ImageFont.load_default()
    return {k: d for k in ("hero", "title", "subtitle", "body", "small", "badge", "cta", "url", "mock", "mock_bold")}


F = fonts()


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


def ease_out(t: float) -> float:
    return 1 - (1 - t) ** 3


def gradient_bg() -> Image.Image:
    top = Image.new("RGB", (W, H), (14, 22, 30))
    bottom = Image.new("RGB", (W, H), PAPER)
    mask = Image.linear_gradient("L").resize((W, H))
    base = Image.composite(bottom, top, mask)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow)
    g.ellipse((-120, 80, 320, 520), fill=(61, 173, 184, 40))
    g.ellipse((700, -100, 1180, 380), fill=(232, 168, 124, 30))
    g.ellipse((500, 1400, 1100, 1920), fill=(61, 173, 184, 25))
    glow = glow.filter(ImageFilter.GaussianBlur(50))
    return Image.alpha_composite(base.convert("RGBA"), glow).convert("RGB")


def rounded(draw, xy, r, fill, outline=None):
    draw.rounded_rectangle(xy, radius=r, fill=fill, outline=outline)


def draw_progress(draw, y, progress, color=RIVER):
    rounded(draw, (80, y, W - 80, y + 6), 3, PAPER_CARD)
    w = int((W - 160) * progress)
    if w > 0:
        rounded(draw, (80, y, 80 + w, y + 6), 3, color)


def fade_alpha(t: float, fade_in=0.15, fade_out=0.85) -> float:
    if t < fade_in:
        return ease_out(t / fade_in)
    if t > fade_out:
        return ease_out((1 - t) / (1 - fade_out))
    return 1.0


def overlay_text(img, xy, text, font, fill, alpha: float):
    if alpha <= 0.01:
        return img
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r, g, b = fill[:3]
    d.text(xy, text, font=font, fill=(r, g, b, int(255 * alpha)))
    return Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")


def mock_header(draw, section: str, alpha: float):
    if alpha < 0.1:
        return
    c = int(255 * alpha)
    rounded(draw, (80, 200, 360, 260), 14, (*PAPER_LIGHT, c) if False else PAPER_LIGHT)
    draw.text((100, 212), SITE_NAME, font=F["badge"], fill=(*INK_SOFT,))
    rounded(draw, (80, 280, 280, 340), 20, RIVER_DARK)
    draw.text((100, 292), section, font=F["badge"], fill=WHITE)


def slide_intro(t: float) -> Image.Image:
    img = gradient_bg().convert("RGBA")
    draw = ImageDraw.Draw(img)
    a = fade_alpha(t)
    zoom = lerp(1.0, 1.04, t)

    # Barra topo
    draw.rectangle((0, 0, W, 10), fill=RIVER)

    texts = [
        ((80, 420), "Morou em Guaíba?", F["hero"], GOLD, a),
        ((80, 530), SITE_NAME, F["title"], INK, a * ease_out(min(1, t / 0.25))),
        ((80, 610), "Guaíba em Dia", F["subtitle"], RIVER, a * ease_out(min(1, (t - 0.08) / 0.25))),
        ((80, 700), "Tudo da cidade num só lugar.", F["body"], INK, a * ease_out(min(1, (t - 0.15) / 0.25))),
        ((80, 760), "Notícias. Rios. Saúde. Editais.", F["body"], INK_SOFT, a * ease_out(min(1, (t - 0.22) / 0.25))),
    ]
    img = img.convert("RGB")
    for xy, txt, font, color, alpha in texts:
        img = overlay_text(img, xy, txt, font, color, alpha)

    draw = ImageDraw.Draw(img)
    card_a = a * ease_out(min(1, (t - 0.3) / 0.3))
    if card_a > 0.05:
        cy = int(lerp(980, 960, zoom))
        rounded(draw, (80, cy, W - 80, cy + 280), 20, PAPER_LIGHT)
        draw.text((110, cy + 36), "Portal cidadão · Gratuito · No celular", font=F["mock_bold"], fill=RIVER)
        draw.text((110, cy + 90), "Fique por dentro do que", font=F["body"], fill=INK)
        draw.text((110, cy + 140), "acontece em Guaíba.", font=F["body"], fill=GOLD)
        draw.text((110, cy + 210), "Atualizado automaticamente para você.", font=F["small"], fill=INK_SOFT)

    draw_progress(draw, H - 120, (t + 0) / SLIDE_COUNT * SLIDE_COUNT / SLIDE_COUNT)
    draw_progress(draw, H - 120, 1 / SLIDE_COUNT)
    return img


def slide_guibanews(t: float) -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    a = fade_alpha(t)
    mock_header(draw, "GuaibaNews", a)

    img = overlay_text(img, (80, 400), "Notícias de Guaíba", F["title"], INK, a)
    img = overlay_text(img, (80, 480), "reunidas pra você.", F["title"], GOLD, a * ease_out(min(1, (t - 0.1) / 0.2)))
    img = overlay_text(img, (80, 580), "Repórter Guaibense, Litoral Sul e mais.", F["body"], INK_SOFT, a * ease_out(min(1, (t - 0.15) / 0.2)))
    img = overlay_text(img, (80, 640), "Atualizado a cada 2 horas.", F["body"], RIVER, a * ease_out(min(1, (t - 0.2) / 0.2)))

    draw = ImageDraw.Draw(img)
    headlines = [
        ("Repórter Guaibense", "Prefeitura anuncia novas obras no bairro", "há 1h"),
        ("Portal Litoral Sul", "Trânsito alterado na BR-116 nesta semana", "há 3h"),
        ("Correio do Povo", "Região Metropolitana em alerta de chuva", "há 5h"),
    ]
    y = 760
    for i, (src, title, when) in enumerate(headlines):
        ca = a * ease_out(min(1, (t - 0.25 - i * 0.08) / 0.2))
        if ca < 0.05:
            continue
        rounded(draw, (80, y, W - 80, y + 110), 16, PAPER_LIGHT)
        draw.text((100, y + 16), src, font=F["mock"], fill=RIVER)
        draw.text((100, y + 50), title[:42] + ("…" if len(title) > 42 else ""), font=F["mock_bold"], fill=INK)
        draw.text((100, y + 82), when, font=F["mock"], fill=INK_SOFT)
        y += 126

    img = overlay_text(img, (80, 1280), "Pare de caçar notícia em 5 apps.", F["body"], GOLD, a * ease_out(min(1, (t - 0.5) / 0.2)))
    img = overlay_text(img, (80, 1340), f"Abra o {SITE_NAME} e pronto.", F["body"], INK, a * ease_out(min(1, (t - 0.55) / 0.2)))

    draw = ImageDraw.Draw(img)
    draw_progress(draw, H - 120, 2 / SLIDE_COUNT)
    return img


def slide_agora(t: float) -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    a = fade_alpha(t)
    mock_header(draw, "Agora", a)

    img = overlay_text(img, (80, 400), "Rios e clima", F["title"], INK, a)
    img = overlay_text(img, (80, 480), "em tempo real.", F["title"], RIVER, a * ease_out(min(1, (t - 0.1) / 0.2)))
    img = overlay_text(img, (80, 580), "Saiba antes da enchente chegar.", F["body"], GOLD, a * ease_out(min(1, (t - 0.15) / 0.2)))
    img = overlay_text(img, (80, 640), "Dados atualizados a cada 30 minutos.", F["body"], INK_SOFT, a * ease_out(min(1, (t - 0.2) / 0.2)))

    draw = ImageDraw.Draw(img)
    cards = [
        ("Rio Guaíba", "0,66 m", "Normal", GREEN, 760),
        ("Rio Jacuí", "2,30 m", "Vigiar", ORANGE, 980),
    ]
    for name, level, status, color, y in cards:
        ca = a * ease_out(min(1, (t - 0.25 - (y - 760) / 400) / 0.2))
        rounded(draw, (80, y, 520, y + 180), 18, PAPER_LIGHT)
        draw.text((100, y + 20), name, font=F["mock_bold"], fill=INK)
        draw.text((100, y + 60), level, font=F["title"], fill=RIVER)
        draw.ellipse((100, y + 130, 116, y + 146), fill=color)
        draw.text((128, y + 126), status, font=F["mock"], fill=INK)

    rounded(draw, (560, 760, W - 80, 1160), 18, PAPER_LIGHT)
    draw.text((580, 800), "Clima em Guaíba", font=F["mock_bold"], fill=INK)
    draw.text((580, 860), "24°C", font=F["title"], fill=GOLD)
    draw.text((580, 940), "Chuva prevista hoje", font=F["body"], fill=INK_SOFT)
    draw.text((580, 1000), "Defesa Civil: 199", font=F["mock_bold"], fill=RED)

    img = overlay_text(img, (80, 1220), "Quando chove, cada minuto conta.", F["body"], INK, a * ease_out(min(1, (t - 0.55) / 0.2)))

    draw = ImageDraw.Draw(img)
    draw_progress(draw, H - 120, 3 / SLIDE_COUNT)
    return img


def slide_servicos(t: float) -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    a = fade_alpha(t)
    mock_header(draw, "Serviços", a)

    img = overlay_text(img, (80, 400), "O que você precisa", F["title"], INK, a)
    img = overlay_text(img, (80, 480), "hoje em Guaíba.", F["title"], GOLD, a * ease_out(min(1, (t - 0.1) / 0.2)))
    img = overlay_text(img, (80, 580), "Links oficiais. Sem enrolação.", F["body"], INK_SOFT, a * ease_out(min(1, (t - 0.15) / 0.2)))

    services = [
        ("Farmácia de plantão", "Qual está aberta agora", RIVER),
        ("Horários de ônibus", "Linhas e itinerários", GREEN),
        ("Coleta de lixo", "Dias por bairro", ORANGE),
        ("Agenda de eventos", "O que rola na cidade", GOLD),
        ("Vagas e empregos", "Oportunidades locais", (139, 156, 246)),
    ]
    y = 700
    for i, (title, desc, color) in enumerate(services):
        ca = a * ease_out(min(1, (t - 0.2 - i * 0.07) / 0.2))
        if ca < 0.05:
            continue
        rounded(draw, (80, y, W - 80, y + 100), 16, PAPER_LIGHT)
        draw.ellipse((100, y + 38, 116, y + 54), fill=color)
        draw.text((132, y + 22), title, font=F["mock_bold"], fill=INK)
        draw.text((132, y + 58), desc, font=F["mock"], fill=INK_SOFT)
        y += 116

    img = overlay_text(img, (80, 1420), "Menos busca. Mais solução.", F["body"], GOLD, a * ease_out(min(1, (t - 0.55) / 0.2)))

    draw = ImageDraw.Draw(img)
    draw_progress(draw, H - 120, 4 / SLIDE_COUNT)
    return img


def slide_saude_editais(t: float) -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    a = fade_alpha(t)
    mock_header(draw, "Saúde · Diário", a)

    img = overlay_text(img, (80, 400), "Saúde e oportunidades", F["title"], INK, a)
    img = overlay_text(img, (80, 480), "na palma da mão.", F["title"], RIVER, a * ease_out(min(1, (t - 0.1) / 0.2)))

    draw = ImageDraw.Draw(img)
    ca = a * ease_out(min(1, (t - 0.2) / 0.25))
    rounded(draw, (80, 580, 500, 920), 18, PAPER_LIGHT)
    draw.text((100, 610), "Mapa de UBS", font=F["mock_bold"], fill=INK)
    draw.text((100, 660), "Encontre atendimento perto", font=F["mock"], fill=INK_SOFT)
    # mock map dots
    for dx, dy in [(140, 740), (220, 780), (300, 720), (180, 830), (260, 860)]:
        draw.ellipse((dx, dy, dx + 18, dy + 18), fill=RIVER)
    rounded(draw, (120, 800, 460, 880), 12, PAPER_CARD)
    draw.text((140, 830), "Unidades de saúde em Guaíba", font=F["mock"], fill=INK_SOFT)

    rounded(draw, (530, 580, W - 80, 920), 18, PAPER_LIGHT)
    draw.text((550, 610), "Editais e vagas", font=F["mock_bold"], fill=GOLD)
    editais = ["Concurso Prefeitura Guaíba", "Edital de licitação", "Vaga temporária SMS"]
    ey = 670
    for ed in editais:
        draw.text((550, ey), "• " + ed, font=F["mock"], fill=INK)
        ey += 52

    img = overlay_text(img, (80, 980), "Não perca concurso nem plantão.", F["body"], GOLD, a * ease_out(min(1, (t - 0.45) / 0.2)))
    img = overlay_text(img, (80, 1040), f"O {SITE_NAME} avisa você.", F["body"], INK, a * ease_out(min(1, (t - 0.5) / 0.2)))

    draw = ImageDraw.Draw(img)
    draw_progress(draw, H - 120, 5 / SLIDE_COUNT)
    return img


def slide_cta(t: float) -> Image.Image:
    img = gradient_bg()
    draw = ImageDraw.Draw(img)
    a = fade_alpha(t)

    img = overlay_text(img, (80, 380), "Acesse agora.", F["hero"], GOLD, a)
    img = overlay_text(img, (80, 490), "Grátis. No celular.", F["title"], INK, a * ease_out(min(1, (t - 0.1) / 0.2)))
    img = overlay_text(img, (80, 570), "Feito para quem mora em Guaíba.", F["body"], RIVER, a * ease_out(min(1, (t - 0.15) / 0.2)))

    if QR_PATH.exists():
        ca = a * ease_out(min(1, (t - 0.25) / 0.25))
        if ca > 0.05:
            qr = Image.open(QR_PATH).convert("RGB").resize((340, 340), Image.Resampling.NEAREST)
            pad = 24
            frame = Image.new("RGB", (qr.width + pad * 2, qr.height + pad * 2), WHITE)
            frame.paste(qr, (pad, pad))
            px = (W - frame.width) // 2
            py = 700
            img.paste(frame, (px, py))

    img = overlay_text(img, (80, 1120), SITE_URL, F["url"], RIVER, a * ease_out(min(1, (t - 0.4) / 0.2)))
    img = overlay_text(img, (80, 1180), "Salve na tela inicial do celular", F["body"], INK_SOFT, a * ease_out(min(1, (t - 0.45) / 0.2)))

    draw = ImageDraw.Draw(img)
    ba = a * ease_out(min(1, (t - 0.5) / 0.2))
    if ba > 0.05:
        rounded(draw, (80, 1280, W - 80, 1380), 20, RIVER_DARK)
        draw.text((W // 2 - 280, 1318), "COMPARTILHE COM GUAÍBA", font=F["cta"], fill=WHITE)

    draw.text((80, 1480), f"{SITE_NAME} · Iniciativa cidadã independente", font=F["small"], fill=INK_SOFT)

    draw = ImageDraw.Draw(img)
    draw_progress(draw, H - 120, 1.0)
    return img


SLIDES = [
    slide_intro,
    slide_guibanews,
    slide_agora,
    slide_servicos,
    slide_saude_editais,
    slide_cta,
]


def render_frames() -> list[Path]:
    tmp = Path(tempfile.mkdtemp(prefix="guaipecaz-video-"))
    paths: list[Path] = []
    frame_idx = 0

    for slide_i, slide_fn in enumerate(SLIDES):
        for f in range(SLIDE_FRAMES):
            t = f / SLIDE_FRAMES
            # crossfade no início/fim do slide
            if slide_i > 0 and f < 12:
                t_blend = f / 12
                prev = SLIDES[slide_i - 1](1.0 - t_blend * 0.3)
                curr = slide_fn(t)
                img = Image.blend(prev.convert("RGB"), curr.convert("RGB"), ease_out(t_blend))
            else:
                img = slide_fn(t)

            path = tmp / f"frame_{frame_idx:05d}.png"
            img.save(path, "PNG")
            paths.append(path)
            frame_idx += 1

    return paths


def encode_video(frame_paths: list[Path], out: Path, audio: Path | None = None) -> None:
    if not frame_paths:
        raise SystemExit("Nenhum frame gerado.")

    if imageio_ffmpeg is None:
        raise SystemExit("Instale: pip install imageio-ffmpeg")

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    pattern = str(frame_paths[0].parent / "frame_%05d.png")

    cmd = [
        ffmpeg, "-y",
        "-framerate", str(FPS),
        "-i", pattern,
    ]

    use_audio = audio is not None and audio.exists()
    if use_audio:
        fade_out_start = max(0.0, DURATION - AUDIO_FADE_OUT)
        afilter = (
            f"[1:a]atrim=0:{DURATION},asetpts=PTS-STARTPTS,"
            f"volume={AUDIO_VOLUME},"
            f"afade=t=in:st=0:d={AUDIO_FADE_IN},"
            f"afade=t=out:st={fade_out_start}:d={AUDIO_FADE_OUT}[a]"
        )
        cmd.extend(["-i", str(audio), "-filter_complex", afilter, "-map", "0:v", "-map", "[a]"])
    else:
        if audio is not None:
            print(f"Aviso: trilha não encontrada ({audio}), gerando vídeo sem áudio.")

    cmd.extend([
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-crf", "20",
        "-preset", "medium",
    ])
    if use_audio:
        cmd.extend(["-c:a", "aac", "-b:a", "128k"])
    cmd.extend(["-movflags", "+faststart", str(out)])

    subprocess.run(cmd, check=True, capture_output=True)


def main():
    ASSETS.mkdir(parents=True, exist_ok=True)
    print(f"Gerando {int(DURATION * FPS)} frames ({DURATION}s @ {FPS}fps)...")
    frames = render_frames()
    if AUDIO_TRACK.exists():
        print(f"Codificando vídeo + trilha ({AUDIO_TRACK.name}) → {OUT_VIDEO}")
    else:
        print(f"Codificando vídeo → {OUT_VIDEO}")
    encode_video(frames, OUT_VIDEO, audio=AUDIO_TRACK)
    # cleanup temp frames
    for p in frames:
        p.unlink(missing_ok=True)
    frames[0].parent.rmdir()
    size_mb = OUT_VIDEO.stat().st_size / (1024 * 1024)
    print(f"Pronto: {OUT_VIDEO} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
