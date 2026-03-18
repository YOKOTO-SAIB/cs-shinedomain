/* admin.js */
(function(){
'use strict';
let _cuid=null,_chats={},_msgOff=null;

/* ── Init ─────────────────────── */
window.initAdmin=function(){
  const u=window.App.user,r=window.App.role;
  if(!u||!window.App.db)return;
  document.getElementById('adm-av').src=u.photoURL||genAv(u.displayName);
  document.getElementById('adm-uname').textContent=u.displayName;
  const chip=document.getElementById('adm-chip');
  chip.textContent=r.toUpperCase();chip.className='role-chip '+(r==='owner'?'rc-owner':'rc-admin');
  if(r==='owner')document.getElementById('owner-nav').classList.remove('hidden');
  loadCustomAv();listenChats();
};
async function loadCustomAv(){
  const s=await window.App.db.ref('users/'+window.App.user.uid+'/customAvatar').once('value');
  if(s.val())document.getElementById('adm-av').src=s.val();
}

/* ── Panel switch ─────────────── */
window.switchP=function(p,btn){
  document.querySelectorAll('.adm-panel').forEach(el=>el.classList.remove('active'));
  const target=document.getElementById('p-'+p);
  if(target)target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  if(p==='qr')loadQR();
  if(p==='users')loadUsers();
  if(p==='bc')loadBCHist();
  if(p==='cfg')loadCSForm();
  if(p==='owner')loadOwner();
};

/* ── Chat list ───────────────── */
function listenChats(){
  window.App.db.ref('chats').on('value',snap=>{
    _chats=snap.val()||{};
    renderChats(_chats);
    // unread dot
    const hasUnread=Object.values(_chats).some(c=>(c.unread||0)>0);
    document.getElementById('chat-dot').classList.toggle('hidden',!hasUnread);
  });
}
function renderChats(data,q=''){
  const list=document.getElementById('chat-list');list.innerHTML='';
  const entries=Object.entries(data)
    .filter(([uid,c])=>{
      if(!c.userInfo&&!c.lastMsg)return false;
      if(!q)return true;
      const n=(c.userInfo?.name||'').toLowerCase(),e=(c.userInfo?.email||'').toLowerCase();
      return n.includes(q)||e.includes(q);
    })
    .sort((a,b)=>(b[1].lastTime||0)-(a[1].lastTime||0));
  if(!entries.length){list.innerHTML='<div style="text-align:center;color:var(--text3);font-size:13px;padding:40px 20px">Belum ada chat masuk</div>';return;}
  entries.forEach(([uid,c])=>{
    const info=c.userInfo||{},name=info.name||uid,unread=c.unread||0,banned=c.banned;
    const item=document.createElement('div');item.className='ci';
    item.innerHTML=`
      <img class="ci-av" src="${info.photoURL||genAv(name)}" onerror="this.src='${genAv(name)}'" alt="">
      <div class="ci-body">
        <div class="ci-name truncate">${esc(name)}${banned?' <span class="ci-ban">BANNED</span>':''}</div>
        <div class="ci-prev truncate">${esc(c.lastMsg||'Belum ada pesan')}</div>
      </div>
      <div class="ci-meta">
        <span class="ci-time">${fmtShort(c.lastTime)}</span>
        ${unread>0?`<span class="ci-unread">${unread}</span>`:''}
      </div>`;
    item.addEventListener('click',()=>openChat(uid,info));
    list.appendChild(item);
  });
}
window.filterChats=q=>renderChats(_chats,q.toLowerCase());

/* ── Open chat (slide in) ──────── */
async function openChat(uid,info){
  _cuid=uid;
  const cv=document.getElementById('chat-view');
  cv.classList.add('open');
  document.getElementById('cv-av').src=info.photoURL||genAv(info.name||'?');
  document.getElementById('cv-name').textContent=info.name||uid;
  document.getElementById('cv-email').textContent=info.email||'';
  await window.App.db.ref('chats/'+uid+'/unread').set(0);
  if(_msgOff){window.App.db.ref('chats/'+_msgOff+'/messages').off();_msgOff=null;}
  _msgOff=uid;
  const cont=document.getElementById('a-msgs');cont.innerHTML='';
  const auid=window.App.user.uid;
  window.App.db.ref('chats/'+uid+'/messages').on('child_added',snap=>{
    const msg=snap.val();msg.id=snap.key;msg.showName=true;
    appendMsg(msg,cont,auid,uid);scrollEnd(cont);
    window.App.db.ref('chats/'+uid+'/messages/'+snap.key+'/read').set(true);
  });
  window.App.db.ref('chats/'+uid+'/messages').on('child_changed',snap=>{const m=snap.val();m.id=snap.key;m.showName=true;updateMsg(m,cont,auid,uid);});
  window.App.db.ref('chats/'+uid+'/messages').on('child_removed',snap=>rmMsg(snap.key));
}
window.closeChat=function(){
  document.getElementById('chat-view').classList.remove('open');
};

/* ── Admin send ───────────────── */
window.aSend=async function(){
  if(!_cuid){toast('Pilih chat dulu!','ter');return;}
  const box=document.getElementById('a-msg-inp'),text=box.value.trim();
  if(!text)return;
  box.value='';ar(box);
  const u=window.App.user;
  const avS=await window.App.db.ref('users/'+u.uid+'/customAvatar').once('value');
  const msg={type:'text',text,uid:u.uid,name:u.displayName,photoURL:avS.val()||u.photoURL||'',from:'cs',timestamp:Date.now(),read:false};
  const rep=window._rep.admin;
  if(rep){msg.replyTo={id:rep.id,name:rep.name,text:rep.text||'[media]'};cancelRep('admin');}
  await window.App.db.ref('chats/'+_cuid+'/messages').push(msg);
  await window.App.db.ref('chats/'+_cuid).update({lastMsg:text,lastTime:Date.now(),unread:0});
  scrollEnd('a-msgs');
};
window.aKey=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();aSend();}};

