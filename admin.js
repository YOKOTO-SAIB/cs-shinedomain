/* ═══════════════════════════════
   admin.js — Admin Panel Logic
═══════════════════════════════ */
(function(){
'use strict';

let _chatUID = null, _allChats = {}, _msgOff = null;

// ── Init ──────────────────────
window.initAdmin = function() {
  const u=window.App.user, r=window.App.role;
  if(!u||!window.App.db) return;

  // profile strip
  document.getElementById('sb-av').src    = u.photoURL||genAv(u.displayName);
  document.getElementById('sb-name').textContent  = u.displayName;
  document.getElementById('sb-email').textContent = u.email;
  const chip=document.getElementById('sb-role');
  chip.textContent=r.toUpperCase(); chip.className='role-chip '+(r==='owner'?'rc-owner':'rc-admin');
  if(r==='owner') document.getElementById('owner-nav').style.display='flex';

  loadCustomAv();
  listenChats();
  checkMobile();
};

async function loadCustomAv(){
  const snap=await window.App.db.ref('users/'+window.App.user.uid+'/customAvatar').once('value');
  if(snap.val()) document.getElementById('sb-av').src=snap.val();
}

// ── Panel switch ──────────────
window.switchP = function(p, btn){
  ['chat','qr','users','broadcast','settings','owner'].forEach(id=>{
    const el=document.getElementById('p-'+id);
    if(!el) return;
    el.classList.toggle('on', id===p);
  });
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('on'));
  btn?.classList.add('on');
  if(p==='qr')        loadQRList();
  if(p==='users')     loadUsers();
  if(p==='broadcast') loadBCHistory();
  if(p==='settings')  loadCSForm();
  if(p==='owner')     loadOwner();
};

// ── Chat list ─────────────────
function listenChats(){
  window.App.db.ref('chats').on('value', snap=>{
    _allChats=snap.val()||{};
    renderList(_allChats);
  });
}
function renderList(data, q=''){
  const list=document.getElementById('chat-list'); list.innerHTML='';
  const entries=Object.entries(data)
    .filter(([uid,c])=>{
      if(!c.userInfo&&!c.lastMsg) return false;
      if(!q) return true;
      const n=(c.userInfo?.name||'').toLowerCase(), e=(c.userInfo?.email||'').toLowerCase();
      return n.includes(q)||e.includes(q);
    })
    .sort((a,b)=>(b[1].lastTime||0)-(a[1].lastTime||0));
  if(!entries.length){ list.innerHTML='<div style="text-align:center;color:var(--text3);font-size:13px;padding:24px">Belum ada chat</div>'; return; }
  entries.forEach(([uid,c])=>{
    const info=c.userInfo||{}, name=info.name||uid, unread=c.unread||0, banned=c.banned;
    const item=document.createElement('div'); item.className='ci'+(uid===_chatUID?' active':'');
    item.innerHTML=`
      <img class="ci-av" src="${info.photoURL||genAv(name)}" onerror="this.src='${genAv(name)}'" alt="">
      <div class="ci-body">
        <div class="ci-name">${esc(name)}${banned?' <span class="ci-ban">BANNED</span>':''}</div>
        <div class="ci-prev truncate">${esc(c.lastMsg||'Belum ada pesan')}</div>
      </div>
      <div class="ci-meta">
        <span class="ci-time">${fmtShort(c.lastTime)}</span>
        ${unread>0?`<span class="ci-unread">${unread}</span>`:''}
      </div>`;
    item.onclick=()=>openChat(uid,info);
    list.appendChild(item);
  });
}
window.filterList = q=>renderList(_allChats, q.toLowerCase());

// ── Open chat ─────────────────
async function openChat(uid, info){
  _chatUID=uid;
  renderList(_allChats, document.getElementById('sb-search').value.toLowerCase());

  document.getElementById('a-empty').style.display='none';
  document.getElementById('a-msgs').style.display='flex';
  document.getElementById('a-input').style.display='block';
  document.getElementById('a-chat-hdr').style.display='flex';

  document.getElementById('ach-av').src   = info.photoURL||genAv(info.name||'?');
  document.getElementById('ach-name').textContent  = info.name||uid;
  document.getElementById('ach-email').textContent = info.email||'';

  await window.App.db.ref('chats/'+uid+'/unread').set(0);

  // detach old
  if(_msgOff){ window.App.db.ref('chats/'+_msgOff+'/messages').off(); }
  _msgOff=uid;

  const cont=document.getElementById('a-msgs'); cont.innerHTML='';
  const auid=window.App.user.uid;

  window.App.db.ref('chats/'+uid+'/messages').on('child_added', snap=>{
    const msg=snap.val(); msg.id=snap.key; msg.showName=true;
    appendMsg(msg,cont,auid,uid); scrollEnd(cont);
    window.App.db.ref('chats/'+uid+'/messages/'+snap.key+'/read').set(true);
  });
  window.App.db.ref('chats/'+uid+'/messages').on('child_changed', snap=>{ const m=snap.val();m.id=snap.key;m.showName=true; updateMsg(m,cont,auid,uid); });
  window.App.db.ref('chats/'+uid+'/messages').on('child_removed', snap=>removeMsg(snap.key));

  if(window.innerWidth<=768) closeSB();
}

// ── Admin send ────────────────
window.aSend = async function(){
  if(!_chatUID){ toast('Pilih chat dulu!','err'); return; }
  const box=document.getElementById('admin-msg-box'), text=box.value.trim();
  if(!text) return;
  box.value=''; autoResize(box);
  const u=window.App.user;
  const avS=await window.App.db.ref('users/'+u.uid+'/customAvatar').once('value');
  const msg={ type:'text', text, uid:u.uid, name:u.displayName, photoURL:avS.val()||u.photoURL||'', from:'cs', timestamp:Date.now(), read:false };
  const rep=window._reply.admin;
  if(rep){ msg.replyTo={id:rep.id,name:rep.name,text:rep.text||'[media]'}; cancelReply('admin'); }
  await window.App.db.ref('chats/'+_chatUID+'/messages').push(msg);
  await window.App.db.ref('chats/'+_chatUID).update({lastMsg:text,lastTime:Date.now(),unread:0});
  scrollEnd('a-msgs');
};
window.aKey = e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();aSend();} };

