import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, increment, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDWW0hSO-kb8B8hFt2M1mSpsq8gVbPxFAQ",
  authDomain: "nbsur-cf108.firebaseapp.com",
  projectId: "nbsur-cf108",
  storageBucket: "nbsur-cf108.firebasestorage.app",
  messagingSenderId: "223476840819",
  appId: "1:223476840819:web:4af79db89af4f560a6ad06"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// State & Public NBS External API
window.NBS_STATE = {
  user: { username: localStorage.getItem('currentUser') || 'ROBLOX CITIZEN', isAdmin: false },
  balanceUC: 0,
  cardNumber: '4441 5829 9012 3456',
  cvv: '***',
  eurRate: 45.85,
  dailyLimit: 50000,
  screenshotBase64: null,
  transactions: [],
  requests: []
};

// Public External API for other SiYa Ecosystem Apps
window.NBSApi = {
  getBalance: function() {
    return { uc: window.NBS_STATE.balanceUC, eur: (window.NBS_STATE.balanceUC / window.NBS_STATE.eurRate).toFixed(2) };
  },
  requestPayment: function(params) {
    if (!params || !params.amount) return Promise.reject("Invalid payment parameters");
    document.getElementById('trfAmount').value = params.amount;
    if (params.recipient) document.getElementById('trfTarget').value = params.recipient;
    openModal('modalTransfer');
    return Promise.resolve({ status: 'initiated', txId: 'NBS-EXT-' + Math.floor(Math.random() * 900000) });
  },
  processDirectPayment: async function(params) {
    if (!params || !params.amount || !params.cvv) return { success: false, error: "Missing amount or cvv" };
    if (params.cvv !== window.NBS_STATE.cvv) return { success: false, error: "Invalid CVV" };
    if (params.amount > window.NBS_STATE.balanceUC) return { success: false, error: "Insufficient funds" };
    
    try {
      const cardRef = doc(db, "cards", window.NBS_STATE.user.username);
      await updateDoc(cardRef, { balanceUC: increment(-params.amount) });

      const txId = 'EXT-' + Math.floor(100000 + Math.random() * 900000);
      await addDoc(collection(db, "transactions"), {
        userId: window.NBS_STATE.user.username,
        type: 'withdraw',
        title: params.title || 'Оплата послуг',
        sub: 'Списання через API',
        amount: -params.amount,
        status: 'completed',
        timestamp: serverTimestamp()
      });

      return { success: true, txId: txId };
    } catch(e) {
      console.error(e);
      return { success: false, error: "Transaction failed" };
    }
  }
};

// Listen for Cross-Origin API requests
if (window.parent && window.parent !== window) {
  window.parent.NBSApi = window.NBSApi;
}

window.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data || !data.type || !data.id) return;
  
  if (data.type === 'NBS_GET_BALANCE') {
    event.source.postMessage({ id: data.id, response: window.NBSApi.getBalance() }, '*');
  } else if (data.type === 'NBS_REQUEST_PAYMENT') {
    try {
      const res = await window.NBSApi.requestPayment(data.payload);
      event.source.postMessage({ id: data.id, response: res }, '*');
    } catch(e) {
      event.source.postMessage({ id: data.id, error: e.toString() }, '*');
    }
  } else if (data.type === 'NBS_PROCESS_DIRECT_PAYMENT') {
    const res = await window.NBSApi.processDirectPayment(data.payload);
    event.source.postMessage({ id: data.id, response: res }, '*');
  }
});

