import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  collection, addDoc, onSnapshot, query, where, limit,
  serverTimestamp, increment, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWW0hSO-kb8B8hFt2M1mSpsq8gVbPxFAQ",
  authDomain: "nbsur-cf108.firebaseapp.com",
  projectId: "nbsur-cf108",
  storageBucket: "nbsur-cf108.firebasestorage.app",
  messagingSenderId: "223476840819",
  appId: "1:223476840819:web:4af79db89af4f560a6ad06"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

/* Діапазон сум для внеску та виводу (€) */
const MIN_AMT = 1000;
const MAX_AMT = 8000;

/* ============================================================================
   Categories — fixed slot order, never cycled. Past slot 6 → "Інше".
   Colors are the validated dark-mode categorical steps (see nbu.css).
   ========================================================================== */
const CATEGORIES = {
  transfer:  { name: 'Перекази',   color: 'var(--series-1)', icon: 'fa-paper-plane' },
  withdraw:  { name: 'Виведення',  color: 'var(--series-2)', icon: 'fa-arrow-up' },
  service:   { name: 'Послуги',    color: 'var(--series-3)', icon: 'fa-bolt' },
  fine:      { name: 'Штрафи',     color: 'var(--series-4)', icon: 'fa-triangle-exclamation' },
  contract:  { name: 'Контракти',  color: 'var(--series-5)', icon: 'fa-file-signature' },
  jar:       { name: 'Банки',      color: 'var(--series-6)', icon: 'fa-piggy-bank' },
  other:     { name: 'Інше',       color: 'var(--series-other)', icon: 'fa-ellipsis' }
};

/* ============================================================================
   State
   ========================================================================== */
window.NBS_STATE = {
  user: { username: localStorage.getItem('currentUser') || 'ROBLOX CITIZEN', isAdmin: false, exactAdminName: null },
  balanceUC: 0,          // total money on the card (jar reservations included)
  cardNumber: '•••• •••• •••• ••••',
  cardExpiry: '12/28',
  cvv: '•••',
  frozen: false,
  limit: 0,
  jars: [],
  transactions: [],
  myRequests: [],
  requests: [],          // admin: pending
  requestsDone: [],      // admin: processed
  screenshotBase64: null,
  cardLoaded: false,
  txLoaded: false,
  ui: { tab: 'home', historyFilter: 'all', historyQuery: '', monthOffset: 0, adminFilter: 'pending' }
};
const S = window.NBS_STATE;

/* Money reserved inside jars is not spendable. */
const reserved  = () => S.jars.reduce((a, j) => a + (j.balance || 0), 0);
const available = () => Math.max(0, (S.balanceUC || 0) - reserved());

/* ============================================================================
   Utils
   ========================================================================== */
const nf = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 2 });
const num   = v => nf.format(Number(v) || 0);
const money = v => num(v) + ' €';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  return null;
}

const dfDay      = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long' });
const dfDayYear  = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
const dfTime     = new Intl.DateTimeFormat('uk-UA', { hour: '2-digit', minute: '2-digit' });
const dfFull     = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dfMonth    = new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' });

const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function dayLabel(d) {
  const now = new Date();
  const today = dayKey(now);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (dayKey(d) === today) return 'Сьогодні';
  if (dayKey(d) === dayKey(y)) return 'Вчора';
  return d.getFullYear() === now.getFullYear() ? dfDay.format(d) : dfDayYear.format(d);
}

function haptic(ms = 8) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* unsupported */ }
}

window.showToast = function (msg, kind = 'ok') {
  const t = document.getElementById('toastPopup');
  const icon = t.querySelector('i');
  icon.className = kind === 'err' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
  t.classList.remove('ok', 'err');
  t.classList.add(kind);
  document.getElementById('toastMsg').innerText = msg;
  t.classList.add('active');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('active'), 2800);
};
const fail = msg => showToast(msg, 'err');

window.copyText = async function (text, okMsg = 'Скопійовано') {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e2) { fail('Не вдалось скопіювати'); ta.remove(); return; }
    ta.remove();
  }
  haptic();
  showToast(okMsg);
};

function busy(btn, on, htmlWhenIdle) {
  if (!btn) return;
  if (on) {
    btn._idle = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Обробка…';
  } else {
    btn.disabled = false;
    btn.innerHTML = htmlWhenIdle || btn._idle || btn.innerHTML;
  }
}

/* Category resolution — new records carry `category`; older ones are inferred. */
function catOf(tx) {
  if (tx.category && CATEGORIES[tx.category]) return tx.category;
  const t = ((tx.title || '') + ' ' + (tx.sub || '')).toLowerCase();
  if (tx.type === 'jar' || /банк[аи]|скарбничк/.test(t)) return 'jar';
  if (/штраф|фін[аи]/.test(t)) return 'fine';
  if (/контракт|зарплат|оклад/.test(t)) return 'contract';
  if (/api|послуг|оплата послуг|підписк/.test(t)) return 'service';
  if (tx.type === 'transfer') return 'transfer';
  if (tx.type === 'withdraw') return 'withdraw';
  return 'other';
}

function txIconClass(tx) {
  if (tx.type === 'jar') return 'jar';
  if (tx.type === 'deposit') return 'deposit';
  if (tx.type === 'transfer') return 'transfer';
  return 'withdraw';
}
function txIcon(tx) {
  if (tx.type === 'jar') return 'fa-piggy-bank';
  if (tx.type === 'deposit') return 'fa-arrow-down';
  if (tx.type === 'transfer') return 'fa-paper-plane';
  return 'fa-arrow-up';
}

/* ============================================================================
   Public API for other SiYa ecosystem apps
   ========================================================================== */
window.NBSApi = {
  getBalance() {
    return { uc: available(), eur: available(), total: S.balanceUC, reserved: reserved() };
  },

  requestPayment(params) {
    if (!params || !params.amount) return Promise.reject('Invalid payment parameters');
    document.getElementById('trfAmount').value = params.amount;
    if (params.recipient) document.getElementById('trfTarget').value = params.recipient;
    openModal('modalTransfer');
    return Promise.resolve({ status: 'initiated', txId: 'NBS-EXT-' + Math.floor(Math.random() * 900000) });
  },

  async processDirectPayment(params) {
    if (!params || !params.amount || !params.cvv) return { success: false, error: 'Missing amount or cvv' };
    if (String(params.cvv) !== String(S.cvv))     return { success: false, error: 'Invalid CVV' };
    if (S.frozen)                                 return { success: false, error: 'Card is frozen' };
    const amount = Number(params.amount);
    if (!(amount > 0))                            return { success: false, error: 'Invalid amount' };
    if (S.limit > 0 && amount > S.limit)          return { success: false, error: 'Amount exceeds card limit' };
    if (amount > available())                     return { success: false, error: 'Insufficient funds' };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'cards', S.user.username), { balanceUC: increment(-amount) });
      batch.set(doc(collection(db, 'transactions')), {
        userId: S.user.username,
        type: 'withdraw',
        category: 'service',
        title: params.title || 'Оплата послуг',
        sub: 'Списання через API' + (params.merchant ? ' · ' + params.merchant : ''),
        amount: -amount,
        status: 'completed',
        timestamp: serverTimestamp()
      });
      await batch.commit();
      return { success: true, txId: 'EXT-' + Math.floor(100000 + Math.random() * 900000) };
    } catch (e) {
      console.error(e);
      return { success: false, error: 'Transaction failed' };
    }
  }
};