window.aPickFile = function(accept){
  const f=document.getElementById('a-file'); f.accept=accept; f.click(); hideAllAttach();
};
window.aOnFile = async function(e){
  const file=e.target.files[0]; if(!file) return; e.target.value='';
  if(!_chatUID){ toast('Pilih chat dulu!','err'); return; }
  const prog=document.getElementById('a-up-wrap'), bar=document.getElementById('a-up-bar'), lbl=document.getElementById('a-up-lbl');
  prog.style.display='block'; lbl.textContent='Mengupload '+file.name+'...';
  try {
    const r=await uploadImgBB(file, p=>bar.style.width=p+'%');
    const u=window.App.user;
    const avS=await window.App.db.ref('users/'+u.uid+'/customAvatar').once('value');
    const msg={ type:detectType(file), url:r.url, uid:u.uid, name:u.displayName, photoURL:avS.val()||u.photoURL||'', from:'cs', filename:file.name, size:fmtSize(file.size), timestamp:Date.now(), read:false };
    const rep=window._reply.admin;
    if(rep){ msg.replyTo={id:rep.id,name:rep.name,text:rep.text||'[media]'}; cancelReply('admin'); }
    await window.App.db.ref('chats/'+_chatUID+'/messages').push(msg);
    await window.App.db.ref('chats/'+_chatUID).update({lastMsg:'['+msg.type+'] '+file.name,lastTime:Date.now(),unread:0});
    toast('Terkirim!','ok'); scrollEnd('a-msgs');
  } catch(err){ toast('Upload gagal: '+err.message,'err'); }
  prog.style.display='none'; bar.style.width='0%';
};

