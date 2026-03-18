/* utils.js */
'use strict';

const IMGBB_KEY   = '99bf016111ec0f50e3160ecb66e8a33f';
const MAX_MB      = 10;
const REACT_LIST  = ['👍','❤️','😂','😮','😢','🔥','💯','👏'];

window.App = { db:null, auth:null, user:null, role:null };

/* ── Toast ─────────────────── */
function toast(msg, type='tin', ms=2800){
  let r=document.getElementById('toast-root');
  if(!r){r=document.createElement('div');r.id='toast-root';document.body.appendChild(r);}
  const t=document.createElement('div');
  t.className='toast '+type; t.textContent=msg; r.appendChild(t);
  setTimeout(()=>{t.style.transition='opacity .25s,transform .25s';t.style.opacity='0';t.style.transform='translateY(8px)';setTimeout(()=>t.remove(),280);},ms);
}

/* ── Overlay/sheet modals ───── */
function openSheet(id){const el=document.getElementById(id);if(el)el.style.display='flex';}
function closeSheet(id){const el=document.getElementById(id);if(el)el.style.display='none';}
function closeAllSheets(){document.querySelectorAll('.overlay').forEach(o=>o.style.display='none');}
document.addEventListener('click',e=>{if(e.target.classList.contains('overlay'))e.target.style.display='none';});

/* ── HTML escape ─────────────── */
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

/* ── Time ─────────────────── */
function fmtTime(ts){if(!ts)return'';return new Date(ts).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});}
function fmtShort(ts){
  if(!ts)return'';
  const d=new Date(ts),now=new Date();
  if(d.toDateString()===now.toDateString())return fmtTime(ts);
  const yd=new Date(now);yd.setDate(yd.getDate()-1);
  if(d.toDateString()===yd.toDateString())return'Kemarin';
  return d.toLocaleDateString('id-ID',{day:'numeric',month:'short'});
}
function fmtDay(ts){
  const d=new Date(ts),now=new Date();
  if(d.toDateString()===now.toDateString())return'Hari ini';
  const yd=new Date(now);yd.setDate(yd.getDate()-1);
  if(d.toDateString()===yd.toDateString())return'Kemarin';
  return d.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

/* ── File helpers ─────────── */
function fmtSize(b){if(!b)return'';if(b<1024)return b+'B';if(b<1048576)return(b/1024).toFixed(1)+'KB';return(b/1048576).toFixed(1)+'MB';}
function fIcon(name){const ext=(name||'').split('.').pop().toLowerCase();return({pdf:'📑',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📋',pptx:'📋',zip:'🗜️',rar:'🗜️','7z':'🗜️',mp3:'🎵',wav:'🎵',ogg:'🎵',aac:'🎵',m4a:'🎵',mp4:'🎬',mkv:'🎬',mov:'🎬',webm:'🎬',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🎞️',webp:'🖼️',svg:'🎨',txt:'📃',js:'📜',html:'🌐',json:'⚙️',py:'🐍',apk:'📱',exe:'💿'})[ext]||'📄';}
function dType(file){if(file.type.startsWith('image/'))return'image';if(file.type.startsWith('video/'))return'video';if(file.type.startsWith('audio/'))return'audio';return'file';}

/* ── Textarea auto-resize ─── */
function ar(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,110)+'px';}

/* ── Scroll end ──────────── */
function scrollEnd(el){if(typeof el==='string')el=document.getElementById(el);if(el)el.scrollTop=el.scrollHeight;}

/* ── Long press ──────────── */
function onLP(el,cb){let t;el.addEventListener('touchstart',e=>{t=setTimeout(()=>cb(e),450);},{passive:true});const c=()=>clearTimeout(t);el.addEventListener('touchend',c,{passive:true});el.addEventListener('touchmove',c,{passive:true});}

/* ── Copy ────────────────── */
function copyTxt(s){navigator.clipboard?.writeText(s).then(()=>toast('Disalin!','tok')).catch(()=>{const t=document.createElement('textarea');t.value=s;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('Disalin!','tok');});}

