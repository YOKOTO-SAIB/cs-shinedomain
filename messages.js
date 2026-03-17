/* ═══════════════════════════════
   messages.js — Message Renderer
═══════════════════════════════ */
'use strict';

// ── Global reply state ────────
window._reply = { user:null, admin:null };

// ── Build message element ─────
function buildMsg(msg, viewUID, chatUID) {
  const sent = msg.uid === viewUID;
  const wrap = document.createElement('div');
  wrap.className = `mw ${sent?'out':'in'}`;
  wrap.dataset.id = msg.id;

  // avatar side
  if (!sent) {
    const av = document.createElement('img');
    av.className = 'm-av';
    av.src = msg.photoURL || genAv(msg.name);
    av.onerror = () => { av.src = genAv(msg.name); };
    wrap.appendChild(av);
  } else {
    const ph = document.createElement('div'); ph.className='m-av-ph'; wrap.appendChild(ph);
  }

  const col = document.createElement('div'); col.className = 'm-col';

  // sender name (admin side shows who sent)
  if (!sent && msg.showName) {
    const nm = document.createElement('div'); nm.className='m-sender';
    nm.textContent = msg.name || 'Pengguna'; col.appendChild(nm);
  }

  // bubble
  const bub = document.createElement('div'); bub.className = 'mb'; bub.id = 'msg_'+msg.id;

  // broadcast badge
  if (msg.isBroadcast) {
    const b = document.createElement('div'); b.className='bc-badge';
    b.innerHTML='<i class="fa fa-broadcast-tower"></i> Broadcast'; bub.appendChild(b);
  }

  // reply tag
  if (msg.replyTo) {
    const rt = document.createElement('div'); rt.className='reply-tag';
    rt.innerHTML=`<div class="rt-name">${esc(msg.replyTo.name||'Pesan')}</div><div class="rt-text">${esc(msg.replyTo.text||'[media]')}</div>`;
    rt.onclick = e => { e.stopPropagation(); jumpToMsg(msg.replyTo.id); };
    bub.appendChild(rt);
  }

  // content
  bub.appendChild(buildContent(msg));

  // meta
  const meta = document.createElement('div'); meta.className='m-meta';
  meta.innerHTML = `<span>${fmtTime(msg.timestamp)}</span>`;
  if (sent) {
    const s = document.createElement('span');
    s.className = msg.read ? 'm-read' : '';
    s.innerHTML = msg.read ? '<i class="fa fa-check-double"></i>' : '<i class="fa fa-check"></i>';
    meta.appendChild(s);
  }
  bub.appendChild(meta);

  // events
  bub.addEventListener('contextmenu', e => { e.preventDefault(); showMsgCtx(e.clientX, e.clientY, msg, viewUID, chatUID); });
  onLongPress(bub, e => { const t=e.touches?.[0]||e; showMsgCtx(t.clientX, t.clientY, msg, viewUID, chatUID); });

  col.appendChild(bub);

  // reactions below bubble
  if (msg.reactions && Object.keys(msg.reactions).length) {
    col.appendChild(buildReactions(msg, viewUID, chatUID));
  }

  wrap.appendChild(col);
  return wrap;
}

// ── Content builder ───────────
function buildContent(msg) {
  const w = document.createElement('div');
  switch (msg.type) {
    case 'text':
      // preserve newlines
      w.style.whiteSpace = 'pre-wrap';
      w.textContent = msg.text || '';
      break;

    case 'image': {
      const img = document.createElement('img');
      img.className = 'msg-img'; img.src = msg.url; img.alt = msg.filename||'foto'; img.loading='lazy';
      img.onerror = () => { img.style.opacity='.4'; img.title='Gagal dimuat'; };
      img.onclick = e => { e.stopPropagation(); openLightbox(msg.url, msg.filename||'foto.jpg'); };
      w.appendChild(img);
      if (msg.caption) { const c=document.createElement('div'); c.className='msg-caption'; c.textContent=msg.caption; w.appendChild(c); }
      break;
    }
    case 'video': {
      const v = document.createElement('video');
      v.className='msg-vid'; v.src=msg.url; v.controls=true; v.preload='metadata';
      v.onclick = e => e.stopPropagation();
      w.appendChild(v); break;
    }
    case 'audio': {
      const a = document.createElement('audio');
      a.className='msg-aud'; a.src=msg.url; a.controls=true; a.preload='metadata';
      a.onclick = e => e.stopPropagation();
      w.appendChild(a); break;
    }
    case 'file': {
      const card = document.createElement('div'); card.className='msg-file';
      card.innerHTML=`
        <div class="mf-icon">${fileIcon(msg.filename)}</div>
        <div class="mf-info">
          <div class="mf-name">${esc(msg.filename||'file')}</div>
          <div class="mf-size">${esc(msg.size||'')}</div>
        </div>
        <a class="mf-dl" href="${esc(msg.url)}" download="${esc(msg.filename||'file')}" target="_blank" onclick="event.stopPropagation()" title="Download">
          <i class="fa fa-download"></i>
        </a>`;
      w.appendChild(card); break;
    }
    default:
      w.textContent = msg.text || '[pesan]';
  }
  return w;
}