// ── Quick Reply ───────────────
async function loadQRList(){
  const data=(await window.App.db.ref('quick_replies').once('value')).val()||{};
  const list=document.getElementById('qr-list'); list.innerHTML='';
  const entries=Object.entries(data);
  if(!entries.length){ list.innerHTML='<div style="color:var(--text3);text-align:center;padding:24px;font-size:13px">Belum ada quick reply. Klik Tambah untuk membuat.</div>'; return; }
  entries.forEach(([id,qr])=>{
    const card=document.createElement('div'); card.className='qr-card';
    card.innerHTML=`<div class="qr-kw">${esc(qr.trigger)}</div><div class="qr-txt">${esc(qr.text)}</div>
    <div class="qr-foot">
      <button class="btn btn-sm btn-primary" onclick="pasteQR(${JSON.stringify(qr.text)})"><i class="fa fa-arrow-right"></i> Gunakan</button>
      <button class="btn btn-sm btn-danger" onclick="delQR('${id}')"><i class="fa fa-trash"></i> Hapus</button>
    </div>`;
    list.appendChild(card);
  });
}
window.showAddQR = ()=>openModal('add-qr-modal');
window.saveQR   = async function(){
  const kw=document.getElementById('qr-kw').value.trim(), body=document.getElementById('qr-body').value.trim();
  if(!kw||!body){ toast('Isi semua field!','err'); return; }
  await window.App.db.ref('quick_replies').push({trigger:kw,text:body});
  toast('Disimpan!','ok'); closeModal('add-qr-modal');
  document.getElementById('qr-kw').value=''; document.getElementById('qr-body').value='';
  loadQRList();
};
window.delQR = async function(id){
  if(!confirm('Hapus quick reply ini?')) return;
  await window.App.db.ref('quick_replies/'+id).remove(); loadQRList();
};
window.pasteQR = function(text){ document.getElementById('admin-msg-box').value=text; closeModal('qr-picker-modal'); switchP('chat',document.querySelector('[data-p="chat"]')); };
window.openQRPicker = async function(){
  const data=(await window.App.db.ref('quick_replies').once('value')).val()||{};
  const list=document.getElementById('qr-picker-list'); list.innerHTML='';
  Object.entries(data).forEach(([id,qr])=>{
    const c=document.createElement('div'); c.className='qr-card'; c.style.cursor='pointer';
    c.innerHTML=`<div class="qr-kw">${esc(qr.trigger)}</div><div class="qr-txt">${esc(qr.text)}</div>`;
    c.onclick=()=>pasteQR(qr.text); list.appendChild(c);
  });
  if(!list.children.length) list.innerHTML='<div style="color:var(--text3);text-align:center;padding:14px;font-size:13px">Belum ada quick reply</div>';
  openModal('qr-picker-modal'); hideAllAttach();
};

// ── Users ─────────────────────
async function loadUsers(){
  const data=(await window.App.db.ref('users').once('value')).val()||{};
  const list=document.getElementById('users-list'); list.innerHTML='';
  Object.entries(data).forEach(([uid,u])=>{
    const row=document.createElement('div'); row.className='user-row';
    row.innerHTML=`
      <img class="ur-av" src="${u.customAvatar||u.photoURL||genAv(u.name||'?')}" onerror="this.src='${genAv(u.name||'?')}'" alt="">
      <div class="ur-info">
        <div class="ur-name">${esc(u.name||uid)} <span style="font-size:10px;color:var(--text3)">[${u.role||'user'}]</span>${u.banned?' <span style="color:var(--danger);font-size:11px">🚫</span>':''}</div>
        <div class="ur-email">${esc(u.email||'')} · <span style="color:var(--text3)">${uid.substring(0,13)}…</span></div>
      </div>
      <div class="ur-acts">
        <button class="btn-icon" title="Buka Chat" onclick='goChat("${uid}",${JSON.stringify(JSON.stringify({name:u.name,email:u.email,photoURL:u.customAvatar||u.photoURL}))})' ><i class="fa fa-comment"></i></button>
        ${!u.banned
          ?`<button class="btn-icon" title="Ban" onclick="banU('${uid}')"><i class="fa fa-ban" style="color:var(--danger)"></i></button>`
          :`<button class="btn-icon" title="Unban" onclick="unbanU('${uid}')"><i class="fa fa-check" style="color:var(--success)"></i></button>`}
      </div>`;
    list.appendChild(row);
  });
  if(!list.children.length) list.innerHTML='<div style="text-align:center;color:var(--text3);padding:24px;font-size:13px">Tidak ada pengguna</div>';
}
window.goChat = function(uid, infoStr){ openChat(uid,JSON.parse(JSON.parse(infoStr))); switchP('chat',document.querySelector('[data-p="chat"]')); };
window.banU   = async function(uid){ await window.App.db.ref('users/'+uid+'/banned').set(true); await window.App.db.ref('chats/'+uid+'/banned').set(true); toast('Dibanned','inf'); loadUsers(); logAct('User '+uid+' dibanned'); };
window.unbanU = async function(uid){ await window.App.db.ref('users/'+uid+'/banned').remove(); await window.App.db.ref('chats/'+uid+'/banned').remove(); toast('Di-unban','ok'); loadUsers(); };