if (window.parent && window.parent !== window) {
  try { window.parent.NBSApi = window.NBSApi; } catch (e) { /* cross-origin */ }
}

window.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type || !data.id) return;
  const reply = payload => event.source && event.source.postMessage({ id: data.id, ...payload }, '*');

  if (data.type === 'NBS_GET_BALANCE') {
    reply({ response: window.NBSApi.getBalance() });
  } else if (data.type === 'NBS_REQUEST_PAYMENT') {
    try { reply({ response: await window.NBSApi.requestPayment(data.payload) }); }
    catch (e) { reply({ error: String(e) }); }
  } else if (data.type === 'NBS_PROCESS_DIRECT_PAYMENT') {
    reply({ response: await window.NBSApi.processDirectPayment(data.payload) });
  }
});

/* ============================================================================
   Boot
   ========================================================================== */
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);

  if (!localStorage.getItem('currentUser')) {
    window.location.href = `../index.html?action=siya_auth&return_url=nbu/index.html`;
    return;
  }

  S.user.username = localStorage.getItem('currentUser');

  if (urlParams.has('user') || urlParams.has('status')) {
    // Legacy/insecure params are never trusted — strip them once read by checkSiYaReturn.
  }

  renderIdentity();
  renderRecentSkeleton();
  renderJarsSkeleton();

  // Auth must land before anything reads Firestore — config/admins itself
  // requires a signed-in request.
  onAuthStateChanged(auth, async (user) => {
    if (!user || window.listenersInitialized) return;
    window.listenersInitialized = true;
    await verifyAdmin();
    initFirestoreListeners();
    checkSiYaReturn();
  });

  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.warn('Auth warning', e);
    fail('Немає зʼєднання з НБС');
  }

  initCarouselDots();
});

/* Admin status comes from the DB only — never from window.parent or the URL. */
async function verifyAdmin() {
  try {
    const adminDoc = await getDoc(doc(db, 'config', 'admins'));
    if (adminDoc.exists()) {
      const list = adminDoc.data().list || [];
      const match = list.find(a => String(a).toLowerCase() === S.user.username.toLowerCase());
      if (match) { S.user.isAdmin = true; S.user.exactAdminName = match; }
    }
  } catch (e) {
    console.warn('Admin config unavailable');
  }

  if (S.user.isAdmin) {
    document.getElementById('adminToggleBtn').classList.remove('hidden');
    document.getElementById('moreAdminRow').classList.remove('hidden');
    document.getElementById('profileBadge').innerHTML =
      '<i class="fa-solid fa-user-shield"></i> Модератор НБС';
  }
}

function renderIdentity() {
  const avatar = localStorage.getItem('currentUserAvatar') || '../png/ciyablack.png';
  const name = S.user.username;

  document.getElementById('headerUserProfile').innerHTML = `
    <img class="header-user-avatar" src="${esc(avatar)}" alt="" onerror="this.src='../png/ciyablack.png'">
    <div class="header-user-meta">
      <div class="header-user-name">${esc(name)}</div>
      <div class="header-user-sub">Особистий рахунок НБС</div>
    </div>`;

  document.getElementById('profileAvatar').src = avatar;
  document.getElementById('profileAvatar').onerror = function () { this.src = '../png/ciyablack.png'; };
  document.getElementById('profileName').innerText = name;
  document.getElementById('cardHolder').innerText = name.toUpperCase();
}

/* ============================================================================
   Firestore listeners
   ========================================================================== */
function initFirestoreListeners() {
  const cardRef = doc(db, 'cards', S.user.username);

  onSnapshot(cardRef, (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      S.balanceUC  = d.balanceUC || 0;
      S.cardNumber = d.cardNumber || '•••• •••• •••• ••••';
      S.cardExpiry = d.cardExpiry || '12/28';
      S.frozen     = !!d.frozen;
      S.limit      = d.limit || 0;

      if (!d.cvv) {
        const newCvv = String(Math.floor(100 + Math.random() * 900));
        updateDoc(cardRef, { cvv: newCvv }).catch(() => {});
        S.cvv = newCvv;
      } else {
        S.cvv = d.cvv;
      }
      if (!d.cardExpiry) updateDoc(cardRef, { cardExpiry: S.cardExpiry }).catch(() => {});
    } else {
      const initCvv = String(Math.floor(100 + Math.random() * 900));
      const grp = () => String(Math.floor(1000 + Math.random() * 9000));
      setDoc(cardRef, {
        balanceUC: 0,
        cardNumber: `4441 ${grp()} ${grp()} ${grp()}`,
        cardExpiry: '12/28',
        cvv: initCvv,
        frozen: false,
        limit: 0,
        ownerUid: auth.currentUser ? auth.currentUser.uid : 'anon',
        createdAt: serverTimestamp()
      }).catch(e => console.error('Card create failed', e));
      S.cvv = initCvv;
    }
    S.cardLoaded = true;
    renderCard();
    renderMore();
  }, (err) => {
    console.error('Card error:', err);
    fail('Не вдалось прочитати картку');
  });

  // Own transactions
  onSnapshot(query(collection(db, 'transactions'), where('userId', '==', S.user.username)), (snap) => {
    S.transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    S.txLoaded = true;
    renderAllLists();
  }, (err) => {
    console.error('Transactions error:', err);
    S.txLoaded = true;
    renderAllLists();
    if (err.code === 'permission-denied') fail('Помилка прав доступу (Firestore Rules)');
  });

  // Own deposit requests (so pending/rejected ones are visible in history)
  onSnapshot(query(collection(db, 'requests'), where('userId', '==', S.user.username)), (snap) => {
    S.myRequests = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAllLists();
  }, (err) => console.warn('My requests error:', err));

  // Jars — queried by ownerUid so the query matches the security rule exactly.
  onSnapshot(query(collection(db, 'jars'), where('ownerUid', '==', auth.currentUser.uid)), (snap) => {
    S.jars = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (toDate(a.createdAt)?.getTime() || 0) - (toDate(b.createdAt)?.getTime() || 0));
    renderCard();
    renderJars();
  }, (err) => {
    console.warn('Jars error:', err);
    S.jars = [];
    renderJars();
  });

  if (S.user.isAdmin) {
    onSnapshot(query(collection(db, 'requests'), where('status', '==', 'pending')), (snap) => {
      S.requests = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.timestamp)?.getTime() || 0) - (toDate(a.timestamp)?.getTime() || 0));
      renderAdminBadge();
      if (document.getElementById('modalAdmin').classList.contains('active')) loadAdminRequests();
    }, (err) => console.error('Admin requests error:', err));

    onSnapshot(query(collection(db, 'requests'), where('status', 'in', ['completed', 'rejected']), limit(60)), (snap) => {
      S.requestsDone = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.processedAt || b.timestamp)?.getTime() || 0) - (toDate(a.processedAt || a.timestamp)?.getTime() || 0));
      if (S.ui.adminFilter === 'history' && document.getElementById('modalAdmin').classList.contains('active')) loadAdminRequests();
    }, (err) => console.warn('Admin history error:', err));
  }
}

