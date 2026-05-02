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
    if (initData) {
      const params = new URLSearchParams(initData);
      const userStr = params.get('user');
      if (userStr) {
        tgUser = JSON.parse(decodeURIComponent(userStr));
      }
    }
  } catch(e) {}

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

function switchScreen(id) {
  if (currentScreen === id) return;
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

    // Рендеримо ліцензії при переході на профіль
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
  if (!xpString) return "Невідомо";
  if (isNaN(parseInt(xpString))) return xpString;
  const xp = parseInt(xpString.replace(/\s/g, ''), 10);
  if (xp <= 2999) return "Кадет";
  if (xp <= 5999) return "Молодший патрульний";
  if (xp <= 9999) return "Патрульний";
  if (xp <= 12999) return "Старший патрульний";
  if (xp <= 15499) return "Молодший сержант";
  if (xp <= 18499) return "Сержант";
  if (xp <= 21999) return "Старший сержант";
  if (xp <= 25999) return "Лейтенант";
  if (xp <= 29999) return "Капітан";
  if (xp <= 34999) return "Ветеран";
  if (xp <= 44999) return "Комісар";
  if (xp <= 59999) return "Полковник";
  return "Генерал";
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
        type: 'Реєстрація ОЗУ',
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
        type: 'Бізнес-сертифікат',
        status: data.cans ? 'Скасовано' : 'Активний',
        docNumber: data.status || '—',
        fields: [
          f('Власник', owner),
          f('Назва', data.role || '—'),
          f('ID бізнесу', data.status || '—'),
          ...cansField,
        ]
      };
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

function getDocUrl(docId) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  params.set('doc', docId);
  const uname = (tgUser && tgUser.username)
    || (window.state && window.state.telegram && window.state.telegram.username)
    || null;
  if (uname) params.set('u', uname);
  if (tgUser && tgUser.id) params.set('uid', tgUser.id);
  return `${base}?${params.toString()}`;
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

