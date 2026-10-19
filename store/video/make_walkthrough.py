"""
Crew Lens walkthrough promo: one phone on the wooden table going through the jobs, the stamped photos,
a gallery link for the client, then an invoice opened, signed, dated, saved and sent. All text sits at the
top: a black step headline and an orange callout whose arrow points down at the feature on screen.
Callouts ride with the phone's shake so the rings stay on target. Same look as make_video.py, no split screen.
Inputs: rec/walk.mp4 and rec/docs.mp4 (simulator recordings). Output: out/crewlens-walk.mp4 (1080x1920) and
out/crewlens-walk-app.mp4 (720x1080, 2:3 crop, silent, walkthrough only, for the welcome screen).
"""
import math, os, subprocess
from PIL import Image, ImageDraw, ImageFilter

from make_video import (ROOT, BUILD, OUT, W, H, INK, WHITE, F_XB, F_SB, font, rounded, text_box, end_card)

SOURCES = {'walk': os.path.join(ROOT, 'rec', 'walk.mp4'), 'docs': os.path.join(ROOT, 'rec', 'docs.mp4')}
ORANGE = (234, 74, 15)

# (recording, start, end, speed-up, step headline) in seconds of the raw recording; idle stretches are dropped.
SEGMENTS = [
    ('walk', 9.4, 15.9, 1.3, 'Every job, organized'),
    ('walk', 19.0, 25.9, 1.0, 'Every photo, time-stamped'),
    ('walk', 26.0, 38.4, 1.8, 'Send photos in one link'),
    ('walk', 38.4, 45.5, 1.1, 'Send photos in one link'),
    ('docs', 10.6, 16.6, 1.25, 'Invoices in the job'),
    ('docs', 16.6, 32.2, 3.0, 'Sign on your phone'),
    ('docs', 32.2, 38.6, 1.3, 'Sign on your phone'),
    ('docs', 38.6, 42.3, 0.9, 'Send it to the client'),
]

# Callouts, timed in raw-recording seconds. ring and target are fractions of the phone screen;
# the bubble sits in the band above the phone, nudged sideways toward its target.
CALLOUTS = [
    dict(src='walk', t=(9.7, 12.9), ring=(0.03, 0.355, 0.97, 0.66), target=(0.5, 0.35), text='Every job gets its own folder'),
    dict(src='walk', t=(13.1, 15.9), text='Kitchen, deck, framing.\nNever mixed up.'),
    dict(src='walk', t=(19.5, 21.2), ring=(0.03, 0.365, 0.97, 0.69), target=(0.3, 0.36), text='Sorted by day and time,\nautomatically'),
    dict(src='walk', t=(21.4, 23.5), ring=(0.015, 0.835, 0.43, 0.885), target=(0.2, 0.83), text='Date, time and initials\nstamped on every photo'),
    dict(src='walk', t=(23.6, 25.8), ring=(0.80, 0.835, 0.99, 0.885), target=(0.9, 0.83), text='Backed up the moment\nyou shoot'),
    dict(src='walk', t=(28.7, 30.7), ring=(0.02, 0.69, 0.98, 0.865), target=(0.5, 0.685), text='Share the whole job\nor just a few photos'),
    dict(src='walk', t=(31.4, 36.5), ring=(0.03, 0.44, 0.97, 0.70), target=(0.5, 0.44), text='Tap the photos you want'),
    dict(src='walk', t=(36.6, 38.4), ring=(0.03, 0.87, 0.97, 0.95), target=(0.5, 0.865), text='One tap makes the link'),
    dict(src='walk', t=(39.2, 40.8), ring=(0.29, 0.275, 0.46, 0.345), target=(0.375, 0.27), text='Link copied, ready to send'),
    dict(src='walk', t=(41.1, 45.5), ring=(0.02, 0.575, 0.98, 0.675), target=(0.5, 0.57), text='Text it to the client.\nNo app needed.'),
    dict(src='docs', t=(10.9, 13.0), ring=(0.02, 0.155, 0.98, 0.255), target=(0.5, 0.155), text='Invoices and contracts\nlive with the job'),
    dict(src='docs', t=(13.9, 16.6), ring=(0.03, 0.15, 0.97, 0.70), target=(0.5, 0.15), text='Open any PDF\nright on your phone'),
    dict(src='docs', t=(18.2, 32.0), ring=(0.03, 0.38, 0.97, 0.575), target=(0.5, 0.38), text='Sign it with your finger'),
    dict(src='docs', t=(32.4, 34.6), ring=(0.22, 0.455, 0.57, 0.55), target=(0.4, 0.455), text='Signature on the invoice'),
    dict(src='docs', t=(34.9, 37.0), ring=(0.09, 0.515, 0.27, 0.55), target=(0.18, 0.515), text="Today's date in one tap"),
    dict(src='docs', t=(37.9, 39.7), ring=(0.09, 0.095, 0.40, 0.13), target=(0.25, 0.095), text='Saved. Every version kept.'),
    dict(src='docs', t=(39.9, 42.3), ring=(0.02, 0.69, 0.98, 0.84), target=(0.5, 0.69), text='Text or email it\nto the client'),
]

