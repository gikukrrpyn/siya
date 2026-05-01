
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

function getPoliceRank(xpString) {     if (!xpString) return "Невідомо";     if (isNaN(parseInt(xpString))) return xpString;     const xp = parseInt(xpString.replace(/\s/g, ''), 10);     if (xp <= 2999) return "Кадет";     if (xp <= 5999) return "Молодший патрульний";     if (xp <= 9999) return "Патрульний";     if (xp <= 12999) return "Старший патрульний";     if (xp <= 15499) return "Молодший сержант";     if (xp <= 18499) return "Сержант";     if (xp <= 21999) return "Старший сержант";     if (xp <= 25999) return "Лейтенант";     if (xp <= 29999) return "Капітан";     if (xp <= 34999) return "Ветеран";     if (xp <= 44999) return "Комісар";     if (xp <= 59999) return "Полковник";     return "Генерал"; }
let docData = {};
function loadLicenseInfo(roblox, licenses) {
    const username = roblox.username;
    const display = roblox.display || username;
    const lc = username.toLowerCase();

    let docsHtml = '';
    let animDelay = 0;
    let d = null;
    function generateDocHtml(id, type, title, status, infoText, docNumber, rawData) {
        const delayClass = `d${animDelay % 5}`;
        animDelay++;
        
        d = docData[id] = {
            [id]: {
                title,
                type,
                fields: Object.entries(rawData || {}).map(([k, v]) => ({
                    label: k,
                    value: v
                }))
            }
        };
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
                        id,
                        'Документ',
                        item.role || key,
                        item.cans ? 'Скасовано' : 'Дійсний',
                        `${display} · ${username}`,
                        item.status || item.telegram || '—',
                        item
                    );
                });
        }

        else if (typeof section === 'object') {
            const entryKey = Object.keys(section).find(
                k => k.toLowerCase() === lc
            );

            if (!entryKey) continue;

            const data = section[entryKey];

            let type = 'Документ';
            let title = key;
            let docNumber = data.status || data.telegram || '—';

            if (lowerKey === 'weapon') {
                type = 'Ліцензія';
                title = 'Ліцензія на зброю';
            }

            if (lowerKey === 'police') {
                type = 'Посвідчення';
                title = 'Посвідчення НПС';
                docNumber = getPoliceRank(data.role);
            }

            const id = key;

            docsHtml += generateDocHtml(
                id,
                type,
                title,
                data.cans ? 'Скасовано' : 'Дійсний',
                `${display} · ${username}`,
                docNumber,
                data
            );
        }
    }

    const container = document.querySelector('.doc-list');
    if (container) {
        container.innerHTML =
            docsHtml || '<div style="padding:20px;color:#999">Нічого не знайдено</div>';
    }
    return d;
}

const checkRobloxData = setInterval(() => {
    if (window.state && window.state.roblox && window.licenses) {
        docData = loadLicenseInfo(window.state.roblox, window.licenses);
        clearInterval(checkRobloxData);
    }
}, 500);

function openDocPage(docId) {
  const data = docData[docId];
  if (!data) return;
  currentDocId = docId;
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
      <button class="doc-action-btn" onclick="showToast('📥 Зберігаємо...')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Зберегти
      </button>
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

  const res = await fetch("https://hurler-reversion-crisped.ngrok-free.dev/generate", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      user_id: tgUser?.id,
      doc_id: currentDocId
    })
  });

  const data = await res.json();

  await QRCode.toCanvas(canvas, data.url, { width: 160 });
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
  document.getElementById('splash').classList.add('hidden');
  setTimeout(() => document.getElementById('splash').remove(), 600);
}, 1600);

document.getElementById('screen-home').style.transform = 'translateX(0)';

// ойбаля