/* ── Admin file upload ─────────── */
window.aPickF=function(accept){const f=document.getElementById('a-file');f.accept=accept;f.click();hideAtts();};
window.aFile=async function(e){
  const file=e.target.files[0];if(!file)return;e.target.value='';
  if(!_cuid){toast('Pilih chat dulu!','ter');return;}
  const prog=document.getElementById('a-uprog'),bar=document.getElementById('a-uprog-bar'),lbl=document.getElementById('a-uprog-lbl');
  prog.style.display='block';lbl.textContent='Mengupload '+file.name+'...';
  try{
    const r=await upImgBB(file,p=>bar.style.width=p+'%');
    const u=window.App.user,avS=await window.App.db.ref('users/'+u.uid+'/customAvatar').once('value');
    const msg={type:dType(file),url:r.url,uid:u.uid,name:u.displayName,photoURL:avS.val()||u.photoURL||'',from:'cs',filename:file.name,size:fmtSize(file.size),timestamp:Date.now(),read:false};
    const rep=window._rep.admin;if(rep){msg.replyTo={id:rep.id,name:rep.name,text:rep.text||'[media]'};cancelRep('admin');}
    await window.App.db.ref('chats/'+_cuid+'/messages').push(msg);
    await window.App.db.ref('chats/'+_cuid).update({lastMsg:'['+msg.type+'] '+file.name,lastTime:Date.now(),unread:0});
    toast('Terkirim!','tok');scrollEnd('a-msgs');
  }catch(err){toast('Upload gagal: '+err.message,'ter');}
  prog.style.display='none';bar.style.width='0%';
};

/* ── User actions ─────────────── */
window.showUserAct=function(){
  if(!_cuid)return;
  document.getElementById('ua-title').textContent='Aksi: '+document.getElementById('cv-name').textContent;
  document.getElementById('ua-uid').textContent='UID: '+_cuid;
  openSheet('ua-sheet');
};
async function banU(uid){await window.App.db.ref('users/'+uid+'/banned').set(true);await window.App.db.ref('chats/'+uid+'/banned').set(true);toast('Dibanned','tin');loadUsers();logAct('User '+uid+' dibanned');}
async function unbanU(uid){await window.App.db.ref('users/'+uid+'/banned').remove();await window.App.db.ref('chats/'+uid+'/banned').remove();toast('Di-unban','tok');loadUsers();}
window.ua_ban=async()=>{await banU(_cuid);closeSheet('ua-sheet');};
window.ua_unban=async()=>{await unbanU(_cuid);closeSheet('ua-sheet');};
window.ua_clear=async()=>{if(!confirm('Hapus semua riwayat chat?'))return;await window.App.db.ref('chats/'+_cuid+'/messages').remove();document.getElementById('a-msgs').innerHTML='';toast('Riwayat dihapus','tin');closeSheet('ua-sheet');logAct('Chat '+_cuid+' dihapus');};
window.ua_del=async()=>{
  if(!confirm('Hapus akun ini dari database?'))return;
  await window.App.db.ref('users/'+_cuid).remove();await window.App.db.ref('chats/'+_cuid).remove();
  _cuid=null;closeChat();toast('Dihapus','tin');closeSheet('ua-sheet');
};

