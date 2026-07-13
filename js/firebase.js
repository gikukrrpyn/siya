import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  initializeFirestore, doc, setDoc, getDoc, deleteDoc,
  collection, getDocs, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp, where
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyBuSUZN8d0yAcC_96VvvSnl9fhwDIj-4PY",
  authDomain: "ciya-4c11b.firebaseapp.com",
  projectId: "ciya-4c11b",
  storageBucket: "ciya-4c11b.firebasestorage.app",
  messagingSenderId: "593656122805",
  appId: "1:593656122805:web:9bf0f7ab44544a0b825dfc",
  measurementId: "G-3ZVQ86CG6V"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

const meId = () => {
  const t = window.state && window.state.telegram;
  if (t && t.id) return String(t.id);
  if (t && t.username) return String(t.username);
  return null;
};

const roleNow = () => {
  try { return (window.getUserIssuerRole && window.getUserIssuerRole()) || {}; } catch (e) { return {}; }
};

const isAdmin = () => {
  const r = roleNow();
  return !!r.canApprove;
};

const mustAdmin = () => {
  if (!isAdmin()) throw new Error('NO_ADMIN');
  return true;
};

window.chatPublishKey = async (id, jwk) => {
  if (!id || !jwk) return false;
  const my = meId();
  if (!my || String(my) !== String(id)) return false;
  try {
    const pub = JSON.stringify(jwk);
    if (pub.length > 3000) return false;
    await setDoc(doc(db, "chat_keys", String(id)), { pub, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.chatGetKey = async (id) => {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "chat_keys", String(id)));
    if (!snap.exists()) return null;
    const raw = snap.data().pub;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) { return null; }
};

window.chatHeartbeat = async (id) => {
  if (!id) return false;
  const my = meId();
  if (!my || String(my) !== String(id)) return false;
  try {
    await setDoc(doc(db, "chat_presence", String(id)), { lastSeen: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.chatGetPresence = async (id) => {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, "chat_presence", String(id)));
    return snap.exists() ? (snap.data().lastSeen || null) : null;
  } catch (e) { return null; }
};

window.chatSetProfile = async (id, name) => {
  if (!id) return false;
  const my = meId();
  if (!my || String(my) !== String(id)) return false;
  try {
    await setDoc(doc(db, "chat_profiles", String(id)), { name: String(name || '').slice(0, 40), updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.chatListContacts = async () => {
  try {
    const [pSnap, prSnap, kSnap] = await Promise.all([
      getDocs(query(collection(db, "passports"), limit(2000))),
      getDocs(collection(db, "chat_presence")),
      getDocs(collection(db, "chat_keys"))
    ]);

    let profiles = {};
    try {
      const profSnap = await getDocs(query(collection(db, "chat_profiles"), limit(5000)));
      profSnap.forEach(d => { profiles[d.id] = (d.data() || {}).name || null; });
    } catch (e) {}

    const presence = {};
    prSnap.forEach(d => { presence[d.id] = (d.data() || {}).lastSeen || null; });

    const hasKey = {};
    kSnap.forEach(d => { hasKey[d.id] = true; });

    const out = [];
    pSnap.forEach(d => {
      const data = d.data() || {};
      const rbx = data.roblox || null;
      out.push({
        id: d.id,
        username: profiles[d.id] || (rbx && rbx.username) || (data.telegram && data.telegram.username) || d.id,
        avatar: (rbx && rbx.avatar) || null,
        tgUsername: (data.telegram && data.telegram.username) || null,
        hasKey: !!hasKey[d.id],
        lastSeen: presence[d.id] || null
      });
    });
    return out;
  } catch (e) { return []; }
};

window.chatLastTimes = async (chatIds) => {
  const out = {};
  if (!Array.isArray(chatIds)) return out;
  await Promise.all(chatIds.map(async (cid) => {
    if (!cid) return;
    try {
      const q = query(collection(db, "chats", String(cid), "messages"), orderBy("createdAt", "desc"), limit(1));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const c = (d.data() || {}).createdAt;
        out[cid] = (c && typeof c.toMillis === 'function') ? c.toMillis() : 0;
      });
    } catch (e) {}
  }));
  return out;
};

window.chatSubscribe = (chatId, cb) => {
  if (!chatId) return () => {};
  try {
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => { list.push(Object.assign({ _id: d.id }, d.data() || {})); });
      cb(list);
    }, () => {});
  } catch (e) { return () => {}; }
};

window.chatSend = async (chatId, msg) => {
  if (!chatId || !msg) return false;
  const my = meId();
  if (!my) return false;
  if (String(msg.from) !== String(my)) return false;
  try {
    const payload = { from: String(msg.from), iv: String(msg.iv), data: String(msg.data), createdAt: serverTimestamp() };
    if (msg.fromName) payload.fromName = String(msg.fromName);
    if (msg.replyTo) payload.replyTo = String(msg.replyTo);
    if (msg.mediaUrl) payload.mediaUrl = String(msg.mediaUrl);
    if (msg.media) payload.media = String(msg.media);
    if (msg.mediaIv) payload.mediaIv = String(msg.mediaIv);
    if (msg.mediaRef) payload.mediaRef = String(msg.mediaRef);
    await addDoc(collection(db, "chats", chatId, "messages"), payload);
    return true;
  } catch (e) { return false; }
};

window.chatEditMessage = async (chatId, msgId, payload) => {
  if (!chatId || !msgId || !payload) return false;
  const my = meId();
  if (!my) return false;
  try {
    const ref = doc(db, "chats", chatId, "messages", String(msgId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const old = snap.data() || {};
    if (String(old.from) !== String(my)) return false;
    await setDoc(ref, { iv: String(payload.iv), data: String(payload.data), edited: new Date().toISOString() }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.chatDeleteMessage = async (chatId, msgId) => {
  if (!chatId || !msgId) return false;
  const my = meId();
  if (!my) return false;
  try {
    const ref = doc(db, "chats", chatId, "messages", String(msgId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const old = snap.data() || {};
    if (String(old.from) !== String(my)) return false;
    await deleteDoc(ref);
    return true;
  } catch (e) { return false; }
};

window.chatUploadMedia = async (chatId, payload) => {
  if (!chatId || !payload || !Array.isArray(payload.chunks)) return null;
  const my = meId();
  if (!my) return null;
  try {
    const ref = await addDoc(collection(db, "chats", chatId, "media"), { n: payload.chunks.length, createdAt: new Date().toISOString() });
    const mid = ref.id;
    for (let i = 0; i < payload.chunks.length; i++) {
      await setDoc(doc(db, "chats", chatId, "media", mid, "parts", String(i)), { d: payload.chunks[i] });
    }
    return mid;
  } catch (e) { return null; }
};

window.chatLoadMedia = async (chatId, mediaId) => {
  if (!chatId || !mediaId) return null;
  try {
    const head = await getDoc(doc(db, "chats", chatId, "media", mediaId));
    if (!head.exists()) return null;
    const n = (head.data() || {}).n || 0;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const s = await getDoc(doc(db, "chats", chatId, "media", mediaId, "parts", String(i)));
      parts.push(s.exists() ? ((s.data() || {}).d || '') : '');
    }
    return { b64: parts.join('') };
  } catch (e) { return null; }
};

window.chatReact = async (chatId, msgId, emoji, userId) => {
  if (!chatId || !msgId || !emoji || !userId) return false;
  const my = meId();
  if (!my || String(userId) !== String(my)) return false;
  try {
    const ref = doc(db, "chats", chatId, "messages", String(msgId));
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() || {};
    const reactions = data.reactions || {};
    const arr = Array.isArray(reactions[emoji]) ? reactions[emoji].slice() : [];
    const idx = arr.indexOf(String(userId));
    if (idx >= 0) arr.splice(idx, 1); else arr.push(String(userId));
    if (arr.length) reactions[emoji] = arr; else delete reactions[emoji];
    await setDoc(ref, { reactions }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.chatMarkRead = async (chatId, userId) => {
  if (!chatId || !userId) return false;
  const my = meId();
  if (!my || String(userId) !== String(my)) return false;
  try {
    await setDoc(doc(db, "chats", chatId, "reads", String(userId)), { at: serverTimestamp() }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.chatSubscribeReads = (chatId, cb) => {
  if (!chatId) return () => {};
  try {
    return onSnapshot(collection(db, "chats", chatId, "reads"), (snap) => {
      const reads = {};
      snap.forEach(d => { reads[d.id] = (d.data() || {}).at || null; });
      cb(reads);
    }, () => {});
  } catch (e) { return () => {}; }
};

window.chatCreateGroup = async (opts) => {
  if (!opts || !opts.name || !Array.isArray(opts.members) || !opts.owner) return null;
  const my = meId();
  if (!my || String(opts.owner) !== String(my)) return null;
  try {
    const data = { name: String(opts.name).slice(0, 80), members: opts.members.map(String), owner: String(opts.owner), createdAt: new Date().toISOString() };
    if (opts.avatar) data.avatar = String(opts.avatar);
    const ref = await addDoc(collection(db, "chat_groups"), data);
    return ref.id;
  } catch (e) { return null; }
};

window.chatListGroups = async (myId) => {
  if (!myId) return [];
  const my = meId();
  if (!my || String(myId) !== String(my)) return [];
  try {
    const snap = await getDocs(collection(db, "chat_groups"));
    const out = [];
    snap.forEach(d => {
      const data = d.data() || {};
      if (Array.isArray(data.members) && data.members.indexOf(String(myId)) >= 0) {
        out.push({ id: d.id, name: data.name || 'Група', members: data.members, owner: data.owner, avatar: data.avatar || null, desc: data.desc || '' });
      }
    });
    return out;
  } catch (e) { return []; }
};

window.chatGetGroup = async (groupId) => {
  if (!groupId) return null;
  try {
    const s = await getDoc(doc(db, "chat_groups", groupId));
    return s.exists() ? Object.assign({ id: s.id }, s.data()) : null;
  } catch (e) { return null; }
};

window.chatGetGroupWrap = async (groupId, memberId) => {
  if (!groupId || !memberId) return null;
  const my = meId();
  if (!my || String(memberId) !== String(my)) return null;
  try {
    const snap = await getDoc(doc(db, "chat_groups", groupId, "wrapped", String(memberId)));
    return snap.exists() ? snap.data() : null;
  } catch (e) { return null; }
};

window.chatUpdateGroup = async (groupId, patch) => {
  if (!groupId || !patch) return false;
  const my = meId();
  if (!my) return false;
  try {
    const g = await getDoc(doc(db, "chat_groups", groupId));
    if (!g.exists()) return false;
    const data = g.data() || {};
    if (!Array.isArray(data.members) || data.members.indexOf(String(my)) < 0) return false;
    await setDoc(doc(db, "chat_groups", groupId), patch, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.chatAddGroupWrap = async (groupId, memberId, wrap, ownerId) => {
  if (!groupId || !memberId || !wrap) return false;
  const my = meId();
  if (!my || String(ownerId) !== String(my)) return false;
  try {
    const g = await getDoc(doc(db, "chat_groups", groupId));
    if (!g.exists()) return false;
    const gd = g.data() || {};
    if (String(gd.owner) !== String(my)) return false;
    await setDoc(doc(db, "chat_groups", groupId, "wrapped", String(memberId)), { iv: wrap.iv, data: wrap.data, from: String(wrap.from || ownerId || '') });
    return true;
  } catch (e) { return false; }
};

window.chatDeleteGroup = async (groupId) => {
  if (!groupId) return false;
  const my = meId();
  if (!my) return false;
  try {
    const g = await getDoc(doc(db, "chat_groups", groupId));
    if (!g.exists()) return false;
    const gd = g.data() || {};
    if (String(gd.owner) !== String(my)) return false;
    try {
      const w = await getDocs(collection(db, "chat_groups", groupId, "wrapped"));
      await Promise.all(w.docs.map(d => deleteDoc(doc(db, "chat_groups", groupId, "wrapped", d.id))));
    } catch (e) {}
    await deleteDoc(doc(db, "chat_groups", groupId));
    return true;
  } catch (e) { return false; }
};

window.syncWithCloud = async (tgUser, rbxData, idCode, forceIssueDate) => {
  const tgId = (tgUser && typeof tgUser === 'object') ? String(tgUser.id) : null;
  const tgName = (tgUser && typeof tgUser === 'object') ? tgUser.username : tgUser;
  const key = tgId || tgName;
  const my = meId();
  if (!key || !my || String(key) !== String(my)) return;

  const payload = {
    telegram: tgId ? { id: tgId, username: tgName || null, first_name: tgUser.first_name || null, last_name: tgUser.last_name || null } : { username: tgName },
    updatedAt: new Date().toISOString()
  };
  if (idCode) payload.idCode = String(idCode).slice(0, 40);
  if (rbxData) payload.roblox = rbxData;
  if (forceIssueDate) payload.issuedAt = new Date().toISOString();

  try { await setDoc(doc(db, "passports", key), payload, { merge: true }); } catch (e) {}

  if (rbxData && rbxData.username) {
    try { await setDoc(doc(db, "rbx_index", String(rbxData.username).toLowerCase()), { tgId: tgId || null, telegram: tgName || null }, { merge: true }); } catch (e) {}
  }
  if (tgId && tgName) {
    try { await setDoc(doc(db, "tg_username_index", String(tgName).toLowerCase()), { tgId }, { merge: true }); } catch (e) {}
  }
};


window.findProfileByIdCode = async (idCodeStr) => {
  if (!idCodeStr) return null;
  let raw = String(idCodeStr).trim();
  let noSpaces = raw.replace(/\s+/g, '');
  let normalized = noSpaces.toUpperCase();
  let spaced = normalized.split('').join(' ');
  try {
    // Exact match of what user typed
    const q0 = query(collection(db, "passports"), where("idCode", "==", raw));
    const snap0 = await getDocs(q0);
    if (!snap0.empty) return snap0.docs[0].data();
    
    // No spaces exact match
    const q0_1 = query(collection(db, "passports"), where("idCode", "==", noSpaces));
    const snap0_1 = await getDocs(q0_1);
    if (!snap0_1.empty) return snap0_1.docs[0].data();

    const q1 = query(collection(db, "passports"), where("idCode", "==", spaced));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) return snap1.docs[0].data();
    
    const q2 = query(collection(db, "passports"), where("idCode", "==", normalized));
    const snap2 = await getDocs(q2);
    if (!snap2.empty) return snap2.docs[0].data();
  } catch (e) { console.error(e); }
  return null;
};

window.fetchProfile = async (tgUserOrName) => {
  if (!tgUserOrName) return null;
  const tgId = (typeof tgUserOrName === 'object') ? String(tgUserOrName.id) : null;
  const tgName = (typeof tgUserOrName === 'object') ? tgUserOrName.username : tgUserOrName;
  try {
    if (tgId) {
      const snap = await getDoc(doc(db, "passports", tgId));
      if (snap.exists()) return snap.data();
    }
    if (tgName) {
      const snap = await getDoc(doc(db, "passports", String(tgName)));
      if (snap.exists()) return snap.data();
    }
    return null;
  } catch (e) { return null; }
};

window.findTgByRobloxUsername = async (rbxUsername) => {
  if (!rbxUsername) return null;
  try {
    const snap = await getDoc(doc(db, "rbx_index", String(rbxUsername).toLowerCase()));
    return snap.exists() ? (snap.data().tgId || snap.data().telegram) : null;
  } catch (e) { return null; }
};

window.createDocToken = async (docId, ownerTgId) => {
  const my = meId();
  if (!docId || !ownerTgId || !my || String(ownerTgId) !== String(my)) return null;

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const arr = new Uint8Array(9);
  crypto.getRandomValues(arr);
  const token = Array.from(arr).map(b => chars[b % chars.length]).join('');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 3 * 60 * 1000);

  try {
    await setDoc(doc(db, "doc_tokens", token), { docId, owner: String(ownerTgId), createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
    return token;
  } catch (e) { return null; }
};

window.consumeDocToken = async (token) => {
  if (!token) return null;
  try {
    const snap = await getDoc(doc(db, "doc_tokens", token));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (new Date(data.expiresAt) < new Date()) {
      try { await deleteDoc(doc(db, "doc_tokens", token)); } catch (e) {}
      return null;
    }
    return data;
  } catch (e) { return null; }
};

window.addFineDirect = async (targetId, fine) => {
  if (!targetId || !fine) return false;
  const r = roleNow();
  if (!r.canIssueDirectly) return false;

  try {
    let key = targetId;

    const snap1 = await getDoc(doc(db, "passports", String(targetId)));
    if (!snap1.exists()) {
      const idxSnap = await getDoc(doc(db, "tg_username_index", String(targetId).toLowerCase()));
      if (idxSnap.exists()) key = idxSnap.data().tgId;
    }

    const profSnap = await getDoc(doc(db, "passports", String(key)));
    const data = profSnap.exists() ? profSnap.data() : {};
    const fines = Array.isArray(data.fines) ? data.fines.slice() : [];
    fines.push(fine);

    await setDoc(doc(db, "passports", String(key)), { fines }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.submitPendingFine = async (item) => {
  if (!item) return false;
  const r = roleNow();
  if (!r.canIssueDirectly && !r.canSubmitPending) return false;
  try {
    const ref = doc(db, "fines", "pending");
    const snap = await getDoc(ref);
    const list = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
    if (list.length >= 500) return false;
    list.push(item);
    await setDoc(ref, { items: list }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.fetchPendingFines = async () => {
  try {
    const snap = await getDoc(doc(db, "fines", "pending"));
    return snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
  } catch (e) { return []; }
};

window.approvePendingFine = async (pendingId, approverTgId) => {
  try {
    mustAdmin();
  } catch (e) {
    return false;
  }

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
    fine.approvedBy = approverTgId || null;
    fine.approvedAt = new Date().toISOString();

    let key = target;

    const snap1 = await getDoc(doc(db, "passports", String(target)));
    if (!snap1.exists()) {
      const idxSnap = await getDoc(doc(db, "tg_username_index", String(target).toLowerCase()));
      if (idxSnap.exists()) key = idxSnap.data().tgId;
    }

    const profSnap = await getDoc(doc(db, "passports", String(key)));
    const data = profSnap.exists() ? profSnap.data() : {};
    const fines = Array.isArray(data.fines) ? data.fines.slice() : [];
    fines.push(fine);

    await setDoc(doc(db, "passports", String(key)), { fines }, { merge: true });
    await setDoc(pendRef, { items: list }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.rejectPendingFine = async (pendingId) => {
  try {
    mustAdmin();
  } catch (e) {
    return false;
  }

  try {
    const pendRef = doc(db, "fines", "pending");
    const pendSnap = await getDoc(pendRef);
    const list = pendSnap.exists() && Array.isArray(pendSnap.data().items) ? pendSnap.data().items.slice() : [];
    const idx = list.findIndex(f => f && f._pendingId === pendingId);
    if (idx < 0) return false;
    list.splice(idx, 1);
    await setDoc(pendRef, { items: list }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.submitPaymentRequest = async (item) => {
  if (!item) return false;
  const my = meId();
  if (!my) return false;
  if (item.tgId && String(item.tgId) !== String(my)) return false;
  try {
    const ref = doc(db, "fines", "payments");
    const snap = await getDoc(ref);
    const list = snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
    if (list.length >= 500) return false;
    list.push(item);
    await setDoc(ref, { items: list }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.fetchPaymentRequests = async () => {
  try {
    const snap = await getDoc(doc(db, "fines", "payments"));
    return snap.exists() && Array.isArray(snap.data().items) ? snap.data().items : [];
  } catch (e) { return []; }
};

window.approvePaymentRequest = async (paymentId, approverTgId) => {
  try {
    mustAdmin();
  } catch (e) {
    return false;
  }

  try {
    const payRef = doc(db, "fines", "payments");
    const paySnap = await getDoc(payRef);
    const list = paySnap.exists() && Array.isArray(paySnap.data().items) ? paySnap.data().items.slice() : [];
    const idx = list.findIndex(p => p && p._paymentId === paymentId);
    if (idx < 0) return false;

    const item = list.splice(idx, 1)[0];
    let key = item.username || item.tgId;

    if (key) {
      const snap1 = await getDoc(doc(db, "passports", String(key)));
      if (!snap1.exists()) {
        const idxSnap = await getDoc(doc(db, "tg_username_index", String(key).toLowerCase()));
        if (idxSnap.exists()) key = idxSnap.data().tgId;
      }

      const profRef = doc(db, "passports", String(key));
      const profSnap = await getDoc(profRef);
      const data = profSnap.exists() ? profSnap.data() : {};
      const fines = Array.isArray(data.fines) ? data.fines.slice() : [];
      const fineIdx = fines.findIndex(f => f && f.id === item.fineId);

      if (fineIdx >= 0) {
        fines[fineIdx] = Object.assign({}, fines[fineIdx], { status: 'paid', paidAt: new Date().toISOString(), paidApprovedBy: approverTgId || null });
      }

      await setDoc(profRef, { fines }, { merge: true });
    }

    await setDoc(payRef, { items: list }, { merge: true });
    return true;
  } catch (e) { return false; }
};

window.rejectPaymentRequest = async (paymentId) => {
  try {
    mustAdmin();
  } catch (e) {
    return false;
  }

  try {
    const payRef = doc(db, "fines", "payments");
    const paySnap = await getDoc(payRef);
    const list = paySnap.exists() && Array.isArray(paySnap.data().items) ? paySnap.data().items.slice() : [];
    const idx = list.findIndex(p => p && p._paymentId === paymentId);
    if (idx < 0) return false;
    list.splice(idx, 1);
    await setDoc(payRef, { items: list }, { merge: true });
    return true;
  } catch (e) { return false; }
};

const tg = (typeof window !== 'undefined' && window.Telegram) ? window.Telegram.WebApp : null;
if (tg) {
  try { tg.ready(); } catch (e) {}
  try { tg.expand(); } catch (e) {}
  if (tg.initData && typeof tg.initData === 'string' && tg.initData.trim().length > 0) {
    const checkAuth = setInterval(() => {
      if (typeof window.onTelegramAuth === 'function') {
        clearInterval(checkAuth);
        try {
          const params = new URLSearchParams(tg.initData);
          const hash = params.get('hash');
          const authDate = params.get('auth_date');
          const userStr = params.get('user');
          
          if (hash && authDate && userStr) {
            const authTime = parseInt(authDate, 10);
            const now = Math.floor(Date.now() / 1000);
            // 24 hours expiration
            if (!isNaN(authTime) && (now - authTime <= 86400)) {
              window.onTelegramAuth(JSON.parse(userStr));
            }
          }
        } catch(e) {}
      }
    }, 50);
  }
}

window.meId = meId;
window.isAdmin = isAdmin;
window.mustAdmin = mustAdmin;
