let currentDocId = null;
let tg = null;
let tgUser = null;

async function computeHmacSha256(secret, dataStr) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(dataStr));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function initTelegramAuth() {
  if (window.Telegram && window.Telegram.WebApp) {
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#ffffff');
    tg.setBackgroundColor('#ffffff');
    // SERVER-SIDE INITDATA CHECKER DO NOT BYPASS IT RESTRICTED AREA FOR USER
    try {
      const initData = tg.initData;
      if (initData && typeof initData === 'string' && initData.trim().length > 0) {
        // Secure server-side validation
        const res = await fetch('https://xqcgezcoywcnrmigjdyi.supabase.co/functions/v1/quick-handler', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sb_publishable_S9Mo4BXYYPHHeznPMknN7w_GwEm_fad',
            'apikey': 'sb_publishable_S9Mo4BXYYPHHeznPMknN7w_GwEm_fad'
          },
          body: JSON.stringify({ initData })
        });
        const data = await res.json();
        
        if (data.success && data.user && data.verifyKey) {
          // Client-side verification of the "special key" to ensure the response hasn't been tampered with locally
          const expectedKey = await computeHmacSha256('siya_secure_client_secret', JSON.stringify(data.user));
          if (data.verifyKey === expectedKey) {
            tgUser = data.user;
          } else {
            console.error('Security Error: Invalid verification key from server');
          }
        }
      }
    } catch(e) {
      console.error('Telegram Auth Error', e);
      tgUser = null;
    }

    if (tgUser) {
      const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
      const greet = document.querySelector('.greeting-name');
      if (greet) greet.textContent = `Привіт, ${tgUser.first_name || 'гість'} `;
      const pName = document.querySelector('.profile-name');
      if (pName) pName.textContent = name || 'Користувач';
      const pId = document.querySelector('.profile-id');
      if (pId) pId.textContent = tgUser.id || 'None';
      
      const initials = (name || 'U').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
      const avatarEl = document.querySelector('.profile-avatar');
      if (avatarEl) {
        avatarEl.innerHTML = tgUser.photo_url ? `<img src="${tgUser.photo_url}" alt="${name || 'Користувач'}">` : initials;
      }
      if (tg.BackButton) {
        tg.BackButton.onClick(() => goBack());
      }
    }
  }
}
initTelegramAuth();

let currentScreen = 'home';
let screenHistory = ['home'];

function _canAdmin() {
  try {
    const r = (window.getUserIssuerRole && window.getUserIssuerRole()) || {};
    return !!r.canApprove;
  } catch (e) { return false; }
}

function switchScreen(id) {
  if (currentScreen === id) return;
  if (id === 'admin-fines' && !_canAdmin()) {
    typeof showToast === 'function' && showToast('Немає прав');
    return;
  }

  const prev = document.getElementById('screen-' + currentScreen);
  const next = document.getElementById('screen-' + id);
  if (!next) return;

  prev.classList.remove('active');
  next.classList.add('active');
  currentScreen = id;

  if (!['home','docs','services','news','profile'].includes(id)) {
    screenHistory.push(id);
    if (tg && tg.BackButton) tg.BackButton.show();

    if (id === 'fines') {
      renderFines();
      renderPendingApprovalSection();
      renderPaymentRequestsSection();
      updateIssueFineButtonVisibility();
    }
    if (id === 'issue-fine') {
      renderIssueFineForm();
    }
    if (id === 'settings') {
      renderSettingsScreen();
    }
  } else {
    screenHistory = [id];
    if (tg && tg.BackButton) tg.BackButton.hide();

    if (id === 'profile') {
      renderProfileLicenses();
      renderProfileExtras();
    }
  }
  const animClasses = ['animate-in','anim-left','anim-scale','anim-flip','anim-blur','anim-slide-right','anim-pop','anim-wave','anim-down'];
  setTimeout(() => {
    next.querySelectorAll('.animate-in, .anim-left, .anim-scale, .anim-flip, .anim-blur, .anim-slide-right, .anim-pop, .anim-wave, .anim-down').forEach((el,i) => {
      const cls = animClasses.find(c => el.classList.contains(c)) || 'animate-in';
      el.classList.remove(cls);
      el.offsetHeight;
      el.classList.add(cls);
      el.style.animationDelay = `${i * 0.06}s`;
    });
  }, 10);
}

function goBack() {
  if (screenHistory.length > 1) {
    screenHistory.pop();
    const prev = screenHistory[screenHistory.length - 1];
    const curr = document.getElementById('screen-' + currentScreen);
    const next = document.getElementById('screen-' + prev);
    curr.classList.remove('active');
    next.classList.add('active');
    currentScreen = prev;
    if (screenHistory.length <= 1 && tg && tg.BackButton) tg.BackButton.hide();
  }
}

function getPoliceRank(xpString) {
  if (xpString === undefined || xpString === null || xpString === "") {
    return "Невідомо";
  }
  const xp = parseInt(String(xpString).replace(/\s/g, ''), 10);
  if (isNaN(xp)) {
    return xpString;
  }
  if (xp <= 2999) return "Кадет";
  if (xp <= 5999) return "Молодший патрульний";
  if (xp <= 9999) return "Патрульний";
  if (xp <= 12999) return "Старший патрульний";
  if (xp <= 15499) return "Молодший сержант";
  if (xp <= 18499) return "Сержант";
  if (xp <= 21999) return "Старший сержант";
  if (xp <= 25999) return "Лейтенант";
  if (xp <= 29999) return "Капітан";
  
  return "Ветеран";
}

