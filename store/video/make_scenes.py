"""
Onboarding "Here's how it goes now" scenes, one per thing Crew Lens is for: every photo organized by project,
a link the client opens, and the invoice signed and sent from the job. Each opens on a few seconds of the
everyday moment (generated first-person footage, or a camera roll built from real photos), then the real
Crew Lens recording, zoomed into a 4:5 window with the same orange callouts as the walkthrough.
Output: ../../assets/video/scenes/<scene>.mp4 and <scene>.jpg (poster), silent, 864x1080, plus the step
timings to paste into src/constants/scene-media.ts.
Inputs (rec/ is not committed): rec/app-organized.mov, rec/walk.mp4, rec/docs.mp4 (simulator recordings),
rec/pov-share.mp4 and rec/pov-invoice.mp4 (Higgsfield, 9:16).
"""
import json, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter, ImageOps

from make_video import ROOT, BUILD, WHITE, F_XB, font, rounded, text_box
from make_walkthrough import ORANGE, arrow

W, H = 864, 1080
FPS = 30
XFADE = 0.3
ASSETS = os.path.join(ROOT, '..', '..', 'assets', 'video', 'scenes')

def ease(a, b, t0, t1):
    """ffmpeg expression: a until t0, smoothstep to b by t1, then b."""
    p = f'clip((t-{t0})/{t1 - t0},0,1)'
    return f'({a}+({b}-{a})*({p}*{p}*(3-2*{p})))'

# Segments: (raw start, raw seconds, crop-y in recording pixels or an expression of t, speed-up).
# B stands for the window resting on the bottom of the screen.
# Callouts and steps are timed in seconds of the app part (after speed-ups), rings in output pixels.
SCENES = {
    'organized': dict(
        opener=dict(kind='roll', dur=3.8, caption='Which one was the\nHenderson job?'),
        app='app-organized.mov',
        segments=[
            (11.4, 1.6, '0', 1),
            (13.0, 2.6, ease(0, 'B', 0.3, 1.3), 1),
            (21.8, 4.4, f"if(lt(t,1.5),{ease('B', 600, 0.0, 0.4)},{ease(600, 'B', 1.5, 2.3)})", 1),
        ],
        callouts=[
            dict(t=(0.1, 1.0), ring=(24, 606, 840, 1070), text='Every project gets\nits own folder'),
            dict(t=(2.9, 4.2), ring=(20, 590, 844, 928), text='Sorted by day,\nautomatically'),
            dict(t=(6.6, 8.6), ring=(28, 788, 432, 896), text='Time, place and\nwho took it'),
        ],
        steps=[('Every project in its own folder', 0.0), ('Sorted by day, automatically', 2.9), ('Stamped with time and place', 6.6)],
    ),
    'share': dict(
        opener=dict(kind='pov', src='pov-share.mp4', start=0.2, dur=4.4, crop_y=230, caption='"Can you send me pictures\nof how it\'s going?"'),
        app='walk.mp4',
        segments=[
            (27.6, 3.2, 'B', 1),
            (31.0, 5.6, '700', 2.0),
            (36.5, 2.0, 'B', 1),
            (41.0, 3.0, 'B', 1),
        ],
        callouts=[
            dict(t=(0.9, 3.2), ring=(20, 500, 844, 800), text='The whole job,\nor just a few photos'),
            dict(t=(3.4, 6.0), ring=(20, 320, 844, 860), text='Tap the photos you want'),
            dict(t=(6.1, 7.9), ring=(24, 845, 840, 975), text='One tap makes the link'),
            dict(t=(8.3, 11.0), ring=(20, 330, 844, 470), text='Text it to the client.\nNo app needed.'),
        ],
        steps=[('The whole job, or a few photos', 0.0), ('One tap makes the link', 6.0), ('Text it. No app needed.', 8.0)],
    ),
    'invoice': dict(
        opener=dict(kind='pov', src='pov-invoice.mp4', start=0.2, dur=4.4, crop_y=230, caption='"It looks amazing.\nJust send me the invoice."'),
        app='docs.mp4',
        segments=[
            (10.6, 2.6, '0', 1),
            (18.0, 14.0, '600', 3.5),
            (32.3, 2.2, '600', 1),
            (39.8, 2.5, 'B', 1),
        ],
        callouts=[
            dict(t=(0.4, 2.6), ring=(20, 290, 844, 480), text='The invoice lives\nwith the job', below=True),
            dict(t=(2.9, 6.6), ring=(24, 272, 840, 645), text='Sign it with your finger'),
            dict(t=(6.7, 8.8), ring=(185, 415, 525, 610), text='Signed on the invoice'),
            dict(t=(9.0, 11.3), ring=(20, 490, 844, 800), text='Text or email it\nto the client'),
        ],
        steps=[('The invoice lives with the job', 0.0), ('Sign it with your finger', 2.6), ('Send it before you leave', 8.8)],
    ),
}

