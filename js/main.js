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
  } else {
    screenHistory = [id];
    if (tg && tg.BackButton) tg.BackButton.hide();

    // Рендеримо ліцензії при переході на профіль
    if (id === 'profile') {
      renderProfileLicenses();
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

let docData = {};

function getDocUrl(docId) {
  const base = window.location.origin + window.location.pathname;
  const params = new URLSearchParams();
  params.set('doc', docId);
  // Username is the canonical Firebase key (passports/{username}); always prefer it.
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
  section.className = 'anim-pop d4';
  section.style.cssText = 'margin:16px 16px 0;border-radius:16px;background:var(--bg2,#f5f5f5);overflow:hidden;';

  if (!items.length) {
    section.innerHTML = `
      <div style="padding:16px 16px 6px;font-size:13px;font-weight:700;color:var(--text2,#888);letter-spacing:.04em;text-transform:uppercase;">📄 Мої ліцензії</div>
      <div style="padding:0 16px 16px;font-size:14px;color:var(--text2,#888);">Ліцензій не знайдено</div>`;
  } else {
    const rows = items.map(item => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border,rgba(0,0,0,.06));">
        <span style="font-size:20px;flex-shrink:0;line-height:1.3">${item.icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--text1,#111);">${item.label}</div>
          <div style="font-size:12px;color:var(--text2,#888);margin-top:2px;white-space:pre-line;">${item.extra}</div>
          ${item.code ? `<div style="font-size:12px;color:var(--text2,#888);margin-top:2px;">Код: <span style="font-family:monospace;font-weight:600;color:var(--accent,#007aff)">${item.code}</span></div>` : ''}
        </div>
      </div>`).join('');

    section.innerHTML = `
      <div style="padding:16px 16px 6px;font-size:13px;font-weight:700;color:var(--text2,#888);letter-spacing:.04em;text-transform:uppercase;">📄 Мої ліцензії</div>
      ${rows}
      <div style="height:4px;"></div>`;
  }

  const logoutBtn = scrollArea.querySelector('.profile-logout');
  if (logoutBtn) {
    scrollArea.insertBefore(section, logoutBtn);
  } else {
    scrollArea.appendChild(section);
  }
}

function loadLicenseInfo(roblox, licenses) {
  const username = roblox.username;
  const display = roblox.display || username;
  const lc = username.toLowerCase();

  let docsHtml = '';
  let animDelay = 0;
  let d = {};

  function generateDocHtml(id, type, title, status, infoText, docNumber, rawData) {
    const delayClass = `d${animDelay % 5}`;
    animDelay++;

    docData[id] = {
      [id]: {
        title,
        type,
        fields: Object.entries(rawData || {}).map(([k, v]) => ({
          label: k,
          value: v
        }))
      }
    };
    d[id] = docData[id];
    return `
    <div class="doc-item anim-flip ${delayClass}" onclick="openDocPage('${id}')">
        <div class="doc-deco">▌▌▌▐▌▌▐▌</div>
        <div class="doc-item-header">
            <div class="doc-item-type">${type}</div>
            <div class="doc-item-status">
                <div class="status-dot"></div>${status}
            </div>
        </div>
        <div class="doc-item-name">${title}</div>
        <div class="doc-item-info">${infoText}</div>
        <div class="news-ticker-wrap">
          <span class="news-ticker">СіЯ · Сержава і Я · Цифрові документи · Сервер в смартфоні · СіЯ · Сервер і Я · Цифрові документи · Сервер в смартфоні &nbsp;</span>
        </div>
        <div class="doc-item-footer">
            <div class="doc-item-number">${docNumber}</div>
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

  for (const [key, section] of Object.entries(licenses)) {
    const lowerKey = key.toLowerCase();
    if (Array.isArray(section)) {
      section
        .filter(item => item.username?.toLowerCase() === lc)
        .forEach((item, index) => {
          const id = `${key}_${index}`;
          docsHtml += generateDocHtml(
            id, 'Документ',
            item.role || key,
            item.cans ? 'Скасовано' : 'Дійсний',
            `${display} · ${username}`,
            item.status || item.telegram || '—',
            item
          );
        });
    } else if (typeof section === 'object') {
      const entryKey = Object.keys(section).find(k => k.toLowerCase() === lc);
      if (!entryKey) continue;
      const data = section[entryKey];
      let type = 'Документ';
      let title = key;
      let docNumber = data.status || data.telegram || '—';
      if (lowerKey === 'weapon') { type = 'Ліцензія'; title = 'Ліцензія на зброю'; }
      if (lowerKey === 'police') { type = 'Посвідчення'; title = 'Посвідчення НПС'; docNumber = getPoliceRank(data.role); }
      const id = key;
      docsHtml += generateDocHtml(id, type, title, data.cans ? 'Скасовано' : 'Дійсний', `${display} · ${username}`, docNumber, data);
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
  // QR тепер містить пряме посилання на документ
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
  if (!docId) return;
  const username = params.get('u') || params.get('user') || null;

  document.body.classList.add('viewer-mode');
  const splash = document.getElementById('splash');
  if (splash) splash.remove();

  if (!username) {
    showViewerError('Посилання неповне: відсутній власник документа.');
    return;
  }

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

  await waitFor(() => window.state && window.state.licenses, 8000);

  if (window.state.licenses) {
    try { docData = loadLicenseInfo(profile.roblox, window.state.licenses); } catch (e) { console.error(e); }
  }

  if (!docData || !docData[docId]) {
    showViewerError('Документ "' + docId + '" недоступний для цього профілю.');
    return;
  }

  openDocPage(docId);
}

window.addEventListener('load', () => {
  bootViewerMode();
});