/* ── Quick Reply ──────────────── */
async function loadQR(){
  const data=(await window.App.db.ref('quick_replies').once('value')).val()||{};
  const list=document.getElementById('qr-list');list.innerHTML='';
  const entries=Object.entries(data);
  if(!entries.length){list.innerHTML='<div style="color:var(--text3);text-align:center;padding:32px;font-size:13px">Belum ada quick reply.<br>Tap Tambah Baru untuk membuat.</div>';return;}
  entries.forEach(([id,qr])=>{
    const c=document.createElement('div');c.className='qr-card';
    c.innerHTML=`<div class="qr-kw">${esc(qr.trigger)}</div><div class="qr-tx">${esc(qr.text)}</div>
    <div class="qr-acts">
      <button class="btn btn-sm btn-pri" onclick="pasteQR(${JSON.stringify(qr.text)})"><i class="fa fa-arrow-right"></i> Gunakan</button>
      <button class="btn btn-sm btn-red" onclick="delQR('${id}')"><i class="fa fa-trash"></i> Hapus</button>
    </div>`;
    list.appendChild(c);
  });
}
window.showAddQR=()=>openSheet('add-qr-sheet');
window.saveQR=async function(){
  const kw=document.getElementById('qr-kw').value.trim(),tx=document.getElementById('qr-tx').value.trim();
  if(!kw||!tx)return toast('Isi semua field!','ter');
  await window.App.db.ref('quick_replies').push({trigger:kw,text:tx});
  toast('Disimpan!','tok');closeSheet('add-qr-sheet');
  document.getElementById('qr-kw').value='';document.getElementById('qr-tx').value='';
  loadQR();
};
window.delQR=async function(id){if(!confirm('Hapus?'))return;await window.App.db.ref('quick_replies/'+id).remove();loadQR();};
window.pasteQR=function(text){document.getElementById('a-msg-inp').value=text;closeSheet('qr-pick-sheet');};
window.openQRPick=async function(){
  const data=(await window.App.db.ref('quick_replies').once('value')).val()||{};
  const list=document.getElementById('qr-pick-list');list.innerHTML='';
  Object.entries(data).forEach(([id,qr])=>{
    const c=document.createElement('div');c.className='qr-card';c.style.cursor='pointer';
    c.innerHTML=`<div class="qr-kw">${esc(qr.trigger)}</div><div class="qr-tx">${esc(qr.text)}</div>`;
    c.addEventListener('click',()=>pasteQR(qr.text));list.appendChild(c);
  });
  if(!list.children.length)list.innerHTML='<div style="color:var(--text3);text-align:center;padding:20px;font-size:13px">Belum ada quick reply</div>';
  openSheet('qr-pick-sheet');hideAtts();
};

/* ── Users ───────────────────── */
async function loadUsers(){
  const data=(await window.App.db.ref('users').once('value')).val()||{};
  const list=document.getElementById('users-list');list.innerHTML='';
  Object.entries(data).forEach(([uid,u])=>{
    const row=document.createElement('div');row.className='user-row';
    row.innerHTML=`
      <img class="ur-av" src="${u.customAvatar||u.photoURL||genAv(u.name||'?')}" onerror="this.src='${genAv(u.name||'?')}'" alt="">
      <div class="ur-info">
        <div class="ur-name">${esc(u.name||uid)}<span style="font-size:10px;color:var(--text3);margin-left:4px">[${u.role||'user'}]</span>${u.banned?'<span style="color:var(--red);font-size:11px"> 🚫</span>':''}</div>
        <div class="ur-email truncate">${esc(u.email||'')} · ${uid.substring(0,12)}…</div>
      </div>
      <div class="ur-acts">
        <button class="ibtn" title="Buka Chat" onclick='chatFromUser("${uid}",${JSON.stringify(JSON.stringify({name:u.name,email:u.email,photoURL:u.customAvatar||u.photoURL}))})'>
          <i class="fa fa-comment"></i>
        </button>
        ${!u.banned
          ?`<button class="ibtn" title="Ban" onclick="banU('${uid}')"><i class="fa fa-ban" style="color:var(--red)"></i></button>`
          :`<button class="ibtn" title="Unban" onclick="unbanU('${uid}')"><i class="fa fa-check" style="color:var(--green)"></i></button>`}
      </div>`;
    list.appendChild(row);
  });
  if(!list.children.length)list.innerHTML='<div style="text-align:center;color:var(--text3);padding:32px;font-size:13px">Tidak ada pengguna</div>';
}
window.chatFromUser=function(uid,infoStr){openChat(uid,JSON.parse(JSON.parse(infoStr)));switchP('chats',document.querySelector('[data-p="chats"]'));};
window.banU=banU;window.unbanU=unbanU;