/* ============================================================================
   Combined feed: real transactions + own pending/rejected deposit/withdraw requests
   ========================================================================== */
function feed() {
  const items = S.transactions.map(t => ({ ...t, _kind: 'tx' }));

  S.myRequests.forEach(r => {
    if (r.status === 'completed') return; // already mirrored as a real transaction
    const isWithdraw = r.type === 'withdraw';
    items.push({
      id: r.id,
      _kind: 'req',
      userId: r.userId,
      type: isWithdraw ? 'withdraw' : 'deposit',
      category: isWithdraw ? 'withdraw' : 'other',
      title: isWithdraw ? 'Виведення коштів' : 'Поповнення рахунку',
      sub: r.status === 'rejected'
        ? (isWithdraw ? 'Відхилено · кошти повернуто' : 'Відхилено модератором')
        : 'Очікує перевірки НБС',
      amount: isWithdraw ? -r.amount : r.amount,
      status: r.status || 'pending',
      img: r.img || null,
      timestamp: r.timestamp
    });
  });

  // Records still waiting on serverTimestamp() sort to the top as "just now".
  const at = x => { const d = toDate(x.timestamp); return d ? d.getTime() : Number.MAX_SAFE_INTEGER; };
  return items.sort((a, b) => at(b) - at(a));
}

/* ============================================================================
   Render — card & carousel
   ========================================================================== */
function renderCard() {
  document.getElementById('cardBalanceVal').innerText = num(available());
  document.getElementById('cardNumberDisplay').innerText = maskCard(S.cardNumber);
  document.getElementById('cardBackNumber').innerText = S.cardNumber;
  document.getElementById('cardExpiry').innerText = S.cardExpiry;
  document.getElementById('cardCvvDisplay').innerText = 'CVV ' + S.cvv;
  document.getElementById('cardHolder').innerText = S.user.username.toUpperCase();
  document.getElementById('mainCardScene').classList.toggle('frozen', S.frozen);

  document.getElementById('totalBalanceVal').innerText = money(S.balanceUC);
  document.getElementById('witAvail').innerText = money(available());
  document.getElementById('trfAvail').innerText = money(available());

  document.getElementById('reqHolder').innerText = S.user.username;
  document.getElementById('reqNumber').innerText = S.cardNumber;
  document.getElementById('reqExpiry').innerText = S.cardExpiry;

  renderCarouselJars();
}

function maskCard(n) {
  const digits = String(n).replace(/\D/g, '');
  if (digits.length < 8) return String(n);
  return `${digits.slice(0, 4)} •••• •••• ${digits.slice(-4)}`;
}

function jarPct(j) {
  if (!j.goal || j.goal <= 0) return 0;
  return Math.min(100, Math.round(((j.balance || 0) / j.goal) * 100));
}

function renderCarouselJars() {
  const host = document.getElementById('carouselJars');
  if (!host) return;
  host.innerHTML = S.jars.map(j => `
    <div class="jar-tile" onclick="openJar('${esc(j.id)}')">
      <div class="jar-tile-head">
        <div>
          <div class="jar-tile-title">${esc(j.name)}</div>
          <div class="jar-tile-sub">${j.goal > 0 ? 'Ціль ' + esc(money(j.goal)) : 'Без цілі'}</div>
        </div>
        ${j.goal > 0
          ? `<div class="ring" style="--p:${jarPct(j)}" data-p="${jarPct(j)}%"></div>`
          : `<div class="lr-icon amber" style="width:44px;height:44px;border-radius:50%"><i class="fa-solid fa-piggy-bank"></i></div>`}
      </div>
      <div>
        <div class="jar-tile-amount">${esc(money(j.balance || 0))}</div>
        <div class="jar-tile-goal">${j.goal > 0 ? 'Залишилось ' + esc(money(Math.max(0, j.goal - (j.balance || 0)))) : 'Накопичення'}</div>
      </div>
    </div>`).join('');
  updateDots();
}

function initCarouselDots() {
  const car = document.getElementById('cardsCarousel');
  if (!car) return;
  car.addEventListener('scroll', () => {
    clearTimeout(car._t);
    car._t = setTimeout(updateDots, 60);
  }, { passive: true });
  updateDots();
}

function tiles() {
  const car = document.getElementById('cardsCarousel');
  return car ? Array.from(car.querySelectorAll('.card-scene, .jar-tile, .add-tile')) : [];
}

function updateDots() {
  const car = document.getElementById('cardsCarousel');
  const dots = document.getElementById('carouselDots');
  if (!car || !dots) return;
  const list = tiles();
  const center = car.scrollLeft + car.clientWidth / 2;
  let active = 0, best = Infinity;
  list.forEach((el, i) => {
    const c = el.offsetLeft + el.offsetWidth / 2;
    const d = Math.abs(c - center);
    if (d < best) { best = d; active = i; }
  });
  dots.innerHTML = list.map((_, i) => `<i class="${i === active ? 'on' : ''}"></i>`).join('');
}

window.flipCard = function () {
  haptic();
  document.getElementById('cardObject').classList.toggle('is-flipped');
};

/* ============================================================================
   Render — transaction lists
   ========================================================================== */
function renderRecentSkeleton() {
  document.getElementById('recentList').innerHTML = Array.from({ length: 4 }).map(() => `
    <div class="skeleton-row">
      <div class="sk circle"></div>
      <div style="flex:1; display:flex; flex-direction:column; gap:7px">
        <div class="sk line" style="width:52%"></div>
        <div class="sk line" style="width:32%; height:9px"></div>
      </div>
      <div class="sk line" style="width:56px"></div>
    </div>`).join('');
}

function renderJarsSkeleton() {
  document.getElementById('jarsList').innerHTML = Array.from({ length: 2 }).map(() => `
    <div class="skeleton-row">
      <div class="sk circle"></div>
      <div style="flex:1; display:flex; flex-direction:column; gap:7px">
        <div class="sk line" style="width:44%"></div>
        <div class="sk line" style="width:28%; height:9px"></div>
      </div>
    </div>`).join('');
}

function txRowHtml(tx) {
  const isVoid = tx.status === 'rejected';
  const cls = isVoid ? 'void' : (tx.amount >= 0 ? 'plus' : 'minus');
  const sign = tx.amount > 0 ? '+' : '';
  const badge = tx.status === 'completed' ? '' :
    `<span class="tx-status-badge status-${esc(tx.status)}">${tx.status === 'pending' ? 'Очікує' : 'Відхилено'}</span>`;

  return `
    <div class="tx-item" onclick="openTx('${esc(tx._kind)}','${esc(tx.id)}')">
      <div class="tx-left">
        <div class="tx-icon-box ${txIconClass(tx)}"><i class="fa-solid ${txIcon(tx)}"></i></div>
        <div class="tx-details">
          <div class="tx-title">${esc(tx.title || 'Операція')}</div>
          <div class="tx-subtitle">${esc(tx.sub || CATEGORIES[catOf(tx)].name)}</div>
        </div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${cls}">${sign}${esc(money(tx.amount || 0))}</div>
        ${badge}
      </div>
    </div>`;
}

