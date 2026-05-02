const CONFIG = {
  CLIENT_ID: '3526437072957618224',
  REDIRECT_URI: 'https://hurler-reversion-crisped.ngrok-free.dev/index.html',
  SCOPES: 'openid profile',
  AUTH_URL: 'https://apis.roblox.com/oauth/v1/authorize',
  TOKEN_URL: 'https://apis.roblox.com/oauth/v1/token',
  USERINFO_URL: 'https://apis.roblox.com/oauth/v1/userinfo',
};

window.state = {
  isRbxAuth: false,
  isTgAuth: false,
  roblox: null,
  telegram: null,
  players: null,
  licenses: null,
  posada: null
};

//function checkAndRender() {
  // document.querySelector('.badge.tg').style.display = window.state.isTgAuth ? '' : 'none';
  // document.querySelector('.badge.rb').style.display = window.state.isRbxAuth ? '' : 'none';
  
  //if (window.state.isRbxAuth && window.state.isTgAuth) {
   // document.querySelector('.card').style.display = 'block';
   // renderPassport();
 // }
//}

function renderPassport() {
  const { roblox, telegram, players, licenses } = window.state;
  if (!roblox || !telegram) return;

  const idCode = localStorage.getItem('user_id_code') || generateNewId();
  
  document.getElementById('passport-id-code').textContent = idCode;
  document.getElementById('passport-nick').textContent = roblox.username;
  document.getElementById('passport-avatar').src = roblox.avatar;
  
  document.getElementById('field-rb-nick').textContent = roblox.username;
  document.getElementById('field-tg-nick').textContent = '@' + telegram.username;
  document.getElementById('field-rb-id').textContent = roblox.id;

  document.querySelector('.badge.ok').style.display = '';

  const { fraction, role } = determineFractionAndRole(roblox.username, players, licenses);
  document.getElementById('field-fraction').textContent = fraction;
  document.getElementById('field-position').textContent = role;

  if (licenses) {
    document.getElementById('license-list').innerText = formatLicenses(roblox.username, licenses);
  }
}

function determineFractionAndRole(nick, players, licenses) {
  const lc = nick.toLowerCase();
  let result = { fraction: 'Громадянин', role: 'Немає' };

  if (players) {
    const pKey = Object.keys(players).find(k => k.toLowerCase() === lc);
    if (pKey && players[pKey] && players[pKey][0]) {
      const data = players[pKey][0];
      result.fraction = data.category;
      result.role = data.role || '—';
      return result;
    }
  }

  if (licenses) {
    const factionDefs = [
      { key: 'police', name: 'НПС' },
      { key: 'nabs',   name: 'НАБС' },
      { key: 'sbs',    name: 'СБС' },
      { key: 'dbr',    name: 'ДБР' },
    ];
    for (const fd of factionDefs) {
      const block = licenses[fd.key]; 
      if (!block) continue;
      const entryKey = Object.keys(block).find(k => k.toLowerCase() === lc);
      if (!entryKey) continue;
      const d = block[entryKey];
      const rank = typeof window.getPoliceRank === 'function' && d.role
        ? window.getPoliceRank(d.role)
        : (d.role || fd.name);
      result.fraction = fd.name;
      result.role = rank;
      return result;
    }
    const otherDefs = [
      { key: 'advocat', name: 'Адвокат', role: 'Адвокат' },
      { key: 'taxi',    name: 'Таксист', role: 'Таксист' },
    ];
    for (const od of otherDefs) {
      const block = licenses[od.key];
      if (!block) continue;
      const entryKey = Object.keys(block).find(k => k.toLowerCase() === lc);
      if (!entryKey) continue;
      result.fraction = od.name;
      result.role = od.role;
      return result;
    }
  }

  return result;
}

function findInObj(obj, lowerKey) {
  if (!obj) return null;
  return Object.keys(obj).find(k => k.toLowerCase() === lowerKey);
}

function formatLicenses(nick, L) {
  const found = [];
  const lc = nick.toLowerCase();
  const map = { weapon: 'Зброя', taxi: 'Таксі', advocat: 'Адвокат', presslicense: 'Прес-карта', press: 'ЗМІ', mafia: 'ОЗУ' };
  
  for (const [key, label] of Object.entries(map)) {
    if (L[key] && !Array.isArray(L[key])) {
      const entryKey = findInObj(L[key], lc);
      if (entryKey) {
        const entry = L[key][entryKey];
        if (entry.cans) found.push(`${label}: CANS`);
        else if (entry.status && entry.status.toLowerCase().includes('недійс')) found.push(`${label}: Недійсна`);
        else found.push(`${label}: Є`);
      }
    }
  }

  if (L.business && Array.isArray(L.business)) {
    L.business.filter(b => b.username && b.username.toLowerCase() === lc).forEach(b => {
      found.push(b.cans ? `Бізнес: CANS` : `Бізнес: Є`);
    });
  }

  return found.length ? found.join('\n') : 'Ліцензій немає';
}