# The closing card: benefits, not features. Same copy as src/constants/benefits.ts.
BENEFITS = [
    ('Find any job photo in seconds', 'No more digging through your camera roll.'),
    ('Proof for every job', 'Date, time and who took it, on every photo.'),
    ('Fewer client calls', 'One link shows them the progress.'),
    ('Get paid faster', 'Sign and send the invoice from the job site.'),
    ('Your whole crew on the same page', "Everyone's photos land in one job."),
]
CARD_SECONDS = 5.5

SCREEN_W = 620
SCREEN_H = round(SCREEN_W * 2622 / 1206)
BEZEL = 18
PHONE_W, PHONE_H = SCREEN_W + 2 * BEZEL, SCREEN_H + 2 * BEZEL
PHONE_X = (W - PHONE_W) // 2
PHONE_Y = 470
HEADLINE_Y = 64
BUBBLE_Y = 336        # centre of the callout band between the headline and the phone
APP_CROP_Y = 232      # 1080x1620 window that keeps the callouts and the phone, drops the headline

def out_time(src, src_t):
    """Raw-recording second -> second in the edited video."""
    t = 0.0
    for s, a, b, speed, _ in SEGMENTS:
        if s == src and a <= src_t <= b:
            return t + (src_t - a) / speed
        t += (b - a) / speed
    raise ValueError(f'{src} {src_t}s is not in any segment')

def screen_px(nx, ny):
    return PHONE_X + BEZEL + nx * SCREEN_W, PHONE_Y + BEZEL + ny * SCREEN_H

def shake():
    # Gentle handheld drift, shared by the phone and its callouts so the rings stay on target.
    return "4*sin(2*PI*0.9*t)+1.5*sin(2*PI*2.3*t)", "3*sin(2*PI*2.3*t)+1.5*sin(2*PI*0.9*t+0.5)"

def base():
    bg = Image.open(os.path.join(ROOT, 'src', 'table.jpg')).convert('RGB')
    s = max(W / bg.width, H / bg.height)
    bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
    bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H)).convert('RGBA')
    bg.alpha_composite(Image.new('RGBA', (W, H), (0, 0, 0, 28)))
    sh = rounded((PHONE_W, PHONE_H), 92, (0, 0, 0, 130)).filter(ImageFilter.GaussianBlur(22))
    bg.alpha_composite(sh, (PHONE_X + 10, PHONE_Y + 22))
    bg.convert('RGB').save(os.path.join(BUILD, 'walk-base.png'))

def bezel():
    im = rounded((PHONE_W, PHONE_H), 92, (16, 16, 18, 255))
    ImageDraw.Draw(im).rounded_rectangle([2, 2, PHONE_W - 3, PHONE_H - 3], radius=90, outline=(70, 70, 76, 255), width=3)
    im.save(os.path.join(BUILD, 'walk-bezel.png'))
    rounded((SCREEN_W, SCREEN_H), 76, (255, 255, 255, 255)).save(os.path.join(BUILD, 'walk-mask.png'))

def arrow(d, start, end, width=9):
    """Gently curved arrow from start to end with a solid head, white outline under orange."""
    (x0, y0), (x1, y1) = start, end
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0
    bend = 0.12 if dx >= 0 else -0.12
    cx, cy = mx - dy * bend, my + dx * bend
    pts = [((1 - s) ** 2 * x0 + 2 * (1 - s) * s * cx + s * s * x1, (1 - s) ** 2 * y0 + 2 * (1 - s) * s * cy + s * s * y1)
           for s in (i / 40 for i in range(41))]
    ang = math.atan2(y1 - pts[-4][1], x1 - pts[-4][0])
    head = 34
    tip = (x1, y1)
    left = (x1 - head * math.cos(ang - 0.45), y1 - head * math.sin(ang - 0.45))
    right = (x1 - head * math.cos(ang + 0.45), y1 - head * math.sin(ang + 0.45))
    back = (x1 - head * 0.8 * math.cos(ang), y1 - head * 0.8 * math.sin(ang))
    shaft = pts[:-3] + [back]
    d.line(shaft, fill=WHITE + (255,), width=width + 8, joint='curve')
    d.polygon([tip, left, right], fill=WHITE + (255,), outline=WHITE + (255,), width=8)
    d.line(shaft, fill=ORANGE + (255,), width=width, joint='curve')
    d.polygon([tip, left, right], fill=ORANGE + (255,))