function isXpString(s) {
  if (s == null) return false;
  const t = String(s).replace(/[\s\u00A0]/g, '');
  return /^\d+$/.test(t);
}

window.getPoliceRank = getPoliceRank;

function buildLicenseDoc(key, data, ctx) {
  ctx = ctx || {};
  const display = ctx.display || ctx.username || '';
  const username = ctx.username || '';
  const owner = display + (username && username !== display ? ' · ' + username : '');
  const f = (label, value) => ({ label, value: value == null ? '—' : String(value) });
  const cansField = data.cans ? [f('Причина скасування', data.cans)] : [];

  switch (String(key).toLowerCase()) {
    case 'weapon': {
      const isCancelled = data.cans || /злочинн|скасов|недійсн/i.test(data.status || '') || data.expiry === '00.00.0000';
      return {
        title: 'Ліцензія на зброю',
        type: 'Ліцензія',
        status: isCancelled ? 'Скасовано' : (data.status || 'Дійсна'),
        docNumber: data.expiry && data.expiry !== '00.00.0000' ? data.expiry : '—',
        fields: [
          f('Власник', owner),
          f('Статус', data.status || '—'),
          ...(data.expiry ? [f('Термін дії', data.expiry)] : []),
          ...cansField,
        ]
      };
    }
    case 'police': {
      const rank = getPoliceRank(data.role);
      const xpField = isXpString(data.role) ? [f('XP', data.role)] : [];
      const subdiv = data.expiry && data.expiry !== '00.00.0000' ? data.expiry : '';
      return {
        title: 'Посвідчення НПС',
        type: 'Посвідчення',
        status: data.cans ? 'Скасовано' : 'Дійсне',
        docNumber: data.status ? '#' + data.status : '—',
        fields: [
          f('Дисплей та юзернейм', owner),
          f('Звання', rank),
          f('Жетон', data.status ? '#' + data.status : '—'),
          ...xpField,
          ...(subdiv ? [f('Підрозділ', subdiv)] : []),
          ...cansField,
        ]
      };
    }
    case 'nabs':
      return {
        title: 'Посвідчення НАБС',
        type: 'Посвідчення',
        status: data.cans ? 'Скасовано' : 'Дійсне',
        docNumber: data.status ? '#' + data.status : '—',
        fields: [
          f('Дисплей та юзернейм', owner),
          f('Звання', data.role || 'Агент'),
          f('Жетон', data.status ? '#' + data.status : '—'),
          ...cansField,
        ]
      };
    case 'sbs':
      return {
        title: 'Посвідчення СБС',
        type: 'Посвідчення',
        status: data.cans ? 'Скасовано' : 'Дійсне',
        docNumber: data.status ? '#' + data.status : '—',
        fields: [
          f('Дисплей та юзернейм', owner),
          f('Звання', data.role || 'Рядовий'),
          f('Жетон', data.status ? '#' + data.status : '—'),
          ...cansField,
        ]
      };
    case 'dbr':
      return {
        title: 'Посвідчення ДБР',
        type: 'Посвідчення',
        status: data.cans ? 'Скасовано' : 'Дійсне',
        docNumber: data.status ? '#' + data.status : '—',
        fields: [
          f('Дисплей та юзернейм', owner),
          f('Звання', data.role || 'Рядовий'),
          f('Жетон', data.status ? '#' + data.status : '—'),
          ...cansField,
        ]
      };
    case 'taxi':
      return {
        title: 'Таксистська ліцензія',
        type: 'Ліцензія',
        status: data.cans ? 'Скасовано' : 'Дійсна',
        docNumber: data.status || '—',
        fields: [
          f('Власник', owner),
          f('ID таксиста', data.status || '—'),
          ...cansField,
        ]
      };
    case 'advocat':
      return {
        title: 'Адвокатська ліцензія',
        type: 'Ліцензія',
        status: data.cans ? 'Скасовано' : 'Дійсна',
        docNumber: data.status || '—',
        fields: [
          f('Адвокат', owner),
          f('ID адвоката', data.status || '—'),
          ...cansField,
        ]
      };
    case 'presslicense':
      return {
        title: 'Прес-карта',
        type: 'Прес-карта',
        status: data.cans ? 'Скасовано' : 'Дійсна',
        docNumber: data.status || '—',
        fields: [
          f('Журналіст', owner),
          f('ЗМІ', data.role || '—'),
          f('Номер прес-карти', data.status || '—'),
          ...cansField,
        ]
      };
    case 'press':
      return {
        title: 'Реєстрація ЗМІ',
        type: 'ЗМІ',
        status: data.cans ? 'Скасовано' : 'Дійсна',
        docNumber: data.status || '—',
        fields: [
          f('Засновник', owner),
          f('Назва ЗМІ', data.status || '—'),
          ...cansField,
        ]
      };
    case 'mafia':
      return {
        title: data.status || 'ОЗУ',
        type: 'ОЗУ',
        status: data.cans ? 'Скасовано' : 'Дійсна',
        docNumber: data.status || '—',
        fields: [
          f('Лідер', owner),
          f('Тип', data.role || 'ОЗУ'),
          f('Назва', data.status || '—'),
          ...cansField,
        ]
      };
    case 'business':
      return {
        title: data.role || 'Бізнес',
        type: 'Бізнес',
        status: data.cans ? 'Скасовано' : 'Активний',
        docNumber: data.status || '—',
        fields: [
          f('Власник', owner),
          f('Назва', data.role || '—'),
          f('ID бізнесу', data.status || '—'),
          ...cansField,
        ]
      };
    case 'marriage': {
      let dateStr = '—';
      if (data.date) {
        const parts = data.date.split('-');
        if (parts.length === 3) {
          dateStr = `${parts[1]}.${parts[2]}.${parts[0]}`;
        }
      }
      return {
        title: 'Свідоцтво про шлюб',
        type: 'Свідоцтво',
        status: 'Дійсне',
        docNumber: dateStr,
        fields: [
          f('Чоловік/Дружина 1', data.username1 || '—'),
          f('Чоловік/Дружина 2', data.username2 || '—'),
          f('Дата шлюбу', dateStr),
        ],
        photo1: data.photo1 || null,
        photo2: data.photo2 || null,
      };
    }
    default:
      return {
        title: key,
        type: 'Документ',
        status: data.cans ? 'Скасовано' : 'Дійсний',
        docNumber: data.status || data.telegram || '—',
        fields: Object.entries(data || {}).map(([k, v]) => f(k, v)),
      };
  }
}

