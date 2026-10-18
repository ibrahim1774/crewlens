"""
App Store screenshots (6.9", 1320x2868) in the app's black-and-white Figtree style.
Inputs: real simulator captures in screenshots/raw2/. Output: screenshots/final/01.png ... 06.png.
Run: python3 store/make_screenshots.py   (needs Google Chrome for headless rendering)
"""
import os, subprocess, html
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(ROOT, '..', 'node_modules', '@expo-google-fonts', 'figtree')
RAW = os.path.join(ROOT, 'screenshots', 'raw2')
OUT = os.path.join(ROOT, 'screenshots', 'final')
BUILD = os.path.join(ROOT, 'screenshots', 'build')
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
W, H = 1320, 2868

# (file, headline, sub, dark background)
SLIDES = [
    ('home.png', 'Every photo,<br>sorted by job.', 'No more digging through your camera roll.', False),
    ('photo.png', 'Stamped with<br>time and place.', 'Date, time, GPS and initials on every photo.', True),
    ('job.png', 'Every job,<br>day by day.', 'Open the job and the photos are there.', False),
    ('share.png', 'One link for<br>the client.', 'A live link that always shows the latest photos.', False),
    ('invoice.png', 'Invoices, signed<br>and sent.', 'Upload a PDF, sign it, text it to the client.', False),
    ('activity.png', 'See what your<br>crew shot.', 'Every photo and document, newest first.', True),
]

def font(weight_dir, name):
    return 'file://' + os.path.join(FONTS, weight_dir, name)

PAGE = """<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:Figtree;font-weight:800;src:url('{xb}')}}
@font-face{{font-family:Figtree;font-weight:500;src:url('{md}')}}
html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:{bg};font-family:Figtree,sans-serif}}
.wrap{{position:relative;width:{W}px;height:{H}px}}
h1{{position:absolute;top:170px;left:80px;right:80px;margin:0;text-align:center;font-weight:800;font-size:116px;line-height:1.04;letter-spacing:-2px;color:{ink}}}
p{{position:absolute;top:440px;left:140px;right:140px;margin:0;text-align:center;font-weight:500;font-size:44px;line-height:1.3;color:{sub}}}
.device{{position:absolute;left:170px;top:650px;width:980px;height:2130px;border-radius:118px;border:16px solid {rim};background:#0B0B0D;overflow:hidden;box-shadow:0 50px 100px rgba(0,0,0,.22)}}
.device img{{display:block;width:100%;height:auto}}
</style></head><body><div class="wrap">
<h1>{h1}</h1><p>{p}</p>
<div class="device"><img src="{img}"></div>
</div></body></html>"""

def render():
    os.makedirs(OUT, exist_ok=True); os.makedirs(BUILD, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'): os.remove(os.path.join(OUT, f))
    for i, (img, h1, sub, dark) in enumerate(SLIDES, 1):
        page = PAGE.format(
            W=W, H=H, xb=font('800ExtraBold', 'Figtree_800ExtraBold.ttf'), md=font('500Medium', 'Figtree_500Medium.ttf'),
            bg='#0B0B0D' if dark else '#F5F4F1', ink='#FFFFFF' if dark else '#22211E',
            sub='rgba(255,255,255,.72)' if dark else '#6E6C67', rim='#2A2A2E' if dark else '#22211E',
            h1=h1, p=html.escape(sub), img='file://' + os.path.join(RAW, img))
        src = os.path.join(BUILD, f'{i:02d}.html')
        open(src, 'w').write(page)
        out = os.path.join(OUT, f'{i:02d}.png')
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
                        f'--window-size={W},{H}', '--force-device-scale-factor=1', f'--screenshot={out}', 'file://' + src],
                       check=True, capture_output=True)
        Image.open(out).convert('RGB').save(out)  # App Store Connect rejects alpha channels
        print('wrote', out)

if __name__ == '__main__':
    render()
