import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBuSUZN8d0yAcC_96VvvSnl9fhwDIj-4PY",
    authDomain: "ciya-4c11b.firebaseapp.com",
    projectId: "ciya-4c11b",
    storageBucket: "ciya-4c11b.firebasestorage.app",
    messagingSenderId: "593656122805",
    appId: "1:593656122805:web:9bf0f7ab44544a0b825dfc",
    measurementId: "G-3ZVQ86CG6V"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.syncWithCloud = async (tgUsername, rbxData, idCode, forceIssueDate) => {
    if (!tgUsername) return;
    const payload = {
        telegram: { username: tgUsername },
        updatedAt: new Date().toISOString()
    };
    if (idCode) payload.idCode = idCode;
    if (rbxData) payload.roblox = rbxData;
    if (forceIssueDate) {
        payload.issuedAt = new Date().toISOString();
    }

    try {
        await setDoc(doc(db, "passports", tgUsername), payload, { merge: true });
    } catch (e) { console.error(e); }
};

window.fetchProfile = async (tgUsername) => {
    if (!tgUsername) return null;
    try {
        const snap = await getDoc(doc(db, "passports", tgUsername));
        return snap.exists() ? snap.data() : null;
    } catch (e) { return null; }
};


window.addFineDirect = async (targetUsername, fine) => {
    if (!targetUsername || !fine) return false;
    try {
        const profSnap = await getDoc(doc(db, "passports", targetUsername));
        const data = profSnap.exists() ? profSnap.data() : {};
        const fines = Array.isArray(data.fines) ? data.fines.slice() : [];
        fines.push(fine);
        await setDoc(doc(db, "passports", targetUsername), { fines }, { merge: true });
        return true;
    } catch (e) { console.error('addFineDirect', e); return false; }
};

window.submitPendingFine = async (item) => {
    if (!item) return false;
    try {
        const ref = doc(db, "fines", "pending");
        const snap = await getDoc(ref);
        const list = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
        list.push(item);
        await setDoc(ref, { items: list }, { merge: true });
        return true;
    } catch (e) { console.error('submitPendingFine', e); return false; }
};


window.fetchPendingFines = async () => {
    try {
        const snap = await getDoc(doc(db, "fines", "pending"));
        return snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
    } catch (e) { console.error('fetchPendingFines', e); return []; }
};

window.approvePendingFine = async (pendingId, approverUsername) => {
    try {
        const pendRef = doc(db, "fines", "pending");
        const pendSnap = await getDoc(pendRef);
        const list = pendSnap.exists() && Array.isArray(pendSnap.data().items) ? pendSnap.data().items.slice() : [];
        const idx = list.findIndex(f => f && f._pendingId === pendingId);
        if (idx < 0) return false;

        const item = list.splice(idx, 1)[0];
        const target = item.target;
        if (!target) return false;

        const fine = Object.assign({}, item);
        delete fine._pendingId;
        delete fine.target;
        fine.status = 'unpaid';
        fine.approvedBy = approverUsername || null;
        fine.approvedAt = new Date().toISOString();

        const profSnap = await getDoc(doc(db, "passports", target));
        const data = profSnap.exists() ? profSnap.data() : {};
        const fines = Array.isArray(data.fines) ? data.fines.slice() : [];
        fines.push(fine);

        await setDoc(doc(db, "passports", target), { fines }, { merge: true });
        await setDoc(pendRef, { items: list }, { merge: true });
        return true;
    } catch (e) { console.error('approvePendingFine', e); return false; }
};

window.rejectPendingFine = async (pendingId) => {
    try {
        const pendRef = doc(db, "fines", "pending");
        const pendSnap = await getDoc(pendRef);
        const list = pendSnap.exists() && Array.isArray(pendSnap.data().items) ? pendSnap.data().items.slice() : [];
        const idx = list.findIndex(f => f && f._pendingId === pendingId);
        if (idx < 0) return false;
        list.splice(idx, 1);
        await setDoc(pendRef, { items: list }, { merge: true });
        return true;
    } catch (e) { console.error('rejectPendingFine', e); return false; }
};

const tg = (typeof window !== 'undefined' && window.Telegram) ? window.Telegram.WebApp : null;
if (tg) {
    try { tg.ready(); } catch (e) {}
    try { tg.expand(); } catch (e) {}
    if (tg.initDataUnsafe && tg.initDataUnsafe.user && typeof window.onTelegramAuth === 'function') {
        window.onTelegramAuth(tg.initDataUnsafe.user);
    }
}