function groupedHtml(items) {
  const groups = [];
  let cur = null;
  items.forEach(tx => {
    const d = toDate(tx.timestamp);
    const key = d ? dayKey(d) : 'pending-write';
    if (!cur || cur.key !== key) {
      cur = { key, label: d ? dayLabel(d) : 'Зараз', items: [], sum: 0 };
      groups.push(cur);
    }
    cur.items.push(tx);
    if (tx.status !== 'rejected') cur.sum += (tx.amount || 0);
  });

  return groups.map(g => `
    <div class="tx-day-header">
      <span class="d-name">${esc(g.label)}</span>
      <span class="d-sum">${g.sum >= 0 ? '+' : ''}${esc(money(g.sum))}</span>
    </div>
    ${g.items.map(txRowHtml).join('')}`).join('');
}

function emptyHtml(icon, title, sub) {
  return `<div class="empty-state">
    <i class="fa-solid ${icon}"></i>
    <div class="es-title">${esc(title)}</div>
    <div class="es-sub">${esc(sub)}</div>
  </div>`;
}

function renderAllLists() {
  renderRecent();
  renderHistory();
  renderStats();
}

function renderRecent() {
  const el = document.getElementById('recentList');
  if (!S.txLoaded) return;
  const items = feed().slice(0, 6);
  el.innerHTML = items.length
    ? groupedHtml(items)
    : emptyHtml('fa-receipt', 'Операцій ще немає', 'Поповніть рахунок або отримайте переказ — усе зʼявиться тут.');
}

function matchesFilter(tx) {
  const f = S.ui.historyFilter;
  if (f === 'in') return (tx.amount || 0) > 0 && tx.status !== 'rejected';
  if (f === 'out') return (tx.amount || 0) < 0 && tx.status !== 'rejected';
  if (f === 'pending') return tx.status === 'pending';
  return true;
}

function matchesQuery(tx) {
  const q = S.ui.historyQuery.trim().toLowerCase();
  if (!q) return true;
  const hay = `${tx.title || ''} ${tx.sub || ''} ${CATEGORIES[catOf(tx)].name} ${Math.abs(tx.amount || 0)}`.toLowerCase();
  return hay.includes(q);
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!el) return;
  if (!S.txLoaded) {
    el.innerHTML = '<div class="skeleton-row"><div class="sk circle"></div><div style="flex:1"><div class="sk line" style="width:50%"></div></div></div>';
    return;
  }
  const items = feed().filter(t => matchesFilter(t) && matchesQuery(t));
  if (!items.length) {
    el.innerHTML = S.ui.historyQuery
      ? emptyHtml('fa-magnifying-glass', 'Нічого не знайдено', 'Спробуйте іншу назву або суму.')
      : emptyHtml('fa-clock-rotate-left', 'Тут порожньо', 'За цим фільтром операцій немає.');
    return;
  }
  el.innerHTML = groupedHtml(items);
}

/* ============================================================================
   Render — statistics
   ========================================================================== */
function monthWindow(offset) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start, end };
}

function renderStats() {
  const { start, end } = monthWindow(S.ui.monthOffset);
  document.getElementById('statMonthLabel').innerText = dfMonth.format(start);
  document.getElementById('statMonthNext').disabled = S.ui.monthOffset >= 0;

  const items = S.transactions.filter(t => {
    const d = toDate(t.timestamp);
    return d && d >= start && d < end && t.status === 'completed';
  });

  let inc = 0, out = 0;
  const byCat = {};
  items.forEach(t => {
    const a = t.amount || 0;
    if (a >= 0) { inc += a; return; }
    out += -a;
    const c = catOf(t);
    byCat[c] = (byCat[c] || 0) + (-a);
  });

  document.getElementById('statSpent').innerText = money(out);
  document.getElementById('statIn').innerText = money(inc);
  document.getElementById('statOut').innerText = money(out);

  const list = document.getElementById('catList');
  const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  if (!rows.length) {
    list.innerHTML = `<div class="form-hint" style="text-align:center; padding:6px 0">
      За ${esc(dfMonth.format(start))} витрат не було.</div>`;
    return;
  }

  // Cap at the 6 fixed categorical slots; everything else folds into "Інше".
  const top = rows.slice(0, 6);
  const restSum = rows.slice(6).reduce((a, r) => a + r[1], 0);
  if (restSum > 0) {
    const i = top.findIndex(r => r[0] === 'other');
    if (i >= 0) top[i][1] += restSum; else top.push(['other', restSum]);
  }

  const max = Math.max(...top.map(r => r[1]));
  list.innerHTML = top.map(([key, val]) => {
    const c = CATEGORIES[key] || CATEGORIES.other;
    const pct = out > 0 ? Math.round((val / out) * 100) : 0;
    return `
      <div class="cat-row">
        <div class="cat-row-top">
          <span class="cat-swatch" style="background:${c.color}"></span>
          <span class="cat-name">${esc(c.name)}</span>
          <span class="cat-pct">${pct}%</span>
          <span class="cat-val">${esc(money(val))}</span>
        </div>
        <div class="meter"><span style="width:${Math.max(2, (val / max) * 100)}%; background:${c.color}"></span></div>
      </div>`;
  }).join('');
}

window.shiftMonth = function (delta) {
  const next = S.ui.monthOffset + delta;
  if (next > 0) return;
  S.ui.monthOffset = next;
  haptic();
  renderStats();
};

/* ============================================================================
   Render — jars screen
   ========================================================================== */
function renderJars() {
  document.getElementById('jarsTotal').innerText = money(reserved());

  const el = document.getElementById('jarsList');
  if (!S.jars.length) {
    el.innerHTML = emptyHtml('fa-piggy-bank', 'Банок ще немає',
      'Банка — це відкладені кошти на картці. Вони не витрачаються на перекази, поки ви не заберете їх назад.');
    return;
  }

  el.innerHTML = S.jars.map(j => {
    const pct = jarPct(j);
    return `
      <div class="list-row" onclick="openJar('${esc(j.id)}')">
        ${j.goal > 0
          ? `<div class="ring" style="--p:${pct}; width:40px; height:40px" data-p="${pct}%"></div>`
          : `<div class="lr-icon amber"><i class="fa-solid fa-piggy-bank"></i></div>`}
        <div class="lr-body">
          <div class="lr-title">${esc(j.name)}</div>
          <div class="lr-sub">${j.goal > 0
            ? `${esc(money(j.balance || 0))} з ${esc(money(j.goal))}`
            : 'Без цілі'}</div>
        </div>
        <span class="lr-value">${esc(money(j.balance || 0))}</span>
        <i class="fa-solid fa-chevron-right lr-chev"></i>
      </div>`;
  }).join('');
}

