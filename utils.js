/* ═══════════════════════════════
   utils.js — Shared Utilities
═══════════════════════════════ */
'use strict';

const IMGBB_KEY   = '99bf016111ec0f50e3160ecb66e8a33f';
const MAX_MB      = 10;
const REACT_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','💯','👏'];

// ── App state ────────────────
window.App = {
  db:   null,
  auth: null,
  user: null,
  role: null,
};

// ── Toast ─────────────────────
function toast(msg, type = 'inf', ms = 2800) {
  let w = document.getElementById('toast-wrap');
  if (!w) { w = document.createElement('div'); w.id = 'toast-wrap'; document.body.appendChild(w); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  w.appendChild(t);
  setTimeout(() => {
    t.style.transition = 'opacity .28s, transform .28s';
    t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
    setTimeout(() => t.remove(), 320);
  }, ms);
}

// ── Modals ────────────────────
function openModal(id)  { const el = document.getElementById(id); if(el) el.style.display = 'flex'; }
function closeModal(id) { const el = document.getElementById(id); if(el) el.style.display = 'none';  }
function closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }
document.addEventListener('click', e => { if(e.target.classList.contains('modal-overlay')) e.target.style.display = 'none'; });

// ── HTML escape ───────────────
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ── Time helpers ──────────────
function fmtTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
}
function fmtShort(ts) {
  if (!ts) return '';
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return fmtTime(ts);
  const yd = new Date(now); yd.setDate(yd.getDate()-1);
  if (d.toDateString() === yd.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day:'numeric', month:'short' });
}
function fmtDayLabel(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hari ini';
  const yd = new Date(now); yd.setDate(yd.getDate()-1);
  if (d.toDateString() === yd.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

// ── File helpers ──────────────
function fmtSize(b) {
  if (!b) return '';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function fileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  return ({
    pdf:'📑',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',
    zip:'🗜️',rar:'🗜️','7z':'🗜️',tar:'🗜️',
    mp3:'🎵',wav:'🎵',ogg:'🎵',flac:'🎵',aac:'🎵',m4a:'🎵',
    mp4:'🎬',mkv:'🎬',avi:'🎬',mov:'🎬',webm:'🎬',
    jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🎞️',webp:'🖼️',svg:'🎨',
    txt:'📃',md:'📃',js:'📜',ts:'📜',html:'🌐',css:'🎨',json:'⚙️',
    py:'🐍',php:'🐘',sh:'⚡',apk:'📱',exe:'💿',
  })[ext] || '📄';
}
function detectType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

// ── Auto-resize textarea ──────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 110) + 'px';
}

// ── Scroll bottom ─────────────
function scrollEnd(el) {
  if (typeof el === 'string') el = document.getElementById(el);
  if (el) el.scrollTop = el.scrollHeight;
}

// ── Long-press (mobile) ───────
function onLongPress(el, cb) {
  let t;
  el.addEventListener('touchstart', e => { t = setTimeout(() => cb(e), 480); }, { passive:true });
  const cancel = () => clearTimeout(t);
  el.addEventListener('touchend',   cancel, { passive:true });
  el.addEventListener('touchmove',  cancel, { passive:true });
  el.addEventListener('touchcancel',cancel, { passive:true });
}

// ── Copy to clipboard ─────────
function copyText(s) {
  navigator.clipboard?.writeText(s).then(() => toast('Disalin!','ok')).catch(() => {
    const t = document.createElement('textarea');
    t.value = s; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove(); toast('Disalin!','ok');
  });
}

// ── imgBB upload ──────────────
async function uploadImgBB(file, onProg) {
  if (file.size > MAX_MB * 1048576) throw new Error(`File max ${MAX_MB}MB`);
  const fd = new FormData();
  fd.append('image', file);
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('POST', `https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`);
    x.upload.onprogress = e => { if(e.lengthComputable && onProg) onProg(Math.round(e.loaded/e.total*90)); };
    x.onload = () => {
      try {
        const d = JSON.parse(x.responseText);
        if (d.success) { onProg && onProg(100); res({ url:d.data.url, thumb:d.data.thumb?.url }); }
        else rej(new Error(d.error?.message || 'Upload gagal'));
      } catch { rej(new Error('Response error')); }
    };
    x.onerror = () => rej(new Error('Network error'));
    x.send(fd);
  });
}

// ── Lightbox ──────────────────
function openLightbox(url, name) {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div'); lb.id = 'lightbox';
    lb.innerHTML = `<img id="lb-img"><div class="lightbox-bar">
      <a id="lb-dl" target="_blank"><i class="fa fa-download"></i> Download</a>
      <button onclick="closeLightbox()"><i class="fa fa-times"></i> Tutup</button>
    </div>`;
    lb.addEventListener('click', e => { if(e.target===lb) closeLightbox(); });
    document.body.appendChild(lb);
  }
  document.getElementById('lb-img').src = url;
  const dl = document.getElementById('lb-dl'); dl.href = url; dl.download = name||'file';
  lb.style.display = 'flex';
}
function closeLightbox() {
  const lb = document.getElementById('lightbox'); if(lb) lb.style.display = 'none';
}

// ── Context menu ──────────────
let _ctx = null;
function removeCtx() { if(_ctx){ _ctx.remove(); _ctx=null; } }
function showCtx(x, y, cfg) {
  removeCtx();
  const m = document.createElement('div'); m.className = 'ctx-menu';
  // emoji row
  if (cfg.emojis) {
    const r = document.createElement('div'); r.className = 'ctx-emoji-row';
    cfg.emojis.forEach(em => {
      const s = document.createElement('span'); s.className='ctx-emoji'; s.textContent=em;
      s.onclick = () => { cfg.onEmoji(em); removeCtx(); };
      r.appendChild(s);
    });
    m.appendChild(r);
  }
  (cfg.items||[]).forEach(item => {
    const d = document.createElement('div');
    d.className = 'ctx-item' + (item.red ? ' red' : '');
    d.innerHTML  = `<i class="${item.icon}"></i> ${esc(item.label)}`;
    d.onclick    = () => { item.fn(); removeCtx(); };
    m.appendChild(d);
  });
  // clamp
  const pw = 174, ph = (cfg.items?.length||0)*36 + 60;
  m.style.left = Math.min(x, innerWidth-pw-8)+'px';
  m.style.top  = Math.min(y, innerHeight-ph-8)+'px';
  document.body.appendChild(m); _ctx = m;
  setTimeout(() => document.addEventListener('click', removeCtx, {once:true}), 50);
}

// ── Attach menu toggle ────────
function toggleAttach(menuId, e) {
  e?.stopPropagation();
  const m = document.getElementById(menuId);
  if (!m) return;
  const open = m.style.display === 'flex';
  hideAllAttach();
  if (!open) { m.style.display='flex'; m.style.flexDirection='column'; }
}
function hideAllAttach() {
  document.querySelectorAll('.attach-menu').forEach(m => m.style.display='none');
}
document.addEventListener('click', hideAllAttach);

// ── Activity log ──────────────
function logAct(text) {
  const u = window.App.user;
  window.App.db?.ref('activity_log').push({ text, by:u?.displayName||'system', byUID:u?.uid||'', ts:Date.now() });
}
