const CONFIG = {
  CLIENT_ID: '3526437072957618224',
  REDIRECT_URI: 'https://siya.ukrainerpeh.com/index.html',
  SCOPES: 'openid profile',
  AUTH_URL: 'https://apis.roblox.com/oauth/v1/authorize',
  TOKEN_URL: 'https://apis.roblox.com/oauth/v1/token',
  USERINFO_URL: 'https://apis.roblox.com/oauth/v1/userinfo',
};

window.state = window.state || {
  isRbxAuth: false,
  isTgAuth: false,
  roblox: null,
  telegram: null,
  players: null,
  licenses: null,
  posada: null,
  marriedList: null
};

function renderPassport() {
  const { roblox, telegram, players, licenses } = window.state;
  if (!roblox || !telegram) return;

  const idCode = localStorage.getItem('user_id_code') || generateNewId();

  const a = document.getElementById('passport-id-code');
  const b = document.getElementById('passport-nick');
  const c = document.getElementById('passport-avatar');
  const d = document.getElementById('field-rb-nick');
  const e = document.getElementById('field-tg-nick');
  const f = document.getElementById('field-rb-id');
  const g = document.getElementById('field-fraction');
  const h = document.getElementById('field-position');

  if (a) a.textContent = idCode;
  if (b) b.textContent = roblox.username || '';
  if (c) c.src = roblox.avatar || '';

  if (d) d.textContent = roblox.username || '';
  if (e) e.textContent = '@' + (telegram.username || '');
  if (f) f.textContent = roblox.id || '';

  const okBadge = document.querySelector('.badge.ok');
  if (okBadge) okBadge.style.display = '';

  const fr = determineFractionAndRole(roblox.username, players, licenses);
  if (g) g.textContent = fr.fraction || '';
  if (h) h.textContent = fr.role || '';

  const list = document.getElementById('license-list');
  if (licenses && list) list.innerText = formatLicenses(roblox.username, licenses);
}

function determineFractionAndRole(nick, players, licenses) {
  const lc = String(nick || '').toLowerCase();
  let result = { fraction: 'Громадянин', role: 'Немає' };

  if (players && typeof players === 'object') {
    const pKey = Object.keys(players).find(k => String(k).toLowerCase() === lc);
    if (pKey && players[pKey] && players[pKey][0]) {
      const data = players[pKey][0] || {};
      result.fraction = data.category || 'Громадянин';
      result.role = data.role || '—';
      return result;
    }
  }

  if (licenses && typeof licenses === 'object') {
    const factionDefs = [
      { key: 'police', name: 'НПС' },
      { key: 'nabs', name: 'НАБС' },
      { key: 'sbs', name: 'СБС' },
      { key: 'dbr', name: 'ДБР' },
    ];

    for (const fd of factionDefs) {
      const block = licenses[fd.key];
      if (!block || typeof block !== 'object') continue;
      const entryKey = Object.keys(block).find(k => String(k).toLowerCase() === lc);
      if (!entryKey) continue;
      const d = block[entryKey] || {};
      const rank = (typeof window.getPoliceRank === 'function' && d.role)
        ? window.getPoliceRank(d.role)
        : (d.role || fd.name);
      result.fraction = fd.name;
      result.role = rank;
      return result;
    }

    const otherDefs = [
      { key: 'advocat', name: 'Адвокат', role: 'Адвокат' },
      { key: 'taxi', name: 'Таксист', role: 'Таксист' },
    ];

    for (const od of otherDefs) {
      const block = licenses[od.key];
      if (!block || typeof block !== 'object') continue;
      const entryKey = Object.keys(block).find(k => String(k).toLowerCase() === lc);
      if (!entryKey) continue;
      result.fraction = od.name;
      result.role = od.role;
      return result;
    }
  }

  return result;
}

function findInObj(obj, lowerKey) {
  if (!obj || typeof obj !== 'object') return null;
  return Object.keys(obj).find(k => String(k).toLowerCase() === lowerKey);
}

