let currentDocId = null;
let tg = null;
let tgUser = null;

if (window.Telegram && window.Telegram.WebApp) {
  tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#ffffff');
  tg.setBackgroundColor('#ffffff');

  try {
    const initData = tg.initData;
    if (initData && typeof initData === 'string' && initData.trim().length > 0) {
      const params = new URLSearchParams(initData);
      const hash = params.get('hash');
      const authDate = params.get('auth_date');
      const userStr = params.get('user');
      
      if (hash && authDate && userStr) {
        const authTime = parseInt(authDate, 10);
        const now = Math.floor(Date.now() / 1000);
        // Перевіряємо, чи дані не застаріли (наприклад, 24 години = 86400 секунд)
        if (!isNaN(authTime) && (now - authTime <= 86400)) {
          tgUser = JSON.parse(userStr);
        }
      }
    } else {
      tgUser = null;
    }
  } catch(e) {
    tgUser = null;
  }

  if (tgUser) {
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ');
    document.querySelector('.greeting-name').textContent = `Привіт, ${tgUser.first_name || 'гість'} 👋`;
    document.querySelector('.profile-name').textContent = name || 'Користувач';
    document.querySelector('.profile-id').textContent = tgUser.id || 'None';
    const initials = (name || 'U').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    document.querySelector('.profile-avatar').innerHTML = tgUser.photo_url ? `<img src="${tgUser.photo_url}" alt="${name || 'Користувач'}">` : initials;
    if (tg.BackButton) {
      tg.BackButton.onClick(() => goBack());
    }
  }
}

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
    typeof showToast === 'function' && showToast('🚫 Немає прав');
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
      const status = d.cans ? '⛔ Скасовано' : (d.status || 'Дійсна');
      const expiry = d.expiry ? `\nДійсна до: ${formatExpiryDate(d.expiry)}` : '';
      items.push({ icon: '🔫', label: 'Ліцензія на зброю', extra: `${status}${expiry}`, code: d.code || d.telegram || null });
    }
  }

  if (L.taxi) {
    const key = Object.keys(L.taxi).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.taxi[key];
      const status = d.cans ? '⛔ Скасовано' : (d.status || 'Дійсна');
      const expiry = d.expiry ? `\nДійсна до: ${formatExpiryDate(d.expiry)}` : '';
      items.push({ icon: '🚕', label: 'Таксистська ліцензія', extra: `${status}${expiry}`, code: d.code || d.telegram || null });
    }
  }

  if (L.advocat) {
    const key = Object.keys(L.advocat).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.advocat[key];
      const status = d.cans ? '⛔ Скасовано' : (d.status || 'Дійсна');
      const expiry = d.expiry ? `\nДійсна до: ${formatExpiryDate(d.expiry)}` : '';
      items.push({ icon: '⚖️', label: 'Адвокатська ліцензія', extra: `${status}${expiry}`, code: d.code || d.telegram || null });
    }
  }

  if (L.presslicense) {
    const key = Object.keys(L.presslicense).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.presslicense[key];
      items.push({ icon: '📰', label: 'Прес-карта', extra: d.cans ? '⛔ Скасовано' : (d.status || 'Дійсна'), code: d.code || null });
    }
  }

  if (L.press) {
    const key = Object.keys(L.press).find(k => k.toLowerCase() === lc);
    if (key && key !== 'username') {
      const d = L.press[key];
      items.push({ icon: '📡', label: 'ЗМІ', extra: d.cans ? '⛔ Скасовано' : (d.status || 'Дійсна'), code: null });
    }
  }

  if (L.business && Array.isArray(L.business)) {
    L.business.filter(b => b.username && b.username.toLowerCase() === lc).forEach(b => {
      items.push({ icon: '💼', label: `Бізнес: ${b.role || ''}`.trim(), extra: b.cans ? '⛔ Скасовано' : (b.status || 'Дійсна'), code: null });
    });
  }

  if (L.police) {
    const key = Object.keys(L.police).find(k => k.toLowerCase() === lc);
    if (key) {
      const d = L.police[key];
      const rank = getPoliceRank(d.role);
      items.push({ icon: '👮', label: 'НПС', extra: rank, code: null });
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
        items.push({ icon: '💍', label: 'Свідоцтво про шлюб', extra: `${partner} · ${dateStr}`, code: null });
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
      <div class="profile-section-title">📄 Мої ліцензії</div>
      <div class="profile-rows">
        <div class="profile-row" style="cursor:default;">
          <div class="profile-row-icon">📄</div>
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
      <div class="profile-section-title">📄 Мої ліцензії</div>
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
        <div class="profile-row-icon">🕒</div>
        <div class="profile-row-label">Штрафи на перевірку</div>
        <div class="profile-row-arrow">›</div>
      </div>`
    : '';
  const _issueRow = (_extraRole.canIssueDirectly || _extraRole.canSubmitPending)
    ? `<div class="profile-row" onclick="openIssueFineForm()">
        <div class="profile-row-icon">📝</div>
        <div class="profile-row-label">Виписати штраф</div>
        <div class="profile-row-arrow">›</div>
      </div>`
    : '';

  section.innerHTML = `
    <div class="profile-rows">
      <div class="profile-row" onclick="switchScreen('fines')">
        <div class="profile-row-icon">💸</div>
        <div class="profile-row-label">Штрафи</div>
        <div class="profile-row-arrow">›</div>
      </div>
      ${_pendingRow}
      ${_issueRow}
      <div class="profile-row" onclick="switchScreen('settings')">
        <div class="profile-row-icon">⚙️</div>
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
  'weapon': '🔫',
  'police': '👮',
  'nps': '👮',
  'nabs': '🛡️',
  'sbs': '🛡️',
  'dbr': '🛡️',
  'taxi': '🚕',
  'advocat': '⚖️',
  'presslicense': '📰',
  'press': '📡',
  'mafia': '🕶️',
  'business': '💼',
  'marriage': '💍'
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
      <div class="doc-card-icon">${typeKey === 'passport' ? '🪪' : icon}</div>
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
      <div class="doc-marriage-heart">💍</div>
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
      showToast('🔗 Посилання скопійовано');
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
    showToast('🔗 Посилання скопійовано');
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
      <div class="viewer-error-icon">📄</div>
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

