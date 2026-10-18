"""
Crew Lens split-screen promo: Photos app (left) vs Crew Lens (right) on a wooden table,
then an end card. Inputs are real simulator recordings in rec/. Output: out/crewlens-split.mp4
(1080x1920, 15 s) and out/crewlens-split-app.mp4 (720x1080, 2:3 crop, silent, split screen only, looped on the welcome screen).
"""
import os, subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(ROOT, '..', '..', 'node_modules', '@expo-google-fonts', 'figtree')
F_XB = os.path.join(FONTS, '800ExtraBold', 'Figtree_800ExtraBold.ttf')
F_SB = os.path.join(FONTS, '600SemiBold', 'Figtree_600SemiBold.ttf')
BUILD = os.path.join(ROOT, 'build'); OUT = os.path.join(ROOT, 'out')
os.makedirs(BUILD, exist_ok=True); os.makedirs(OUT, exist_ok=True)

W, H = 1080, 1920
SPLIT_END = 13.0          # split screen runs 0-13 s, end card 13-15 s
INK = (34, 33, 30); WHITE = (255, 255, 255)

# Source segments (seconds in the raw recordings) and their playback speed-ups.
# Pre-cut constant-frame-rate clips (the raw simulator recordings are variable frame rate):
#   ffmpeg -i rec/left.mp4  -vf "fps=30,trim=start=6:end=52,setpts=PTS-STARTPTS" -an rec/left-cut.mp4
#   ffmpeg -i rec/right.mp4 -vf "fps=30,trim=start=7.0:end=24.0,setpts=PTS-STARTPTS" -an rec/right-cut.mp4
LEFT_SRC = ('rec/left-cut.mp4', 0.0, 46.0)   # 46 s of searching, played fast
RIGHT_SRC = ('rec/right-cut.mp4', 0.0, 17.0)  # 17 s of finding and sharing

SCREEN_W = 452
SCREEN_H = round(SCREEN_W * 2622 / 1206)   # simulator aspect
BEZEL = 14
PHONE_W, PHONE_H = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
PHONE_Y = 470
LEFT_X = (540 - PHONE_W) // 2
RIGHT_X = 540 + (540 - PHONE_W) // 2

def font(path, size): return ImageFont.truetype(path, size)

def rounded(size, radius, fill):
    im = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(im).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=fill)
    return im

def text_box(text, f, fg, bg, pad=(34, 20), radius=26):
    d = ImageDraw.Draw(Image.new('RGBA', (10, 10)))
    l, t, r, b = d.textbbox((0, 0), text, font=f)
    w, h = r - l + 2 * pad[0], b - t + 2 * pad[1]
    im = rounded((w, h), radius, bg)
    ImageDraw.Draw(im).text((pad[0] - l, pad[1] - t), text, font=f, fill=fg)
    return im