// DOM Ready
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await signInAnonymously(auth);
  } catch(e) {
    console.warn("Auth warning", e);
  }

  // Determine user (SiYa Auth Flow)
  const urlParams = new URLSearchParams(window.location.search);
  
  if (!localStorage.getItem('currentUser')) {
    // Redirect to SiYa ecosystem auth if not logged in
    window.location.href = `../index.html?action=siya_auth&return_url=nbu/index.html`;
    return;
  } else {
    window.NBS_STATE.user.username = localStorage.getItem('currentUser');
    
    // Clean any old insecure URL parameters if they exist
    if (urlParams.has('user') || urlParams.has('status')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Render Header User Profile
    const headerProfile = document.getElementById('headerUserProfile');
    if (headerProfile) {
      const avatarUrl = localStorage.getItem('currentUserAvatar');
      headerProfile.innerHTML = `
        <img class="header-user-avatar" src="${avatarUrl || 'png/ciyablack.png'}" alt="Avatar">
        <span class="header-user-name">${window.NBS_STATE.user.username}</span>
      `;
    }
  }

  // Dynamic Admin Verification (Без заглушок)
  window.NBS_STATE.user.isAdmin = false;
  
  // 1. Check SiYa Ecosystem Parent (if in iframe)
  try {
    if (window.parent && typeof window.parent.checkEditPermissions === 'function') {
      const perms = window.parent.checkEditPermissions();
      if (perms && perms.isAdmin) {
        window.NBS_STATE.user.isAdmin = true;
      }
    }
  } catch(e) {}

  // 2. Fallback to NBS Firestore Config (for standalone or custom admins)
  if (!window.NBS_STATE.user.isAdmin) {
    try {
      const adminDoc = await getDoc(doc(db, "config", "admins"));
      if (adminDoc.exists()) {
        const adminList = adminDoc.data().list || [];
        if (adminList.map(a => a.toLowerCase()).includes(window.NBS_STATE.user.username.toLowerCase())) {
          window.NBS_STATE.user.isAdmin = true;
        }
      }
    } catch(e) {
      console.warn("Admin config read failed or missing (check rules/db)");
    }
  }

  if (window.NBS_STATE.user.isAdmin) {
    document.getElementById('adminToggleBtn').style.display = 'flex';
  } else {
    document.getElementById('adminToggleBtn').style.display = 'none';
  }

  initFirestoreListeners();
  checkSiYaReturn();
  fetchNbuRate();
});

function initFirestoreListeners() {
  const cardRef = doc(db, "cards", window.NBS_STATE.user.username);
  
  // Listen to Card Balance
  onSnapshot(cardRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      window.NBS_STATE.balanceUC = data.balanceUC || 0;
      window.NBS_STATE.dailyLimit = data.dailyLimit || 50000;
      window.NBS_STATE.cardNumber = data.cardNumber || '4441 5829 9012 3456';
      
      if (!data.cvv) {
        // Generate CVV for existing cards if missing
        const newCvv = Math.floor(100 + Math.random() * 900).toString();
        updateDoc(cardRef, { cvv: newCvv });
        window.NBS_STATE.cvv = newCvv;
      } else {
        window.NBS_STATE.cvv = data.cvv;
      }
    } else {
      // Create initial card
      const initCvv = Math.floor(100 + Math.random() * 900).toString();
      setDoc(cardRef, {
        balanceUC: 0,
        dailyLimit: 50000,
        cardNumber: '4441 ' + Math.floor(1000 + Math.random()*9000) + ' ' + Math.floor(1000 + Math.random()*9000) + ' ' + Math.floor(1000 + Math.random()*9000),
        cvv: initCvv,
        ownerUid: auth.currentUser ? auth.currentUser.uid : 'anon'
      });
      window.NBS_STATE.cvv = initCvv;
    }
    renderUI();
  });

  // Listen to Transactions
  const txQuery = query(collection(db, "transactions"), where("userId", "==", window.NBS_STATE.user.username));
  onSnapshot(txQuery, (snapshot) => {
    window.NBS_STATE.transactions = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
    renderTransactions();
  }, (err) => {
    console.error("Transactions Error:", err);
    if(err.code === 'permission-denied') showToast("Помилка прав (Оновіть Firebase Rules)");
  });

  // Admin Request Listener
  if (window.NBS_STATE.user.isAdmin) {
    const reqQuery = query(collection(db, "requests"), where("status", "==", "pending"));
    onSnapshot(reqQuery, (snapshot) => {
      window.NBS_STATE.requests = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      if (document.getElementById('adminBadgeBar').style.display !== 'none') {
        loadAdminRequests();
      }
    }, (err) => {
      console.error("Requests Error:", err);
    });
  }
}