// ── User actions modal ────────
window.showUserActions = function(){
  if(!_chatUID) return;
  document.getElementById('ua-title').textContent='Aksi: '+document.getElementById('ach-name').textContent;
  document.getElementById('ua-uid').textContent='UID: '+_chatUID;
  openModal('ua-modal');
};
window.ua_ban   = async()=>{ await banU(_chatUID);   closeModal('ua-modal'); };
window.ua_unban = async()=>{ await unbanU(_chatUID); closeModal('ua-modal'); };
window.ua_clear = async()=>{
  if(!confirm('Hapus semua riwayat chat?')) return;
  await window.App.db.ref('chats/'+_chatUID+'/messages').remove();
  document.getElementById('a-msgs').innerHTML='';
  toast('Riwayat dihapus','inf'); closeModal('ua-modal'); logAct('Chat '+_chatUID+' dihapus');
};
window.ua_del = async()=>{
  if(!confirm('Hapus akun user ini dari database? Tidak bisa dibatalkan!')) return;
  await window.App.db.ref('users/'+_chatUID).remove();
  await window.App.db.ref('chats/'+_chatUID).remove();
  _chatUID=null;
  document.getElementById('a-empty').style.display='flex';
  document.getElementById('a-msgs').style.display='none';
  document.getElementById('a-input').style.display='none';
  document.getElementById('a-chat-hdr').style.display='none';
  toast('Akun dihapus','inf'); closeModal('ua-modal');
};

// ── Broadcast ─────────────────
window.doBroadcast = async function(){
  const title=document.getElementById('bc-title').value.trim();
  const body=document.getElementById('bc-body').value.trim();
  const target=document.getElementById('bc-target').value;
  if(!body){ toast('Isi pesan dulu!','err'); return; }
  const btn=document.getElementById('bc-btn'); btn.disabled=true; btn.textContent='Mengirim...';
  const users=(await window.App.db.ref('users').once('value')).val()||{};
  const u=window.App.user, now=Date.now(), week=7*86400000; let count=0;
  for(const [uid,usr] of Object.entries(users)){
    if(['admin','owner'].includes(usr.role)) continue;
    if(target==='active'&&usr.lastSeen&&(now-usr.lastSeen>week)) continue;
    const full=(title?`📢 *${title}*\n\n`:'')+body;
    await window.App.db.ref('chats/'+uid+'/messages').push({type:'text',text:full,uid:u.uid,name:u.displayName,photoURL:u.photoURL||'',from:'cs',timestamp:now,isBroadcast:true,read:false});
    await window.App.db.ref('chats/'+uid).update({lastMsg:body.substring(0,60),lastTime:now});
    count++;
  }
  await window.App.db.ref('broadcasts').push({title,msg:body,sentBy:u.displayName,timestamp:now,count});
  toast('Broadcast ke '+count+' user!','ok');
  document.getElementById('bc-title').value=''; document.getElementById('bc-body').value='';
  btn.disabled=false; btn.innerHTML='<i class="fa fa-tower-broadcast"></i> Kirim Broadcast';
  loadBCHistory(); logAct('Broadcast ke '+count+' user');
};
async function loadBCHistory(){
  const data=(await window.App.db.ref('broadcasts').limitToLast(15).once('value')).val()||{};
  const el=document.getElementById('bc-history'); el.innerHTML='';
  Object.values(data).sort((a,b)=>b.timestamp-a.timestamp).forEach(bc=>{
    const d=document.createElement('div'); d.className='qr-card';
    d.innerHTML=`<div class="qr-kw">${esc(bc.title||'Broadcast')} <span style="color:var(--text3)">· ${bc.count||0} user</span></div><div class="qr-txt">${esc(bc.msg.substring(0,90))}${bc.msg.length>90?'...':''}</div><div style="font-size:11px;color:var(--text3);margin-top:5px">${fmtTime(bc.timestamp)} · ${esc(bc.sentBy)}</div>`;
    el.appendChild(d);
  });
  if(!el.children.length) el.innerHTML='<div style="color:var(--text3);text-align:center;padding:14px;font-size:13px">Belum ada broadcast</div>';
}