function logout() {
  try { localStorage.removeItem('user_id_code'); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
  window.state = window.state || {};
  window.state.roblox = null;
  window.state.telegram = null;
  window.state.fines = null;
  window.state.isRbxAuth = false;
  window.state.isTgAuth = false;
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

function getUserIssuerRole() {
  const out = {
    canIssueDirectly: false,
    canSubmitPending: false,
    canApprove: false,
    label: '',
    issuerType: ''
  };

  const rbx = window.state && window.state.roblox;
  const robloxUsername = rbx && rbx.username;
  if (!robloxUsername) return out;

  const lc = robloxUsername.toLowerCase();
  const headWords = ['комісар', 'начальник', 'директор', 'голова', 'генерал', 'шеріф'];
  const seniorWords = ['полковник', 'підполковник', 'капітан', 'майор'];

  const P = window.state && window.state.players;
  if (P) {
    const pKey = Object.keys(P).find(k => k.toLowerCase() === lc);
    if (pKey && Array.isArray(P[pKey]) && P[pKey][0]) {
      const pd = P[pKey][0];
      const cat = String(pd.category || '').toLowerCase();
      const role = String(pd.role || '').toLowerCase();
      if (cat.includes('адмін') || cat === 'адміністрація') {
        return { canIssueDirectly: true, canSubmitPending: true, canApprove: true, label: pd.role || 'Адміністрація', issuerType: 'admin' };
      }
      if (cat.includes('суд')) {
        return { canIssueDirectly: true, canSubmitPending: true, canApprove: true, label: pd.role || 'Суд', issuerType: 'court' };
      }
      const factionMap = [
        { cats: ['поліція', 'нпс', 'police'], label: 'НПС', issuerType: 'police' },
        { cats: ['набс', 'nabs'],             label: 'НАБС', issuerType: 'police' },
        { cats: ['сбс', 'sbs'],               label: 'СБС',  issuerType: 'police' },
        { cats: ['дбр', 'dbr'],               label: 'ДБР',  issuerType: 'police' },
      ];
      for (const fm of factionMap) {
        if (fm.cats.some(c => cat.includes(c))) {
          const isHead = headWords.some(w => role.includes(w));
          const isSenior = seniorWords.some(w => role.includes(w));
          return {
            canIssueDirectly: isHead || isSenior,
            canSubmitPending: true,
            canApprove: isHead,
            label: (pd.role || fm.label) + ' ' + fm.label,
            issuerType: fm.issuerType
          };
        }
      }
    }
  }

  const L = window.state && window.state.licenses;
  if (!L) return out;

  const factions = [
    { key: 'police', label: 'НПС', issuerType: 'police' },
    { key: 'nabs',   label: 'НАБС', issuerType: 'police' },
    { key: 'sbs',    label: 'СБС',  issuerType: 'police' },
    { key: 'dbr',    label: 'ДБР',  issuerType: 'police' }
  ];

  for (const f of factions) {
    const block = L[f.key];
    if (!block) continue;
    const key = Object.keys(block).find(k => k.toLowerCase() === lc);
    if (!key) continue;
    const r = block[key];
    if (!r) continue;
    const role = String(r.role || '').toLowerCase();
    const isHead = headWords.some(w => role.includes(w));
    const isSenior = seniorWords.some(w => role.includes(w));
    return {
      canIssueDirectly: isHead || isSenior,
      canSubmitPending: true,
      canApprove: isHead,
      label: (r.role || f.label) + ' ' + f.label,
      issuerType: f.issuerType
    };
  }

  return out;
}

function openPendingFinesScreen() {
  switchScreen('fines');
  renderPendingApprovalSection();
  renderPaymentRequestsSection();
}

function openPayFineModal(fineId, amount) {
  const existing = document.getElementById('pay-fine-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'pay-fine-modal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;';

  overlay.innerHTML = `
    <div style="background:var(--bg1,#fff);border-radius:20px 20px 0 0;padding:24px 20px 36px;width:100%;max-width:480px;box-shadow:0 -4px 32px rgba(0,0,0,0.15);">
      <div style="width:36px;height:4px;background:var(--sep,#e0e0e0);border-radius:2px;margin:0 auto 18px;"></div>
      <div style="font-size:18px;font-weight:700;margin-bottom:4px;">💳 Оплата штрафу</div>
      <div style="font-size:14px;color:var(--text2,#888);margin-bottom:18px;">Сума: <b>${amount} €</b> · Штраф №${fineId}</div>
      <div style="font-size:13px;color:var(--text2,#888);margin-bottom:8px;">Прикріпіть скріншот підтвердження оплати:</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <label class="ff-file-button" id="pay-evidence-label" for="pay-evidence-file" style="flex-shrink:0;">Обрати фото</label>
        <input id="pay-evidence-file" type="file" accept="image/png,image/jpeg" style="display:none;" onchange="handlePayEvidenceFile(this)">
        <span id="pay-evidence-name" style="font-size:12px;color:var(--text2,#888);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
      </div>
      <div id="pay-evidence-preview" style="margin-bottom:14px;"></div>
      <div id="pay-status-msg" class="ff-status" style="margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;">
        <button type="button" class="ff-submit" style="flex:1;" onclick="submitPayFineRequest('${fineId}')">Надіслати на перевірку</button>
        <button type="button" class="btn-secondary" style="flex:0 0 auto;padding:0 18px;" onclick="document.getElementById('pay-fine-modal').remove()">Скасувати</button>
      </div>
    </div>`;

  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

async function handlePayEvidenceFile(input) {
  const preview = document.getElementById('pay-evidence-preview');
  const label = document.getElementById('pay-evidence-label');
  const nameEl = document.getElementById('pay-evidence-name');
  if (!input || !input.files || !input.files[0]) {
    window._payEvidence = null;
    if (preview) preview.innerHTML = '';
    if (label) label.textContent = 'Обрати фото';
    if (nameEl) nameEl.textContent = '';
    return;
  }
  const file = input.files[0];
  if (file.size > 10 * 1024 * 1024) {
    if (preview) preview.innerHTML = '<span class="ff-preview-info" style="color:#ff6b6b;">Файл завеликий (макс 10 МБ)</span>';
    return;
  }
  if (preview) preview.innerHTML = '<span class="ff-preview-info">Обробляємо…</span>';
  const dataUrl = await compressImageToDataUrl(file, 800, 0.8);
  if (!dataUrl) {
    if (preview) preview.innerHTML = '<span class="ff-preview-info" style="color:#ff6b6b;">Не вдалося прочитати файл</span>';
    return;
  }
  window._payEvidence = dataUrl;
  if (nameEl) nameEl.textContent = file.name;
  if (label) label.textContent = 'Замінити';
  if (preview) preview.innerHTML = `<img class="ff-preview-img" src="${dataUrl}" alt="оплата" style="max-width:100%;border-radius:10px;max-height:180px;object-fit:contain;">`;
}

async function submitPayFineRequest(fineId) {
  const status = document.getElementById('pay-status-msg');
  const username = (window.state && window.state.telegram && window.state.telegram.username)
    || (tgUser && tgUser.username);

  if (!window._payEvidence) {
    if (status) status.textContent = '⚠️ Потрібен скріншот підтвердження оплати';
    return;
  }
  if (status) status.textContent = 'Надсилаємо…';

  const item = {
    _paymentId: 'pay_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6),
    fineId,
    username,
    evidence: window._payEvidence,
    submittedAt: new Date().toISOString()
  };

  let ok = false;
  if (typeof window.submitPaymentRequest === 'function') {
    ok = await window.submitPaymentRequest(item);
  }

  if (ok) {
    window._payEvidence = null;
    if (status) status.textContent = '✅ Надіслано на перевірку адміністрації';
    setTimeout(() => {
      const modal = document.getElementById('pay-fine-modal');
      if (modal) modal.remove();
      renderFines();
    }, 1500);
  } else {
    if (status) status.textContent = '❌ Не вдалося надіслати';
  }
}

async function renderPaymentRequestsSection() {
  const role = getUserIssuerRole();
  if (!role.canApprove) return;

  let root = document.getElementById('fines-payments-list');
  if (!root) {
    const finesList = document.getElementById('fines-pending-list');
    if (!finesList) return;
    root = document.createElement('div');
    root.id = 'fines-payments-list';
    finesList.parentNode.insertBefore(root, finesList.nextSibling);
  }

  root.innerHTML = `<div class="fines-loading">Перевірка оплат…</div>`;

  let items = [];
  if (typeof window.fetchPaymentRequests === 'function') {
    try { items = await window.fetchPaymentRequests(); } catch(e) {}
  }

  if (!items.length) { root.innerHTML = ''; return; }

  root.innerHTML = `
    <div class="profile-section-title" style="padding:12px 4px 6px;">💳 Запити на оплату (${items.length})</div>
    ${items.map(it => `
      <div class="fine-card fine-card-pending">
        <div class="fine-card-header">
          <div class="fine-card-num">Штраф №${it.fineId || '—'}</div>
          <div class="fine-card-status" style="color:#f0a000;"><span class="fine-status-dot" style="background:#f0a000;"></span>Очікує</div>
        </div>
        <div class="fine-card-row"><span class="fine-card-label">Гравець:</span><span class="fine-card-value">@${it.username || '—'}</span></div>
        <div class="fine-card-row"><span class="fine-card-label">Дата:</span><span class="fine-card-value">${it.submittedAt ? formatExpiryDate(it.submittedAt.slice(0,10)) : '—'}</span></div>
        ${it.evidence
          ? `<img class="fine-evidence-img" src="${it.evidence}" alt="оплата" onclick="openEvidenceFull('${it._paymentId}')" style="max-width:100%;border-radius:10px;max-height:200px;object-fit:contain;margin-top:8px;cursor:zoom-in;">`
          : '<div class="ff-preview-info">⚠️ Без скріншоту</div>'}
        <div class="fine-actions" style="margin-top:10px;">
          <button type="button" class="fine-btn fine-btn-approve" onclick="approvePaymentUI('${it._paymentId}')">✅ Підтвердити оплату</button>
          <button type="button" class="fine-btn fine-btn-reject" onclick="rejectPaymentUI('${it._paymentId}')">❌ Відхилити</button>
        </div>
      </div>`).join('')}`;
}

async function approvePaymentUI(paymentId) {
  if (typeof window.approvePaymentRequest !== 'function') return;
  const approver = window.state && window.state.telegram && window.state.telegram.username;
  const ok = await window.approvePaymentRequest(paymentId, approver);
  if (ok) {
    showToast && showToast('✅ Оплату підтверджено');
    renderPaymentRequestsSection();
  } else {
    showToast && showToast('❌ Не вдалося підтвердити');
  }
}

async function rejectPaymentUI(paymentId) {
  if (typeof window.rejectPaymentRequest !== 'function') return;
  const ok = await window.rejectPaymentRequest(paymentId);
  if (ok) {
    showToast && showToast('Запит відхилено');
    renderPaymentRequestsSection();
  } else {
    showToast && showToast('❌ Не вдалося відхилити');
  }
}

function genPendingId() {
  return 'pf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function openIssueFineForm() {
  const role = getUserIssuerRole();
  if (!role.canIssueDirectly && !role.canSubmitPending) {
    showToast && showToast('У вас немає прав виписувати штрафи');
    return;
  }
  window._issueFineRole = role;
  window._fineEvidence = null;
  switchScreen('issue-fine');
}

async function submitFineForm() {
  const role = window._issueFineRole || getUserIssuerRole();
  const target = (document.getElementById('fine-target') || {}).value;
  const amount = (document.getElementById('fine-amount') || {}).value;
  const dueDate = (document.getElementById('fine-due') || {}).value;
  const reason = (document.getElementById('fine-reason') || {}).value;
  const evidenceData = window._fineEvidence || null;
  const status = document.getElementById('fine-status-msg');

  if (!target || !target.trim()) { if (status) status.textContent = 'Вкажіть кому виписується штраф (Telegram username)'; return; }
  if (!amount || isNaN(Number(amount))) { if (status) status.textContent = 'Сума має бути числом'; return; }
  if (!dueDate) { if (status) status.textContent = 'Вкажіть дату оплати'; return; }
  if (!reason || !reason.trim()) { if (status) status.textContent = 'Вкажіть причину штрафу'; return; }
  if (!role.canIssueDirectly && !evidenceData) {
    if (status) status.textContent = 'Для штрафу на затвердження потрібен скрін доказу (PNG/JPG)';
    return;
  }

  const proposerTg = window.state && window.state.telegram && window.state.telegram.username;
  const fine = {
    id: 'F-' + Date.now().toString(36).toUpperCase(),
    issuer: role.label || 'Невідомо',
    issuerType: role.issuerType || 'admin',
    issuedBy: proposerTg || null,
    amount: Number(amount),
    dueDate: dueDate,
    reason: reason.trim(),
    issuedAt: new Date().toISOString()
  };

  if (status) status.textContent = 'Зберігаємо…';

  let ok = false;
  const targetClean = target.trim().replace(/^@/, '');

  if (role.canIssueDirectly) {
    fine.status = 'unpaid';
    if (evidenceData) fine.evidence = evidenceData; 
    if (typeof window.addFineDirect === 'function') {
      ok = await window.addFineDirect(targetClean, fine);
    }
  } else {
    const pending = Object.assign({}, fine, {
      target: targetClean,
      evidence: evidenceData || null,
      status: 'pending',
      _pendingId: genPendingId(),
      proposedBy: proposerTg || null,
      proposedAt: new Date().toISOString()
    });
    if (typeof window.submitPendingFine === 'function') {
      ok = await window.submitPendingFine(pending);
    }
  }

  if (status) {
    if (ok) {
      status.textContent = role.canIssueDirectly
        ? '✅ Штраф виписано'
        : '🕒 Штраф надіслано на затвердження';
      ['fine-target','fine-amount','fine-due','fine-reason']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      window._fineEvidence = null;
      const preview = document.getElementById('fine-evidence-preview');
      if (preview) preview.innerHTML = '';
      const fileLabel = document.getElementById('fine-evidence-label');
      if (fileLabel) fileLabel.textContent = 'Обрати фото';
      const fileInput = document.getElementById('fine-evidence-file');
      if (fileInput) fileInput.value = '';
    } else {
      status.textContent = '❌ Не вдалося зберегти штраф';
    }
  }
}

async function compressImageToDataUrl(file, maxSize, quality) {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * ratio));
          const h = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function handleEvidenceFile(input) {
  const preview = document.getElementById('fine-evidence-preview');
  const label = document.getElementById('fine-evidence-label');
  if (!input || !input.files || !input.files[0]) {
    window._fineEvidence = null;
    if (preview) preview.innerHTML = '';
    if (label) label.textContent = 'Обрати фото';
    return;
  }
  const file = input.files[0];
  if (file.size > 10 * 1024 * 1024) {
    if (preview) preview.innerHTML = '<span class="ff-preview-info" style="color:#ff6b6b;">Файл завеликий (макс 10 МБ)</span>';
    return;
  }
  if (preview) preview.innerHTML = '<span class="ff-preview-info">Обробляємо…</span>';

  const dataUrl = await compressImageToDataUrl(file, 800, 0.8);
  if (!dataUrl) {
    if (preview) preview.innerHTML = '<span class="ff-preview-info" style="color:#ff6b6b;">Не вдалося прочитати файл</span>';
    return;
  }
  window._fineEvidence = dataUrl;
  const sizeKB = Math.round(dataUrl.length * 3 / 4 / 1024);
  if (preview) {
    preview.innerHTML = `
      <img class="ff-preview-img" src="${dataUrl}" alt="доказ">
      <div class="ff-preview-info">${file.name} • ~${sizeKB} КБ</div>
    `;
  }
  if (label) label.textContent = 'Замінити фото';
}


function renderIssueFineForm() {
  const role = getUserIssuerRole();
  window._issueFineRole = role;

  const root = document.getElementById('issue-fine-body');
  if (!root) return;

  if (!role.canIssueDirectly && !role.canSubmitPending) {
    root.innerHTML = `
      <div class="fines-empty">
        <div class="fines-empty-icon">🚫</div>
        <div class="fines-empty-title">Немає прав</div>
        <div class="fines-empty-sub">Виписувати штрафи можуть лише голови фракцій, судді, адміністрація, агенти НПС/СБС/ДБР/НАБС.</div>
      </div>`;
    return;
  }

  const evidenceLabel = role.canIssueDirectly
    ? 'Доказ (PNG/JPG, опційно)'
    : 'Доказ (PNG/JPG) *';

  const evidenceField = `
    <div class="ff-field">
      <span class="ff-label">${evidenceLabel}</span>
      <div class="ff-file-row">
        <label class="ff-file-button" id="fine-evidence-label" for="fine-evidence-file">Обрати фото</label>
        <input id="fine-evidence-file" type="file" accept="image/png,image/jpeg" onchange="handleEvidenceFile(this)" style="display:none;">
      </div>
      <div id="fine-evidence-preview"></div>
    </div>`;

  const note = role.canIssueDirectly
    ? `<div class="ff-hint">Ви виписуєте напряму як <b>${role.label}</b>. Штраф з’явиться у профілі гравця одразу.</div>`
    : `<div class="ff-hint">Ви <b>${role.label}</b>. Штраф піде на <b>затвердження адміністрації</b>. Без скріну доказів штраф не приймуть.</div>`;

  const today = todayPlusDays(0);
  const default30 = todayPlusDays(30);

  root.innerHTML = `
    ${note}
    <label class="ff-field">
      <span class="ff-label">Кому (Telegram username) *</span>
      <input id="fine-target" class="ff-input" type="text" placeholder="username (без @)">
    </label>
    <label class="ff-field">
      <span class="ff-label">Сума, € *</span>
      <input id="fine-amount" class="ff-input" type="number" min="1" step="1" placeholder="100">
    </label>
    <label class="ff-field">
      <span class="ff-label">Оплатити до *</span>
      <input id="fine-due" class="ff-input" type="date" min="${today}" value="${default30}">
    </label>
    <label class="ff-field">
      <span class="ff-label">Причина *</span>
      <textarea id="fine-reason" class="ff-input" rows="3" placeholder="ст. 124 ПДР — перевищення швидкості"></textarea>
    </label>
    ${evidenceField}
    <button type="button" class="ff-submit" onclick="submitFineForm()">${role.canIssueDirectly ? 'Виписати штраф' : 'Надіслати на затвердження'}</button>
    <div id="fine-status-msg" class="ff-status"></div>
  `;
}

async function renderPendingApprovalSection() {
  const root = document.getElementById('fines-pending-list');
  if (!root) return;

  const role = getUserIssuerRole();
  if (!role.canApprove) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = `<div class="fines-loading">Завантажуємо чергу…</div>`;

  let items = [];
  if (typeof window.fetchPendingFines === 'function') {
    try { items = await window.fetchPendingFines(); } catch (e) { console.error(e); }
  }

  if (role.issuerType !== 'admin' && role.issuerType !== 'court') {
    items = items.filter(i => i && i.issuerType === role.issuerType);
  }

  if (!items.length) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = `
    <div class="profile-section-title" style="padding:0 4px 6px;">🕒 На затвердження (${items.length})</div>
    ${items.map(it => {
      const issuer = classifyFineIssuer(it);
      const amount = (it.amount != null && it.amount !== '') ? `${it.amount} €` : '—';
      const due = it.dueDate ? formatExpiryDate(it.dueDate) : '—';
      const evidence = it.evidence
        ? `<img class="fine-evidence-img" src="${it.evidence}" alt="доказ" onclick="openEvidenceFull('${it._pendingId}')">`
        : '<div class="ff-preview-info">⚠️ Без доказу</div>';
      return `
        <div class="fine-card fine-card-pending">
          <div class="fine-card-header">
            <div class="fine-card-num">Штраф ${it.id || '—'}</div>
            <div class="fine-card-status" style="color:#f0a000;">
              <span class="fine-status-dot" style="background:#f0a000;"></span>ОЧІКУЄ
            </div>
          </div>
          <div class="fine-card-row"><span class="fine-card-label">Кому:</span><span class="fine-card-value">@${it.target || '—'}</span></div>
          <div class="fine-card-row"><span class="fine-card-label">Виписав:</span><span class="fine-card-value">${issuer.icon} ${issuer.label}${it.proposedBy ? ' (@' + it.proposedBy + ')' : ''}</span></div>
          <div class="fine-card-row"><span class="fine-card-label">Сума:</span><span class="fine-card-value fine-card-amount">${amount}</span></div>
          <div class="fine-card-row"><span class="fine-card-label">До:</span><span class="fine-card-value">${due}</span></div>
          ${it.reason ? `<div class="fine-card-reason">${it.reason}</div>` : ''}
          <div style="margin-top:6px;">${evidence}</div>
          <div class="fine-actions">
            <button type="button" class="fine-btn fine-btn-approve" onclick="approveFineUI('${it._pendingId}')">✅ Затвердити</button>
            <button type="button" class="fine-btn fine-btn-reject" onclick="rejectFineUI('${it._pendingId}')">❌ Відхилити</button>
          </div>
        </div>`;
    }).join('')}
  `;
}

function openEvidenceFull(pendingId) {
  const img = document.querySelector(`.fine-card-pending img.fine-evidence-img[onclick*="${pendingId}"]`);
  if (!img) return;
  const src = img.getAttribute('src');
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;';
  overlay.innerHTML = `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

async function approveFineUI(pendingId) {
  if (typeof window.approvePendingFine !== 'function') return;
  const approver = window.state && window.state.telegram && window.state.telegram.username;
  const ok = await window.approvePendingFine(pendingId, approver);
  if (ok) {
    showToast && showToast('✅ Штраф затверджено');
    renderPendingApprovalSection();
  } else {
    showToast && showToast('❌ Не вдалося затвердити');
  }
}

async function rejectFineUI(pendingId) {
  if (typeof window.rejectPendingFine !== 'function') return;
  const ok = await window.rejectPendingFine(pendingId);
  if (ok) {
    showToast && showToast('Штраф відхилено');
    renderPendingApprovalSection();
  } else {
    showToast && showToast('❌ Не вдалося відхилити');
  }
}

function applyTheme(name) {
  const t = name === 'dark' ? 'dark' : 'light';
  if (t === 'dark') document.body.classList.add('theme-dark');
  else document.body.classList.remove('theme-dark');
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

function classifyFineIssuer(f) {
  const t = (f.issuerType || '').toLowerCase();
  if (t === 'court' || t === 'judge') return { icon: '⚖️', label: 'Суд' };
  if (t === 'admin' || t === 'administration') return { icon: '🛡️', label: 'Адміністрація' };
  if (t === 'police' || t === 'nps') return { icon: '👮', label: 'НПС' };
  const s = (f.issuer || f.issuedBy || '').toLowerCase();
  if (s.includes('суд')) return { icon: '⚖️', label: f.issuer || 'Суд' };
  if (s.includes('адмін')) return { icon: '🛡️', label: f.issuer || 'Адміністрація' };
  if (s.includes('нпс') || s.includes('сержант') || s.includes('лейтенант') || s.includes('капітан')
      || s.includes('патруль') || s.includes('кадет')) return { icon: '👮', label: f.issuer || 'НПС' };
  return { icon: '📄', label: f.issuer || f.issuedBy || '—' };
}

function isFinePaid(f) {
  const s = String(f.status || '').toLowerCase();
  if (s === 'paid' || s === 'true' || s === '1') return true;
  return s.includes('сплач') && !s.includes('неспл');
}

async function renderFines() {
  const list = document.getElementById('fines-list');
  if (!list) return;

  list.innerHTML = `<div class="fines-loading">Завантаження…</div>`;

  const username = (window.state && window.state.telegram && window.state.telegram.username)
    || (tgUser && tgUser.username);

  let fines = [];
  if (username && typeof window.fetchProfile === 'function') {
    try {
      const profile = await window.fetchProfile(username);
      if (profile && Array.isArray(profile.fines)) fines = profile.fines;
    } catch (e) { console.error(e); }
  }
  if (!fines.length && window.state && Array.isArray(window.state.fines)) {
    fines = window.state.fines;
  }
  if (window.state) window.state.fines = fines;

  let pendingPaymentIds = [];
  if (typeof window.fetchPaymentRequests === 'function') {
    try {
      const reqs = await window.fetchPaymentRequests();
      pendingPaymentIds = reqs
        .filter(r => r && r.username === username)
        .map(r => r.fineId);
    } catch(e) {}
  }

  if (!fines.length) {
    list.innerHTML = `
      <div class="fines-empty">
        <div class="fines-empty-icon">💸</div>
        <div class="fines-empty-title">Штрафів немає</div>
        <div class="fines-empty-sub">Тут зʼявляться штрафи від суду, адміністрації або НПС.</div>
      </div>`;
    return;
  }

  list.innerHTML = fines.map((f, i) => {
    const num = f.id != null ? String(f.id) : String(i + 1);
    const issuer = classifyFineIssuer(f);
    const amount = (f.amount != null && f.amount !== '') ? `${f.amount} €` : '—';
    const due = f.dueDate ? formatExpiryDate(f.dueDate) : (f.due || '—');
    const paid = isFinePaid(f);
    const isPendingPayment = !paid && pendingPaymentIds.includes(f.id);
    const statusLabel = paid ? 'Сплачено' : (isPendingPayment ? 'На перевірці' : 'Несплачено');
    const statusColor = paid ? '#30d158' : (isPendingPayment ? '#f0a000' : '#ff4d4d');
    const reason = f.reason ? `<div class="fine-card-reason">${f.reason}</div>` : '';
    const payBtn = (!paid && !isPendingPayment)
      ? `<div class="fine-actions" style="margin-top:8px;">
           <button type="button" class="fine-btn fine-btn-approve" style="width:100%;" onclick="openPayFineModal('${f.id}', ${f.amount || 0})">💳 Сплатити</button>
         </div>`
      : (isPendingPayment ? `<div class="ff-hint" style="margin-top:8px;font-size:12px;color:#f0a000;">⏳ Чекає підтвердження адміністрації</div>` : '');
    return `
      <div class="fine-card">
        <div class="fine-card-header">
          <div class="fine-card-num">Штраф №${num}</div>
          <div class="fine-card-status" style="color:${statusColor};">
            <span class="fine-status-dot" style="background:${statusColor};"></span>${statusLabel}
          </div>
        </div>
        <div class="fine-card-row">
          <span class="fine-card-label">Виписано:</span>
          <span class="fine-card-value">${issuer.icon} ${issuer.label}</span>
        </div>
        <div class="fine-card-row">
          <span class="fine-card-label">Сума штрафу:</span>
          <span class="fine-card-value fine-card-amount">${amount}</span>
        </div>
        <div class="fine-card-row">
          <span class="fine-card-label">Оплатити до:</span>
          <span class="fine-card-value">${due}</span>
        </div>
        ${reason}
        ${payBtn}
      </div>`;
  }).join('');
}

function loadLicenseInfo(roblox, licenses) {
  const username = roblox.username;
  const display = roblox.display || username;
  const lc = username.toLowerCase();

  let docsHtml = '';
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
        <div class="doc-deco">▌▌▌▐▌▌▐▌</div>
        <div class="doc-item-header">
            <div class="doc-item-type">${meta.type}</div>
            <div class="doc-item-status">
                <div class="status-dot"></div>${meta.status}
            </div>
        </div>
        <div class="doc-item-name">${meta.title}</div>
        <div class="doc-item-info">${infoText}</div>
        <div class="news-ticker-wrap">
          <span class="news-ticker">СіЯ · Сержава і Я · Цифрові документи · Сервер в смартфоні · СіЯ · Сервер і Я · Цифрові документи · Сервер в смартфоні &nbsp;</span>
        </div>
        <div class="doc-item-footer">
            <div class="doc-item-number">${meta.docNumber}</div>
        </div>
    </div>`;
  }

  const idCode = localStorage.getItem('user_id_code') || '—';
  const issuedAt = window.state.issuedAt || null;
  let issuedStr = '—';
  if (issuedAt) {
    const d2 = new Date(issuedAt);
    issuedStr = d2.toLocaleDateString('uk-UA', { day:'2-digit', month:'2-digit', year:'numeric' });
  }
  docData['passport'] = {
    passport: {
      title: 'Паспорт',
      type: 'Паспорт',
      fields: [
        { label: 'ROBLOX NICK', value: roblox.username },
        { label: 'ROBLOX ID', value: roblox.id || '—' },
        { label: 'DISPLAY NAME', value: roblox.display || roblox.username },
        { label: 'ВИДАНО', value: issuedStr },
        { label: 'ID КОД', value: idCode },
      ]
    }
  };
  d['passport'] = docData['passport'];

  docsHtml += `
  <div class="doc-item anim-flip d0" onclick="openDocPage('passport')">
      <div class="doc-deco">▌▌▌▐▌▌▐▌</div>
      <div class="doc-item-header">
          <div class="doc-item-type">Паспорт</div>
          <div class="doc-item-status">
              <div class="status-dot"></div>Дійсний
          </div>
      </div>
      <div class="doc-item-name">Паспорт</div>
      <div class="doc-item-info">${display} · ${username}</div>
      <div class="news-ticker-wrap">
        <span class="news-ticker">СіЯ · Сержава і Я · Цифрові документи · Сервер в смартфоні · СіЯ · Сервер і Я · Цифрові документи · Сервер в смартфоні &nbsp;</span>
      </div>
      <div class="doc-item-footer">
          <div class="doc-item-number">${idCode}</div>
      </div>
  </div>`;
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
        });
    } else if (section && typeof section === 'object') {
      const entryKey = Object.keys(section).find(k => k.toLowerCase() === lc);
      if (!entryKey || entryKey === 'username') continue;
      const data = section[entryKey];
      const meta = buildLicenseDoc(key, data, ctx);
      docsHtml += renderDocCard(key, meta, infoText);
    }
  }

  const container = document.querySelector('.doc-list');
  if (container) {
    container.innerHTML = docsHtml || '<div style="padding:20px;color:#999">Нічого не знайдено</div>';
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

function openDocPage(docId) {
  const raw = docData[docId];
  if (!raw) return;
  const data = raw[docId] ? raw[docId] : raw;
  currentDocId = docId;
  const verr = document.getElementById('viewer-error');
  if (verr) verr.remove();

  const docUrl = getDocUrl(docId);

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
      <button class="doc-action-btn primary" onclick="openModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Поділитись
      </button>
      <button class="doc-action-btn" id="copy-link-btn" onclick="copyDocLink()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Копіювати
      </button>
    </div>

    <div class="doc-link-row animate-in" id="doc-link-row">
      <div class="doc-link-label">Посилання на документ</div>
      <div class="doc-link-value" id="doc-link-value">${docUrl}</div>
    </div>

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

function copyDocLink() {
  const url = getDocUrl(currentDocId);
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
  const url = getDocUrl(currentDocId);
  try {
    await QRCode.toCanvas(canvas, url, { width: 160, margin: 1 });
  } catch(e) {
    console.error('QR error:', e);
  }
}

async function saveDocument() {
  await fetch("https://hurler-reversion-crisped.ngrok-free.dev/save-doc", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      user_id: tgUser.id,
      doc: docData
    })
  });
  showToast("✅ Збережено");
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
  const username = params.get('u') || params.get('user') || null;

  if (!docId || !username) return;

  document.body.classList.add('viewer-mode');
  const splash = document.getElementById('splash');
  if (splash) splash.remove();

  const fetchProfile = await waitFor(() => window.fetchProfile, 6000);
  if (!fetchProfile) {
    showViewerError('Не вдалося завантажити Firebase.');
    return;
  }

  let profile = null;
  try { profile = await fetchProfile(username); } catch (e) { profile = null; }

  if (!profile || !profile.roblox) {
    showViewerError('Документ не знайдено для @' + username + '.');
    return;
  }

  window.state = window.state || {};
  window.state.telegram = { username };
  window.state.roblox = profile.roblox;
  window.state.issuedAt = profile.issuedAt || null;
  window.state.isTgAuth = true;
  window.state.isRbxAuth = true;
  if (profile.idCode) {
    try { localStorage.setItem('user_id_code', profile.idCode); } catch (e) {}
  }

  await waitFor(() => (window.state && window.state.licenses) || window.licenses, 20000);

  const licenses = (window.state && window.state.licenses) || window.licenses;
  if (!licenses) {
    showViewerError('Не вдалося завантажити список ліцензій.');
    return;
  }

  window.state = window.state || {};
  if (!window.state.licenses) window.state.licenses = licenses;

  try {
    docData = loadLicenseInfo(profile.roblox, licenses);
    console.log('[viewer] docData keys after load:', Object.keys(docData).join(','));
  } catch (e) {
    console.error('[viewer] loadLicenseInfo failed:', e && e.message, e && e.stack);
    showViewerError('Не вдалося прочитати ліцензії: ' + (e && e.message || 'невідома помилка'));
    return;
  }

  if (!docData || !docData[docId]) {
    showViewerError('Документ "' + docId + '" недоступний для цього профілю.');
    return;
  }

  openDocPage(docId);
}

function updateIssueFineButtonVisibility() {
  const btn = document.getElementById('btn-issue-fine');
  if (!btn) return;
  const role = getUserIssuerRole();
  btn.style.display = (role.canIssueDirectly || role.canSubmitPending) ? '' : 'none';
}


if (document.body) bootTheme();
else document.addEventListener('DOMContentLoaded', bootTheme);

window.addEventListener('load', () => {
  bootTheme();
  bootViewerMode();
});