// ── Reactions ─────────────────
function buildReactions(msg, viewUID, chatUID) {
  const c = document.createElement('div'); c.className='m-reactions';
  const counts={}, mine={};
  Object.entries(msg.reactions).forEach(([uid,em])=>{ counts[em]=(counts[em]||0)+1; if(uid===viewUID) mine[em]=true; });
  Object.entries(counts).forEach(([em,cnt])=>{
    const b=document.createElement('div'); b.className='reaction'+(mine[em]?' mine':'');
    b.innerHTML=`${em} <span class="react-cnt">${cnt}</span>`;
    b.onclick=()=>toggleReact(msg,em,viewUID,chatUID);
    c.appendChild(b);
  });
  return c;
}

async function toggleReact(msg, emoji, viewUID, chatUID) {
  if(!chatUID||!window.App.db) return;
  const ref = window.App.db.ref(`chats/${chatUID}/messages/${msg.id}/reactions/${viewUID}`);
  const snap = await ref.once('value');
  snap.val()===emoji ? await ref.remove() : await ref.set(emoji);
}

// ── Context menu for message ──
function showMsgCtx(x, y, msg, viewUID, chatUID) {
  const canDel = msg.uid===viewUID || ['admin','owner'].includes(window.App.role);
  showCtx(x, y, {
    emojis: REACT_EMOJIS,
    onEmoji: em => toggleReact(msg, em, viewUID, chatUID),
    items: [
      { icon:'fa fa-reply',  label:'Balas',       fn: ()=>setReply(msg) },
      ...(msg.type==='text' ? [{icon:'fa fa-copy', label:'Salin Teks', fn:()=>copyText(msg.text)}] : []),
      ...(msg.url ? [{icon:'fa fa-download', label:'Download', fn:()=>{ const a=document.createElement('a');a.href=msg.url;a.download=msg.filename||'file';a.target='_blank';a.click(); }}] : []),
      ...(canDel  ? [{icon:'fa fa-trash', label:'Hapus Pesan', red:true, fn:()=>deleteMsg(msg.id,chatUID)}] : []),
    ]
  });
}

async function deleteMsg(msgId, chatUID) {
  if(!chatUID||!window.App.db) return;
  if(!confirm('Hapus pesan ini?')) return;
  await window.App.db.ref(`chats/${chatUID}/messages/${msgId}`).remove();
  toast('Pesan dihapus','inf');
}

// ── Reply helpers ─────────────
function setReply(msg) {
  const mode = window.App.role==='user' ? 'user' : 'admin';
  window._reply[mode] = msg;
  const prev = document.getElementById(mode==='user'?'reply-prev':'admin-reply-prev');
  if(!prev) return;
  prev.querySelector('.rp-name').textContent = msg.name||'Pesan';
  prev.querySelector('.rp-text').textContent = msg.text||'[media]';
  prev.style.display='flex';
  document.getElementById(mode==='user'?'msg-box':'admin-msg-box')?.focus();
}
function cancelReply(mode) {
  window._reply[mode||'user'] = null;
  const prev = document.getElementById(mode==='admin'?'admin-reply-prev':'reply-prev');
  if(prev) prev.style.display='none';
}

function jumpToMsg(id) {
  const el = document.getElementById('msg_'+id); if(!el) return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.style.outline='2px solid var(--accent3)';
  setTimeout(()=>el.style.outline='none', 1400);
}

// ── Append / update / remove ──
function appendMsg(msg, container, viewUID, chatUID) {
  // day separator
  if (msg.timestamp) {
    const key = new Date(msg.timestamp).toDateString();
    if (!container.querySelector(`[data-day="${key}"]`)) {
      const sep=document.createElement('div'); sep.className='day-sep'; sep.dataset.day=key;
      sep.textContent=fmtDayLabel(msg.timestamp); container.appendChild(sep);
    }
  }
  const el = buildMsg(msg, viewUID, chatUID);
  container.appendChild(el);
  return el;
}
function updateMsg(msg, container, viewUID, chatUID) {
  const old=document.getElementById('msg_'+msg.id); if(!old) return;
  const w=old.closest('.mw'); if(!w) return;
  w.replaceWith(buildMsg(msg, viewUID, chatUID));
}
function removeMsg(id) {
  const el=document.getElementById('msg_'+id); if(el){ const w=el.closest('.mw'); w?.remove(); }
}

// ── Util: generate avatar ─────
function genAv(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name||'?')}&background=1f2335&color=8891b0&size=64`;
}