function formatLicenses(nick, L) {
  const found = [];
  const lc = String(nick || '').toLowerCase();
  const map = { weapon: 'Зброя', taxi: 'Таксі', advocat: 'Адвокат', presslicense: 'Прес-карта', press: 'ЗМІ', mafia: 'ОЗУ' };

  for (const [key, label] of Object.entries(map)) {
    if (L[key] && !Array.isArray(L[key]) && typeof L[key] === 'object') {
      const entryKey = findInObj(L[key], lc);
      if (entryKey) {
        const entry = L[key][entryKey] || {};
        if (entry.cans) found.push(`${label}: CANS`);
        else if (entry.status && String(entry.status).toLowerCase().includes('недійс')) found.push(`${label}: Недійсна`);
        else found.push(`${label}: Є`);
      }
    }
  }

  if (L.business && Array.isArray(L.business)) {
    L.business.filter(b => b && b.username && String(b.username).toLowerCase() === lc).forEach(b => {
      found.push(b.cans ? `Бізнес: CANS` : `Бізнес: Є`);
    });
  }

  return found.length ? found.join('\n') : 'Ліцензій немає';
}

window.onTelegramAuth = async function (user) {
  try {
    if (!user || !user.id) return;
    window.state.telegram = {
      id: String(user.id),
      username: user.username,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      photo_url: user.photo_url || ''
    };
    window.state.isTgAuth = true;

    if (window.fetchProfile) {
      const cloud = await window.fetchProfile(user);
      const isNewPassport = !cloud;

      if (cloud) {
        if (cloud.idCode) localStorage.setItem('user_id_code', cloud.idCode);
        if (cloud.roblox) {
          window.state.roblox = cloud.roblox;
          window.state.isRbxAuth = true;
        }
        if (cloud.issuedAt) window.state.issuedAt = cloud.issuedAt;
      }

      const currentCode = localStorage.getItem('user_id_code') || generateNewId();
      if (window.syncWithCloud) await window.syncWithCloud(user, window.state.roblox, currentCode, isNewPassport);

      if (!window.state.issuedAt) {
        const updated = await window.fetchProfile(user);
        if (updated && updated.issuedAt) window.state.issuedAt = updated.issuedAt;
      }
    }

    if (typeof window.updateProfileAuthUI === 'function') window.updateProfileAuthUI();
  } catch (e) {}
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

window.openRobloxOAuth = openRobloxOAuth;

async function handleCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code) return;

  const savedState = sessionStorage.getItem('rbx_state');
  if (!savedState || !state || savedState !== state) {
    try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
    return;
  }

  try {
    const verifier = sessionStorage.getItem('rbx_verif');
    if (!verifier) throw new Error('no_verifier');

    const res = await fetch(CONFIG.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CONFIG.REDIRECT_URI,
        client_id: CONFIG.CLIENT_ID,
        code_verifier: verifier
      })
    });

    const tokens = await res.json();
    if (!tokens || !tokens.access_token) throw new Error('no_token');

    const userRes = await fetch(CONFIG.USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const info = await userRes.json();
    if (!info || !info.sub || !info.preferred_username) throw new Error('bad_userinfo');

    const avatar = info.picture || '';

    window.state.roblox = {
      id: String(info.sub),
      username: String(info.preferred_username),
      display: info.name ? String(info.name) : String(info.preferred_username),
      avatar: avatar || ''
    };
    window.state.isRbxAuth = true;

    if (window.state.isTgAuth && window.syncWithCloud) {
      await window.syncWithCloud(window.state.telegram, window.state.roblox, localStorage.getItem('user_id_code'));
    }

    try { window.history.replaceState({}, document.title, window.location.pathname); } catch (e) {}
  } catch (e) {}

  if (typeof window.updateProfileAuthUI === 'function') window.updateProfileAuthUI();
}


function generateNewId() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const arr = crypto.getRandomValues(new Uint8Array(5));
  const res = Array.from(arr, b => chars[b % chars.length]).join(' ');
  localStorage.setItem('user_id_code', res);
  return res;
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
  const timestamp = new Date().getTime();
  if (typeof players !== 'undefined') window.state.players = players;
  if (typeof licenses !== 'undefined') window.state.licenses = licenses;

  import(`https://ukrainerpeh.com/marriage/marriedlist.js?v=${Date.now()}`)
    .then(m => { window.state.marriedList = (m && m.marriedList) ? m.marriedList : null; })
    .catch(() => {});
}

function initGen() {
  loadExternal();
  handleCallback();
}

if (document.readyState === 'complete') {
  initGen();
} else {
  window.addEventListener('load', initGen);
}