/* ============================================================================
   Render — more screen
   ========================================================================== */
function renderMore() {
  document.getElementById('freezeSwitch').classList.toggle('on', S.frozen);
  document.getElementById('limitValue').innerText = S.limit > 0 ? money(S.limit) : 'Без ліміту';
  document.getElementById('limitInput').value = S.limit > 0 ? S.limit : '';
}

function renderAdminBadge() {
  const n = S.requests.length;
  const badge = document.getElementById('adminBadgeCount');
  badge.innerText = n > 99 ? '99+' : n;
  badge.classList.toggle('hidden', n === 0);
  document.getElementById('moreAdminCount').innerText = n;
  document.getElementById('adminPendingLabel').innerText = `${n} очікує`;
}

/* ============================================================================
   Router
   ========================================================================== */
window.switchTab = function (tab) {
  S.ui.tab = tab;
  haptic(6);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById('screen-' + tab);
  if (screen) screen.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.tab === tab));

  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (tab === 'home') requestAnimationFrame(updateDots);
  if (tab === 'history') renderStats();
};

/* ============================================================================
   Modals
   ========================================================================== */
window.openModal = function (id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  haptic();
};

window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
};

window.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('active');
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
});

window.setAmount = function (id, v) {
  document.getElementById(id).value = v;
  haptic();
};
window.setAmountAll = function (id) {
  document.getElementById(id).value = available();
  haptic();
};

/* ── Transaction receipt ─────────────────────────────────────────────────── */
window.openTx = function (kind, id) {
  const tx = feed().find(t => t.id === id && t._kind === kind);
  if (!tx) return;

  const d = toDate(tx.timestamp);
  const c = CATEGORIES[catOf(tx)];
  const isVoid = tx.status === 'rejected';
  const color = isVoid ? 'var(--text-3)' : (tx.amount >= 0 ? 'var(--green)' : 'var(--text-1)');
  const iconBg = tx.amount >= 0 ? 'var(--green-dim)' : 'var(--red-dim)';
  const iconCol = tx.amount >= 0 ? 'var(--green)' : 'var(--red)';

  const statusText = tx.status === 'completed' ? 'Виконано'
    : tx.status === 'pending' ? 'На модерації' : 'Відхилено';

  document.getElementById('modalTxBody').innerHTML = `
    <div class="sheet-grabber"></div>
    <div class="modal-header">
      <h3>Квитанція</h3>
      <button class="close-modal-btn" onclick="closeModal('modalTx')"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="receipt-hero">
      <div class="receipt-icon" style="background:${iconBg}; color:${iconCol}">
        <i class="fa-solid ${txIcon(tx)}"></i>
      </div>
      <div class="receipt-amount" style="color:${color}">
        ${tx.amount > 0 ? '+' : ''}${esc(money(tx.amount || 0))}
      </div>
      <div class="receipt-title">${esc(tx.title || 'Операція')}</div>
    </div>

    <div class="kv-list">
      <div class="kv-row"><span class="k">Статус</span><span class="v">${esc(statusText)}</span></div>
      <div class="kv-row"><span class="k">Категорія</span><span class="v">${esc(c.name)}</span></div>
      <div class="kv-row"><span class="k">Опис</span><span class="v">${esc(tx.sub || '—')}</span></div>
      <div class="kv-row"><span class="k">Дата</span><span class="v">${d ? esc(dfFull.format(d)) : 'обробляється'}</span></div>
      <div class="kv-row"><span class="k">Рахунок</span><span class="v mono">${esc(maskCard(S.cardNumber))}</span></div>
      <div class="kv-row"><span class="k">Ідентифікатор</span><span class="v mono">${esc(tx.id)}</span></div>
    </div>

    ${tx.img ? `<img class="admin-req-img" src="${esc(tx.img)}" onclick="showLightbox('${esc(tx.img)}')" alt="">` : ''}

    <button class="btn-secondary" onclick="copyText('${esc(tx.id)}','ID операції скопійовано')">
      <i class="fa-solid fa-copy"></i> Копіювати ID
    </button>`;

  openModal('modalTx');
};

window.showLightbox = function (src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('active');
};

/* ============================================================================
   Deposit
   ========================================================================== */
window.handleScreenshotSelect = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 1048576) { fail('Файл завеликий. Максимум 1 МБ'); e.target.value = ''; return; }

  const reader = new FileReader();
  reader.onload = (evt) => {
    S.screenshotBase64 = evt.target.result;
    document.getElementById('depPreviewImg').src = S.screenshotBase64;
    document.getElementById('depPreviewBox').classList.remove('hidden');
    document.getElementById('depUploadZone').classList.add('filled');
    document.getElementById('depUploadText').innerText = file.name;
  };
  reader.readAsDataURL(file);
};

function resetDepositForm() {
  document.getElementById('depAmount').value = '';
  document.getElementById('depScreenshot').value = '';
  document.getElementById('depPreviewBox').classList.add('hidden');
  document.getElementById('depUploadZone').classList.remove('filled');
  document.getElementById('depUploadText').innerText = 'Натисніть, щоб обрати файл (до 1 МБ)';
  S.screenshotBase64 = null;
}

window.submitDepositRequest = async function () {
  const btn = document.getElementById('depSubmitBtn');
  const amount = parseFloat(document.getElementById('depAmount').value);

  if (!(amount > 0)) return fail('Вкажіть суму поповнення');
  if (amount < MIN_AMT || amount > MAX_AMT) return fail(`Сума має бути від ${money(MIN_AMT)} до ${money(MAX_AMT)}`);
  if (!S.screenshotBase64) return fail('Додайте скріншот транзакції');

  busy(btn, true);
  try {
    await addDoc(collection(db, 'requests'), {
      userId: S.user.username,
      amount: amount,
      img: S.screenshotBase64,
      status: 'pending',
      timestamp: serverTimestamp(),
      ownerUid: auth.currentUser.uid
    });
    closeModal('modalDeposit');
    resetDepositForm();
    showToast('Заявку відправлено на модерацію');
  } catch (e) {
    console.error(e);
    fail('Не вдалось відправити заявку');
  } finally {
    busy(btn, false, '<i class="fa-solid fa-paper-plane"></i> Відправити на модерацію');
  }
};

/* ============================================================================
   Transfer target resolution
   ========================================================================== */
function normalizeCardInput(v) {
  const d = String(v).replace(/\D/g, '');
  if (d.length !== 16) return null;
  return `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8, 12)} ${d.slice(12)}`;
}

async function resolveTarget(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, reason: 'Вкажіть одержувача' };

  const asCard = normalizeCardInput(raw);
  if (asCard) {
    const snap = await getDocs(query(collection(db, 'cards'), where('cardNumber', '==', asCard), limit(1)));
    if (snap.empty) return { ok: false, reason: 'Картку не знайдено в НБС' };
    return { ok: true, username: snap.docs[0].id };
  }

  const snap = await getDoc(doc(db, 'cards', raw));
  if (!snap.exists()) return { ok: false, reason: 'Гравця не знайдено в НБС' };
  return { ok: true, username: raw };
}