def callout_png(i, c):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if c.get('ring'):
        x0, y0 = screen_px(*c['ring'][:2]); x1, y1 = screen_px(*c['ring'][2:])
        glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(glow).rounded_rectangle([x0, y0, x1, y1], radius=22, outline=ORANGE + (200,), width=18)
        im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(10)))
        d.rounded_rectangle([x0 - 3, y0 - 3, x1 + 3, y1 + 3], radius=24, outline=WHITE + (255,), width=12)
        d.rounded_rectangle([x0, y0, x1, y1], radius=22, outline=ORANGE + (255,), width=7)
    b = text_box(c['text'], font(F_XB, 46), WHITE, ORANGE + (255,), pad=(36, 22), radius=28)
    tx, ty = screen_px(*c['target']) if c.get('target') else (W / 2, 0)
    bx = W / 2 + (tx - W / 2) * 0.45  # lean toward the target so the arrow stays short
    bx = min(max(bx, b.width / 2 + 28), W - b.width / 2 - 28)
    left, top = int(bx - b.width / 2), int(BUBBLE_Y - b.height / 2)
    if c.get('target'):
        sx = min(max(tx, left + 50), left + b.width - 50)
        arrow(d, (sx, top + b.height), (tx, ty - 6))
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow.alpha_composite(rounded((b.width, b.height), 28, (0, 0, 0, 150)), (left + 6, top + 12))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(12)))
    im.alpha_composite(rounded((b.width + 10, b.height + 10), 32, WHITE + (255,)), (left - 5, top - 5))
    im.alpha_composite(b, (left, top))
    p = os.path.join(BUILD, f'walk-call{i}.png'); im.save(p)
    return p, out_time(c['src'], c['t'][0]), out_time(c['src'], c['t'][1])