// ── Settings ──────────────────
async function loadCSForm(){
  const cs=(await window.App.db.ref('cs_settings').once('value')).val()||{};
  document.getElementById('s-csname').value = cs.name||'';
  document.getElementById('s-store').value  = cs.storeName||'';
  document.getElementById('s-csav').value   = cs.avatar||'';
  document.getElementById('s-welcome').value= cs.welcome||'';
}
window.saveCS = async function(){
  await window.App.db.ref('cs_settings').update({ name:document.getElementById('s-csname').value.trim(), storeName:document.getElementById('s-store').value.trim(), avatar:document.getElementById('s-csav').value.trim(), welcome:document.getElementById('s-welcome').value.trim() });
  toast('Pengaturan disimpan!','ok'); logAct('CS settings diupdate');
};
window.saveMyPFP = async function(){
  const url=document.getElementById('s-mypfp').value.trim();
  if(!url){ toast('Masukkan URL!','err'); return; }
  await window.App.db.ref('users/'+window.App.user.uid+'/customAvatar').set(url);
  document.getElementById('sb-av').src=url; toast('Foto diupdate!','ok');
};

// ── Admin profile modal ───────
window.showAdminProfile = async function(){
  const u=window.App.user;
  const snap=await window.App.db.ref('users/'+u.uid+'/customAvatar').once('value');
  document.getElementById('ap-av').src    = snap.val()||u.photoURL||genAv(u.displayName);
  document.getElementById('ap-name').textContent  = u.displayName;
  document.getElementById('ap-email').textContent = u.email;
  document.getElementById('ap-uid').textContent   = 'UID: '+u.uid;
  openModal('ap-modal');
};
window.updatePFPModal = async function(){
  const url=document.getElementById('ap-pfp').value.trim();
  if(!url){ toast('Masukkan URL!','err'); return; }
  await window.App.db.ref('users/'+window.App.user.uid+'/customAvatar').set(url);
  document.getElementById('sb-av').src=url; document.getElementById('ap-av').src=url;
  toast('Diupdate!','ok'); closeModal('ap-modal');
};