def base():
    bg = Image.open(os.path.join(ROOT, 'src', 'table.jpg')).convert('RGB')
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H)).convert('RGBA')
    bg.alpha_composite(Image.new('RGBA', (W, H), (0, 0, 0, 28)))
    # Title banner
    title = text_box('Finding one job photo', font(F_XB, 66), WHITE, INK + (255,), pad=(44, 26), radius=30)
    bg.alpha_composite(title, ((W - title.width) // 2, 96))
    # Side labels: white for the camera roll, black for Crew Lens
    left = text_box('Camera roll', font(F_XB, 52), INK, WHITE + (255,), pad=(40, 24), radius=28)
    right = text_box('Crew Lens', font(F_XB, 52), WHITE, INK + (255,), pad=(40, 24), radius=28)
    bg.alpha_composite(left, (270 - left.width // 2, 290))
    bg.alpha_composite(right, (810 - right.width // 2, 290))
    # Divider
    ImageDraw.Draw(bg).rectangle([539, 260, 541, H - 40], fill=(255, 255, 255, 230))
    # Phone shadows (static, soft)
    for x in (LEFT_X, RIGHT_X):
        sh = rounded((PHONE_W, PHONE_H), 70, (0, 0, 0, 120)).filter(ImageFilter.GaussianBlur(18))
        bg.alpha_composite(sh, (x + 8, PHONE_Y + 18))
    bg.convert('RGB').save(os.path.join(BUILD, 'base.png'))

def bezel():
    im = rounded((PHONE_W, PHONE_H), 70, (16, 16, 18, 255))
    ImageDraw.Draw(im).rounded_rectangle([2, 2, PHONE_W - 3, PHONE_H - 3], radius=68, outline=(70, 70, 76, 255), width=2)
    im.save(os.path.join(BUILD, 'bezel.png'))
    rounded((SCREEN_W, SCREEN_H), 56, (255, 255, 255, 255)).save(os.path.join(BUILD, 'mask.png'))

CAPTIONS = {
    'L': [('Scrolling for one job photo', 0.6, 4.6), ('Buried under personal pics', 4.6, 8.8), ("Still can't find it", 8.8, 13.0)],
    'R': [('Every job in one place', 0.6, 3.8), ('Sorted automatically', 3.8, 7.6), ('Found in seconds', 7.6, 13.0)],
}

def captions():
    f = font(F_XB, 38)
    files = []
    for side, items in CAPTIONS.items():
        for i, (text, t0, t1) in enumerate(items):
            im = text_box(text, f, WHITE, (17, 17, 19, 225), pad=(26, 16), radius=22)
            if im.width > 500:  # wrap long captions to two lines
                words = text.split(); half = len(words) // 2
                im = text_box(' '.join(words[:half]) + '\n' + ' '.join(words[half:]), f, WHITE, (17, 17, 19, 225), pad=(26, 16), radius=22)
            p = os.path.join(BUILD, f'cap-{side}{i}.png'); im.save(p)
            cx = 270 if side == 'L' else 810
            files.append((p, cx - im.width // 2, 1600, t0, t1))
    return files

def end_card():
    im = Image.new('RGBA', (W, H), (245, 244, 241, 255))
    icon = Image.open(os.path.join(ROOT, '..', '..', 'assets', 'images', 'icon.png')).convert('RGBA').resize((300, 300), Image.LANCZOS)
    m = rounded((300, 300), 68, (255, 255, 255, 255))
    icon.putalpha(m.split()[3])
    im.alpha_composite(icon, ((W - 300) // 2, 560))
    d = ImageDraw.Draw(im)
    def center(text, f, y, fill):
        l, t, r, b = d.textbbox((0, 0), text, font=f); d.text(((W - (r - l)) // 2 - l, y - t), text, font=f, fill=fill)
    center('Crew Lens', font(F_XB, 104), 930, INK)
    center('All your job photos. One place.', font(F_SB, 50), 1080, (110, 108, 103))
    btn = text_box('Get started', font(F_XB, 52), WHITE, INK + (255,), pad=(90, 34), radius=60)
    im.alpha_composite(btn, ((W - btn.width) // 2, 1240))
    im.convert('RGB').save(os.path.join(BUILD, 'end.png'))

def shake(seed):
    a, b = (0.9, 2.3) if seed == 0 else (1.1, 1.9)
    return f"5*sin(2*PI*{a}*t+{seed})+2*sin(2*PI*{b}*t)", f"4*sin(2*PI*{b}*t+{seed}*1.7)+2*sin(2*PI*{a}*t+0.5)"

def render():
    base(); bezel(); caps = captions(); end_card()
    lpath, l0, l1 = LEFT_SRC; rpath, r0, r1 = RIGHT_SRC
    lspeed = (l1 - l0) / SPLIT_END; rspeed = (r1 - r0) / SPLIT_END
    inputs = ['-loop', '1', '-t', str(SPLIT_END), '-i', os.path.join(BUILD, 'base.png'),
              '-i', os.path.join(ROOT, lpath),
              '-i', os.path.join(ROOT, rpath),
              '-loop', '1', '-t', str(SPLIT_END), '-i', os.path.join(BUILD, 'bezel.png'),
              '-loop', '1', '-t', str(SPLIT_END), '-i', os.path.join(BUILD, 'mask.png'),
              '-loop', '1', '-t', '2.6', '-i', os.path.join(BUILD, 'end.png')]
    for p, *_ in caps: inputs += ['-loop', '1', '-t', str(SPLIT_END), '-i', p]
    fc = []
    fc.append(f"[4:v]format=gray,split=2[mL][mR]")
    fc.append(f"[1:v]setpts=PTS/{lspeed:.4f},fps=30,scale={SCREEN_W}:{SCREEN_H},eq=saturation=0.68:brightness=-0.03:contrast=0.96,colorbalance=bs=0.07:bm=0.03,format=rgba[ls]")
    fc.append(f"[ls][mL]alphamerge[lsm]")
    fc.append(f"[2:v]setpts=PTS/{rspeed:.4f},fps=30,scale={SCREEN_W}:{SCREEN_H},eq=saturation=1.1:brightness=0.025,colorbalance=rs=0.05:rm=0.025,format=rgba[rs]")
    fc.append(f"[rs][mR]alphamerge[rsm]")
    fc.append(f"[3:v]split=2[bL][bR]")
    fc.append(f"[bL][lsm]overlay={BEZEL}:{BEZEL}:shortest=1[phL]")
    fc.append(f"[bR][rsm]overlay={BEZEL}:{BEZEL}:shortest=1[phR]")
    lx, ly = shake(0); rx, ry = shake(1)
    fc.append(f"[0:v][phL]overlay=x='{LEFT_X}+{lx}':y='{PHONE_Y}+{ly}':shortest=1[s1]")
    fc.append(f"[s1][phR]overlay=x='{RIGHT_X}+{rx}':y='{PHONE_Y}+{ry}':shortest=1[s2]")
    last = 's2'
    for i, (p, x, y, t0, t1) in enumerate(caps):
        idx = 6 + i
        fc.append(f"[{last}][{idx}:v]overlay={x}:{y}:enable='between(t,{t0},{t1})'[c{i}]")
        last = f'c{i}'
    fc.append(f"[{last}]fps=30,format=yuv420p,trim=duration={SPLIT_END},setpts=PTS-STARTPTS[split]")
    fc.append(f"[5:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[end]")
    fc.append(f"[split][end]xfade=transition=wipeleft:duration=0.6:offset={SPLIT_END - 0.6}[v]")
    out = os.path.join(OUT, 'crewlens-split.mp4')
    cmd = ['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[v]', '-t', '15',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    app = os.path.join(OUT, 'crewlens-split-app.mp4')
    # The welcome-screen loop is the split screen only: it stops before the end card wipes in.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-t', f'{SPLIT_END - 0.6:.1f}', '-vf', 'crop=1080:1620:0:80,scale=720:1080', '-an', '-c:v', 'libx264', '-preset', 'slow',
                    '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', app], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '9.5', '-i', out, '-frames:v', '1', '-vf', 'crop=1080:1620:0:80,scale=720:1080', os.path.join(OUT, 'poster.jpg')], check=True)
    print('wrote', out, app)

if __name__ == '__main__':
    render()
