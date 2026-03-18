/* messages.js */
'use strict';
window._rep={user:null,admin:null};

function buildMsg(msg,viewUID,chatUID){
  const sent=msg.uid===viewUID;
  const w=document.createElement('div');
  w.className='mw '+(sent?'out':'inn');
  w.dataset.id=msg.id;

  if(!sent){const av=document.createElement('img');av.className='m-av';av.src=msg.photoURL||genAv(msg.name);av.onerror=()=>av.src=genAv(msg.name);w.appendChild(av);}
  else{const ph=document.createElement('div');ph.className='m-av-ph';w.appendChild(ph);}

  const col=document.createElement('div');col.className='m-col';
  if(!sent&&msg.showName){const nm=document.createElement('div');nm.className='m-who';nm.textContent=msg.name||'User';col.appendChild(nm);}

  const bub=document.createElement('div');bub.className='mb';bub.id='msg_'+msg.id;

  if(msg.isBroadcast){const b=document.createElement('div');b.className='bcbadge';b.innerHTML='<i class="fa fa-tower-broadcast"></i> Broadcast';bub.appendChild(b);}

  if(msg.replyTo){
    const rt=document.createElement('div');rt.className='rt';
    rt.innerHTML=`<div class="rt-nm">${esc(msg.replyTo.name||'Pesan')}</div><div class="rt-tx">${esc(msg.replyTo.text||'[media]')}</div>`;
    rt.onclick=e=>{e.stopPropagation();jumpMsg(msg.replyTo.id);};
    bub.appendChild(rt);
  }

  bub.appendChild(buildContent(msg));

  const meta=document.createElement('div');meta.className='m-meta';
  meta.innerHTML=`<span>${fmtTime(msg.timestamp)}</span>`;
  if(sent){const s=document.createElement('span');s.className=msg.read?'m-read':'';s.innerHTML=msg.read?'<i class="fa fa-check-double"></i>':'<i class="fa fa-check"></i>';meta.appendChild(s);}
  bub.appendChild(meta);

  bub.addEventListener('contextmenu',e=>{e.preventDefault();showMsgCtx(e.clientX,e.clientY,msg,viewUID,chatUID);});
  onLP(bub,e=>{const t=e.touches?.[0]||e;showMsgCtx(t.clientX,t.clientY,msg,viewUID,chatUID);});

  col.appendChild(bub);
  if(msg.reactions&&Object.keys(msg.reactions).length)col.appendChild(buildReacts(msg,viewUID,chatUID));
  w.appendChild(col);
  return w;
}

function buildContent(msg){
  const w=document.createElement('div');
  switch(msg.type){
    case'text':w.style.whiteSpace='pre-wrap';w.textContent=msg.text||'';break;
    case'image':{
      const img=document.createElement('img');img.className='msg-img';img.src=msg.url;img.alt=msg.filename||'foto';img.loading='lazy';
      img.onerror=()=>{img.style.opacity='.3';img.alt='Gagal dimuat';};
      img.onclick=e=>{e.stopPropagation();openLB(msg.url,msg.filename||'foto.jpg');};
      w.appendChild(img);
      if(msg.caption){const c=document.createElement('div');c.className='msg-cap';c.textContent=msg.caption;w.appendChild(c);}
      break;}
    case'video':{const v=document.createElement('video');v.className='msg-vid';v.src=msg.url;v.controls=true;v.preload='metadata';v.onclick=e=>e.stopPropagation();w.appendChild(v);break;}
    case'audio':{const a=document.createElement('audio');a.className='msg-aud';a.src=msg.url;a.controls=true;a.preload='metadata';a.onclick=e=>e.stopPropagation();w.appendChild(a);break;}
    case'file':{
      const c=document.createElement('div');c.className='msg-file';
      c.innerHTML=`<div class="mfi">${fIcon(msg.filename)}</div><div class="mfi-info"><div class="mfi-name">${esc(msg.filename||'file')}</div><div class="mfi-size">${esc(msg.size||'')}</div></div><a class="mfi-dl" href="${esc(msg.url)}" download="${esc(msg.filename||'file')}" target="_blank" onclick="event.stopPropagation()"><i class="fa fa-download"></i></a>`;
      w.appendChild(c);break;}
    default:w.style.whiteSpace='pre-wrap';w.textContent=msg.text||'[pesan]';
  }
  return w;
}

