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

    // Set issuedAt only on first creation (forceIssueDate = true means new passport)
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

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    window.onTelegramAuth(tg.initDataUnsafe.user);
}