let docData = {};
function generateRandomDocId(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const arr = crypto.getRandomValues(new Uint8Array(length));
    return [...arr].map(x => chars[x % chars.length]).join('');
}

async function getDocUrl(docId) {
    const base = window.location.origin + window.location.pathname;
    const username = window.state?.roblox?.username || window.state?.telegram?.username || '';
    const tgId = window.state?.telegram?.id;

    let token = null;
    if (tgId && typeof window.createDocToken === 'function') {
        try { token = await window.createDocToken(docId, tgId); } catch (e) {}
    }

    if (token) {
        return `${base}?doc=${encodeURIComponent(docId)}&u=${encodeURIComponent(username)}&token=${token}`;
    }
    return `${base}?doc=${encodeURIComponent(docId)}&u=${encodeURIComponent(username)}`;
}

function formatExpiryDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (!isNaN(d.getTime()) && /\d{4}/.test(String(s))) {
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return String(s);
}

function openTgLink(url) {
  if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openTelegramLink === 'function') {
    try { window.Telegram.WebApp.openTelegramLink(url); return; } catch (e) {}
  }
  if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.openLink === 'function') {
    try { window.Telegram.WebApp.openLink(url); return; } catch (e) {}
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

window.updateProfileAuthUI = function() {
    const tg  = window.state.telegram;
    const rbx = window.state.roblox;
    const oauthBtn = document.querySelector('.profile-Oauth');
    if (oauthBtn) oauthBtn.style.display = rbx ? 'none' : '';
    const verifiedEl = document.querySelector('.profile-verified');
    if (verifiedEl) verifiedEl.style.display = rbx ? '' : 'none';
    if (tg) {
        const nameEl = document.querySelector('.profile-name');
        const idEl   = document.querySelector('.profile-id');
        const avatEl = document.querySelector('.profile-avatar img');
        if (nameEl) nameEl.textContent = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || tg.username || '';
        if (idEl)   idEl.textContent   = 'ID: ' + (tg.id || '');
        if (avatEl && tg.photo_url) avatEl.src = tg.photo_url;
    }
};

function logout() {
  try { localStorage.removeItem('user_id_code'); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  window.state = window.state || {};
  window.state.telegram = null;
  window.state.fines = null;
  window.state.isTgAuth = false;
  window.state.roblox = null;
  window.state.isRbxAuth = false;
  if (typeof window.updateProfileAuthUI === 'function') window.updateProfileAuthUI();
  if (window.Telegram && window.Telegram.WebApp && typeof window.Telegram.WebApp.close === 'function') {
    try { window.Telegram.WebApp.close(); return; } catch (e) {}
  }
  location.reload();
}

function renderProfileLicenses() {
  const old = document.getElementById('profile-licenses-section');
  if (old) old.remove();

  const L = window.state && window.state.licenses;
  const roblox = window.state && window.state.roblox;
  if (!L || !roblox) return;

  const nick = roblox.username;
  const lc = nick.toLowerCase();

  const items = [];

  if (L.weapon) {
    const key = Object.keys(L.weapon).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.weapon[key];
      const status = d.cans ? 'Скасовано' : (d.status || 'Дійсна');
      const expiry = d.expiry ? `\nДійсна до: ${formatExpiryDate(d.expiry)}` : '';
      items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="18" height="5" rx="1"/><path d="M6 11l-1 9h4l1-9"/><path d="M9 11v3h3a2 2 0 0 0 2-2v-1"/><line x1="19" y1="8" x2="20" y2="8"/><line x1="7" y1="13" x2="7" y2="18"/></svg>', label: 'Ліцензія на зброю', extra: `${status}${expiry}`, code: d.code || d.telegram || null });
    }
  }

  if (L.taxi) {
    const key = Object.keys(L.taxi).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.taxi[key];
      const status = d.cans ? 'Скасовано' : (d.status || 'Дійсна');
      const expiry = d.expiry ? `\nДійсна до: ${formatExpiryDate(d.expiry)}` : '';
      items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>', label: 'Таксистська ліцензія', extra: `${status}${expiry}`, code: d.code || d.telegram || null });
    }
  }

  if (L.advocat) {
    const key = Object.keys(L.advocat).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.advocat[key];
      const status = d.cans ? 'Скасовано' : (d.status || 'Дійсна');
      const expiry = d.expiry ? `\nДійсна до: ${formatExpiryDate(d.expiry)}` : '';
      items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="4" height="18" x="10" y="3" rx="1"/><path d="M4 8h16"/><path d="M4 8l-2 6c0 1.1.9 2 2 2s2-.9 2-2l-2-6Z"/><path d="M20 8l-2 6c0 1.1.9 2 2 2s2-.9 2-2l-2-6Z"/></svg>', label: 'Адвокатська ліцензія', extra: `${status}${expiry}`, code: d.code || d.telegram || null });
    }
  }

  if (L.presslicense) {
    const key = Object.keys(L.presslicense).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.presslicense[key];
      items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>', label: 'Прес-карта', extra: d.cans ? 'Скасовано' : (d.status || 'Дійсна'), code: d.code || null });
    }
  }

  if (L.press) {
    const key = Object.keys(L.press).find(k => k.toLowerCase() === lc);
    if (key && key !== 'username') {
      const d = L.press[key];
      items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>', label: 'ЗМІ', extra: d.cans ? 'Скасовано' : (d.status || 'Дійсна'), code: null });
    }
  }

  if (L.business && Array.isArray(L.business)) {
    L.business.filter(b => b.username && b.username.toLowerCase() === lc).forEach(b => {
      items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>', label: `Бізнес: ${b.role || ''}`.trim(), extra: b.cans ? 'Скасовано' : (b.status || 'Дійсна'), code: null });
    });
  }

  if (L.police) {
    const key = Object.keys(L.police).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.police[key];
      const rank = getPoliceRank(d.role);
      items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1z"/><path d="M4 12l2-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2l2 7"/><path d="M10 6v2a2 2 0 0 0 4 0V6h-4z"/></svg>', label: 'НПС', extra: rank, code: null });
    }
  }

  const married = window.state && window.state.marriedList;
  if (Array.isArray(married)) {
    married.forEach(entry => {
      const u1 = (entry.username1 || '').toLowerCase();
      const u2 = (entry.username2 || '').toLowerCase();
      if (u1 === lc || u2 === lc) {
        const partner = u1 === lc ? entry.username2 : entry.username1;
        const parts = (entry.date || '').split('-');
        const dateStr = parts.length === 3 ? `${parts[1]}.${parts[2]}.${parts[0]}` : entry.date;
        items.push({ icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', label: 'Свідоцтво про шлюб', extra: `${partner} · ${dateStr}`, code: null });
      }
    });
  }

  const scrollArea = document.querySelector('#screen-profile .scroll-area');
  if (!scrollArea) return;

  const section = document.createElement('div');
  section.id = 'profile-licenses-section';
  section.className = 'profile-section anim-pop d4';

  if (!items.length) {
    section.innerHTML = `
      <div class="profile-section-title">Мої ліцензії</div>
      <div class="profile-rows">
        <div class="profile-row" style="cursor:default;">
          <div class="profile-row-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
          <div class="profile-row-label">Ліцензій не знайдено</div>
        </div>
      </div>`;
  } else {
    const rows = items.map(item => {
      const codeBlock = item.code
        ? `<div class="license-row-code">Код: <span>${item.code}</span></div>`
        : '';
      return `
        <div class="profile-row license-row" style="cursor:default;align-items:flex-start;">
          <div class="profile-row-icon">${item.icon}</div>
          <div class="license-row-body">
            <div class="profile-row-label">${item.label}</div>
            <div class="license-row-extra">${item.extra}</div>
            ${codeBlock}
          </div>
        </div>`;
    }).join('');

    section.innerHTML = `
      <div class="profile-section-title">Мої ліцензії</div>
      <div class="profile-rows">${rows}</div>`;
  }

  const logoutBtn = scrollArea.querySelector('.profile-logout');
  if (logoutBtn) {
    scrollArea.insertBefore(section, logoutBtn);
  } else {
    scrollArea.appendChild(section);
  }
}

function renderProfileExtras() {
  const old = document.getElementById('profile-extras-section');
  if (old) old.remove();

  const scrollArea = document.querySelector('#screen-profile .scroll-area');
  if (!scrollArea) return;

  const section = document.createElement('div');
  section.id = 'profile-extras-section';
  section.className = 'profile-section anim-pop d4';
  const _extraRole = getUserIssuerRole();
  const _pendingRow = _extraRole.canApprove
    ? `<div class="profile-row" onclick="openPendingFinesScreen()">
        <div class="profile-row-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
        <div class="profile-row-label">Штрафи на перевірку</div>
        <div class="profile-row-arrow">›</div>
      </div>`
    : '';
  const _issueRow = (_extraRole.canIssueDirectly || _extraRole.canSubmitPending)
    ? `<div class="profile-row" onclick="openIssueFineForm()">
        <div class="profile-row-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
        <div class="profile-row-label">Виписати штраф</div>
        <div class="profile-row-arrow">›</div>
      </div>`
    : '';

  section.innerHTML = `
    <div class="profile-rows">
      <div class="profile-row" onclick="switchScreen('fines')">
        <div class="profile-row-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg></div>
        <div class="profile-row-label">Штрафи</div>
        <div class="profile-row-arrow">›</div>
      </div>
      ${_pendingRow}
      ${_issueRow}
      <div class="profile-row" onclick="switchScreen('settings')">
        <div class="profile-row-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></div>
        <div class="profile-row-label">Налаштування</div>
        <div class="profile-row-arrow">›</div>
      </div>
    </div>`;

  const logoutBtn = scrollArea.querySelector('.profile-logout');
  if (logoutBtn) {
    scrollArea.insertBefore(section, logoutBtn);
  } else {
    scrollArea.appendChild(section);
  }
}

const iconMap = {
  'weapon': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="18" height="5" rx="1"/><path d="M6 11l-1 9h4l1-9"/><path d="M9 11v3h3a2 2 0 0 0 2-2v-1"/><line x1="19" y1="8" x2="20" y2="8"/><line x1="7" y1="13" x2="7" y2="18"/></svg>',
  'police': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1z"/><path d="M4 12l2-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2l2 7"/><path d="M10 6v2a2 2 0 0 0 4 0V6h-4z"/></svg>',
  'nps': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1z"/><path d="M4 12l2-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2l2 7"/><path d="M10 6v2a2 2 0 0 0 4 0V6h-4z"/></svg>',
  'nabs': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1z"/><path d="M4 12l2-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2l2 7"/><path d="M10 6v2a2 2 0 0 0 4 0V6h-4z"/></svg>',
  'sbs': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-1z"/><path d="M4 12l2-7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2l2 7"/><path d="M10 6v2a2 2 0 0 0 4 0V6h-4z"/></svg>',
  'dbr': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  'taxi': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  'advocat': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><rect width="4" height="18" x="10" y="3" rx="1"/><path d="M4 8h16"/><path d="M4 8l-2 6c0 1.1.9 2 2 2s2-.9 2-2l-2-6Z"/><path d="M20 8l-2 6c0 1.1.9 2 2 2s2-.9 2-2l-2-6Z"/></svg>',
  'presslicense': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  'press': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>',
  'mafia': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8a5 5 0 0 1 10 0"/><rect x="6" y="8" width="12" height="2"/><path d="M8 10v2a4 4 0 0 0 8 0v-2"/><path d="M4 22v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/><path d="M8 19h8"/><path d="M8 21h8"/></svg>',
  'business': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  'marriage': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
};

function loadLicenseInfo(roblox, licenses) {
  const username = roblox.username;
  const display = roblox.display || username;
  const lc = username.toLowerCase();

  let docsHtml = '';
  let homeDocsHtml = '';
  let animDelay = 0;
  let d = {};

  function renderDocCard(id, meta, infoText) {
    const delayClass = `d${animDelay % 5}`;
    animDelay++;

    docData[id] = {
      [id]: {
        title: meta.title,
        type: meta.type,
        fields: meta.fields,
      }
    };
    d[id] = docData[id];
    return `
    <div class="doc-item anim-flip ${delayClass}" onclick="openDocPage('${id}')">
        <div class="doc-item-header">
            <div class="doc-item-type">${meta.type}</div>
            <div class="doc-item-status">
                <div class="status-dot"></div>${meta.status}
            </div>
        </div>
        <div class="doc-item-name">${meta.title}</div>
        <div class="doc-item-info">${infoText}</div>
        <div class="news-ticker-wrap">
          <span class="news-ticker">СіЯ · Сервер і Я · Цифрові документи · Сервер в смартфоні · СіЯ · Сервер і Я · Цифрові документи · Сервер в смартфоні &nbsp;</span>
        </div>
        <div class="doc-item-footer">
            <div class="doc-item-number">${meta.docNumber}</div>
        </div>
    </div>`;
  }

  function renderHomeCard(id, meta) {
    const typeKey = id.split('_')[0].toLowerCase();
    const icon = iconMap[typeKey] || '📄';
    const dotColor = meta.status.includes('Скасовано') ? '#ff4d4d' : '';
    const dotStyle = dotColor ? `style="background:${dotColor};"` : '';
    return `<div class="doc-card" onclick="openDocPage('${id}')">
      <div class="doc-valid-dot" ${dotStyle}></div>
      <div class="doc-card-icon">${typeKey === 'passport' ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><circle cx="9" cy="11" r="2"/><path d="M14 15h4"/><path d="M14 11h4"/><path d="M6 15c0-1.7 1.3-3 3-3s3 1.3 3 3"/></svg>' : icon}</div>
      <div class="doc-card-type">${meta.type}</div>
      <div class="doc-card-name">${meta.title}</div>
    </div>`;
  }

  const idCode = localStorage.getItem('user_id_code') || '—';
  const issuedAt = window.state.issuedAt || null;
  let issuedStr = '—';
  if (issuedAt) {
    const d2 = new Date(issuedAt);
    issuedStr = d2.toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric' });
  }

  let passportFraction = '—';
  let passportRole = '—';
  const P = window.state && window.state.players;
  if (P) {
    const pKey = Object.keys(P).find(k => k.toLowerCase() === lc);
    if (pKey && Array.isArray(P[pKey]) && P[pKey][0]) {
      const pd = P[pKey][0];
      passportFraction = pd.category || '—';
      passportRole = pd.role || '—';
    }
  }
  if (passportFraction === '—' && licenses) {
    const factionDefs = [
      { key: 'police', name: 'НПС' }, { key: 'nabs', name: 'НАБС' },
      { key: 'sbs', name: 'СБС' }, { key: 'dbr', name: 'ДБР' },
    ];
    for (const fd of factionDefs) {
      const block = licenses[fd.key];
      if (!block) continue;
      const eKey = Object.keys(block).find(k => k.toLowerCase() === lc);
      if (!eKey) continue;
      const d2 = block[eKey];
      passportFraction = fd.name;
      passportRole = typeof window.getPoliceRank === 'function' && d2.role
        ? window.getPoliceRank(d2.role) : (d2.role || fd.name);
      break;
    }
  }

  docData['passport'] = {
    passport: {
      title: 'Паспорт',
      type: 'Паспорт',
      status: 'Дійсний',
      fields: [
        { label: 'ROBLOX NICK',  value: roblox.username },
        { label: 'ROBLOX ID',    value: roblox.id || '—' },
        { label: 'DISPLAY NAME', value: roblox.display || roblox.username },
        { label: 'ФРАКЦІЯ',      value: passportFraction },
        { label: 'ПОСАДА',       value: passportRole },
        { label: 'ВИДАНО',       value: issuedStr },
        { label: 'ID КОД',       value: idCode },
      ]
    }
  };
  d['passport'] = docData['passport'];

  docsHtml += `
  <div class="doc-item anim-flip d0" onclick="openDocPage('passport')">
      <div class="doc-item-header">
          <div class="doc-item-type">Паспорт</div>
          <div class="doc-item-status">
              <div class="status-dot"></div>Дійсний
          </div>
      </div>
      <div class="doc-item-name">Паспорт</div>
      <div class="doc-item-info">${display} · ${username}</div>
      <div class="news-ticker-wrap">
        <span class="news-ticker">СіЯ · Сервер і Я · Цифрові документи · Сервер в смартфоні · СіЯ · Сервер і Я · Цифрові документи · Сервер в смартфоні &nbsp;</span>
      </div>
      <div class="doc-item-footer">
          <div class="doc-item-number">${idCode}</div>
      </div>
  </div>`;
  homeDocsHtml += renderHomeCard('passport', docData['passport'].passport);
  animDelay = 1;

  const ctx = { display, username };
  const infoText = `${display} · ${username}`;

  for (const [key, section] of Object.entries(licenses)) {
    if (['sbs', 'dbr', 'nabs'].includes(key.toLowerCase())) continue;
    if (Array.isArray(section)) {
      section
        .filter(item => item.username && item.username.toLowerCase() === lc)
        .forEach((item, index) => {
          const id = `${key}_${index}`;
          const meta = buildLicenseDoc(key, item, ctx);
          docsHtml += renderDocCard(id, meta, infoText);
          homeDocsHtml += renderHomeCard(id, meta);
        });
    } else if (section && typeof section === 'object') {
      const entryKey = Object.keys(section).find(k => k.toLowerCase() === lc);
      if (!entryKey || entryKey === 'username') continue;
      const data = section[entryKey];
      const meta = buildLicenseDoc(key, data, ctx);
      docsHtml += renderDocCard(key, meta, infoText);
      homeDocsHtml += renderHomeCard(key, meta);
    }
  }

  const married = window.state && window.state.marriedList;
  if (Array.isArray(married)) {
    married.forEach((entry, index) => {
      const u1 = (entry.username1 || '').toLowerCase();
      const u2 = (entry.username2 || '').toLowerCase();
      if (u1 === lc || u2 === lc) {
        const id = `marriage_${index}`;
        const meta = buildLicenseDoc('marriage', entry, ctx);
        docsHtml += renderDocCard(id, meta, `${entry.username1} & ${entry.username2}`);
        homeDocsHtml += renderHomeCard(id, meta);
      }
    });
  }

  const container = document.querySelector('.doc-list');
  if (container) {
    container.innerHTML = docsHtml || '<div style="padding:20px;color:#999">Нічого не знайдено</div>';
  }

  const homeContainer = document.getElementById('home-docs-scroll');
  if (homeContainer) {
    homeContainer.innerHTML = homeDocsHtml;
  }

  renderProfileLicenses();

  return d;
}

const checkRobloxData = setInterval(() => {
  if (window.state && window.state.roblox && window.state.licenses) {
    docData = loadLicenseInfo(window.state.roblox, window.state.licenses);
    clearInterval(checkRobloxData);
  }
}, 500);

async function openDocPage(docId) {
  if (docId === "nps") docId = "police";
  const raw = docData[docId];
  if (!raw) return;
  const data = raw[docId] ? raw[docId] : raw;
  currentDocId = docId;
  const verr = document.getElementById('viewer-error');
  if (verr) verr.remove();

  const docUrl = await getDocUrl(docId);

  const content = document.getElementById('doc-page-content');
  content.innerHTML = `
    <div class="doc-page-card animate-in">
      <div class="doc-page-label">${data.type}</div>
      <div class="doc-item-name" style="font-size:24px;color:white;font-weight:800;letter-spacing:-0.5px;margin-top:8px;">${data.title}</div>
      <div class="doc-page-qr">
        <div class="doc-page-qr-box" onclick="openModal()">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <rect x="5" y="5" width="18" height="18" rx="2" fill="black"/>
            <rect x="8" y="8" width="12" height="12" rx="1" fill="white"/>
            <rect x="10" y="10" width="8" height="8" rx="0.5" fill="black"/>
            <rect x="37" y="5" width="18" height="18" rx="2" fill="black"/>
            <rect x="40" y="8" width="12" height="12" rx="1" fill="white"/>
            <rect x="42" y="10" width="8" height="8" rx="0.5" fill="black"/>
            <rect x="5" y="37" width="18" height="18" rx="2" fill="black"/>
            <rect x="8" y="40" width="12" height="12" rx="1" fill="white"/>
            <rect x="10" y="42" width="8" height="8" rx="0.5" fill="black"/>
            <rect x="28" y="5" width="4" height="4" fill="black"/>
            <rect x="33" y="5" width="4" height="4" fill="black"/>
            <rect x="28" y="10" width="4" height="4" fill="black"/>
            <rect x="33" y="15" width="4" height="4" fill="black"/>
            <rect x="28" y="28" width="4" height="4" fill="black"/>
            <rect x="33" y="28" width="4" height="4" fill="black"/>
            <rect x="38" y="28" width="4" height="4" fill="black"/>
            <rect x="43" y="33" width="4" height="4" fill="black"/>
            <rect x="48" y="28" width="4" height="4" fill="black"/>
            <rect x="48" y="38" width="4" height="4" fill="black"/>
            <rect x="38" y="43" width="4" height="4" fill="black"/>
            <rect x="28" y="38" width="4" height="4" fill="black"/>
            <rect x="28" y="48" width="4" height="4" fill="black"/>
            <rect x="33" y="43" width="4" height="4" fill="black"/>
            <rect x="5" y="28" width="4" height="4" fill="black"/>
            <rect x="10" y="33" width="4" height="4" fill="black"/>
            <rect x="15" y="28" width="4" height="4" fill="black"/>
            <rect x="20" y="33" width="4" height="4" fill="black"/>
          </svg>
        </div>
      </div>
    </div>

    <div class="doc-actions animate-in">
      <button class="doc-action-btn" id="copy-link-btn" onclick="copyDocLink()" style="flex:1;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Копіювати
      </button>
    </div>

    <div class="doc-link-row animate-in" id="doc-link-row">
      <div class="doc-link-label">Посилання на документ</div>
      <div class="doc-link-value" id="doc-link-value">${docUrl}</div>
    </div>

    ${data.photo1 || data.photo2 ? `
    <div class="doc-marriage-photos animate-in">
      ${data.photo1 ? `<div class="doc-marriage-photo-wrap"><img src="${data.photo1}" class="doc-marriage-photo" onerror="this.style.display='none'"/><div class="doc-marriage-photo-name">${data.fields[0] ? data.fields[0].value : ''}</div></div>` : ''}
      <div class="doc-marriage-heart"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
      ${data.photo2 ? `<div class="doc-marriage-photo-wrap"><img src="${data.photo2}" class="doc-marriage-photo" onerror="this.style.display='none'"/><div class="doc-marriage-photo-name">${data.fields[1] ? data.fields[1].value : ''}</div></div>` : ''}
    </div>` : ''}

    <div class="doc-info-rows animate-in">
      ${data.fields.map(f => `
        <div class="doc-info-row">
          <div class="doc-info-row-label">${f.label}</div>
          <div class="doc-info-row-value">${f.value}</div>
        </div>
      `).join('')}
    </div>
    <div style="height:20px"></div>
  `;

  switchScreen('docpage');
  screenHistory = ['docs', 'docpage'];
  if (tg && tg.BackButton) tg.BackButton.show();
}

async function copyDocLink() {
  const url = await getDocUrl(currentDocId);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Посилання скопійовано');
      const btn = document.getElementById('copy-link-btn');
      if (btn) {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Скопійовано`;
        setTimeout(() => {
          btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Копіювати`;
        }, 2000);
      }
    });
  } else {
    const el = document.createElement('textarea');
    el.value = url;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Посилання скопійовано');
  }
}