function buildReacts(msg,viewUID,chatUID){
  const c=document.createElement('div');c.className='m-reacts';
  const counts={},mine={};
  Object.entries(msg.reactions).forEach(([uid,em])=>{counts[em]=(counts[em]||0)+1;if(uid===viewUID)mine[em]=true;});
  Object.entries(counts).forEach(([em,cnt])=>{
    const b=document.createElement('div');b.className='react'+(mine[em]?' mine':'');
    b.innerHTML=`${em}<span class="react-n">${cnt}</span>`;
    b.onclick=()=>togReact(msg,em,viewUID,chatUID);c.appendChild(b);
  });
  return c;
}

async function togReact(msg,emoji,viewUID,chatUID){
  if(!chatUID||!window.App.db)return;
  const ref=window.App.db.ref(`chats/${chatUID}/messages/${msg.id}/reactions/${viewUID}`);
  const snap=await ref.once('value');
  snap.val()===emoji?await ref.remove():await ref.set(emoji);
}

function showMsgCtx(x,y,msg,viewUID,chatUID){
  const canDel=msg.uid===viewUID||['admin','owner'].includes(window.App.role);
  showCtx(x,y,{
    emojis:REACT_LIST,onEmoji:em=>togReact(msg,em,viewUID,chatUID),
    items:[
      {icon:'fa fa-reply',label:'Balas',fn:()=>setRep(msg)},
      ...(msg.type==='text'?[{icon:'fa fa-copy',label:'Salin',fn:()=>copyTxt(msg.text)}]:[]),
      ...(msg.url?[{icon:'fa fa-download',label:'Download',fn:()=>{const a=document.createElement('a');a.href=msg.url;a.download=msg.filename||'file';a.target='_blank';a.click();}}]:[]),
      ...(canDel?[{icon:'fa fa-trash',label:'Hapus',danger:true,fn:()=>delMsg(msg.id,chatUID)}]:[]),
    ]
  });
}

async function delMsg(id,chatUID){
  if(!chatUID||!window.App.db)return;
  if(!confirm('Hapus pesan?'))return;
  await window.App.db.ref(`chats/${chatUID}/messages/${id}`).remove();
  toast('Dihapus','tin');
}

function setRep(msg){
  const mode=window.App.role==='user'?'user':'admin';
  window._rep[mode]=msg;
  const prev=document.getElementById(mode==='user'?'u-rep-prev':'a-rep-prev');
  if(!prev)return;
  prev.querySelector('.rp-nm').textContent=msg.name||'Pesan';
  prev.querySelector('.rp-tx').textContent=msg.text||'[media]';
  prev.style.display='flex';
  document.getElementById(mode==='user'?'u-msg-inp':'a-msg-inp')?.focus();
}
function cancelRep(mode){
  window._rep[mode]=null;
  const prev=document.getElementById(mode==='admin'?'a-rep-prev':'u-rep-prev');
  if(prev)prev.style.display='none';
}

function jumpMsg(id){
  const el=document.getElementById('msg_'+id);if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.style.outline='2px solid var(--green)';
  setTimeout(()=>el.style.outline='none',1400);
}

function appendMsg(msg,cont,viewUID,chatUID){
  if(msg.timestamp){
    const key=new Date(msg.timestamp).toDateString();
    if(!cont.querySelector(`[data-day="${key}"]`)){
      const sep=document.createElement('div');sep.className='day-div';sep.dataset.day=key;sep.textContent=fmtDay(msg.timestamp);cont.appendChild(sep);
    }
  }
  const el=buildMsg(msg,viewUID,chatUID);cont.appendChild(el);return el;
}
function updateMsg(msg,cont,viewUID,chatUID){const old=document.getElementById('msg_'+msg.id);if(!old)return;const w=old.closest('.mw');if(w)w.replaceWith(buildMsg(msg,viewUID,chatUID));}
function rmMsg(id){const el=document.getElementById('msg_'+id);if(el){const w=el.closest('.mw');w?.remove();}}