window.renderUI = function() {
  document.getElementById('valUC').innerText = window.NBS_STATE.balanceUC.toLocaleString('uk-UA');
  const eurVal = (window.NBS_STATE.balanceUC / window.NBS_STATE.eurRate).toFixed(2);
  document.getElementById('valEUR').innerText = parseFloat(eurVal).toLocaleString('uk-UA');
  document.getElementById('cardHolder').innerText = window.NBS_STATE.user.username.toUpperCase();
  document.getElementById('cardNumberDisplay').innerText = window.NBS_STATE.cardNumber;
  if(document.getElementById('cardCvvDisplay')) {
    document.getElementById('cardCvvDisplay').innerText = 'CVV ' + window.NBS_STATE.cvv;
  }
  document.getElementById('limitInput').value = window.NBS_STATE.dailyLimit;
}

window.renderTransactions = function() {
  const list = document.getElementById('transactionsList');
  if (window.NBS_STATE.transactions.length === 0) {
    list.innerHTML = '<div style="font-size:13px; color:var(--text-sub); text-align:center; padding:10px;">Немає транзакцій</div>';
    return;
  }
  list.innerHTML = window.NBS_STATE.transactions.map(tx => `
    <div class="tx-item">
      <div class="tx-left">
        <div class="tx-icon-box ${tx.type}">
          <i class="fa-solid ${tx.type === 'deposit' ? 'fa-arrow-down' : tx.type === 'withdraw' ? 'fa-arrow-up' : 'fa-paper-plane'}"></i>
        </div>
        <div class="tx-details">
          <div class="tx-title">${tx.title}</div>
          <div class="tx-subtitle">${tx.sub}</div>
        </div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${tx.amount >= 0 ? 'plus' : 'minus'}">
          ${tx.amount >= 0 ? '+' : ''}${tx.amount.toLocaleString()} UC
        </div>
        <span class="tx-status-badge status-${tx.status}">
          ${tx.status === 'completed' ? 'Схвалено' : tx.status === 'pending' ? 'Очікує' : 'Відхилено'}
        </span>
      </div>
    </div>
  `).join('');
}

window.flipCard = function() {
  const card = document.getElementById('cardObject');
  card.classList.toggle('is-flipped');
}

window.openModal = function(id) {
  document.getElementById(id).classList.add('active');
}
window.closeModal = function(id) {
  document.getElementById(id).classList.remove('active');
}

window.runExchangeCalc = function() {
  const eur = parseFloat(document.getElementById('calcEur').value) || 0;
  const uc = Math.round(eur * window.NBS_STATE.eurRate);
  document.getElementById('calcUc').value = uc.toLocaleString('uk-UA');
}

async function fetchNbuRate() {
  try {
    const res = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=EUR&json');
    const data = await res.json();
    if (data && data[0] && data[0].rate) {
      window.NBS_STATE.eurRate = parseFloat(data[0].rate.toFixed(2));
      renderUI();
    }
  } catch(e) {}
}