let trfDebounce;
window.onTransferTargetInput = function (v) {
  const hint = document.getElementById('trfTargetHint');
  clearTimeout(trfDebounce);
  if (!v.trim()) {
    hint.className = 'form-hint';
    hint.innerText = 'Отримувач має бути зареєстрований у НБС.';
    return;
  }
  hint.className = 'form-hint';
  hint.innerText = 'Перевіряємо…';
  trfDebounce = setTimeout(async () => {
    const r = await resolveTarget(v).catch(() => ({ ok: false, reason: 'Помилка перевірки' }));
    if (r.ok) {
      hint.className = 'form-hint';
      hint.innerHTML = `<span style="color:var(--green)"><i class="fa-solid fa-circle-check"></i> ${esc(r.username)}</span>`;
    } else {
      hint.className = 'form-hint err';
      hint.innerText = r.reason;
    }
  }, 450);
};

/* ============================================================================
   Sign & send (withdraw / transfer) via Сія.Підпис
   ========================================================================== */
window.redirectToSiYaSignature = async function (actionType) {
  const isWithdraw = actionType === 'withdraw';
  const btn = document.getElementById(isWithdraw ? 'witSubmitBtn' : 'trfSubmitBtn');
  const amount = parseFloat(document.getElementById(isWithdraw ? 'witAmount' : 'trfAmount').value);
  let target = document.getElementById(isWithdraw ? 'witTarget' : 'trfTarget').value.trim();

  if (S.frozen) return fail('Картку заморожено. Розморозьте її в розділі «Ще»');
  if (!(amount > 0)) return fail('Вкажіть суму операції');
  if (isWithdraw && (amount < MIN_AMT || amount > MAX_AMT)) return fail(`Сума виводу має бути від ${money(MIN_AMT)} до ${money(MAX_AMT)}`);
  if (S.limit > 0 && amount > S.limit) return fail(`Ліміт на операцію — ${money(S.limit)}`);
  if (amount > available()) {
    return fail(reserved() > 0
      ? `Доступно лише ${money(available())} — решта відкладена в банках`
      : 'Недостатньо коштів');
  }
  if (!target) return fail(isWithdraw ? 'Вкажіть реквізити одержувача' : 'Вкажіть одержувача');

  busy(btn, true);
  try {
    if (!isWithdraw) {
      const r = await resolveTarget(target);
      if (!r.ok) { fail(r.reason); return; }
      if (r.username.toLowerCase() === S.user.username.toLowerCase()) {
        fail('Не можна переказати кошти самому собі');
        return;
      }
      target = r.username;
    }

    const txId = 'NBS-' + Math.floor(100000 + Math.random() * 900000);
    await setDoc(doc(db, 'pending_txs', txId), {
      amount, type: actionType, target,
      userId: S.user.username,
      ownerUid: auth.currentUser ? auth.currentUser.uid : 'anon',
      timestamp: serverTimestamp()
    });

    let url = `../index.html?action=siya_sign&return_url=nbu/index.html`
      + `&tx_id=${encodeURIComponent(txId)}&amount=${encodeURIComponent(amount)}`
      + `&type=${encodeURIComponent(actionType)}&curr=UC&user=${encodeURIComponent(S.user.username)}`;
    if (target) url += `&target=${encodeURIComponent(target)}`;
    window.location.href = url;
  } catch (e) {
    console.error(e);
    fail('Помилка сервера. Спробуйте пізніше');
  } finally {
    busy(btn, false, isWithdraw
      ? '<i class="fa-solid fa-signature"></i> Підписати через Сія.Підпис'
      : '<i class="fa-solid fa-signature"></i> Підтвердити Сія.Підписом');
  }
};

async function checkSiYaReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('status') !== 'signed' || !params.get('tx_id')) return;

  const sig  = params.get('sig') || 'N/A';
  const txId = params.get('tx_id');

  try {
    const pendingRef = doc(db, 'pending_txs', txId);
    const pendingSnap = await getDoc(pendingRef);
    if (!pendingSnap.exists()) throw new Error('Транзакція недійсна або вже оброблена');

    const t = pendingSnap.data();
    if (t.userId !== S.user.username) throw new Error('Чужа транзакція');
    if (!(t.amount > 0)) throw new Error('Некоректна сума');

    const { amount, type, target } = t;

    if (type === 'withdraw') {
      // Вивід → створити заявку адміну, резервувати кошти одразу
      const batch = writeBatch(db);
      batch.delete(pendingRef);
      batch.update(doc(db, 'cards', S.user.username), { balanceUC: increment(-amount) });
      batch.set(doc(collection(db, 'requests')), {
        userId: S.user.username,
        type: 'withdraw',
        amount: amount,
        target: target || '',
        status: 'pending',
        ownerUid: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        sig: sig
      });
      await batch.commit();
      showToast('Заявку на вивід відправлено на модерацію');
      document.getElementById('witAmount').value = '';
      document.getElementById('witTarget').value = '';
    } else if (type === 'transfer') {
      // Переказ → виконати одразу
      if (!target) throw new Error('Одержувача не вказано');
      const tSnap = await getDoc(doc(db, 'cards', target));
      if (!tSnap.exists()) throw new Error('Картку одержувача не знайдено');

      const batch = writeBatch(db);
      batch.delete(pendingRef);
      batch.update(doc(db, 'cards', S.user.username), { balanceUC: increment(-amount) });

      batch.set(doc(collection(db, 'transactions')), {
        userId: S.user.username,
        type: 'transfer',
        category: 'transfer',
        title: `Переказ · ${target}`,
        sub: 'Сія.Підпис ' + String(sig).substring(0, 8),
        amount: -amount,
        status: 'completed',
        timestamp: serverTimestamp()
      });

      batch.set(doc(db, 'cards', target), { balanceUC: increment(amount) }, { merge: true });
      batch.set(doc(collection(db, 'transactions')), {
        userId: target,
        type: 'deposit',
        category: 'transfer',
        title: `Переказ від ${S.user.username}`,
        sub: 'Зарахування · Сія.Підпис',
        amount: amount,
        status: 'completed',
        timestamp: serverTimestamp()
      });

      await batch.commit();
      showToast('Переказ успішний');
      document.getElementById('trfAmount').value = '';
      document.getElementById('trfTarget').value = '';
    }
  } catch (e) {
    console.error(e);
    fail(e.message || 'Помилка транзакції');
  }

  window.history.replaceState({}, document.title, window.location.pathname);
}

/* ============================================================================
   Jars — reserved portions of the card balance (never a separate balance)
   ========================================================================== */
