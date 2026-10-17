(function () {
  const $ = (s) => document.querySelector(s);
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const pad = (n) => String(n).padStart(2, '0');

  function coords(lat, lng) {
    if (lat == null || lng == null) return 'NO GPS';
    return `${Math.abs(lat).toFixed(4)}${lat >= 0 ? 'N' : 'S'} ${Math.abs(lng).toFixed(4)}${lng >= 0 ? 'E' : 'W'}`;
  }
  function stamp(p) {
    const d = new Date(p.taken_at);
    return [`${pad(d.getHours())}:${pad(d.getMinutes())} · ${MONTHS[d.getMonth()]} ${pad(d.getDate())} ${d.getFullYear()}`, `${coords(p.lat, p.lng)} · ${p.initials || ''}`];
  }
  function dayKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function dayLabel(iso, n) { const d = new Date(iso); return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${pad(d.getDate())} · ${n} ${n === 1 ? 'PHOTO' : 'PHOTOS'}`; }

  function show(id) { for (const s of ['loading','expired','error','job']) $('#'+s).classList.toggle('hidden', s !== id); }

  function render(data) {
    $('#name').textContent = data.name;
    $('#address').textContent = data.address || '';
    $('#mode').innerHTML = data.live ? '<span class="dot"></span>LIVE · UPDATES AS PHOTOS ARE TAKEN' : (data.type === 'gallery' ? 'GALLERY' : 'ARCHIVED · FROZEN');
    const groups = new Map();
    for (const p of data.photos) { const k = dayKey(p.taken_at); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    const root = $('#days'); root.innerHTML = '';
    if (!data.photos.length) { root.innerHTML = '<div class="state"><h2 class="heading">No photos yet.</h2><p>Check back soon.</p></div>'; }
    for (const [k, photos] of [...groups.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {
      const h = document.createElement('div'); h.className = 'day mono'; h.textContent = dayLabel(photos[0].taken_at, photos.length); root.appendChild(h);
      const g = document.createElement('div'); g.className = 'grid';
      for (const p of photos) {
        const b = document.createElement('button'); b.className = 'tile'; b.setAttribute('aria-label', 'Open photo');
        const img = document.createElement('img'); img.loading = 'lazy'; img.src = p.thumb || p.url || ''; img.alt = '';
        const t = document.createElement('span'); t.className = 't mono'; const d = new Date(p.taken_at); t.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        b.append(img, t);
        if (p.kind === 'video') { const v = document.createElement('span'); v.className = 'play mono'; v.textContent = '▶'; b.appendChild(v); b.setAttribute('aria-label', 'Play video'); } b.addEventListener('click', () => open(p)); g.appendChild(b);
      }
      root.appendChild(g);
    }
    show('job');
  }

  function open(p) {
    const dlg = $('#lightbox'); const isVideo = p.kind === 'video'; const vid = $('#lb-video');
    $('#lb-img').style.display = isVideo ? 'none' : ''; vid.style.display = isVideo ? '' : 'none';
    if (isVideo) { vid.src = p.url || ''; vid.poster = p.thumb || ''; vid.load(); } else { vid.pause(); vid.removeAttribute('src'); $('#lb-img').src = p.url || p.thumb || ''; }
    const [a, b] = stamp(p); $('#lb-a').textContent = a; $('#lb-b').textContent = b;
    dlg.showModal();
  }
  $('#lb-close').addEventListener('click', () => $('#lightbox').close());
  $('#lightbox').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  async function load() {
    const m = location.pathname.match(/\/s\/([A-Za-z0-9_-]+)/);
    const token = m ? m[1] : new URLSearchParams(location.search).get('token');
    const endpoint = window.CREWLENS_SHARE_ENDPOINT;
    if (!token || !endpoint) { show('expired'); return; }
    try {
      const res = await fetch(`${endpoint}?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({ status: 'error' }));
      if (data.status === 'ok') render(data);
      else if (data.status === 'expired') show('expired');
      else show('error');
    } catch { show('error'); }
  }
  load();
  $('#retry').addEventListener('click', load);
})();