/* ── Broadcast ───────────────── */
window.doBroadcast=async function(){
  const ttl=document.getElementById('bc-ttl').value.trim(),body=document.getElementById('bc-body').value.trim(),tgt=document.getElementById('bc-tgt').value;
  if(!body)return toast('Isi pesan dulu!','ter');
  const btn=document.getElementById('bc-btn');btn.disabled=true;btn.innerHTML='<i class="fa fa-spinner spin"></i> Mengirim...';
  const users=(await window.App.db.ref('users').once('value')).val()||{};
  const u=window.App.user,now=Date.now(),week=7*86400000;let count=0;
  for(const [uid,usr] of Object.entries(users)){
    if(['admin','owner'].includes(usr.role))continue;
    if(tgt==='active'&&usr.lastSeen&&(now-usr.lastSeen>week))continue;
    const full=(ttl?`📢 *${ttl}*\n\n`:'')+body;
    await window.App.db.ref('chats/'+uid+'/messages').push({type:'text',text:full,uid:u.uid,name:u.displayName,photoURL:u.photoURL||'',from:'cs',timestamp:now,isBroadcast:true,read:false});
    await window.App.db.ref('chats/'+uid).update({lastMsg:body.substring(0,60),lastTime:now});
    count++;
  }
  await window.App.db.ref('broadcasts').push({title:ttl,msg:body,sentBy:u.displayName,timestamp:now,count});
  toast('Terkirim ke '+count+' user!','tok');
  document.getElementById('bc-ttl').value='';document.getElementById('bc-body').value='';
  btn.disabled=false;btn.innerHTML='<i class="fa fa-tower-broadcast"></i> Kirim Broadcast';
  loadBCHist();logAct('Broadcast ke '+count+' user');
};
async function loadBCHist(){
  const data=(await window.App.db.ref('broadcasts').limitToLast(10).once('value')).val()||{};
  const el=document.getElementById('bc-hist');el.innerHTML='';
  Object.values(data).sort((a,b)=>b.timestamp-a.timestamp).forEach(bc=>{
    const d=document.createElement('div');d.className='qr-card';
    d.innerHTML=`<div class="qr-kw">${esc(bc.title||'Broadcast')} <span style="color:var(--text3)">· ${bc.count||0} user</span></div><div class="qr-tx">${esc(bc.msg.substring(0,80))}${bc.msg.length>80?'...':''}</div><div style="font-size:11px;color:var(--text3);margin-top:4px">${fmtTime(bc.timestamp)} · ${esc(bc.sentBy)}</div>`;
    el.appendChild(d);
  });
  if(!el.children.length)el.innerHTML='<div style="color:var(--text3);text-align:center;padding:20px;font-size:13px">Belum ada broadcast</div>';
}

/* ── CS Settings ─────────────── */
async function loadCSForm(){
  const cs=(await window.App.db.ref('cs_settings').once('value')).val()||{};
  document.getElementById('s-csn').value=cs.name||'';
  document.getElementById('s-sto').value=cs.storeName||'';
  document.getElementById('s-csav').value=cs.avatar||'';
  document.getElementById('s-wlc').value=cs.welcome||'';
}
window.saveCS=async function(){
  await window.App.db.ref('cs_settings').update({name:document.getElementById('s-csn').value.trim(),storeName:document.getElementById('s-sto').value.trim(),avatar:document.getElementById('s-csav').value.trim(),welcome:document.getElementById('s-wlc').value.trim()});
  toast('Disimpan!','tok');logAct('CS settings diupdate');
};
window.saveMyPFP=async function(){
  const url=document.getElementById('s-mypfp').value.trim();
  if(!url)return toast('Masukkan URL!','ter');
  await window.App.db.ref('users/'+window.App.user.uid+'/customAvatar').set(url);
  document.getElementById('adm-av').src=url;toast('Diupdate!','tok');
};

/* ── Admin profile sheet ─────── */
window.showAdmProf=async function(){
  const u=window.App.user;
  const snap=await window.App.db.ref('users/'+u.uid+'/customAvatar').once('value');
  document.getElementById('ap-av').src=snap.val()||u.photoURL||genAv(u.displayName);
  document.getElementById('ap-name').textContent=u.displayName;
  document.getElementById('ap-email').textContent=u.email;
  document.getElementById('ap-uid').textContent='UID: '+u.uid;
  openSheet('adm-prof-sheet');
};
window.updatePFP=async function(){
  const url=document.getElementById('ap-pfp').value.trim();
  if(!url)return toast('Masukkan URL!','ter');
  await window.App.db.ref('users/'+window.App.user.uid+'/customAvatar').set(url);
  document.getElementById('adm-av').src=url;document.getElementById('ap-av').src=url;
  toast('Diupdate!','tok');closeSheet('adm-prof-sheet');
};