def headlines():
    """One black headline per run of segments that share a step."""
    runs, t = [], 0.0
    for _, a, b, speed, text in SEGMENTS:
        dur = (b - a) / speed
        if runs and runs[-1][0] == text: runs[-1][2] = t + dur
        else: runs.append([text, t, t + dur])
        t += dur
    files = []
    for i, (text, t0, t1) in enumerate(runs):
        im = text_box(text, font(F_XB, 64), WHITE, INK + (255,), pad=(46, 26), radius=30)
        p = os.path.join(BUILD, f'walk-head{i}.png'); im.save(p)
        files.append((p, (W - im.width) // 2, HEADLINE_Y, t0, t1))
    return files, t

def benefits_card():
    """Light card with the title; each benefit row is its own layer so the rows can land one by one."""
    canvas = (245, 244, 241)
    im = Image.new('RGBA', (W, H), canvas + (255,))
    d = ImageDraw.Draw(im)
    f_title = font(F_XB, 84)
    for k, line in enumerate(['Why crews use', 'Crew Lens']):
        l, t, r, b = d.textbbox((0, 0), line, font=f_title)
        d.text(((W - (r - l)) // 2 - l, 300 + k * 100 - t), line, font=f_title, fill=INK)
    im.convert('RGB').save(os.path.join(BUILD, 'card-base.png'))
    rows, f_head, f_sub = [], font(F_XB, 50), font(F_SB, 38)
    for i, (head, sub) in enumerate(BENEFITS):
        row = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        rd = ImageDraw.Draw(row)
        y = 600 + i * 220
        rd.ellipse([96, y, 96 + 76, y + 76], fill=ORANGE + (255,))
        rd.line([(96 + 20, y + 40), (96 + 33, y + 53), (96 + 57, y + 25)], fill=WHITE + (255,), width=9, joint='curve')
        rd.text((206, y - 4), head, font=f_head, fill=INK)
        rd.text((206, y + 66), sub, font=f_sub, fill=(110, 108, 103))
        p = os.path.join(BUILD, f'card-row{i}.png'); row.save(p); rows.append(p)
    return rows

def render():
    base(); bezel(); end_card()
    rows = benefits_card()
    heads, total = headlines()
    calls = [callout_png(i, c) for i, c in enumerate(CALLOUTS)]
    names = list(SOURCES)
    inputs = ['-loop', '1', '-t', f'{total:.3f}', '-i', os.path.join(BUILD, 'walk-base.png'),
              '-loop', '1', '-t', f'{total:.3f}', '-i', os.path.join(BUILD, 'walk-bezel.png'),
              '-loop', '1', '-t', f'{total:.3f}', '-i', os.path.join(BUILD, 'walk-mask.png'),
              '-loop', '1', '-t', '2.6', '-i', os.path.join(BUILD, 'end.png')]
    for n in names: inputs += ['-i', SOURCES[n]]
    card_in = 4 + len(names)
    inputs += ['-loop', '1', '-t', f'{CARD_SECONDS}', '-i', os.path.join(BUILD, 'card-base.png')]
    for p in rows: inputs += ['-loop', '1', '-t', f'{CARD_SECONDS}', '-i', p]
    first_head = card_in + 1 + len(rows)
    for p, *_ in heads: inputs += ['-loop', '1', '-t', f'{total:.3f}', '-i', p]
    first_call = first_head + len(heads)
    for p, *_ in calls: inputs += ['-loop', '1', '-t', f'{total:.3f}', '-i', p]
    fc = []
    for k, n in enumerate(names):
        uses = [i for i, s in enumerate(SEGMENTS) if s[0] == n]
        fc.append(f"[{4 + k}:v]fps=30,scale={SCREEN_W}:{SCREEN_H},setsar=1,split={len(uses)}" + ''.join(f'[r{i}]' for i in uses))
    for i, (_, a, b, speed, _) in enumerate(SEGMENTS):
        fc.append(f"[r{i}]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{speed}[g{i}]")
    fc.append(''.join(f'[g{i}]' for i in range(len(SEGMENTS))) + f"concat=n={len(SEGMENTS)}:v=1:a=0,fps=30,format=rgba[scr]")
    fc.append("[2:v]format=gray[m]")
    fc.append("[scr][m]alphamerge[scrm]")
    fc.append(f"[1:v][scrm]overlay={BEZEL}:{BEZEL}:shortest=1[ph]")
    x, y = shake()
    fc.append(f"[0:v][ph]overlay=x='{PHONE_X}+{x}':y='{PHONE_Y}+{y}':shortest=1[s0]")
    last = 's0'
    for i, (p, hx, hy, t0, t1) in enumerate(heads):
        fc.append(f"[{last}][{first_head + i}:v]overlay={hx}:{hy}:enable='between(t,{t0:.2f},{t1:.2f})'[h{i}]")
        last = f'h{i}'
    for i, (p, t0, t1) in enumerate(calls):
        fc.append(f"[{first_call + i}:v]format=rgba,fade=in:st={t0:.2f}:d=0.2:alpha=1,fade=out:st={max(t0, t1 - 0.2):.2f}:d=0.2:alpha=1[k{i}]")
        fc.append(f"[{last}][k{i}]overlay=x='{x}':y='{y}':enable='between(t,{t0:.2f},{t1:.2f})'[a{i}]")
        last = f'a{i}'
    fc.append(f"[{last}]fps=30,format=yuv420p,trim=duration={total:.3f},setpts=PTS-STARTPTS[walk]")
    fc.append(f"[{card_in}:v]fps=30,format=rgba[cb]")
    card = 'cb'
    for i in range(len(rows)):
        t0 = 0.7 + i * 0.45
        fc.append(f"[{card_in + 1 + i}:v]format=rgba,fade=in:st={t0:.2f}:d=0.3:alpha=1[cr{i}]")
        fc.append(f"[{card}][cr{i}]overlay=0:0[cc{i}]")
        card = f'cc{i}'
    fc.append(f"[{card}]fps=30,format=yuv420p,trim=duration={CARD_SECONDS},setpts=PTS-STARTPTS[card]")
    fc.append("[3:v]fps=30,format=yuv420p,setpts=PTS-STARTPTS[end]")
    fc.append(f"[walk][card]xfade=transition=wipeleft:duration=0.6:offset={total - 0.6:.3f}[wc]")
    fc.append(f"[wc][end]xfade=transition=fade:duration=0.6:offset={total + CARD_SECONDS - 1.2:.3f}[v]")
    out = os.path.join(OUT, 'crewlens-walk.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[v]', '-t', f'{total + CARD_SECONDS + 0.8:.3f}',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], check=True)
    app = os.path.join(OUT, 'crewlens-walk-app.mp4')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-t', f'{total - 0.6:.2f}', '-vf', f'crop=1080:1620:0:{APP_CROP_Y},scale=720:1080', '-an',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', app], check=True)
    print('wrote', out, app, f'{total:.1f}s + benefits card + end card')

if __name__ == '__main__':
    render()