window.onTelegramAuth = async function(user) {
  window.state.telegram = { username: user.username };
  window.state.isTgAuth = true;

  if (window.fetchProfile) {
    const cloud = await window.fetchProfile(user.username);
    const isNewPassport = !cloud;
    if (cloud) {
      if (cloud.idCode) localStorage.setItem('user_id_code', cloud.idCode);
      if (cloud.roblox) {
        window.state.roblox = cloud.roblox;
        window.state.isRbxAuth = true;
      }
      // Load real issue date from cloud
      if (cloud.issuedAt) {
        window.state.issuedAt = cloud.issuedAt;
      }
    }
    const currentCode = localStorage.getItem('user_id_code') || generateNewId();
    if (window.syncWithCloud) await window.syncWithCloud(user.username, window.state.roblox, currentCode, isNewPassport);
    if (!window.state.issuedAt) {
      const updated = await window.fetchProfile(user.username);
      if (updated && updated.issuedAt) window.state.issuedAt = updated.issuedAt;
    }
  }
//  checkAndRender();
};

async function openRobloxOAuth() {
  const state = randomStr();
  const verifier = randomStr(64);
  const challenge = await deriveChallenge(verifier);
  sessionStorage.setItem('rbx_state', state);
  sessionStorage.setItem('rbx_verif', verifier);
  
  const params = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID, 
    redirect_uri: CONFIG.REDIRECT_URI,
    response_type: 'code', 
    scope: CONFIG.SCOPES, 
    state,
    code_challenge: challenge, 
    code_challenge_method: 'S256'
  });
  window.location.href = `${CONFIG.AUTH_URL}?${params}`;
}

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;
  
  try {
    const res = await fetch(CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code', 
        code,
        redirect_uri: CONFIG.REDIRECT_URI, 
        client_id: CONFIG.CLIENT_ID,
        code_verifier: sessionStorage.getItem('rbx_verif')
      })
    });
    const tokens = await res.json();
    const userRes = await fetch(CONFIG.USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const info = await userRes.json();
    const avatar = await fetchAvatar(info.sub);
    window.state.roblox = { id: info.sub, username: info.preferred_username, display: info.name, avatar };
    window.state.isRbxAuth = true;

    if (window.state.isTgAuth && window.syncWithCloud) {
      await window.syncWithCloud(window.state.telegram.username, window.state.roblox, localStorage.getItem('user_id_code'));
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch (e) { console.error(e); }
 // checkAndRender();
}

async function fetchAvatar(uid) {
  try {
    const proxy = 'https://api.codetabs.com/v1/proxy?quest=';
    const api = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${uid}&size=150x150&format=Png`;
    const r = await fetch(proxy + encodeURIComponent(api));
    const d = await r.json();
    return d?.data?.[0]?.imageUrl || '';
  } catch { return ''; }
}

function generateNewId() {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  for (let i = 0; i < 5; i++) res += chars[Math.floor(Math.random() * chars.length)];
  const final = res.split('').join(' ');
  localStorage.setItem('user_id_code', final);
  return final;
}

function randomStr(l = 32) {
  const a = new Uint8Array(l);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function deriveChallenge(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function loadExternal() {
  const scripts = [
    { 
      src: 'https://ukrainerpeh.xyz/players.js', 
      key: 'players',
      cb: (data) => { window.state.players = data; }
    },
    { 
      src: 'https://ukrainerpeh.xyz/licenses.js', 
      key: 'licenses',
      cb: (data) => { window.state.licenses = data; }
    },
  ];

  scripts.forEach(({ src, key, cb }) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => {
      const data = window[key] || (typeof window[key] !== 'undefined' ? window[key] : (typeof players !== 'undefined' ? players : (typeof licenses !== 'undefined' ? licenses : null)));
      cb(data);
     // checkAndRender(); 
    };
    document.head.appendChild(s);
  });
}

window.addEventListener('load', () => {
  loadExternal();
  handleCallback();
});