/* ── Owner Panel ─────────────── */
async function loadOwner(){
  const [uS,cS,bS]=await Promise.all([window.App.db.ref('users').once('value'),window.App.db.ref('chats').once('value'),window.App.db.ref('broadcasts').once('value')]);
  const users=uS.val()||{},chats=cS.val()||{},bcs=bS.val()||{};
  const tu=Object.values(users).filter(u=>!['admin','owner'].includes(u.role)).length;
  const ta=Object.values(users).filter(u=>u.role==='admin').length;
  const tb=Object.values(users).filter(u=>u.banned).length;
  let tm=0,td=0;const today=new Date().toDateString();
  Object.values(chats).forEach(c=>{const msgs=Object.values(c.messages||{});tm+=msgs.length;msgs.forEach(m=>{if(new Date(m.timestamp).toDateString()===today)td++;});});
  document.getElementById('o-stats').innerHTML=`
    <div class="stat-card"><div class="stat-lbl">Users</div><div class="stat-val cv-blue">${tu}</div></div>
    <div class="stat-card"><div class="stat-lbl">Admin CS</div><div class="stat-val cv-green">${ta}</div></div>
    <div class="stat-card"><div class="stat-lbl">Total Pesan</div><div class="stat-val cv-orange">${tm}</div></div>
    <div class="stat-card"><div class="stat-lbl">Banned</div><div class="stat-val cv-red">${tb}</div></div>
    <div class="stat-card"><div class="stat-lbl">Hari Ini</div><div class="stat-val cv-blue">${td}</div></div>
    <div class="stat-card"><div class="stat-lbl">Chat Rooms</div><div class="stat-val cv-purple">${Object.keys(chats).length}</div></div>`;
  const cfg=(()=>{try{return JSON.parse(localStorage.getItem('yoko_cfg')||'null');}catch{return null;}})();
  document.getElementById('o-mon').innerHTML=`
    <div class="mon-row"><span class="mon-k">imgBB Key</span><span class="mon-v" style="color:var(--green)">✅ Terpasang</span></div>
    <div class="mon-row"><span class="mon-k">Owner UID</span><span class="mon-v" style="font-size:11px">${cfg?.ownerUID||'—'}</span></div>
    <div class="mon-row"><span class="mon-k">Project ID</span><span class="mon-v">${cfg?.projectId||'—'}</span></div>
    <div class="mon-row"><span class="mon-k">Broadcast dikirim</span><span class="mon-v">${Object.values(bcs).reduce((a,b)=>a+(b.count||0),0)} pesan</span></div>`;
  loadLog();
}
window.setRole=async function(){
  const uid=document.getElementById('o-uid').value.trim(),role=document.getElementById('o-role').value;
  if(!uid)return toast('Masukkan UID!','ter');
  await window.App.db.ref('users/'+uid+'/role').set(role);
  toast('Role diset ke '+role,'tok');logAct('Role '+uid+' → '+role);
};
async function loadLog(){
  const data=(await window.App.db.ref('activity_log').limitToLast(20).once('value')).val()||{};
  const el=document.getElementById('o-log');el.innerHTML='';
  Object.values(data).sort((a,b)=>b.ts-a.ts).forEach(l=>{
    const d=document.createElement('div');d.className='log-row';
    d.innerHTML=`<span class="log-t">${fmtTime(l.ts)}</span><span class="log-m">${esc(l.text)}</span><span class="log-by">${esc(l.by)}</span>`;
    el.appendChild(d);
  });
  if(!el.children.length)el.innerHTML='<div style="color:var(--text3);text-align:center;padding:14px;font-size:12px">Belum ada log</div>';
}

/* ── Handle back button (android) ─ */
window.addEventListener('popstate',()=>{
  const cv=document.getElementById('chat-view');
  if(cv&&cv.classList.contains('open')){closeChat();history.pushState(null,'',location.href);}
});
document.getElementById('chat-view')?.addEventListener('transitionstart',()=>{});

/* ── Startup ─────────────────── */
window.addEventListener('load',()=>{
  if(!window.App?.db){window.location.href='/';return;}
  window.initAdmin&&window.initAdmin();
  history.pushState(null,'',location.href);
});

})();