// ── Owner panel ───────────────
async function loadOwner(){
  const [uSnap,cSnap,bSnap]=await Promise.all([window.App.db.ref('users').once('value'),window.App.db.ref('chats').once('value'),window.App.db.ref('broadcasts').once('value')]);
  const users=uSnap.val()||{}, chats=cSnap.val()||{}, bcs=bSnap.val()||{};
  const tu=Object.values(users).filter(u=>!['admin','owner'].includes(u.role)).length;
  const ta=Object.values(users).filter(u=>u.role==='admin').length;
  const tb=Object.values(users).filter(u=>u.banned).length;
  let tm=0,td=0; const today=new Date().toDateString();
  Object.values(chats).forEach(c=>{ const msgs=Object.values(c.messages||{}); tm+=msgs.length; msgs.forEach(m=>{ if(new Date(m.timestamp).toDateString()===today) td++; }); });
  document.getElementById('o-stats').innerHTML=`
    <div class="stat-card"><div class="stat-label">Users</div><div class="stat-val c-blue">${tu}</div></div>
    <div class="stat-card"><div class="stat-label">Admin</div><div class="stat-val c-green">${ta}</div></div>
    <div class="stat-card"><div class="stat-label">Total Pesan</div><div class="stat-val c-orange">${tm}</div></div>
    <div class="stat-card"><div class="stat-label">Banned</div><div class="stat-val c-red">${tb}</div></div>
    <div class="stat-card"><div class="stat-label">Hari Ini</div><div class="stat-val c-blue">${td}</div></div>
    <div class="stat-card"><div class="stat-label">Chat Rooms</div><div class="stat-val c-purple">${Object.keys(chats).length}</div></div>
    <div class="stat-card"><div class="stat-label">Broadcast</div><div class="stat-val c-green">${Object.keys(bcs).length}</div></div>`;
  const cfg=(()=>{ try{ return JSON.parse(localStorage.getItem('yoko_cfg')||'null'); }catch{return null;} })()||{};
  document.getElementById('o-monitor').innerHTML=`
    <div class="mon-row"><span class="mon-k">imgBB Key</span><span class="mon-v" style="color:var(--success)">✅ Terpasang</span></div>
    <div class="mon-row"><span class="mon-k">Owner UID</span><span class="mon-v" style="font-size:11px">${cfg.ownerUID||'—'}</span></div>
    <div class="mon-row"><span class="mon-k">Firebase Project</span><span class="mon-v">${cfg.projectId||'—'}</span></div>
    <div class="mon-row"><span class="mon-k">Total Broadcast Dikirim</span><span class="mon-v">${Object.values(bcs).reduce((a,b)=>a+(b.count||0),0)} pesan</span></div>`;
  loadLog();
}
window.setRole = async function(){
  const uid=document.getElementById('o-uid').value.trim(), role=document.getElementById('o-role').value;
  if(!uid){ toast('Masukkan UID!','err'); return; }
  await window.App.db.ref('users/'+uid+'/role').set(role);
  toast('Role diset ke '+role,'ok'); logAct('Role '+uid+' → '+role);
};
async function loadLog(){
  const data=(await window.App.db.ref('activity_log').limitToLast(25).once('value')).val()||{};
  const el=document.getElementById('o-log'); el.innerHTML='';
  Object.values(data).sort((a,b)=>b.ts-a.ts).forEach(l=>{
    const d=document.createElement('div'); d.className='log-row';
    d.innerHTML=`<span class="log-t">${fmtTime(l.ts)}</span><span class="log-m">${esc(l.text)}</span><span class="log-by">${esc(l.by)}</span>`;
    el.appendChild(d);
  });
  if(!el.children.length) el.innerHTML='<div style="color:var(--text3);text-align:center;padding:12px;font-size:12px">Belum ada log</div>';
}

// ── Responsive ────────────────
function checkMobile(){
  const mob=window.innerWidth<=768;
  const sc=document.getElementById('sb-close'), mb=document.getElementById('mob-sb-btn');
  if(sc) sc.style.display=mob?'flex':'none';
  if(mb) mb.style.display=mob?'flex':'none';
}
window.openSB  = ()=>{ document.getElementById('sidebar').classList.add('open'); document.getElementById('sb-overlay').classList.add('on'); };
window.closeSB = ()=>{ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sb-overlay').classList.remove('on'); };
window.addEventListener('resize', checkMobile);

// Redirect if opened directly without App context
window.addEventListener('load', ()=>{
  if(!window.App?.db) { window.location.href='/'; return; }
  window.initAdmin && window.initAdmin();
});

})();