window.createJar = async function () {
  const btn = document.getElementById('jarCreateBtn');
  const name = document.getElementById('jarName').value.trim();
  const goal = parseFloat(document.getElementById('jarGoal').value) || 0;

  if (!name) return fail('Вкажіть назву банки');
  // Дзеркалить обмеження в firestore.rules — інакше запис впаде з permission-denied.
  if (name.length > 40) return fail('Назва задовга — максимум 40 символів');
  if (S.jars.length >= 12) return fail('Максимум 12 банок');
  if (goal < 0) return fail('Ціль не може бути відʼємною');

  busy(btn, true);
  try {
    await addDoc(collection(db, 'jars'), {
      userId: S.user.username,
      ownerUid: auth.currentUser.uid,
      name, goal, balance: 0,
      createdAt: serverTimestamp()
    });
    closeModal('modalJarNew');
    document.getElementById('jarName').value = '';
    document.getElementById('jarGoal').value = '';
    showToast('Банку створено');
  } catch (e) {
    console.error(e);
    fail('Не вдалось створити банку');
  } finally {
    busy(btn, false, '<i class="fa-solid fa-piggy-bank"></i> Створити');
  }
};

window.openJar = function (id) {
  const j = S.jars.find(x => x.id === id);
  if (!j) return;
  const pct = jarPct(j);

  document.getElementById('modalJarBody').innerHTML = `
    <div class="sheet-grabber"></div>
    <div class="modal-header">
      <h3>${esc(j.name)}</h3>
      <button class="close-modal-btn" onclick="closeModal('modalJar')"><i class="fa-solid fa-xmark"></i></button>
    </div>

    <div class="receipt-hero">
      ${j.goal > 0
        ? `<div class="ring" style="--p:${pct}; width:70px; height:70px" data-p="${pct}%"></div>`
        : `<div class="receipt-icon" style="background:var(--amber-dim); color:var(--amber)"><i class="fa-solid fa-piggy-bank"></i></div>`}
      <div class="receipt-amount">${esc(money(j.balance || 0))}</div>
      <div class="receipt-title">${j.goal > 0
        ? `Ціль ${esc(money(j.goal))} · залишилось ${esc(money(Math.max(0, j.goal - (j.balance || 0))))}`
        : 'Накопичення без цілі'}</div>
    </div>

    <div class="form-group">
      <label class="form-label">Сума (€)</label>
      <input type="number" id="jarOpAmount" class="form-input" placeholder="0" inputmode="decimal">
      <div class="form-hint">Доступно на картці: ${esc(money(available()))}</div>
    </div>

    <button class="btn-submit-main" id="jarTopupBtn" onclick="jarMove('${esc(j.id)}', 1)">
      <i class="fa-solid fa-arrow-down"></i> Відкласти в банку
    </button>
    <button class="btn-secondary" id="jarWithdrawBtn" onclick="jarMove('${esc(j.id)}', -1)">
      <i class="fa-solid fa-arrow-up"></i> Забрати на картку
    </button>
    <button class="btn-secondary danger" onclick="deleteJar('${esc(j.id)}')">
      <i class="fa-solid fa-trash"></i> Закрити банку
    </button>`;

  openModal('modalJar');
};

window.jarMove = async function (id, dir) {
  const j = S.jars.find(x => x.id === id);
  if (!j) return;

  const amount = parseFloat(document.getElementById('jarOpAmount').value);
  if (!(amount > 0)) return fail('Вкажіть суму');

  if (dir > 0 && amount > available()) return fail(`Доступно лише ${money(available())}`);
  if (dir < 0 && amount > (j.balance || 0)) return fail('У банці недостатньо коштів');

  const btn = document.getElementById(dir > 0 ? 'jarTopupBtn' : 'jarWithdrawBtn');
  busy(btn, true);
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'jars', id), { balance: increment(dir * amount) });
    batch.set(doc(collection(db, 'transactions')), {
      userId: S.user.username,
      type: 'jar',
      category: 'jar',
      title: dir > 0 ? `У банку «${j.name}»` : `З банки «${j.name}»`,
      sub: dir > 0 ? 'Відкладено' : 'Повернуто на картку',
      amount: dir > 0 ? -amount : amount,
      status: 'completed',
      timestamp: serverTimestamp()
    });
    await batch.commit();
    closeModal('modalJar');
    showToast(dir > 0 ? 'Кошти відкладено' : 'Кошти на картці');
  } catch (e) {
    console.error(e);
    fail('Операція не вдалась');
  } finally {
    busy(btn, false, dir > 0
      ? '<i class="fa-solid fa-arrow-down"></i> Відкласти в банку'
      : '<i class="fa-solid fa-arrow-up"></i> Забрати на картку');
  }
};

window.deleteJar = async function (id) {
  const j = S.jars.find(x => x.id === id);
  if (!j) return;
  if (!confirm(`Закрити банку «${j.name}»? ${(j.balance || 0) > 0 ? money(j.balance) + ' повернуться на картку.' : ''}`)) return;

  try {
    if ((j.balance || 0) > 0) {
      await addDoc(collection(db, 'transactions'), {
        userId: S.user.username,
        type: 'jar',
        category: 'jar',
        title: `Закриття банки «${j.name}»`,
        sub: 'Повернуто на картку',
        amount: j.balance,
        status: 'completed',
        timestamp: serverTimestamp()
      });
    }
    await deleteDoc(doc(db, 'jars', id));
    closeModal('modalJar');
    showToast('Банку закрито');
  } catch (e) {
    console.error(e);
    fail('Не вдалось закрити банку');
  }
};

/* ============================================================================
   Card settings
   ========================================================================== */
window.toggleFreeze = async function () {
  if (!S.cardLoaded) return;
  const next = !S.frozen;
  document.getElementById('freezeSwitch').classList.toggle('on', next);
  try {
    await updateDoc(doc(db, 'cards', S.user.username), { frozen: next });
    haptic(12);
    showToast(next ? 'Картку заморожено' : 'Картку розморожено');
  } catch (e) {
    console.error(e);
    document.getElementById('freezeSwitch').classList.toggle('on', S.frozen);
    fail('Не вдалось змінити стан картки');
  }
};

window.saveLimit = async function () {
  const v = parseFloat(document.getElementById('limitInput').value) || 0;
  if (v < 0) return fail('Ліміт не може бути відʼємним');
  try {
    await updateDoc(doc(db, 'cards', S.user.username), { limit: v });
    closeModal('modalLimits');
    showToast(v > 0 ? `Ліміт: ${money(v)}` : 'Ліміт вимкнено');
  } catch (e) {
    console.error(e);
    fail('Не вдалось зберегти ліміт');
  }
};

window.regenerateCvv = async function () {
  if (!confirm('Перевипустити CVV? Старий код перестане працювати в підключених сервісах.')) return;
  const newCvv = String(Math.floor(100 + Math.random() * 900));
  try {
    await updateDoc(doc(db, 'cards', S.user.username), { cvv: newCvv });
    showToast('Новий CVV: ' + newCvv);
  } catch (e) {
    console.error(e);
    fail('Не вдалось перевипустити CVV');
  }
};

window.copyRequisites = function () {
  copyText(
    `Отримувач: ${S.user.username}\nКартка НБС: ${S.cardNumber}\nТермін дії: ${S.cardExpiry}\nБанк: НБС · Ukraine RP`,
    'Реквізити скопійовано'
  );
};

