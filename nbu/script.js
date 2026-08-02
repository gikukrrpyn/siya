import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
    const authOverlay = document.getElementById('authOverlay');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const appContainer = document.getElementById('appContainer');

    let EXCHANGE_RATE = 0;
    let MY_UID = null;
    let MY_NICK = 'Громадянин';
    let MY_SIGNATURE = null;
    let MY_AVATAR_URL = null;
    let MY_IS_ADMIN = false;

    // Tabs
    const tabs = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
            
            if(tab.dataset.tab === 'history') loadHistory();
        });
    });

    // Check Auth
    if (window.authReady) await window.authReady;
    
    MY_UID = typeof window.firebaseUid === 'function' ? window.firebaseUid() : null;
    if (!MY_UID) {
        loadingOverlay.classList.remove('active');
        authOverlay.classList.add('active');
        return;
    }

    try {
        loadingText.textContent = "Завантаження профілю...";
        
        if (typeof window.fetchProfile === 'function') {
            const profile = await window.fetchProfile(MY_UID);
            if (profile) {
                if (profile.roblox && profile.roblox.username) MY_NICK = profile.roblox.username;
                else if (profile.telegram && profile.telegram.username) MY_NICK = profile.telegram.username;
                else if (profile.telegram && profile.telegram.first_name) MY_NICK = profile.telegram.first_name;
                
                if (profile.signature) MY_SIGNATURE = profile.signature;
                if (profile.roblox && profile.roblox.avatar) MY_AVATAR_URL = profile.roblox.avatar;
            }
        }

        document.getElementById('userName').textContent = MY_NICK;
        document.getElementById('userId').textContent = MY_UID;
        
        // Avatar
        if (typeof window.fetchAvatarMap === 'function' && typeof window.avatarForNick === 'function') {
            await window.fetchAvatarMap();
            const av = window.avatarForNick(MY_NICK);
            if (av) {
                document.getElementById('userAvatar').style.backgroundImage = `url(${av})`;
                if (!MY_AVATAR_URL) MY_AVATAR_URL = av;
            }
        }

        // Check Admin Role
        checkAdminRole();

        loadingText.textContent = "Отримання курсу НБУ...";
        try {
            const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?valcode=EUR&json');
            const data = await response.json();
            if (data && data.length > 0 && data[0].rate) {
                EXCHANGE_RATE = parseFloat(data[0].rate);
            } else throw new Error();
        } catch (e) {
            EXCHANGE_RATE = 51.27; // fallback
        }
        document.getElementById('currentRate').textContent = EXCHANGE_RATE.toFixed(2);

        // Load Balance
        loadingText.textContent = "Отримання балансу...";
        await loadBalance();

        // Init UI
        loadingOverlay.classList.remove('active');
        appContainer.style.display = 'flex';

        // Check if returning from Signature Redirect
        checkPendingTransfer();

    } catch (error) {
        console.error("Initialization error:", error);
        loadingText.textContent = "Помилка завантаження. " + error.message;
        loadingText.style.color = "#ff4444";
    }

    function checkAdminRole() {
        if (!window.players) return;
        const lc = String(MY_NICK).toLowerCase();
        let isAdmin = false;
        
        for (const [frac, arr] of Object.entries(window.players)) {
            if (Array.isArray(arr)) {
                const match = arr.find(item => item && item.username && String(item.username).toLowerCase() === lc);
                if (match && (frac.toLowerCase().includes('адмін') || frac.toLowerCase() === 'адміністрація')) {
                    isAdmin = true;
                    break;
                }
            }
        }
        
        MY_IS_ADMIN = isAdmin;
        if (isAdmin) {
            document.getElementById('adminTabBtn').style.display = 'flex';
        }
    }

    async function getDb() {
        if (window.firebaseDb) return window.firebaseDb;
        for(let i=0; i<10; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (window.firebaseDb) return window.firebaseDb;
        }
        throw new Error("База даних недоступна");
    }

    async function loadBalance() {
        const db = await getDb();
        const docRef = doc(db, "passports", String(MY_UID));
        const snap = await getDoc(docRef);
        let bal = 0;
        if (snap.exists()) {
            bal = parseFloat(snap.data().nbu_balance) || 0;
        }
        
        document.getElementById('balanceGc').textContent = bal;
        const uah = (bal * EXCHANGE_RATE).toFixed(2);
        document.getElementById('balanceUah').textContent = uah.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return bal;
    }

    async function resolveTargetUid(nick) {
        const db = await getDb();
        const str = String(nick).toLowerCase().trim();
        
        // Try RBX index
        const rbxSnap = await getDoc(doc(db, "rbx_index", str));
        if (rbxSnap.exists() && rbxSnap.data().tgId) return String(rbxSnap.data().tgId);
        
        // Try TG index
        const tgSnap = await getDoc(doc(db, "tg_username_index", str));
        if (tgSnap.exists() && tgSnap.data().tgId) return String(tgSnap.data().tgId);
        
        // Try direct Passport ID
        const pSnap = await getDoc(doc(db, "passports", nick.trim()));
        if (pSnap.exists()) return pSnap.id;
        
        return null;
    }

    async function appendTransactionAndBalance(targetUid, newBalance, txData) {
        const db = await getDb();
        const docRef = doc(db, "passports", String(targetUid));
        const snap = await getDoc(docRef);
        const data = snap.exists() ? snap.data() : {};
        const history = Array.isArray(data.nbu_history) ? data.nbu_history.slice() : [];
        
        history.push(Object.assign({}, txData, { timestamp: new Date().toISOString() }));
        
        await setDoc(docRef, { nbu_balance: newBalance, nbu_history: history }, { merge: true });
    }

    // --- Transfer Logic ---
    const sendBtn = document.getElementById('sendTransferBtn');
    sendBtn.addEventListener('click', async () => {
        const toNick = document.getElementById('transferTo').value;
        const amount = parseFloat(document.getElementById('transferAmount').value);
        const note = document.getElementById('transferNote').value || 'Переказ';
        const status = document.getElementById('transferStatus');
        
        status.className = 'status-msg';
        status.textContent = '';
        
        if (!toNick || isNaN(amount) || amount <= 0) {
            status.textContent = 'Будь ласка, введіть коректні дані.';
            status.classList.add('error');
            return;
        }

        // Check if signature exists before redirecting
        if (!MY_SIGNATURE) {
            status.textContent = 'У вас немає графічного підпису. Створіть його у додатку СіЯ.';
            status.classList.add('error');
            return;
        }

        // Save state and redirect to main app for signature
        localStorage.setItem('nbu_pending_transfer', JSON.stringify({ toNick, amount, note }));
        window.location.href = '../../index.html?action=sign_nbu';
    });

    async function checkPendingTransfer() {
        const params = new URLSearchParams(window.location.search);
        if (params.get('signed') === 'true') {
            const pendingStr = localStorage.getItem('nbu_pending_transfer');
            if (pendingStr) {
                try {
                    const pending = JSON.parse(pendingStr);
                    localStorage.removeItem('nbu_pending_transfer');
                    
                    // Switch to transfer tab to show receipt
                    document.querySelector('[data-tab="transfer"]').click();
                    
                    await executeTransfer(pending.toNick, pending.amount, pending.note);
                    
                } catch (e) {
                    console.error("Помилка відновлення переказу", e);
                }
            }
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    async function executeTransfer(toNick, amount, note) {
        const status = document.getElementById('transferStatus');
        const sendBtn = document.getElementById('sendTransferBtn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Обробка...';

        try {
            const currentBal = await loadBalance();
            if (currentBal < amount) {
                throw new Error("Недостатньо коштів на балансі.");
            }

            const targetUid = await resolveTargetUid(toNick);
            if (!targetUid) {
                throw new Error("Користувача не знайдено.");
            }
            if (targetUid === MY_UID) {
                throw new Error("Не можна переказати самому собі.");
            }

            const db = await getDb();
            
            // Deduct from me
            await appendTransactionAndBalance(MY_UID, currentBal - amount, {
                type: 'transfer_out',
                amount: amount,
                toNick: toNick,
                toUid: targetUid,
                note: note
            });
            
            // Add to target
            const targetRef = doc(db, "passports", targetUid);
            const targetSnap = await getDoc(targetRef);
            const targetBal = targetSnap.exists() ? (parseFloat(targetSnap.data().nbu_balance) || 0) : 0;
            
            await appendTransactionAndBalance(targetUid, targetBal + amount, {
                type: 'transfer_in',
                amount: amount,
                fromNick: MY_NICK,
                fromUid: MY_UID,
                note: note
            });

            // Update UI
            await loadBalance();
            showReceipt(MY_NICK, toNick, amount, note);
            
            document.getElementById('transferTo').value = '';
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferNote').value = '';
            status.textContent = 'Переказ успішно надіслано!';
            status.classList.add('success');
            
        } catch (e) {
            status.textContent = e.message || 'Помилка переказу.';
            status.classList.add('error');
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Надіслати переказ';
        }
    }

    function showReceipt(sender, receiver, amount, note) {
        const rc = document.getElementById('receiptCard');
        rc.classList.remove('hidden');
        
        const uah = (amount * EXCHANGE_RATE).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        document.getElementById('receiptUah').textContent = `${uah} ₴`;
        
        document.getElementById('receiptSender').textContent = sender;
        document.getElementById('receiptReceiver').textContent = receiver;
        document.getElementById('receiptGc').textContent = amount;
        document.getElementById('receiptNote').textContent = note;
        
        const pad = (n) => n.toString().padStart(2, '0');
        const d = new Date();
        document.getElementById('receiptDate').textContent = `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        
        let sigHtml = '';
        if (MY_SIGNATURE) {
            sigHtml = `<img src="${MY_SIGNATURE}" style="max-height:60px; margin-top:16px; filter: contrast(1.2) drop-shadow(0 2px 2px rgba(0,0,0,0.1));">`;
        }
        
        if (!document.getElementById('receiptSignature')) {
            rc.querySelector('.details-box').insertAdjacentHTML('afterend', `<div id="receiptSignature" style="text-align:center;">${sigHtml}</div>`);
        } else {
            document.getElementById('receiptSignature').innerHTML = sigHtml;
        }
    }

    // --- Admin Logic ---
    const adminBtn = document.getElementById('adminActionBtn');
    adminBtn.addEventListener('click', async () => {
        if (!MY_IS_ADMIN) return;
        
        const targetNick = document.getElementById('adminTargetUser').value;
        const amount = parseFloat(document.getElementById('adminAmount').value);
        const action = document.getElementById('adminActionType').value;
        const note = document.getElementById('adminNote').value;
        const status = document.getElementById('adminStatus');
        
        status.className = 'status-msg';
        status.textContent = '';
        
        if (!targetNick || isNaN(amount) || amount <= 0 || !note) {
            status.textContent = 'Заповніть всі поля (включаючи причину).';
            status.classList.add('error');
            return;
        }

        adminBtn.disabled = true;
        adminBtn.textContent = 'Обробка...';

        try {
            const targetUid = await resolveTargetUid(targetNick);
            if (!targetUid) throw new Error("Користувача не знайдено.");

            const db = await getDb();
            const targetRef = doc(db, "passports", targetUid);
            const targetSnap = await getDoc(targetRef);
            let bal = targetSnap.exists() ? (parseFloat(targetSnap.data().nbu_balance) || 0) : 0;
            
            if (action === 'remove' && bal < amount) {
                throw new Error("У користувача недостатньо коштів для конфіскації.");
            }
            
            const newBal = action === 'add' ? bal + amount : bal - amount;
            
            await appendTransactionAndBalance(targetUid, newBal, {
                type: action === 'add' ? 'admin_add' : 'admin_remove',
                amount: amount,
                adminNick: MY_NICK,
                adminUid: MY_UID,
                note: note
            });

            status.textContent = `Успішно. Новий баланс: ${newBal} GC.`;
            status.classList.add('success');
            document.getElementById('adminTargetUser').value = '';
            document.getElementById('adminAmount').value = '';
            document.getElementById('adminNote').value = '';
            
            if (targetUid === MY_UID) await loadBalance();

        } catch (e) {
            status.textContent = e.message || 'Помилка дії.';
            status.classList.add('error');
        } finally {
            adminBtn.disabled = false;
            adminBtn.textContent = 'Виконати дію';
        }
    });

    // --- History Logic ---
    async function loadHistory() {
        const list = document.getElementById('historyList');
        list.innerHTML = '<div class="empty-state">Завантаження...</div>';
        
        try {
            const db = await getDb();
            const docRef = doc(db, "passports", String(MY_UID));
            const snap = await getDoc(docRef);
            
            let history = [];
            if (snap.exists() && Array.isArray(snap.data().nbu_history)) {
                history = snap.data().nbu_history.slice();
            }
            
            // Sort by newest first
            history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            if (history.length === 0) {
                list.innerHTML = '<div class="empty-state">Історія порожня.</div>';
                return;
            }

            list.innerHTML = '';
            const pad = (n) => n.toString().padStart(2, '0');
            
            history.forEach(tx => {
                let title = 'Транзакція';
                let amountCls = '';
                let prefix = '';
                
                if (tx.type === 'transfer_out') {
                    title = `Переказ для: ${tx.toNick}`;
                    amountCls = 'negative';
                    prefix = '-';
                } else if (tx.type === 'transfer_in') {
                    title = `Переказ від: ${tx.fromNick}`;
                    amountCls = 'positive';
                    prefix = '+';
                } else if (tx.type === 'admin_add') {
                    title = `Емісія НБУ (від ${tx.adminNick})`;
                    amountCls = 'positive';
                    prefix = '+';
                } else if (tx.type === 'admin_remove') {
                    title = `Конфіскація НБУ (від ${tx.adminNick})`;
                    amountCls = 'negative';
                    prefix = '-';
                }

                const d = new Date(tx.timestamp);
                let dateStr = '';
                if (!isNaN(d.getTime())) {
                    dateStr = `${pad(d.getDate())}.${pad(d.getMonth()+1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                }

                list.innerHTML += `
                    <div class="history-item">
                        <div class="history-info">
                            <div class="history-title">${title}</div>
                            <div class="history-date">${dateStr} • ${tx.note || ''}</div>
                        </div>
                        <div class="history-amount ${amountCls}">${prefix}${tx.amount} GC</div>
                    </div>
                `;
            });
            
        } catch (e) {
            console.error(e);
            list.innerHTML = '<div class="empty-state">Помилка завантаження історії.</div>';
        }
    }
});