window.handleScreenshotSelect = function(e) {
  const file = e.target.files[0];
  if (file) {
    if (file.size > 1048576) {
      alert("Файл завеликий! Максимум 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = function(evt) {
      window.NBS_STATE.screenshotBase64 = evt.target.result;
      document.getElementById('depPreviewImg').src = window.NBS_STATE.screenshotBase64;
      document.getElementById('depPreviewBox').style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

window.submitDepositRequest = async function() {
  const amount = parseFloat(document.getElementById('depAmount').value);
  if (!amount || amount <= 0) {
    alert('Вкажіть суму поповнення.');
    return;
  }
  if (!window.NBS_STATE.screenshotBase64) {
    alert('Завантажте скріншот транзакції!');
    return;
  }

  try {
    await addDoc(collection(db, "requests"), {
      userId: window.NBS_STATE.user.username,
      amount: amount,
      img: window.NBS_STATE.screenshotBase64,
      status: 'pending',
      timestamp: serverTimestamp()
    });

    closeModal('modalDeposit');
    document.getElementById('depAmount').value = '';
    document.getElementById('depPreviewBox').style.display = 'none';
    window.NBS_STATE.screenshotBase64 = null;
    
    showToast('Заявку відправлено на модерацію!');
  } catch (e) {
    console.error(e);
    alert("Помилка відправки заявки");
  }
}

// Two-Way SiYa Redirect Flow
window.redirectToSiYaSignature = async function(actionType) {
  let amount = 0;
  let target = '';
  if (actionType === 'withdraw') {
    amount = parseFloat(document.getElementById('witAmount').value);
    target = document.getElementById('witTarget').value;
  } else {
    amount = parseFloat(document.getElementById('trfAmount').value);
    target = document.getElementById('trfTarget').value;
  }

  if (!amount || amount <= 0) {
    alert('Вкажіть суму операції.');
    return;
  }

  if (actionType === 'transfer' && !target) {
    alert('Вкажіть одержувача.');
    return;
  }

  if (amount > window.NBS_STATE.balanceUC) {
    alert('Недостатньо коштів!');
    return;
  }

  const txId = 'NBS-' + Math.floor(100000 + Math.random() * 900000);
  
  // Secure Nonce for Replay Attack Prevention
  try {
    await setDoc(doc(db, "pending_txs", txId), {
      amount: amount,
      type: actionType,
      target: target,
      userId: window.NBS_STATE.user.username,
      ownerUid: auth.currentUser ? auth.currentUser.uid : 'anon',
      timestamp: serverTimestamp()
    });
  } catch(e) {
    console.error(e);
    alert('Помилка сервера. Спробуйте пізніше.');
    return;
  }

  let siyaUrl = `../index.html?action=siya_sign&return_url=nbu/index.html&tx_id=${txId}&amount=${amount}&type=${actionType}&curr=UC&user=${encodeURIComponent(window.NBS_STATE.user.username)}`;
  if (target) siyaUrl += `&target=${encodeURIComponent(target)}`;
  
  window.location.href = siyaUrl;
}

async function checkSiYaReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('status') === 'signed' && params.get('tx_id')) {
    const sig = params.get('sig') || 'N/A';
    const txId = params.get('tx_id');

    try {
      // Secure state verification (Nonce)
      const pendingRef = doc(db, "pending_txs", txId);
      const pendingSnap = await getDoc(pendingRef);
      if (!pendingSnap.exists()) {
        throw new Error("Транзакція недійсна або вже була оброблена!");
      }
      
      const txData = pendingSnap.data();
      if (txData.userId !== window.NBS_STATE.user.username) {
        throw new Error("Чужа транзакція!");
      }
      if (!txData.amount || txData.amount <= 0) {
        throw new Error("Некоректна сума!");
      }

      const amount = txData.amount;
      const type = txData.type;
      const target = txData.target;

      // ATOMIC BATCH FOR SAFETY
      const batch = writeBatch(db);
      
      // 1. Delete Nonce
      batch.delete(pendingRef);

      // 2. Deduct funds from current user
      const cardRef = doc(db, "cards", window.NBS_STATE.user.username);
      batch.update(cardRef, { balanceUC: increment(-amount) });

      // 3. Sender transaction history
      const senderTxRef = doc(collection(db, "transactions"));
      batch.set(senderTxRef, {
        userId: window.NBS_STATE.user.username,
        type: type,
        title: type === 'withdraw' ? 'Вивід коштів' : `Переказ гравцю ${target}`,
        sub: 'Підписано Сіа.Підпис (' + sig.substring(0, 8) + ')',
        amount: -amount,
        status: 'completed',
        timestamp: serverTimestamp()
      });

      // 4. Receiver deposit & history
      if (type === 'transfer' && target) {
        const targetCardRef = doc(db, "cards", target);
        batch.set(targetCardRef, { balanceUC: increment(amount) }, { merge: true });
        
        const targetTxRef = doc(collection(db, "transactions"));
        batch.set(targetTxRef, {
          userId: target,
          type: 'deposit',
          title: 'Переказ від ' + window.NBS_STATE.user.username,
          sub: 'Зарахування (Сіа.Підпис)',
          amount: amount,
          status: 'completed',
          timestamp: serverTimestamp()
        });
      }

      // Commit the batch
      await batch.commit();
      showToast('Транзакція успішна ✅');
    } catch (e) {
      console.error(e);
      alert(e.message || "Помилка транзакції");
    }
    
    // Clean URL params
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// Admin Panel Controls
window.toggleAdminPanel = function() {
  const bar = document.getElementById('adminBadgeBar');
  const list = document.getElementById('adminRequestsList');
  if (bar.style.display === 'none' || bar.style.display === '') {
    bar.style.display = 'flex';
    list.style.display = 'flex';
    loadAdminRequests();
    showToast('Режим модератора увімкнено!');
  } else {
    bar.style.display = 'none';
    list.style.display = 'none';
  }
}

window.loadAdminRequests = function() {
  const list = document.getElementById('adminRequestsList');
  const pendings = window.NBS_STATE.requests;
  
  if (pendings.length === 0) {
    list.innerHTML = '<div style="font-size:12px; color:var(--text-sub); text-align:center; padding:10px;">Немає нових заявок</div>';
    return;
  }

  list.innerHTML = pendings.map(t => `
    <div class="admin-req-card">
      <div style="font-size:13px; font-weight:700;">Заявка від ${t.userId} — ${t.amount} UC</div>
      ${t.img ? `<img src="${t.img}" style="width:100%; max-height:100px; object-fit:cover; border-radius:8px;">` : ''}
      <div class="admin-req-actions">
        <button class="btn-approve" onclick="approveReq('${t.id}', '${t.userId}', ${t.amount})">Схвалити (+${t.amount} UC)</button>
        <button class="btn-reject" onclick="rejectReq('${t.id}')">Відхилити</button>
      </div>
    </div>
  `).join('');
}

window.approveReq = async function(id, userId, amount) {
  try {
    const reqRef = doc(db, "requests", id);
    await updateDoc(reqRef, { status: 'completed' });

    const cardRef = doc(db, "cards", userId);
    await updateDoc(cardRef, { balanceUC: increment(amount) });

    await addDoc(collection(db, "transactions"), {
      userId: userId,
      type: 'deposit',
      title: 'Поповнення',
      sub: 'Схвалено адміністрацією',
      amount: amount,
      status: 'completed',
      timestamp: serverTimestamp()
    });

    showToast(`Заявку схвалено!`);
  } catch(e) {
    console.error(e);
  }
}

window.rejectReq = async function(id) {
  try {
    const reqRef = doc(db, "requests", id);
    await updateDoc(reqRef, { status: 'rejected' });
    showToast(`Заявку відхилено.`);
  } catch(e) {
    console.error(e);
  }
}

window.saveLimitSetting = async function() {
  const val = parseFloat(document.getElementById('limitInput').value) || 50000;
  try {
    const cardRef = doc(db, "cards", window.NBS_STATE.user.username);
    await updateDoc(cardRef, { dailyLimit: val });
    closeModal('modalLimit');
    showToast('Ліміт успішно збережено!');
  } catch(e) {
    console.error(e);
  }
}

window.showToast = function(msg) {
  const t = document.getElementById('toastPopup');
  document.getElementById('toastMsg').innerText = msg;
  t.classList.add('active');
  setTimeout(() => t.classList.remove('active'), 3000);
}