let timerInterval = null;

function openModal() {
  document.getElementById('modal').classList.add('open');
  drawQR();
  startTimer(180);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  clearInterval(timerInterval);
}

function closeModalBg(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

async function drawQR() {
  const canvas = document.getElementById('qrCanvas');
  const url = await getDocUrl(currentDocId);
  try {
    await QRCode.toCanvas(canvas, url, { width: 160, margin: 1 });
  } catch(e) {}
}

function startTimer(seconds) {
  clearInterval(timerInterval);
  let s = seconds;
  const el = document.getElementById('timer');
  const update = () => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    el.textContent = `0${m}:${sec < 10 ? '0' : ''}${sec}`;
    if (s <= 0) { clearInterval(timerInterval); el.textContent = '00:00'; }
    s--;
  };
  update();
  timerInterval = setInterval(update, 1000);
}

let toastTimeout;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.classList.remove('show'), 2500);
}

function setChip(el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

setTimeout(() => {
  const splash = document.getElementById('splash');
  if (splash) {
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 600);
  }
}, 1600);

const homeScreenEl = document.getElementById('screen-home');
if (homeScreenEl) homeScreenEl.style.transform = 'translateX(0)';

function waitFor(predicate, timeoutMs = 6000, intervalMs = 80) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const tick = () => {
      let v;
      try { v = predicate(); } catch (e) { v = null; }
      if (v) return resolve(v);
      if (Date.now() - t0 > timeoutMs) return resolve(null);
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function showViewerError(msg) {
  document.body.classList.add('viewer-mode');
  let el = document.getElementById('viewer-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'viewer-error';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="viewer-error-card">
      <div class="viewer-error-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
      <div class="viewer-error-title">${msg}</div>
      <div class="viewer-error-sub">Відкрийте додаток СіЯ у Telegram, щоб переглянути документ.</div>
    </div>`;
}

async function bootViewerMode() {
  const params = new URLSearchParams(window.location.search);

  const docId = params.get('doc');
  const token = params.get('token');

  if (!docId) return;

  const firebaseReady = await waitFor(
    () => window.fetchProfile && window.findTgByRobloxUsername,
    8000
  );

  if (!firebaseReady) {
    showViewerError('Не вдалося завантажити Firebase.');
    return;
  }

  document.body.classList.add('viewer-mode');

  const splash = document.getElementById('splash');
  if (splash) splash.remove();

  let tgKey = null;

  const uParamRaw =
    params.get('u') ||
    params.get('user') ||
    '';

  const uParam = String(uParamRaw)
    .trim()
    .replace(/^@/, '');

  if (token) {
    try {
      const tokenData = await window.consumeDocToken(token);

      if (!tokenData || tokenData.docId !== docId) {
        showViewerError('Недійсний або прострочений код доступу');
        return;
      }

      tgKey = tokenData.owner || null;
    } catch (e) {
      tgKey = null;
    }
  }

  if (!tgKey && uParam) {
    const variants = [
      uParam,
      uParam.toLowerCase(),
      uParam.toUpperCase(),
      uParam.charAt(0).toUpperCase() + uParam.slice(1).toLowerCase()
    ];

    for (const variant of variants) {
      if (tgKey) break;

      try {
        const found = await window.findTgByRobloxUsername(variant);

        if (found) {
          tgKey = found;
          break;
        }
      } catch (e) {}
    }

    if (!tgKey) {
      tgKey = uParam;
    }
  }

  if (!tgKey) {
    showViewerError('Неможливо визначити власника документа.');
    return;
  }

  let profile = null;

  try {
    profile = await window.fetchProfile(tgKey);
  } catch (e) {}

  if ((!profile || !profile.roblox) && uParam && uParam !== tgKey) {
    try {
      profile = await window.fetchProfile(uParam);
    } catch (e) {}
  }

  if (!profile || !profile.roblox) {
    showViewerError(
      'Профіль не знайдено. Переконайтесь що власник відкривав застосунок СіЯ хоча б раз.'
    );
    return;
  }

  window.state = window.state || {};

  window.state.roblox = profile.roblox;
  window.state.telegram =
    profile.telegram || { username: uParam || tgKey };

  window.state.issuedAt = profile.issuedAt || null;

  window.state.isTgAuth = true;
  window.state.isRbxAuth = true;

  if (profile.idCode) {
    try {
      localStorage.setItem('user_id_code', profile.idCode);
    } catch (e) {}
  }

  await waitFor(
    () => (window.state && window.state.licenses) || window.licenses,
    20000
  );

  const licenses =
    (window.state && window.state.licenses) ||
    window.licenses;

  if (!licenses) {
    showViewerError('Не вдалося завантажити список ліцензій.');
    return;
  }

  if (!window.state.licenses) {
    window.state.licenses = licenses;
  }

  if (!window.state.marriedList) {
    await waitFor(
      () => window.state && window.state.marriedList,
      3000
    );
  }

  try {
    docData = loadLicenseInfo(profile.roblox, licenses);
  } catch (e) {
    showViewerError(
      'Не вдалося прочитати ліцензії: ' +
      ((e && e.message) || 'помилка')
    );
    return;
  }

  if (!docData || !docData[docId]) {
    const available = docData
      ? Object.keys(docData).join(', ')
      : 'нічого';

    showViewerError(
      'Документ "' +
      docId +
      '" не знайдено. Доступні: ' +
      available
    );
    return;
  }

  openDocPage(docId);
}

if (document.body) bootTheme();
else document.addEventListener('DOMContentLoaded', bootTheme);
function applyTheme(name) {
  const t = name === 'dark' ? 'dark' : 'light';
  if (t === 'dark') {
    document.body.classList.add('theme-dark');
    const logo = document.getElementById('header-logo-img');
    if (logo) logo.src = 'png/ciya.png';
  } else {
    document.body.classList.remove('theme-dark');
    const logo = document.getElementById('header-logo-img');
    if (logo) logo.src = 'png/ciyablack.png';
  }
  try { localStorage.setItem('theme', t); } catch (e) {}
  const tgl = document.getElementById('theme-toggle');
  if (tgl) tgl.checked = (t === 'dark');
}

function toggleTheme(checked) {
  applyTheme(checked ? 'dark' : 'light');
}

function bootTheme() {
  let t = 'light';
  try { t = localStorage.getItem('theme') || 'light'; } catch (e) {}
  applyTheme(t);
}

function renderSettingsScreen() {
  const tgl = document.getElementById('theme-toggle');
  if (!tgl) return;
  let t = 'light';
  try { t = localStorage.getItem('theme') || 'light'; } catch (e) {}
  tgl.checked = (t === 'dark');
}

window.toggleTheme = toggleTheme;
window.renderSettingsScreen = renderSettingsScreen;
window.addEventListener('error', function(e) {
  if (e.target && e.target.tagName && e.target.tagName.toLowerCase() === 'img') {
    e.target.style.display = 'none';
    const parent = e.target.parentElement;
    if (parent && parent.classList.contains('service-row-icon')) {
      parent.textContent = e.target.alt ? e.target.alt.charAt(0).toUpperCase() : '?';
    } else if (parent && parent.id === 'ob-splash') {
      const fb = parent.querySelector('.ob-splash-fb');
      if (fb) fb.style.display = 'block';
    }
  }
}, true);

function initMain() {
  bootTheme();
  bootViewerMode();
}

if (document.readyState === 'complete') {
  initMain();
} else {
  window.addEventListener('load', initMain);
}



function applyCustomBg() {
  const url = document.getElementById('custom-bg-url').value.trim();
  if (url) {
    localStorage.setItem('customBg', url);
    setBgImage(url);
  } else {
    localStorage.removeItem('customBg');
    document.getElementById('bg-layer').style.backgroundImage = '';
  }
}




function setBgImage(url) {
  const layer = document.getElementById('bg-layer');
  if(layer) {
    if(url) {
      layer.style.backgroundImage = `url('${url}')`;
      document.body.classList.add('has-custom-bg');
    } else {
      layer.style.backgroundImage = '';
      document.body.classList.remove('has-custom-bg');
    }
  }
}

// Load background on start
document.addEventListener('DOMContentLoaded', () => {
  const savedBg = localStorage.getItem('customBg');
  if (savedBg) {
    setBgImage(savedBg);
    const input = document.getElementById('custom-bg-url');
    if (input) input.value = savedBg;
  }
});
