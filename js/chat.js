(function () {
  'use strict';

  function ab2b64(buf){var b=new Uint8Array(buf),s='';for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s);}
  function b642ab(s){var bin=atob(s),a=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a.buffer;}
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function el(t,c,h){var e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;}
  function initials(s){return (s&&s.trim()?s.trim().slice(0,2).toUpperCase():'?');}
  function fmtTime(ts){if(!ts)return'';var d;if(ts&&typeof ts.toDate==='function')d=ts.toDate();else if(ts&&ts.seconds)d=new Date(ts.seconds*1000);else d=new Date(ts);if(!d||isNaN(d.getTime()))return'';return d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});}
  function tsMs(ts){if(!ts)return 0;if(typeof ts.toDate==='function')return ts.toDate().getTime();if(ts.seconds)return ts.seconds*1000;var d=new Date(ts);return isNaN(d.getTime())?0:d.getTime();}
  function fmtSeen(ls){if(!ls)return'давно';var d=new Date(ls);if(isNaN(d.getTime()))return'давно';var diff=Date.now()-d.getTime();if(diff<60000)return'щойно';if(diff<3600000)return Math.floor(diff/60000)+' хв тому';var t=new Date();t.setHours(0,0,0,0);if(d.getTime()>=t.getTime())return'о '+d.toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});return d.toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'});}
  var EMO_RE=/(\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic}|\uFE0F|[\u{1F3FB}-\u{1F3FF}])*)/gu;
  function jumboCount(s){var t=(s||'').trim();if(!t)return 0;var mm=t.match(EMO_RE);if(!mm)return 0;if(t.replace(EMO_RE,'').trim()!=='')return 0;return mm.length;}
  function mediaLabel(m){if(m.media==='video')return '🎬 Відео';if(m.mediaUrl||m.mediaRef)return '🖼 Фото';return '';}

  async function sha16(s){
    try{
      var b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(s||'')));
      var a=new Uint8Array(b),h='';
      for(var i=0;i<a.length;i++)h+=('0'+a[i].toString(16)).slice(-2);
      return h.slice(0,16);
    }catch(e){return '';}
  }
  function keyFpSlot(id){return 'ciya_key_fp_'+String(id);}

  async function cloudinaryUpload(file){
    var CLOUD='dmixgk60g';
    var PRESET='asyouknow';
    var endpoint='https://api.cloudinary.com/v1_1/'+CLOUD+'/video/upload';
    var fd=new FormData();
    fd.append('file',file);
    fd.append('upload_preset',PRESET);
    var r=await fetch(endpoint,{method:'POST',body:fd});
    var j=await r.json();
    if(!j||!j.secure_url)throw new Error('cloudinary');
    return j.secure_url;
  }
  async function baseMediaPayload(key,kind){var p={from:String(myId)};if(view.isGroup)p.fromName=(window.state&&window.state.telegram&&window.state.telegram.username)||myId;var cap=await enc(key,'');p.iv=cap.iv;p.data=cap.data;p.media=kind;if(reply)p.replyTo=reply.id;return p;}

  var MAX_TEXT=4000, ONLINE_WINDOW=70000, PRESENCE_INTERVAL=30000, CHUNK=700000;
  var QUICK=['❤️','👍','👎','🔥','😂','😮','😢','🙏','🥳','😍','🤔','💯','👏','🤝','⚡','✅'];
  var EMOJIS=['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳','😅','😉','🙂','🙃','😇','🤗','🤔','😐','😴','😭','😡','🥺','😤','🤝','👍','👎','👌','✌️','🤞','🙏','👏','🙌','💪','🔥','❤️','🧡','💛','💚','💙','💜','🖤','💔','✨','⭐','🎉','🎁','💯','✅','❌','⚡','💰','🚗','⚖️','📄','💍'];
  var PRIV=function(id){return 'ciya_chat_priv_'+id;}, PUB=function(id){return 'ciya_chat_pub_'+id;};

  var myId=null,myPriv=null,myPub=null;
  var view=null,chatId=null,aesKey=null,groupKey=null,unsub=null,unsubReads=null;
  var contacts=[],groups=[],lastTimes={},rendered={},decCache={},reads={},reply=null,editing=null;
  var presenceTimer=null,peerTimer=null,_modal=null;
  var msgsInit=false,newCount=0;

  var IC_CLOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/></svg>';
  var IC_CHECK1='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6"/></svg>';
  var IC_CHECK2='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12.5l4 4L13 6"/><path d="M10.5 16.5l1.7 1.7L22 7"/></svg>';
  var IC_REACT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
  var IC_REPLY='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>';
  var IC_PHOTO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  var IC_EDIT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var IC_TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  function getMyId(){var t=window.state&&window.state.telegram;if(t&&t.id)return String(t.id);if(t&&t.username)return String(t.username);return null;}
  function dmId(id){return [String(myId),String(id)].sort().join('__');}
  function online(ls){if(!ls)return false;var t=new Date(ls).getTime();return !isNaN(t)&&(Date.now()-t)<ONLINE_WINDOW;}
  function validJwk(j){return j&&j.kty==='EC'&&j.crv==='P-256'&&typeof j.x==='string';}
  function tgCloud(){var t=window.Telegram&&window.Telegram.WebApp;return (t&&t.CloudStorage)?t.CloudStorage:null;}
  function cloudGet(k){return new Promise(function(res){var cs=tgCloud();if(!cs){res(null);return;}try{cs.getItem(k,function(err,val){res(err?null:(val||null));});}catch(e){res(null);}});}
  function cloudSet(k,v){return new Promise(function(res){var cs=tgCloud();if(!cs){res(false);return;}try{cs.setItem(k,v,function(err,ok){res(!err);});}catch(e){res(false);}});}

  async function ensureKeys(){
    myId=getMyId(); if(!myId)return false;
    var pj=null,uj=null;
    var cpj=await cloudGet('ck_priv_'+myId),cuj=await cloudGet('ck_pub_'+myId);
    if(cpj&&cuj){try{pj=JSON.parse(cpj);uj=JSON.parse(cuj);}catch(e){pj=null;uj=null;}}
    if(!validJwk(uj)||!pj){
      pj=null;uj=null;
      try{pj=JSON.parse(localStorage.getItem(PRIV(myId))||'null');}catch(e){}
      try{uj=JSON.parse(localStorage.getItem(PUB(myId))||'null');}catch(e){}
      if(validJwk(uj)&&pj){await cloudSet('ck_priv_'+myId,JSON.stringify(pj));await cloudSet('ck_pub_'+myId,JSON.stringify(uj));}
      else{pj=null;uj=null;}
    }
    if(!pj||!uj){
      var pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveKey','deriveBits']);
      pj=await crypto.subtle.exportKey('jwk',pair.privateKey);
      uj=await crypto.subtle.exportKey('jwk',pair.publicKey);
      await cloudSet('ck_priv_'+myId,JSON.stringify(pj));
      await cloudSet('ck_pub_'+myId,JSON.stringify(uj));
    }
    try{localStorage.setItem(PRIV(myId),JSON.stringify(pj));localStorage.setItem(PUB(myId),JSON.stringify(uj));}catch(e){}
    myPub=uj;
    myPriv=await crypto.subtle.importKey('jwk',pj,{name:'ECDH',namedCurve:'P-256'},false,['deriveKey','deriveBits']);
    if(typeof window.chatPublishKey==='function'){try{await window.chatPublishKey(myId,uj);}catch(e){}}
    if(typeof window.chatSetProfile==='function'){var nm=(window.state&&window.state.roblox&&window.state.roblox.username)||(window.state&&window.state.telegram&&window.state.telegram.username)||myId;try{await window.chatSetProfile(myId,nm);}catch(e){}}
    return true;
  }

  async function deriveAes(peerJwk){var pk=await crypto.subtle.importKey('jwk',peerJwk,{name:'ECDH',namedCurve:'P-256'},false,[]);return crypto.subtle.deriveKey({name:'ECDH',public:pk},myPriv,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
  async function enc(key,text){var iv=crypto.getRandomValues(new Uint8Array(12));var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(text));return {iv:ab2b64(iv),data:ab2b64(ct)};}
  async function dec(key,iv,data){try{var pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b642ab(iv))},key,b642ab(data));return new TextDecoder().decode(pt);}catch(e){return null;}}
  async function encBytes(key,buf){var iv=crypto.getRandomValues(new Uint8Array(12));var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,buf);return {iv:ab2b64(iv),b64:ab2b64(ct)};}
  async function decBytes(key,iv,b64){return crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b642ab(iv))},key,b642ab(b64));}
  async function genGroupKey(){return crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);}
  async function wrapGroupKey(gk,peerJwk){var raw=await crypto.subtle.exportKey('raw',gk);var k=await deriveAes(peerJwk);var iv=crypto.getRandomValues(new Uint8Array(12));var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},k,raw);return {iv:ab2b64(iv),data:ab2b64(ct)};}
  async function unwrapGroupKey(wrap,fromJwk){var k=await deriveAes(fromJwk);var raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b642ab(wrap.iv))},k,b642ab(wrap.data));return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},true,['encrypt','decrypt']);}

  function fabReady(){var ob=document.getElementById('onboarding-overlay');if(ob&&!ob.classList.contains('hidden')&&ob.style.display!=='none')return false;var sp=document.getElementById('splash');if(sp&&!sp.classList.contains('hidden'))return false;return true;}
  function showFab(){var f=document.getElementById('chat-fab');if(f&&fabReady())f.style.display='flex';}
  function startPresence(){var beat=function(){if(myId&&window.chatHeartbeat)window.chatHeartbeat(myId);};beat();if(!presenceTimer)presenceTimer=setInterval(beat,PRESENCE_INTERVAL);}
  function waitForLogin(){if(getMyId()){ready();return;}var n=0,t=setInterval(function(){if(getMyId()){clearInterval(t);ready();}else if(++n>120)clearInterval(t);},1000);}
  async function ready(){var ok=await ensureKeys();if(ok)startPresence();return ok;}

  function inject(){
    if(document.getElementById('chat-fab'))return;
    var fab=el('button','','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>');
    fab.id='chat-fab';fab.type='button';fab.style.display='none';fab.onclick=openChat;document.body.appendChild(fab);
    var ov=el('div');ov.id='chat-overlay';
    ov.innerHTML=
      '<div class="chat-panel">'+
        '<div class="chat-header">'+
          '<button class="chat-back" id="chat-back" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>'+
          '<div class="chat-header-av" id="chat-header-av"></div>'+
          '<div class="chat-header-main"><div class="chat-header-title" id="chat-header-title">Чати</div><div class="chat-header-status" id="chat-header-status"></div></div>'+
          '<button class="chat-gear" id="chat-gear" type="button" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>'+
          '<button class="chat-close" id="chat-close" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg></button>'+
        '</div>'+
        '<div class="chat-view" id="chat-view-contacts">'+
          '<div class="chat-search"><input id="chat-search-input" type="text" placeholder="Пошук…" autocomplete="off"></div>'+
          '<div class="chat-contacts" id="chat-contacts"></div>'+
        '</div>'+
        '<div class="chat-view" id="chat-view-convo" style="display:none">'+
          '<div class="chat-keywarn" id="chat-keywarn" style="display:none"></div>'+
          '<div class="chat-messages" id="chat-messages"></div>'+
          '<div class="chat-reply-bar" id="chat-reply-bar" style="display:none"></div>'+
          '<div class="chat-emoji-panel" id="chat-emoji-panel"></div>'+
          '<div class="chat-inputbar">'+
            '<button id="chat-emoji-btn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button>'+
            '<button id="chat-photo-btn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></button>'+
            '<button id="chat-video-btn" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></button>'+
            '<input id="chat-input" type="text" maxlength="4000" placeholder="Повідомлення…" autocomplete="off">'+
            '<button id="chat-send" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>'+
          '</div>'+
        '</div>'+
        '<div class="chat-react-popup" id="chat-react-popup"></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.addEventListener('click',function(e){if(e.target===ov)closeChat();});
    document.getElementById('chat-close').onclick=closeChat;
    document.getElementById('chat-back').onclick=showContacts;
    document.getElementById('chat-gear').onclick=openGroupGear;
    document.getElementById('chat-send').onclick=sendCurrent;
    document.getElementById('chat-emoji-btn').onclick=function(){document.getElementById('chat-emoji-panel').classList.toggle('open');};
    document.getElementById('chat-photo-btn').onclick=function(){pickMedia('image');};
    document.getElementById('chat-video-btn').onclick=function(){pickMedia('video');};
    document.getElementById('chat-input').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();sendCurrent();}});
    document.getElementById('chat-input').addEventListener('focus',function(){document.getElementById('chat-emoji-panel').classList.remove('open');});
    document.getElementById('chat-search-input').addEventListener('input',function(e){renderLists(e.target.value);});
    document.getElementById('chat-messages').addEventListener('scroll',onMsgScroll);
    var sd=el('button','chat-scrolldown','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg><span class="chat-sd-badge"></span>');
    sd.id='chat-scrolldown';sd.type='button';sd.onclick=function(){scrollToBottom(true);};
    document.getElementById('chat-view-convo').appendChild(sd);
    document.addEventListener('click',function(e){var p=document.getElementById('chat-react-popup');if(p&&p.classList.contains('open')&&!p.contains(e.target))hidePopups();document.querySelectorAll('.chat-msg-menu').forEach(function(n){if(!n.contains(e.target))n.remove();});});
    var ep=document.getElementById('chat-emoji-panel');
    ep.innerHTML=EMOJIS.map(function(e){return '<button type="button" class="chat-emoji-item">'+e+'</button>';}).join('');
    ep.querySelectorAll('.chat-emoji-item').forEach(function(b){b.onclick=function(){var i=document.getElementById('chat-input');i.value+=b.textContent;i.focus();};});
  }

  async function openChat(){
    inject();
    document.getElementById('chat-overlay').classList.add('open');
    showContacts();
    if(!getMyId()){document.getElementById('chat-contacts').innerHTML=emptyBox('🔒','Потрібна авторизація','Увійди через Telegram.');return;}
    document.getElementById('chat-contacts').innerHTML='<div class="chat-loading">Завантаження…</div>';
    var ok=await ready();if(!ok)return;
    await loadLists();
  }
  function closeChat(){var ov=document.getElementById('chat-overlay');if(ov)ov.classList.remove('open');teardown();}
  function teardown(){if(unsub){try{unsub();}catch(e){}unsub=null;}if(unsubReads){try{unsubReads();}catch(e){}unsubReads=null;}if(peerTimer){clearInterval(peerTimer);peerTimer=null;}chatId=null;aesKey=null;groupKey=null;view=null;rendered={};reads={};reply=null;editing=null;hidePopups();}
  function showContacts(){teardown();document.getElementById('chat-view-convo').style.display='none';document.getElementById('chat-view-contacts').style.display='flex';document.getElementById('chat-back').style.visibility='hidden';document.getElementById('chat-gear').style.display='none';var av=document.getElementById('chat-header-av');av.innerHTML='';av.style.display='none';document.getElementById('chat-header-title').textContent='Чати';document.getElementById('chat-header-status').textContent='';clearReply();}

  function emptyBox(i,t,s){return '<div class="chat-empty"><div class="chat-empty-icon">'+i+'</div><div class="chat-empty-title">'+esc(t)+'</div><div class="chat-empty-sub">'+(s||'')+'</div></div>';}
  function avHtml(av,name){return av?'<img src="'+esc(av)+'" alt="">':esc(initials(name));}

  async function loadLists(){
    var r=await Promise.all([window.chatListContacts?window.chatListContacts():[],window.chatListGroups?window.chatListGroups(myId):[]]);
    contacts=(r[0]||[]).filter(function(c){return String(c.id)!==String(myId);});
    groups=r[1]||[];
    var ids=[];contacts.forEach(function(c){ids.push(dmId(c.id));});groups.forEach(function(g){ids.push(g.id);});
    try{lastTimes=window.chatLastTimes?await window.chatLastTimes(ids):{};}catch(e){lastTimes={};}
    renderLists(document.getElementById('chat-search-input').value||'');
  }

  function renderLists(q){
    var box=document.getElementById('chat-contacts');box.innerHTML='';q=(q||'').toLowerCase().trim();
    var ng=el('button','chat-newgroup-btn','<span class="chat-newgroup-ic">＋</span> Нова група');ng.onclick=openGroupCreate;box.appendChild(ng);
    var items=[];
    groups.forEach(function(g){items.push({type:'g',g:g,name:g.name||'Група',t:lastTimes[g.id]||0});});
    contacts.forEach(function(c){items.push({type:'c',c:c,name:c.username||'',t:lastTimes[dmId(c.id)]||0});});
    items=items.filter(function(it){if(!q)return true;if((it.name||'').toLowerCase().indexOf(q)>=0)return true;if(it.type==='c'&&it.c.tgUsername&&it.c.tgUsername.toLowerCase().indexOf(q)>=0)return true;return false;});
    items.sort(function(a,b){if(b.t!==a.t)return b.t-a.t;return a.name.localeCompare(b.name,'uk');});
    if(!items.length){box.appendChild(el('div','chat-empty','<div class="chat-empty-icon">👥</div><div class="chat-empty-title">Нікого не знайдено</div>'));return;}
    items.forEach(function(it,i){box.appendChild(it.type==='g'?groupRow(it.g):contactRow(it.c,i));});
  }

  function contactRow(c,i){
    var on=online(c.lastSeen);var row=el('div','chat-contact');row.style.animationDelay=(i*0.03)+'s';
    row.innerHTML='<div class="chat-contact-av">'+avHtml(c.avatar,c.username)+(on?'<span class="chat-online-dot"></span>':'')+'</div>'+
      '<div class="chat-contact-body"><div class="chat-contact-name">'+esc(c.username)+'</div><div class="chat-contact-sub">'+(on?'<span class="chat-online-text">У мережі</span>':(c.lastSeen?'Був(ла) '+fmtSeen(c.lastSeen):(c.hasKey?'натисни щоб написати':'без ключа')))+'</div></div>';
    row.onclick=function(){openDm(c);};return row;
  }

  function groupRow(g){
    var row=el('div','chat-contact');
    row.innerHTML='<div class="chat-contact-av chat-group-av">'+avHtml(g.avatar,g.name)+'</div><div class="chat-contact-body"><div class="chat-contact-name">'+esc(g.name)+'</div><div class="chat-contact-sub">'+(g.members?g.members.length:0)+' учасників</div></div><span class="chat-group-badge">Группа</span>';
    row.onclick=function(){openGroup(g);};
    return row;
  }

  async function openDm(c){
    var key=window.chatGetKey?await window.chatGetKey(c.id):null;
    if(!validJwk(key)){
      document.getElementById('chat-view-contacts').style.display='none';
      document.getElementById('chat-view-convo').style.display='flex';
      document.getElementById('chat-back').style.visibility='visible';
      document.getElementById('chat-header-title').textContent=c.username;
      document.getElementById('chat-messages').innerHTML=emptyBox('⏳','Користувач ще не в чаті',esc(c.username)+' має хоч раз відкрити СіЯ.');
      return;
    }

    var fp=await sha16(JSON.stringify(key));
    var old=null;
    try{old=localStorage.getItem(keyFpSlot(c.id))||null;}catch(e){}
    if(old && fp && old!==fp){
      document.getElementById('chat-view-contacts').style.display='none';
      document.getElementById('chat-view-convo').style.display='flex';
      document.getElementById('chat-back').style.visibility='visible';
      document.getElementById('chat-header-title').textContent=c.username;
      document.getElementById('chat-messages').innerHTML=emptyBox('⚠️','Ключ співрозмовника змінився',esc(c.username)+' має знов відкрити СіЯ.');
      return;
    }
    if(fp && !old){try{localStorage.setItem(keyFpSlot(c.id),fp);}catch(e){}}

    try{aesKey=await deriveAes(key);}catch(e){return;}
    groupKey=null;view={isGroup:false,id:String(c.id),name:c.username,avatar:c.avatar,lastSeen:c.lastSeen};
    chatId=dmId(c.id);
    enterUI();startPeerStatus(c.id);subscribe();
  }

  async function openGroup(g){
    var full=(window.chatGetGroup?await window.chatGetGroup(g.id):null)||g;
    var wrap=window.chatGetGroupWrap?await window.chatGetGroupWrap(g.id,myId):null;
    view={isGroup:true,id:g.id,name:full.name,avatar:full.avatar,desc:full.desc||'',members:full.members||[],owner:full.owner};
    chatId=g.id;aesKey=null;groupKey=null;
    enterUI();
    document.getElementById('chat-gear').style.display='flex';
    if(!wrap){document.getElementById('chat-messages').innerHTML=emptyBox('🔒','Нема ключа групи','Тебе додали, але ключ ще не видано. Хай власник відкриє групу.');setInput(false);return;}
    var ownerPub=window.chatGetKey?await window.chatGetKey(wrap.from||full.owner):null;
    if(!validJwk(ownerPub)){document.getElementById('chat-messages').innerHTML=emptyBox('⚠️','Помилка ключа','');return;}
    try{groupKey=await unwrapGroupKey(wrap,ownerPub);}catch(e){document.getElementById('chat-messages').innerHTML=emptyBox('⚠️','Не вдалось відкрити ключ групи','');return;}
    subscribe();
  }

  function enterUI(){
    rendered={};reads={};reply=null;editing=null;decCache={};msgsInit=false;newCount=0;
    document.getElementById('chat-view-contacts').style.display='none';
    document.getElementById('chat-view-convo').style.display='flex';
    document.getElementById('chat-back').style.visibility='visible';
    document.getElementById('chat-gear').style.display='none';
    document.getElementById('chat-header-title').textContent=view.name;
    var av=document.getElementById('chat-header-av');av.style.display='flex';av.className='chat-header-av'+(view.isGroup?' chat-group-av':'');av.innerHTML=avHtml(view.avatar,view.name);
    var st=document.getElementById('chat-header-status');
    if(view.isGroup)st.textContent=(view.members.length)+' учасників';
    else st.innerHTML=online(view.lastSeen)?'<span class="chat-online-text">у мережі</span>':(view.lastSeen?'був(ла) '+fmtSeen(view.lastSeen):'не в мережі');
    clearReply();document.getElementById('chat-emoji-panel').classList.remove('open');
    document.getElementById('chat-messages').innerHTML='<div class="chat-loading">Завантаження…</div>';
    setInput(true);
  }

  function subscribe(){
    if(unsub){try{unsub();}catch(e){}unsub=null;}
    if(unsubReads){try{unsubReads();}catch(e){}unsubReads=null;}
    unsub=window.chatSubscribe(chatId,function(list){renderMsgs(list);if(window.chatMarkRead)window.chatMarkRead(chatId,myId);});
    if(window.chatSubscribeReads&&!view.isGroup)unsubReads=window.chatSubscribeReads(chatId,function(r){reads=r||{};refreshReads();});
  }

  function setInput(on){['chat-input','chat-send','chat-emoji-btn','chat-photo-btn','chat-video-btn'].forEach(function(id){var e=document.getElementById(id);if(e)e.disabled=!on;});}

  function startPeerStatus(pid){
    if(peerTimer)clearInterval(peerTimer);
    peerTimer=setInterval(async function(){
      if(!window.chatGetPresence)return;
      var ls=await window.chatGetPresence(pid);
      if(view&&!view.isGroup&&String(view.id)===String(pid)){
        var st=document.getElementById('chat-header-status');
        st.innerHTML=online(ls)?'<span class="chat-online-text">у мережі</span>':(ls?'був(ла) '+fmtSeen(ls):'не в мережі');
      }
    },20000);
  }

  async function curKey(){return view.isGroup?groupKey:aesKey;}

  function atBottom(){var b=document.getElementById('chat-messages');if(!b)return true;return b.scrollHeight-b.scrollTop-b.clientHeight<60;}
  function scrollToBottom(smooth){var b=document.getElementById('chat-messages');if(!b)return;try{b.scrollTo({top:b.scrollHeight,behavior:smooth?'smooth':'auto'});}catch(e){b.scrollTop=b.scrollHeight;}newCount=0;updateScrollBtn();}
  function updateScrollBtn(){var btn=document.getElementById('chat-scrolldown');if(!btn)return;var show=!atBottom();btn.classList.toggle('show',show);if(!show)newCount=0;var bdg=btn.querySelector('.chat-sd-badge');if(bdg){bdg.textContent=newCount>0?newCount:'';bdg.style.display=newCount>0?'flex':'none';}}
  function onMsgScroll(){hidePopups();updateScrollBtn();}

  async function renderMsgs(list){
    var box=document.getElementById('chat-messages');if(!box)return;
    if(!list.length){box.innerHTML=emptyBox('🔒','Поки порожньо','Захищений чат.');rendered={};msgsInit=true;return;}
    if(box.querySelector('.chat-empty')||box.querySelector('.chat-loading')){box.innerHTML='';rendered={};}
    var key=await curKey();
    var wasBottom=atBottom();
    var byId={};list.forEach(function(m){byId[m._id]=m;});
    Object.keys(rendered).forEach(function(id){if(!byId[id]){rendered[id].remove();delete rendered[id];}});
    var createdIncoming=0,createdMine=0;
    for(var i=0;i<list.length;i++){
      var m=list[i],mine=String(m.from)===String(myId);
      var sig=(m.iv||'')+'|'+(m.data||'')+'|'+(m.edited||'')+'|'+(m.mediaRef||'')+'|'+(m.mediaUrl||'');
      if(rendered[m._id]){
        if(rendered[m._id].dataset.sig!==sig){delete decCache['t_'+m._id];await fillNode(rendered[m._id],m,mine,key,byId);rendered[m._id].dataset.sig=sig;}
        else{updateReactions(rendered[m._id],m);updateMeta(rendered[m._id],m,mine);}
        continue;
      }
      var node=el('div','chat-msg '+(mine?'mine':'theirs'));node.dataset.id=m._id;node.dataset.sig=sig;
      if(msgsInit)node.classList.add('enter');
      box.appendChild(node);rendered[m._id]=node;
      await fillNode(node,m,mine,key,byId);
      if(mine)createdMine++;else createdIncoming++;
    }
    if(createdMine>0||wasBottom){scrollToBottom(false);}
    else if(createdIncoming>0){newCount+=createdIncoming;updateScrollBtn();}
    else{updateScrollBtn();}
    msgsInit=true;
    refreshReads();
  }

  async function fillNode(node,m,mine,key,byId){
    node.innerHTML='';
    if(view.isGroup&&!mine)node.appendChild(el('div','chat-msg-from',esc(m.fromName||m.from)));
    var bubble=el('div','chat-bubble');
    if(m.replyTo&&byId[m.replyTo]){
      var rm=byId[m.replyTo];
      var rt=decCache['t_'+rm._id]||'';
      var who=String(rm.from)===String(myId)?'Ви':(rm.fromName||rm.from);
      var thumb=(rm.mediaUrl&&rm.media!=='video')?'<img class="chat-reply-thumb" src="'+esc(rm.mediaUrl)+'">':'';
      var lbl=rt||mediaLabel(rm);
      var q=el('div','chat-reply-quote'+(thumb?' has-thumb':''));
      q.innerHTML=thumb+'<div class="chat-reply-qtext"><span>'+esc(who)+'</span>'+esc(lbl)+'</div>';
      bubble.appendChild(q);
    }
    var hasMedia=false;
    if(m.mediaUrl){
      hasMedia=true;
      if(m.media==='video'){bubble.appendChild(buildVideoPlayer(m.mediaUrl,m,bubble,mine));}
      else{var mb=el('div','chat-media');var im=el('img','chat-media-img');im.src=m.mediaUrl;mb.appendChild(im);bubble.appendChild(mb);}
    }else if(m.mediaRef){
      hasMedia=true;
      bubble.appendChild(mediaLoader(m,key));
    }
    var text='';
    if(m.iv&&m.data&&key){
      text=decCache['t_'+m._id];
      if(text===undefined||text===null){text=await dec(key,m.iv,m.data);if(text!==null)decCache['t_'+m._id]=text;}
    }
    if(text===null&&!hasMedia){bubble.appendChild(el('div','chat-text chat-undec','🔒 не вдалось розшифрувати'));}
    else if(text){
      var jc=hasMedia?0:jumboCount(text);
      var tx=el('div','chat-text'+(jc>=1&&jc<=3?' jumbo j'+jc:''));
      tx.textContent=text;
      bubble.appendChild(tx);
      if(jc>=1&&jc<=3&&!m.replyTo)bubble.classList.add('emoji-only');
    }
    if(hasMedia)bubble.classList.add('has-media');
    if(m.edited)bubble.appendChild(el('span','chat-edited','змінено'));
    bubble.onclick=function(e){e.stopPropagation();openMenu(m,bubble,mine,text);};
    node.appendChild(bubble);
    node.appendChild(el('div','chat-reactions'));
    node.appendChild(el('div','chat-msg-meta','<span class="chat-msg-time"></span>'+(mine?'<span class="chat-msg-status"></span>':'')));
    node.dataset.rsig='';node.dataset.msig='';
    updateReactions(node,m);updateMeta(node,m,mine);
  }

  function buildVideoPlayer(src,m,bubble,mine){
    var wrap=el('div','chat-vplayer');
    var v=el('video','chat-vplayer-vid');v.src=src;v.setAttribute('playsinline','');v.preload='metadata';
    var play=el('button','chat-vplayer-play','<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>');play.type='button';
    var menuBtn=el('button','chat-vplayer-menu','⋯');menuBtn.type='button';
    var ctrls=el('div','chat-vplayer-ctrls');
    var bar=el('div','chat-vplayer-bar');var prog=el('div','chat-vplayer-prog');bar.appendChild(prog);
    var time=el('span','chat-vplayer-time','0:00');
    var full=el('button','chat-vplayer-full','⛶');full.type='button';
    ctrls.appendChild(bar);ctrls.appendChild(time);ctrls.appendChild(full);
    wrap.appendChild(v);wrap.appendChild(play);wrap.appendChild(menuBtn);wrap.appendChild(ctrls);
    function fmt(t){t=Math.floor(t||0);var mm=Math.floor(t/60),s=t%60;return mm+':'+(s<10?'0':'')+s;}
    function toggle(e){if(e)e.stopPropagation();if(v.paused)v.play();else v.pause();}
    play.onclick=toggle;v.onclick=toggle;
    v.addEventListener('play',function(){wrap.classList.add('playing');});
    v.addEventListener('pause',function(){wrap.classList.remove('playing');});
    v.addEventListener('timeupdate',function(){if(v.duration){prog.style.width=(v.currentTime/v.duration*100)+'%';time.textContent=fmt(v.currentTime);}});
    v.addEventListener('loadedmetadata',function(){time.textContent=fmt(v.duration);});
    bar.onclick=function(e){e.stopPropagation();var rect=bar.getBoundingClientRect();var p=(e.clientX-rect.left)/rect.width;if(v.duration)v.currentTime=Math.max(0,Math.min(1,p))*v.duration;};
    full.onclick=function(e){e.stopPropagation();if(v.requestFullscreen)v.requestFullscreen();else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();};
    menuBtn.onclick=function(e){e.stopPropagation();openMenu(m,bubble,mine,'');};
    return wrap;
  }

  function mediaLoader(m,key){
    var box=el('div','chat-media');var ph=el('div','chat-media-load',(m.media==='video'?'▶ ':'🖼 ')+'Завантажити');
    ph.onclick=async function(e){
      e.stopPropagation();ph.textContent='Завантаження…';
      var res=window.chatLoadMedia?await window.chatLoadMedia(chatId,m.mediaRef):null;
      if(!res||!res.b64){ph.textContent='⚠️ Помилка';return;}
      try{
        var buf=key&&m.mediaIv?await decBytes(key,m.mediaIv,res.b64):b642ab(res.b64);
        var blob=new Blob([buf],{type:m.media==='video'?'video/mp4':'image/jpeg'});
        var url=URL.createObjectURL(blob);
        if(m.media==='video'){var v=el('video','chat-media-vid');v.src=url;v.controls=true;box.replaceChild(v,ph);}
        else{var im=el('img','chat-media-img');im.src=url;box.replaceChild(im,ph);}
      }catch(err){ph.textContent='⚠️ Помилка';}
    };
    box.appendChild(ph);return box;
  }

  function updateMeta(node,m,mine){
    var pending=!m.createdAt;
    var msig=(pending?'p':fmtTime(m.createdAt))+'|'+(mine?'m':'t');
    if(node.dataset.msig!==msig){
      node.dataset.msig=msig;
      var t=node.querySelector('.chat-msg-time');if(t)t.textContent=pending?'':fmtTime(m.createdAt);
      if(mine){var st=node.querySelector('.chat-msg-status');if(st){
        if(pending){node.classList.add('sending');st.className='chat-msg-status pending';st.innerHTML=IC_CLOCK;node.dataset.created='';}
        else{node.classList.remove('sending');node.dataset.created=tsMs(m.createdAt);if(!st.classList.contains('read')){st.className='chat-msg-status sent';st.innerHTML=IC_CHECK1;}}
      }}
    }
  }

  function refreshReads(){
    if(!view||view.isGroup)return;
    var peerId=view.id;if(!peerId)return;
    var rt=tsMs(reads[peerId]);if(!rt)return;
    Object.keys(rendered).forEach(function(id){
      var n=rendered[id];if(!n||!n.classList.contains('mine'))return;
      var c=parseInt(n.dataset.created||'0',10);var st=n.querySelector('.chat-msg-status');
      if(st&&c&&c<=rt){st.className='chat-msg-status read';st.innerHTML=IC_CHECK2;}
    });
  }

  function updateReactions(node,m){
    var cont=node.querySelector('.chat-reactions');if(!cont)return;
    var r=m.reactions||{};var keys=Object.keys(r).filter(function(k){return Array.isArray(r[k])&&r[k].length;});
    var rsig=keys.map(function(k){return k+':'+r[k].length+(r[k].indexOf(String(myId))>=0?'*':'');}).sort().join('|');
    if(node.dataset.rsig===rsig)return;
    node.dataset.rsig=rsig;
    if(!keys.length){cont.innerHTML='';cont.style.display='none';return;}
    cont.style.display='flex';
    cont.innerHTML=keys.map(function(em){var arr=r[em],mineR=arr.indexOf(String(myId))>=0;return '<button type="button" class="chat-reaction-chip'+(mineR?' mine':'')+'" data-e="'+esc(em)+'">'+em+'<span>'+arr.length+'</span></button>';}).join('');
    cont.querySelectorAll('.chat-reaction-chip').forEach(function(chip){chip.onclick=function(e){e.stopPropagation();window.chatReact(chatId,node.dataset.id,chip.getAttribute('data-e'),String(myId));};});
  }

  function openMenu(m,bubble,mine,text){
    hidePopups();
    var pop=el('div','chat-msg-menu');var acts=[];
    acts.push({ic:IC_REACT,t:'Реакція',f:function(){openReact(m,bubble);}});
    acts.push({ic:IC_REPLY,t:'Відповісти',f:function(){setReply(m,text);}});
    if(m.mediaUrl&&m.media!=='video')acts.push({ic:IC_PHOTO,t:'Відкрити фото',f:function(){window.open(m.mediaUrl,'_blank','noopener,noreferrer');}});
    if(mine&&!m.mediaRef&&!m.mediaUrl)acts.push({ic:IC_EDIT,t:'Змінити',f:function(){startEdit(m,text);}});
    if(mine)acts.push({ic:IC_TRASH,t:'Видалити',danger:true,f:function(){
      if(!confirm('Видалити повідомлення?'))return;
      if(!m||String(m.from)!==String(myId))return;
      window.chatDeleteMessage(chatId,m._id);
    }});
    acts.forEach(function(a){
      var b=el('button','chat-msg-menu-item'+(a.danger?' danger':''),a.ic+'<span>'+esc(a.t)+'</span>');
      b.onclick=function(e){e.stopPropagation();hidePopups();a.f();};
      pop.appendChild(b);
    });
    var panel=document.querySelector('.chat-panel');panel.appendChild(pop);
    var pr=panel.getBoundingClientRect(),ar=bubble.getBoundingClientRect();
    var mh=pop.offsetHeight,mw=pop.offsetWidth;
    var top=ar.bottom-pr.top+6;if(top+mh>pr.height-10)top=ar.top-pr.top-mh-6;if(top<10)top=10;
    var left=mine?(ar.right-pr.left-mw):(ar.left-pr.left);if(left<8)left=8;if(left+mw>pr.width-8)left=pr.width-mw-8;
    pop.style.top=top+'px';pop.style.left=left+'px';
    requestAnimationFrame(function(){pop.classList.add('open');});
  }

  function openReact(m,bubble){
    hidePopups();var pop=document.getElementById('chat-react-popup');pop.innerHTML='';
    QUICK.forEach(function(em){var b=el('button','chat-react-opt',em);b.onclick=function(e){e.stopPropagation();window.chatReact(chatId,m._id,em,String(myId));hidePopups();};pop.appendChild(b);});
    var panel=document.querySelector('.chat-panel'),pr=panel.getBoundingClientRect(),ar=bubble.getBoundingClientRect();
    pop.style.display='flex';var top=ar.top-pr.top-54;if(top<8)top=ar.bottom-pr.top+8;pop.style.top=top+'px';
    var left=ar.left-pr.left,max=pr.width-pop.offsetWidth-10;if(left>max)left=max;if(left<8)left=8;pop.style.left=left+'px';
    pop.classList.add('open');pop.scrollLeft=0;
  }

  function hidePopups(){var p=document.getElementById('chat-react-popup');if(p){p.classList.remove('open');p.style.display='none';}document.querySelectorAll('.chat-msg-menu').forEach(function(n){n.remove();});}

  function setReply(m,text){editing=null;reply={id:m._id,from:String(m.from)===String(myId)?'Ви':(m.fromName||m.from),preview:(text||mediaLabel(m)).slice(0,80)};showBar('Відповідь '+reply.from,reply.preview,clearReply);document.getElementById('chat-input').focus();}
  function startEdit(m,text){
    if(!m||String(m.from)!==String(myId))return;
    editing=m;reply=null;
    var i=document.getElementById('chat-input');i.value=text||'';i.focus();
    showBar('Редагування',text||'',function(){editing=null;clearReply();});
  }
  function showBar(title,sub,onClose){var bar=document.getElementById('chat-reply-bar');bar.innerHTML='<div class="chat-reply-info"><div class="chat-reply-title">'+esc(title)+'</div><div class="chat-reply-sub">'+esc(sub)+'</div></div><button class="chat-reply-x" type="button">✕</button>';bar.style.display='flex';bar.querySelector('.chat-reply-x').onclick=onClose;}
  function clearReply(){reply=null;var bar=document.getElementById('chat-reply-bar');if(bar){bar.style.display='none';bar.innerHTML='';}}

  async function sendCurrent(){
    var inp=document.getElementById('chat-input');var txt=(inp.value||'').trim();if(!txt)return;if(txt.length>MAX_TEXT)txt=txt.slice(0,MAX_TEXT);
    var key=await curKey();if(!key||!chatId)return;
    inp.value='';document.getElementById('chat-emoji-panel').classList.remove('open');

    if(editing){
      var m=editing;
      if(!m||String(m.from)!==String(myId)){editing=null;clearReply();return;}
      editing=null;clearReply();
      var e2=await enc(key,txt);
      await window.chatEditMessage(chatId,m._id,{iv:e2.iv,data:e2.data});
      return;
    }

    var e1=await enc(key,txt);
    var payload={from:String(myId),iv:e1.iv,data:e1.data};
    if(view.isGroup)payload.fromName=(window.state&&window.state.telegram&&window.state.telegram.username)||myId;
    if(reply)payload.replyTo=reply.id;
    clearReply();
    await window.chatSend(chatId,payload);
  }

  function pickMedia(kind){var inp=el('input');inp.type='file';inp.accept=kind==='video'?'video/*':'image/*';inp.onchange=function(){var f=inp.files[0];if(f)sendMedia(f,kind);};inp.click();}
  async function sendMedia(file,kind){
    var key=await curKey();if(!key||!chatId)return;
    if(kind==='image'){
      var rd=new FileReader();
      rd.onload=async function(){
        var raw=String(rd.result).split(',')[1];var fd=new FormData();fd.append('image',raw);
        var payload=await baseMediaPayload(key,'image');clearReply();
        try{
          var r=await fetch('https://api.imgbb.com/1/upload?key=7fd02866f388777f8d193e838337d199',{method:'POST',body:fd});
          var j=await r.json();
          if(j&&j.data&&j.data.url){payload.mediaUrl=j.data.url;await window.chatSend(chatId,payload);}else alert('Не вдалось завантажити фото');
        }catch(e){alert('Помилка фото');}
      };
      rd.readAsDataURL(file);return;
    }
    if(file.size>100*1024*1024){alert('Відео завелике (макс 100 МБ).');return;}
    var payload=await baseMediaPayload(key,'video');clearReply();
    var inp=document.getElementById('chat-input');var ph=inp?inp.placeholder:'';if(inp){inp.placeholder='Завантаження відео…';inp.disabled=true;}
    try{
      var url=await cloudinaryUpload(file);
      if(!url){alert('Помилка відео');return;}
      payload.mediaUrl=url;
      await window.chatSend(chatId,payload);
    }catch(e){alert('Помилка відео');}
    finally{if(inp){inp.placeholder=ph;inp.disabled=false;}}
  }

  function openGroupGear(){if(!view||!view.isGroup)return;if(String(view.owner)===String(myId))openGroupSettings();else openGroupInfo();}
  function closeModal(){if(_modal){_modal.remove();_modal=null;}}
  function openGroupInfo(){
    var nameById={};contacts.forEach(function(c){nameById[String(c.id)]=c.username;});nameById[String(myId)]='Ви';
    var mem=(view.members||[]).map(function(id){return '<div class="chat-member-row"><div class="chat-contact-av">'+esc(initials(nameById[String(id)]||String(id)))+'</div><div class="chat-member-name">'+esc(nameById[String(id)]||String(id))+(String(id)===String(view.owner)?' • власник':'')+'</div></div>';}).join('');
    var m=el('div','chat-modal-overlay');
    m.innerHTML='<div class="chat-modal"><div class="chat-modal-head"><div class="chat-modal-title">Інфо групи</div><button class="chat-modal-x" type="button">✕</button></div><div class="chat-modal-body"><div class="chat-modal-avwrap"><div class="chat-modal-av">'+avHtml(view.avatar,view.name)+'</div><div class="chat-modal-gname">'+esc(view.name)+'</div></div>'+(view.desc?'<div class="chat-modal-gdesc">'+esc(view.desc)+'</div>':'')+'<div class="chat-modal-label">Учасники ('+(view.members?view.members.length:0)+')</div><div class="chat-modal-members">'+mem+'</div></div><div class="chat-modal-foot"><button class="chat-modal-save" id="gi-ok" type="button">Закрити</button></div></div>';
    document.body.appendChild(m);_modal=m;requestAnimationFrame(function(){m.classList.add('open');});
    m.querySelector('.chat-modal-x').onclick=closeModal;m.querySelector('#gi-ok').onclick=closeModal;m.onclick=function(e){if(e.target===m)closeModal();};
  }

  function openGroupCreate(){var sel={};groupModal('Нова група',{name:'',desc:'',avatar:''},sel,async function(d){
    var gk=await genGroupKey();var members=d.members.slice();if(members.indexOf(String(myId))<0)members.push(String(myId));
    var gid=await window.chatCreateGroup({name:d.name,members:members,owner:String(myId),avatar:d.avatar});
    if(!gid){alert('Помилка створення');throw new Error('create');}
    if(d.desc)await window.chatUpdateGroup(gid,{desc:d.desc});
    for(var i=0;i<members.length;i++){var pub=window.chatGetKey?await window.chatGetKey(members[i]):null;if(!validJwk(pub))continue;var w=await wrapGroupKey(gk,pub);await window.chatAddGroupWrap(gid,members[i],{iv:w.iv,data:w.data,from:String(myId)},String(myId));}
    closeModal();await loadLists();
  },null);}

  async function openGroupSettings(){
    if(!view||!view.isGroup)return;
    if(String(view.owner)!==String(myId))return;
    var sel={};(view.members||[]).forEach(function(id){sel[id]=true;});
    groupModal('Налаштування групи',{name:view.name,desc:view.desc,avatar:view.avatar},sel,async function(d){
      var members=d.members.slice();if(members.indexOf(String(view.owner))<0)members.push(String(view.owner));
      await window.chatUpdateGroup(view.id,{name:d.name,desc:d.desc,avatar:d.avatar,members:members});
      if(groupKey){
        for(var i=0;i<members.length;i++){
          var has=window.chatGetGroupWrap?await window.chatGetGroupWrap(view.id,members[i]):null;
          if(has)continue;
          var pub=window.chatGetKey?await window.chatGetKey(members[i]):null;
          if(!validJwk(pub))continue;
          var w=await wrapGroupKey(groupKey,pub);
          await window.chatAddGroupWrap(view.id,members[i],{iv:w.iv,data:w.data,from:String(myId)},String(myId));
        }
      }
      view.name=d.name;view.desc=d.desc;view.avatar=d.avatar;view.members=members;
      closeModal();enterUI();document.getElementById('chat-gear').style.display='flex';subscribe();await loadLists();
    },async function(){
      if(String(view.owner)!==String(myId))return;
      if(confirm('Видалити групу для всіх?')){await window.chatDeleteGroup(view.id);closeModal();showContacts();await loadLists();}
    });
  }

  function groupModal(title,init,sel,onSave,onDelete){
    closeModal();var av=init.avatar||'';
    var m=el('div','chat-modal-overlay');
    m.innerHTML='<div class="chat-modal"><div class="chat-modal-head"><div class="chat-modal-title">'+esc(title)+'</div><button class="chat-modal-x" type="button">✕</button></div><div class="chat-modal-body"><div class="chat-modal-avwrap"><div class="chat-modal-av" id="gm-av">'+avHtml(av,init.name)+'</div><button class="chat-modal-avbtn" id="gm-avbtn" type="button">Аватар</button></div><input class="chat-modal-input" id="gm-name" placeholder="Назва" value="'+esc(init.name)+'"><textarea class="chat-modal-input chat-modal-area" id="gm-desc" placeholder="Опис групи">'+esc(init.desc||'')+'</textarea><div class="chat-modal-label">Учасники</div><div class="chat-modal-members" id="gm-mem"></div></div><div class="chat-modal-foot">'+(onDelete?'<button class="chat-modal-del" id="gm-del" type="button">Видалити</button>':'')+'<button class="chat-modal-save" id="gm-save" type="button">Зберегти</button></div></div>';
    document.body.appendChild(m);_modal=m;requestAnimationFrame(function(){m.classList.add('open');});
    m.querySelector('.chat-modal-x').onclick=closeModal;m.onclick=function(e){if(e.target===m)closeModal();};
    var mem=m.querySelector('#gm-mem');
    contacts.forEach(function(c){
      if(String(c.id)===String(myId))return;
      if(!c.hasKey){
        if(sel[c.id])delete sel[c.id];
        var d=el('div','chat-member-row disabled');
        d.innerHTML='<div class="chat-contact-av">'+avHtml(c.avatar,c.username)+'</div><div class="chat-member-name">'+esc(c.username)+'</div><span class="chat-member-nokey">немає ключа</span>';
        mem.appendChild(d);
        return;
      }
      var on=!!sel[c.id];var row=el('div','chat-member-row'+(on?' on':''));
      row.innerHTML='<div class="chat-contact-av">'+avHtml(c.avatar,c.username)+'</div><div class="chat-member-name">'+esc(c.username)+'</div><span class="chat-member-check">'+(on?'✓':'')+'</span>';
      row.onclick=function(){sel[c.id]=!sel[c.id];row.classList.toggle('on',sel[c.id]);row.querySelector('.chat-member-check').textContent=sel[c.id]?'✓':'';};
      mem.appendChild(row);
    });

    m.querySelector('#gm-avbtn').onclick=function(){
      if(String(view && view.owner) && String(view.owner)!==String(myId) && onDelete) return;
      var inp=el('input');inp.type='file';inp.accept='image/*';
      inp.onchange=function(){
        var f=inp.files[0];if(!f)return;
        var rd=new FileReader();
        rd.onload=async function(){
          var raw=String(rd.result).split(',')[1];var fd=new FormData();fd.append('image',raw);
          m.querySelector('#gm-avbtn').textContent='…';
          try{
            var r=await fetch('https://api.imgbb.com/1/upload?key=7fd02866f388777f8d193e838337d199',{method:'POST',body:fd});
            var j=await r.json();
            if(j&&j.data&&j.data.url){av=j.data.url;m.querySelector('#gm-av').innerHTML='<img src="'+esc(av)+'">';}
          }catch(e){}
          m.querySelector('#gm-avbtn').textContent='Аватар';
        };
        rd.readAsDataURL(f);
      };
      inp.click();
    };

    if(onDelete)m.querySelector('#gm-del').onclick=onDelete;
    m.querySelector('#gm-save').onclick=async function(){
      var btn=this;if(btn.disabled)return;
      var name=m.querySelector('#gm-name').value.trim();if(!name){alert('Введи назву');return;}
      var members=Object.keys(sel).filter(function(k){return sel[k];});
      btn.disabled=true;var old=btn.textContent;btn.textContent='Збереження…';
      try{await onSave({name:name,desc:m.querySelector('#gm-desc').value.trim(),avatar:av,members:members});}catch(e){}
      if(document.body.contains(m)){btn.disabled=false;btn.textContent=old;}
    };
  }

  function boot(){if(document.body.classList.contains('viewer-mode'))return;inject();waitForLogin();var fabT=setInterval(function(){if(fabReady()){showFab();clearInterval(fabT);}},500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.chatOpen=openChat;
})();
(function(){
  'use strict';
  var V='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
  var IC_SEND=V+'<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
  var IC_BACK=V+'<polyline points="15 18 9 12 15 6"></polyline></svg>';
  var IC_CLOSE=V+'<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  var IC_EMOJI=V+'<circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>';
  var IC_PHOTO=V+'<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" y="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
  var IC_VIDEO=V+'<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>';
  var IC_GEAR=V+'<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
  var IC_PLUS=V+'<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>';
  function setIcon(sel,svg){
    var list=document.querySelectorAll(sel);
    for(var i=0;i<list.length;i++){
      var n=list[i];
      if(n.getAttribute('data-iconed')==='1')continue;
      n.innerHTML=svg;
      n.setAttribute('data-iconed','1');
    }
  }
  function normalize(){
    setIcon('#chat-send',IC_SEND);
    setIcon('#chat-back',IC_BACK);
    setIcon('#chat-gear',IC_GEAR);
    setIcon('#chat-close',IC_CLOSE);
    setIcon('#chat-emoji-btn',IC_EMOJI);
    setIcon('#chat-photo-btn',IC_PHOTO);
    setIcon('#chat-video-btn',IC_VIDEO);
    var root=document.getElementById('chat-view-contacts')||document.getElementById('chat-overlay');
    if(root){
      var btns=root.querySelectorAll('button');
      for(var i=0;i<btns.length;i++){
        var b=btns[i];
        if(b.getAttribute('data-iconed')==='1')continue;
        if(/Нова\s+група/i.test(b.textContent||'')){
          b.innerHTML=IC_PLUS+'<span>Нова група</span>';
          b.setAttribute('data-iconed','1');
        }
      }
    }
  }
  setInterval(normalize,100);
  document.addEventListener('DOMContentLoaded',normalize);
})();