window.exportStatement = function () {
  const items = feed();
  if (!items.length) return fail('Немає операцій для виписки');

  const rows = [['Дата', 'Тип', 'Категорія', 'Опис', 'Деталі', 'Сума, EUR', 'Статус']];
  items.forEach(t => {
    const d = toDate(t.timestamp);
    rows.push([
      d ? dfFull.format(d) : '',
      t.type || '',
      CATEGORIES[catOf(t)].name,
      t.title || '',
      t.sub || '',
      String(t.amount ?? 0).replace('.', ','),
      t.status || ''
    ]);
  });

  const csv = '﻿' + rows
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `NBS-vypyska-${S.user.username}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  showToast('Виписку завантажено');
};

window.logout = function () {
  if (!confirm('Вийти з акаунта НБС?')) return;
  localStorage.removeItem('currentUser');
  localStorage.removeItem('currentUserAvatar');
  window.location.href = '../index.html';
};

/* ============================================================================
   History controls
   ========================================================================== */
window.setHistoryFilter = function (f, el) {
  S.ui.historyFilter = f;
  document.querySelectorAll('#historyFilter button').forEach(b => b.classList.toggle('on', b === el));
  haptic();
  renderHistory();
};

window.onHistorySearch = function (v) {
  S.ui.historyQuery = v;
  document.getElementById('historySearchClear').classList.toggle('on', !!v);
  renderHistory();
};

window.clearHistorySearch = function () {
  document.getElementById('historySearch').value = '';
  onHistorySearch('');
};

/* ============================================================================
   Admin
   ========================================================================== */
window.openAdmin = function () {
  if (!S.user.isAdmin) return fail('Доступ лише для модераторів НБС');
  openModal('modalAdmin');
  loadAdminRequests();
};

window.setAdminFilter = function (f, el) {
  S.ui.adminFilter = f;
  document.querySelectorAll('#adminFilter button').forEach(b => b.classList.toggle('on', b === el));
  loadAdminRequests();
};

window.loadAdminRequests = function () {
  const list = document.getElementById('adminRequestsList');
  const pending = S.ui.adminFilter === 'pending';
  const items = pending ? S.requests : S.requestsDone;

  if (!items.length) {
    list.innerHTML = emptyHtml('fa-inbox', pending ? 'Нових заявок немає' : 'Історія порожня',
      pending ? 'Усі заявки оброблено.' : 'Оброблені заявки зʼявляться тут.');
    return;
  }

  list.innerHTML = items.map(t => {
    const d = toDate(t.timestamp);
    const done = toDate(t.processedAt);
    const isWithdraw = t.type === 'withdraw';
    return `
      <div class="admin-req-card" id="req-${esc(t.id)}">
        <div class="admin-req-head">
          <div>
            <div class="admin-req-user">${esc(t.userId)}</div>
            <div class="admin-req-time">${d ? esc(dfFull.format(d)) : 'зараз'}</div>
          </div>
          <div class="admin-req-amt" style="color:${isWithdraw ? 'var(--red)' : 'var(--green)'}">${isWithdraw ? '−' : '+'}${esc(money(t.amount || 0))}</div>
        </div>

        ${isWithdraw ? `
          <div class="kv-list" style="margin:12px 0 0 0;">
            <div class="kv-row"><span class="k">Тип</span><span class="v">Виведення коштів</span></div>
            <div class="kv-row"><span class="k">Реквізити</span><span class="v">${esc(t.target || '—')}</span></div>
          </div>`
        : (t.img ? `<img class="admin-req-img" src="${esc(t.img)}" onclick="showLightbox('${esc(t.img)}')" alt="">` : '')}

        ${pending ? `
          <div class="admin-req-actions">
            <button class="btn-approve" onclick="approveReq('${esc(t.id)}')">Схвалити</button>
            <button class="btn-reject"  onclick="rejectReq('${esc(t.id)}')">Відхилити</button>
          </div>`
        : `
          <div class="kv-list">
            <div class="kv-row"><span class="k">Статус</span><span class="v" style="color:${t.status === 'completed' ? 'var(--green)' : 'var(--red)'}">
              ${t.status === 'completed' ? 'Схвалено' : 'Відхилено'}</span></div>
            <div class="kv-row"><span class="k">Модератор</span><span class="v">${esc(t.processedBy || '—')}</span></div>
            <div class="kv-row"><span class="k">Оброблено</span><span class="v">${done ? esc(dfFull.format(done)) : '—'}</span></div>
          </div>`}
      </div>`;
  }).join('');
};

function lockReqCard(id, on) {
  document.querySelectorAll(`#req-${CSS.escape(id)} button`).forEach(b => { b.disabled = on; });
}

window.approveReq = async function (id) {
  const req = S.requests.find(r => r.id === id);
  if (!req) return fail('Заявку не знайдено');

  lockReqCard(id, true);
  const adminName = S.user.exactAdminName || S.user.username;
  const isWithdraw = req.type === 'withdraw';

  try {
    await updateDoc(doc(db, 'requests', id), {
      status: 'completed',
      processedBy: adminName,
      processedAt: serverTimestamp()
    });

    if (isWithdraw) {
      // Вивід: кошти вже зарезервовано, лише транзакція
      await addDoc(collection(db, 'transactions'), {
        userId: req.userId,
        type: 'withdraw',
        category: 'withdraw',
        title: 'Виведення коштів',
        sub: 'Схвалено модератором ' + adminName,
        amount: -req.amount,
        status: 'completed',
        timestamp: serverTimestamp()
      });
      showToast(`Вивід ${money(req.amount)} схвалено для ${req.userId}`);
    } else {
      // Депозит: зарахування балансу + транзакція
      await updateDoc(doc(db, 'cards', req.userId), { balanceUC: increment(req.amount) });
      await addDoc(collection(db, 'transactions'), {
        userId: req.userId,
        type: 'deposit',
        category: 'other',
        title: 'Поповнення рахунку',
        sub: 'Схвалено модератором ' + adminName,
        amount: req.amount,
        status: 'completed',
        timestamp: serverTimestamp()
      });
      showToast(`Схвалено ${money(req.amount)} для ${req.userId}`);
    }
  } catch (e) {
    console.error(e);
    lockReqCard(id, false);
    fail(e.code === 'permission-denied' ? 'Немає прав модератора (config/admins_uids)' : 'Помилка бази даних');
  }
};

window.rejectReq = async function (id) {
  const req = S.requests.find(r => r.id === id);
  lockReqCard(id, true);
  const adminName = S.user.exactAdminName || S.user.username;
  const isWithdraw = req && req.type === 'withdraw';

  try {
    await updateDoc(doc(db, 'requests', id), {
      status: 'rejected',
      processedBy: adminName,
      processedAt: serverTimestamp()
    });

    if (isWithdraw && req) {
      // Вивід відхилено → повернути зарезервовані кошти
      await updateDoc(doc(db, 'cards', req.userId), { balanceUC: increment(req.amount) });
      showToast(`Заявку відхилено, ${money(req.amount)} повернуто ${req.userId}`);
    } else {
      showToast('Заявку відхилено');
    }
  } catch (e) {
    console.error(e);
    lockReqCard(id, false);
    fail('Помилка бази даних');
  }
};