def caption_png(text, path):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    b = text_box(text, font(F_XB, 40), WHITE, (0, 0, 0, 150), pad=(28, 18), radius=22)
    im.alpha_composite(b, ((W - b.width) // 2, int(H * 0.885) - b.height // 2))
    im.save(path)

def callout_png(c, path):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = c['ring']
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle([x0, y0, x1, y1], radius=20, outline=ORANGE + (200,), width=16)
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(9)))
    d.rounded_rectangle([x0 - 3, y0 - 3, x1 + 3, y1 + 3], radius=22, outline=WHITE + (255,), width=10)
    d.rounded_rectangle([x0, y0, x1, y1], radius=20, outline=ORANGE + (255,), width=6)
    b = text_box(c['text'], font(F_XB, 38), WHITE, ORANGE + (255,), pad=(28, 18), radius=24)
    tx = (x0 + x1) / 2
    left = int(min(max(tx - b.width / 2, 24), W - b.width - 24))
    sx = min(max(tx, left + 44), left + b.width - 44)
    top = y0 - 110 - b.height
    if top < 24 or c.get('below'):  # no room above, or it would cover a title: sit below the ring and point up
        top = y1 + 110
        arrow(d, (sx, top), (tx, y1 + 8), width=7)
    else:
        arrow(d, (sx, top + b.height), (tx, y0 - 8), width=7)
    top = int(top)
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shadow.alpha_composite(rounded((b.width, b.height), 24, (0, 0, 0, 140)), (left + 5, top + 10))
    im.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(10)))
    im.alpha_composite(rounded((b.width + 8, b.height + 8), 28, WHITE + (255,)), (left - 4, top - 4))
    im.alpha_composite(b, (left, top))
    im.save(path)

def run(args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args, check=True)

def size(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path],
                         check=True, capture_output=True, text=True).stdout
    s = json.loads(out)['streams'][0]
    return s['width'], s['height']

ENC = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-an']