/* ── imgBB upload ─────────── */
async function upImgBB(file, onProg){
  if(file.size>MAX_MB*1048576) throw new Error(`Max ${MAX_MB}MB`);
  const fd=new FormData(); fd.append('image',file);
  return new Promise((res,rej)=>{
    const x=new XMLHttpRequest();
    x.open('POST',`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`);
    x.upload.onprogress=e=>{if(e.lengthComputable&&onProg)onProg(Math.round(e.loaded/e.total*90));};
    x.onload=()=>{try{const d=JSON.parse(x.responseText);if(d.success){onProg&&onProg(100);res({url:d.data.url,thumb:d.data.thumb?.url});}else rej(new Error(d.error?.message||'Upload gagal'));}catch{rej(new Error('Response error'));}};
    x.onerror=()=>rej(new Error('Network error'));
    x.send(fd);
  });
}

/* ── Lightbox ─────────────── */
function openLB(url, name){
  let lb=document.getElementById('lbx');
  if(!lb){
    lb=document.createElement('div');lb.id='lbx';
    lb.innerHTML=`<img id="lbx-img" alt=""><div class="lbx-bar"><a id="lbx-dl" target="_blank"><i class="fa fa-download"></i> Download</a><button onclick="closeLB()"><i class="fa fa-times"></i> Tutup</button></div>`;
    lb.addEventListener('click',e=>{if(e.target===lb)closeLB();});
    document.body.appendChild(lb);
  }
  document.getElementById('lbx-img').src=url;
  const dl=document.getElementById('lbx-dl');dl.href=url;dl.download=name||'file';
  lb.style.display='flex';
}
function closeLB(){const lb=document.getElementById('lbx');if(lb)lb.style.display='none';}

/* ── Context menu ─────────── */
let _ctx=null;
function rmCtx(){if(_ctx){_ctx.remove();_ctx=null;}}
function showCtx(x,y,cfg){
  rmCtx();
  const m=document.createElement('div');m.className='ctx';
  if(cfg.emojis){
    const r=document.createElement('div');r.className='ctx-emojis';
    cfg.emojis.forEach(em=>{const s=document.createElement('span');s.className='ctx-em';s.textContent=em;s.onclick=()=>{cfg.onEmoji(em);rmCtx();};r.appendChild(s);});
    m.appendChild(r);
  }
  (cfg.items||[]).forEach(it=>{
    const d=document.createElement('div');d.className='ctx-row'+(it.danger?' danger':'');
    d.innerHTML=`<i class="${it.icon}"></i>${esc(it.label)}`;
    d.onclick=()=>{it.fn();rmCtx();};m.appendChild(d);
  });
  const pw=190,ph=(cfg.items?.length||0)*44+70;
  m.style.left=Math.min(x,innerWidth-pw-8)+'px';
  m.style.top=Math.min(y,innerHeight-ph-8)+'px';
  document.body.appendChild(m);_ctx=m;
  setTimeout(()=>document.addEventListener('click',rmCtx,{once:true}),50);
}

/* ── Attach menu ──────────── */
function togAtt(id,e){e?.stopPropagation();const m=document.getElementById(id);if(!m)return;const open=m.style.display==='flex';hideAtts();if(!open){m.style.display='flex';m.style.flexDirection='column';}}
function hideAtts(){document.querySelectorAll('.att-menu').forEach(m=>m.style.display='none');}
document.addEventListener('click',hideAtts);

/* ── Activity log ──────────── */
function logAct(text){const u=window.App.user;window.App.db?.ref('activity_log').push({text,by:u?.displayName||'system',byUID:u?.uid||'',ts:Date.now()});}

/* ── Avatar generator ─────── */
function genAv(name){return`https://ui-avatars.com/api/?name=${encodeURIComponent(name||'?')}&background=1f2538&color=8891b0&size=64`;}