def roll_opener(name, o, out):
    """A crowded camera roll scrolling past: a few job photos lost between dinners, receipts and the dog."""
    src = os.path.join(ROOT, 'src')
    personal = sorted(f for f in os.listdir(src) if f.startswith('clutter-'))
    job = sorted(f for f in os.listdir(src) if f.startswith(('roof-', 'kitchen-')))
    rng = random.Random(7)
    files = []
    while len(files) < 64:
        batch = personal * 2 + job
        rng.shuffle(batch)
        files += [f for f in batch if not files or f != files[-1]]
    cols, gap = 4, 3
    tile = (W - gap * (cols - 1)) // cols
    rows = len(files) // cols
    sheet = Image.new('RGB', (W, rows * (tile + gap)), (255, 255, 255))
    for i, f in enumerate(files[: rows * cols]):
        im = ImageOps.fit(Image.open(os.path.join(src, f)).convert('RGB'), (tile, tile), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * (tile + gap), (i // cols) * (tile + gap)))
    sheet_path = os.path.join(BUILD, f'scene-{name}-roll.png'); sheet.save(sheet_path)
    cap = os.path.join(BUILD, f'scene-{name}-caption.png'); caption_png(o['caption'], cap)
    travel = min(sheet.height - H, 1400)
    # A fast flick that slows down, like a thumb scrolling for one photo.
    y = f"{travel}*(1-pow(1-clip(t/{o['dur']},0,1),2.2))"
    run(['-loop', '1', '-t', str(o['dur']), '-i', sheet_path, '-loop', '1', '-t', str(o['dur']), '-i', cap,
         '-filter_complex', f"[0:v]fps={FPS},crop={W}:{H}:0:'{y}',setsar=1[v];[v][1:v]overlay=0:0:enable='gte(t,0.6)'[o]", '-map', '[o]'] + ENC + [out])

def pov_opener(name, o, out):
    src = os.path.join(ROOT, 'rec', o['src'])
    sw, _ = size(src)
    cap = os.path.join(BUILD, f'scene-{name}-caption.png'); caption_png(o['caption'], cap)
    run(['-ss', str(o['start']), '-t', str(o['dur']), '-i', src, '-loop', '1', '-t', str(o['dur']), '-i', cap,
         '-filter_complex', f"[0:v]crop={sw}:{round(sw * H / W)}:0:{o['crop_y']},scale={W}:{H},fps={FPS},setsar=1[v];"
                            f"[v][1:v]overlay=0:0:enable='gte(t,0.35)'[o]", '-map', '[o]'] + ENC + [out])

def render(name):
    s = SCENES[name]
    os.makedirs(BUILD, exist_ok=True); os.makedirs(ASSETS, exist_ok=True)
    o = s['opener']
    opener = os.path.join(BUILD, f'scene-{name}-opener.mp4')
    (roll_opener if o['kind'] == 'roll' else pov_opener)(name, o, opener)

    # The simulator only writes a frame when the screen changes; a steady 30 fps copy makes the cuts exact.
    raw = os.path.join(ROOT, 'rec', s['app'])
    cfr = os.path.join(BUILD, os.path.splitext(s['app'])[0] + '-cfr.mp4')
    if not os.path.exists(cfr) or os.path.getmtime(cfr) < os.path.getmtime(raw):
        run(['-i', raw, '-vf', f'fps={FPS}', '-c:v', 'libx264', '-preset', 'fast', '-crf', '12', '-pix_fmt', 'yuv420p', '-an', cfr])
    aw, ah = size(cfr)
    crop_h = round(aw * H / W)
    bottom = str(ah - crop_h)

    parts, app_total = [], 0.0
    for i, (a, dur, y, speed) in enumerate(s['segments']):
        out = os.path.join(BUILD, f'scene-{name}-app{i}.mp4'); parts.append(out)
        y = str(y).replace("'B'", bottom).replace('B', bottom)
        run(['-ss', str(a), '-t', str(dur), '-i', cfr,
             '-vf', f"crop={aw}:{crop_h}:0:'{y}',scale={W}:{H}:flags=lanczos,setpts=PTS/{speed},fps={FPS},setsar=1"] + ENC + [out])
        app_total += dur / speed

    inputs, chain = [], ''
    for k, part in enumerate(parts):
        inputs += ['-i', part]; chain += f'[{k}:v]'
    chain += f'concat=n={len(parts)}:v=1:a=0[a0];'
    last = 'a0'
    for k, c in enumerate(s['callouts']):
        png = os.path.join(BUILD, f'scene-{name}-call{k}.png'); callout_png(c, png)
        inputs += ['-loop', '1', '-t', f'{app_total:.3f}', '-i', png]
        t0, t1 = c['t']
        chain += f"[{len(parts) + k}:v]format=rgba,fade=in:st={t0}:d=0.2:alpha=1,fade=out:st={t1 - 0.2}:d=0.2:alpha=1[c{k}];" \
                 f"[{last}][c{k}]overlay=0:0:enable='between(t,{t0},{t1})'[a{k + 1}];"
        last = f'a{k + 1}'
    app_out = os.path.join(BUILD, f'scene-{name}-app.mp4')
    run(inputs + ['-filter_complex', chain.rstrip(';'), '-map', f'[{last}]', '-t', f'{app_total:.3f}'] + ENC + [app_out])

    final = os.path.join(ASSETS, f'{name}.mp4')
    off = o['dur'] - XFADE
    run(['-i', opener, '-i', app_out, '-filter_complex', f'[0:v][1:v]xfade=transition=fade:duration={XFADE}:offset={off}[v]',
         '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '31', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
         '-movflags', '+faststart', '-an', final])
    run(['-ss', '0.05', '-i', final, '-frames:v', '1', '-q:v', '4', os.path.join(ASSETS, f'{name}.jpg')])
    print(f'wrote {final} ({off + app_total:.1f}s, {os.path.getsize(final) // 1024} KB)')
    print('  steps:', [(label, round(off + at, 1)) for label, at in s['steps']])

if __name__ == '__main__':
    for n in (sys.argv[1:] or SCENES):
        render(n)
