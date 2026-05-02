
function finesFormatDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (!isNaN(d.getTime()) && /\d{4}/.test(String(s))) {
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return String(s);
}

function genPendingId() {
  return 'pf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function todayPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  const headWords   = ['комісар', 'начальник', 'директор', 'голова', 'генерал', 'шеріф'];
  const seniorWords = ['полковник', 'підполковник', 'капітан', 'майор'];

  const P = window.state && window.state.players;
  if (P) {
    const pKey = Object.keys(P).find(k => k.toLowerCase() === lc);
    if (pKey && Array.isArray(P[pKey]) && P[pKey][0]) {
      const pd = P[pKey][0];
      const cat  = String(pd.category || '').toLowerCase();
      const role = String(pd.role     || '').toLowerCase();
      if (cat.includes('адмін') || cat === 'адміністрація') {
        return { canIssueDirectly: true, canSubmitPending: true, canApprove: true,
                 label: pd.role || 'Адміністрація', issuerType: 'admin' };
      }
      if (cat.includes('суд')) {
        return { canIssueDirectly: true, canSubmitPending: true, canApprove: true,
                 label: pd.role || 'Суд', issuerType: 'court' };
      }
      const factionMap = [
        { cats: ['поліція', 'нпс', 'police'], label: 'НПС',  issuerType: 'police' },
        { cats: ['набс', 'nabs'],             label: 'НАБС', issuerType: 'police' },
        { cats: ['сбс', 'sbs'],               label: 'СБС',  issuerType: 'police' },
        { cats: ['дбр', 'dbr'],               label: 'ДБР',  issuerType: 'police' },
      ];
      for (const fm of factionMap) {
        if (fm.cats.some(c => cat.includes(c))) {
          const isHead   = headWords.some(w => role.includes(w));
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
    { key: 'police', label: 'НПС',  issuerType: 'police' },
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
    const role   = String(r.role || '').toLowerCase();
    const isHead   = headWords.some(w => role.includes(w));
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
window.getUserIssuerRole = getUserIssuerRole;

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

  const note = role.canIssueDirectly
    ? `<div class="ff-hint">Ви виписуєте напряму як <b>${role.label}</b>. Штраф з'явиться у профілі гравця одразу.</div>`
    : `<div class="ff-hint">Ви <b>${role.label}</b>. Штраф піде на <b>затвердження адміністрації</b>. Без скріну доказів штраф не приймуть.</div>`;

  const today      = todayPlusDays(0);
  const default30  = todayPlusDays(30);

  root.innerHTML = `
    ${note}
    <label class="ff-field">
      <span class="ff-label">Roblox username гравця *</span>
      <div style="position:relative;">
        <input id="fine-target-rbx" class="ff-input" type="text" placeholder="RobloxNick" autocomplete="off"
               oninput="fineRbxLookup(this.value)">
        <div id="fine-rbx-status" style="font-size:12px;margin-top:4px;min-height:18px;color:var(--text2,#888);"></div>
      </div>
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
    <div class="ff-field">
      <span class="ff-label">${evidenceLabel}</span>
      <div class="ff-file-row">
        <label class="ff-file-button" id="fine-evidence-label" for="fine-evidence-file">Обрати фото</label>
        <input id="fine-evidence-file" type="file" accept="image/png,image/jpeg"
               onchange="handleEvidenceFile(this)" style="display:none;">
      </div>
      <div id="fine-evidence-preview"></div>
    </div>
    <button type="button" class="ff-submit" onclick="submitFineForm()">
      ${role.canIssueDirectly ? 'Виписати штраф' : 'Надіслати на затвердження'}
    </button>
    <div id="fine-status-msg" class="ff-status"></div>
  `;
}
window.renderIssueFineForm = renderIssueFineForm;

let _rbxLookupTimer = null;
let _resolvedTgUsername = null;

async function fineRbxLookup(val) {
  const statusEl = document.getElementById('fine-rbx-status');
  _resolvedTgUsername = null;
  clearTimeout(_rbxLookupTimer);
  if (!val || val.trim().length < 3) {
    if (statusEl) statusEl.textContent = '';
    return;
  }
  if (statusEl) statusEl.textContent = '🔍 Шукаємо...';

  _rbxLookupTimer = setTimeout(async () => {
    const rbxNick = val.trim();
    if (typeof window.findTgByRobloxUsername === 'function') {
      const tg = await window.findTgByRobloxUsername(rbxNick);
      if (tg) {
        _resolvedTgUsername = tg;
        if (statusEl) statusEl.innerHTML = `<span style="color:#30d158;">✅ Знайдено: @${tg}</span>`;
        return;
      }
    }
    const L = window.state && window.state.licenses;
    const P = window.state && window.state.players;
    const lc = rbxNick.toLowerCase();
    let found = false;
    if (P) {
      const pKey = Object.keys(P).find(k => k.toLowerCase() === lc);
      if (pKey) { found = true; }
    }
    if (!found && L) {
      for (const section of Object.values(L)) {
        if (!section || typeof section !== 'object') continue;
        if (Array.isArray(section)) {
          if (section.some(i => i && i.username && i.username.toLowerCase() === lc)) { found = true; break; }
        } else {
          if (Object.keys(section).some(k => k.toLowerCase() === lc)) { found = true; break; }
        }
      }
    }
    if (found) {
      _resolvedTgUsername = '__rbx__' + rbxNick; 
      if (statusEl) statusEl.innerHTML = `<span style="color:#f0a000;">⚠️ Гравець є на сервері, але не в СіЯ — штраф збережеться по Roblox нікнейму</span>`;
    } else {
      _resolvedTgUsername = null;
      if (statusEl) statusEl.innerHTML = `<span style="color:#ff4d4d;">❌ Гравця не знайдено</span>`;
    }
  }, 600);
}
window.fineRbxLookup = fineRbxLookup;

async function submitFineForm() {
  const role = window._issueFineRole || getUserIssuerRole();
  const rbxNickEl  = document.getElementById('fine-target-rbx');
  const amount     = (document.getElementById('fine-amount') || {}).value;
  const dueDate    = (document.getElementById('fine-due')    || {}).value;
  const reason     = (document.getElementById('fine-reason') || {}).value;
  const evidenceData = window._fineEvidence || null;
  const status     = document.getElementById('fine-status-msg');

  const rbxNick = (rbxNickEl && rbxNickEl.value) ? rbxNickEl.value.trim() : '';

  if (!rbxNick)         { if (status) status.textContent = 'Вкажіть Roblox username гравця'; return; }
  if (!_resolvedTgUsername) { if (status) status.textContent = 'Гравця не знайдено — зачекайте перевірки або введіть ніку знову'; return; }
  if (!amount || isNaN(Number(amount))) { if (status) status.textContent = 'Сума має бути числом'; return; }
  if (!dueDate)         { if (status) status.textContent = 'Вкажіть дату оплати'; return; }
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
    issuedByRbx: (window.state && window.state.roblox && window.state.roblox.username) || null,
    targetRbx: rbxNick,
    amount: Number(amount),
    dueDate: dueDate,
    reason: reason.trim(),
    issuedAt: new Date().toISOString()
  };

  if (status) status.textContent = 'Зберігаємо…';

  let ok = false;

  const isRbxOnly = _resolvedTgUsername.startsWith('__rbx__');
  const targetTg  = isRbxOnly ? null : _resolvedTgUsername;
  const targetRbx = isRbxOnly ? _resolvedTgUsername.slice(7) : rbxNick;

  if (role.canIssueDirectly) {
    fine.status = 'unpaid';
    if (evidenceData) fine.evidence = evidenceData;

    if (targetTg && typeof window.addFineDirect === 'function') {
      ok = await window.addFineDirect(targetTg, fine);
    } else if (!targetTg) {
      const pending = Object.assign({}, fine, {
        target: null,
        targetRbx,
        evidence: evidenceData || null,
        status: 'pending_rbx',
        _pendingId: genPendingId(),
        proposedBy: proposerTg || null,
        proposedAt: new Date().toISOString(),
        rbxOnly: true
      });
      if (typeof window.submitPendingFine === 'function') {
        ok = await window.submitPendingFine(pending);
      }
    }
  } else {
    const pending = Object.assign({}, fine, {
      target: targetTg || null,
      targetRbx,
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
      const msgDirect  = isRbxOnly
        ? '🕒 Гравець ще не в СіЯ — штраф збережено, буде видно після реєстрації'
        : '✅ Штраф виписано';
      status.textContent = role.canIssueDirectly
        ? msgDirect
        : '🕒 Штраф надіслано на затвердження';
      ['fine-target-rbx','fine-amount','fine-due','fine-reason']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
      const rbxSt = document.getElementById('fine-rbx-status');
      if (rbxSt) rbxSt.textContent = '';
      _resolvedTgUsername = null;
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
window.submitFineForm = submitFineForm;

function openIssueFineForm() {
  const role = getUserIssuerRole();
  if (!role.canIssueDirectly && !role.canSubmitPending) {
    typeof showToast === 'function' && showToast('У вас немає прав виписувати штрафи');
    return;
  }
  window._issueFineRole = role;
  window._fineEvidence  = null;
  _resolvedTgUsername   = null;
  typeof switchScreen === 'function' && switchScreen('issue-fine');
}
window.openIssueFineForm = openIssueFineForm;

async function renderFines() {
  const list = document.getElementById('fines-list');
  if (!list) return;

  list.innerHTML = `<div class="fines-loading">Завантаження…</div>`;

  const username = (window.state && window.state.telegram && window.state.telegram.username)
    || (typeof tgUser !== 'undefined' && tgUser && tgUser.username);

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
        <div class="fines-empty-sub">Тут з'являться штрафи від суду, адміністрації або НПС.</div>
      </div>`;
    return;
  }

  list.innerHTML = fines.map((f, i) => {
    const num  = f.id != null ? String(f.id) : String(i + 1);
    const issuer = classifyFineIssuer(f);
    const amount = (f.amount != null && f.amount !== '') ? `${f.amount} €` : '—';
    const due  = f.dueDate ? finesFormatDate(f.dueDate) : (f.due || '—');
    const paid = isFinePaid(f);
    const isPendingPayment = !paid && pendingPaymentIds.includes(f.id);
    const statusLabel = paid ? 'Сплачено' : (isPendingPayment ? 'На перевірці' : 'Несплачено');
    const statusColor = paid ? '#30d158' : (isPendingPayment ? '#f0a000' : '#ff4d4d');
    const reason  = f.reason ? `<div class="fine-card-reason">${f.reason}</div>` : '';
    const payBtn  = (!paid && !isPendingPayment)
      ? `<div class="fine-actions" style="margin-top:8px;">
           <button type="button" class="fine-btn fine-btn-approve" style="width:100%;"
                   onclick="openPayFineModal('${f.id}', ${f.amount || 0})">💳 Сплатити</button>
         </div>`
      : (isPendingPayment
          ? `<div class="ff-hint" style="margin-top:8px;font-size:12px;color:#f0a000;">⏳ Чекає підтвердження адміністрації</div>`
          : '');
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
        ${f.issuedByRbx ? `<div class="fine-card-row">
          <span class="fine-card-label">Офіцер:</span>
          <span class="fine-card-value">${f.issuedByRbx}</span>
        </div>` : ''}
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
window.renderFines = renderFines;

async function renderPendingApprovalSection() {
  const root = document.getElementById('fines-pending-list');
  if (!root) return;

  const role = getUserIssuerRole();
  if (!role.canApprove) { root.innerHTML = ''; return; }

  root.innerHTML = `<div class="fines-loading">Завантажуємо чергу…</div>`;

  let items = [];
  if (typeof window.fetchPendingFines === 'function') {
    try { items = await window.fetchPendingFines(); } catch (e) { console.error(e); }
  }

  if (role.issuerType !== 'admin' && role.issuerType !== 'court') {
    items = items.filter(i => i && i.issuerType === role.issuerType);
  }

  if (!items.length) { root.innerHTML = ''; return; }

  root.innerHTML = `
    <div class="profile-section-title" style="padding:0 4px 6px;">🕒 На затвердження (${items.length})</div>
    ${items.map(it => {
      const issuer = classifyFineIssuer(it);
      const amount = (it.amount != null && it.amount !== '') ? `${it.amount} €` : '—';
      const due    = it.dueDate ? finesFormatDate(it.dueDate) : '—';
      const evidence = it.evidence
        ? `<img class="fine-evidence-img" src="${it.evidence}" alt="доказ"
               onclick="openEvidenceFull('${it._pendingId}')"
               style="max-width:100%;border-radius:10px;max-height:200px;object-fit:contain;margin-top:6px;cursor:zoom-in;">`
        : '<div class="ff-preview-info">⚠️ Без доказу</div>';
      const targetStr = it.target
        ? `@${it.target}`
        : (it.targetRbx ? `Roblox: ${it.targetRbx}` : '—');
      return `
        <div class="fine-card fine-card-pending">
          <div class="fine-card-header">
            <div class="fine-card-num">Штраф ${it.id || '—'}</div>
            <div class="fine-card-status" style="color:#f0a000;">
              <span class="fine-status-dot" style="background:#f0a000;"></span>ОЧІКУЄ
            </div>
          </div>
          <div class="fine-card-row"><span class="fine-card-label">Кому:</span><span class="fine-card-value">${targetStr}</span></div>
          <div class="fine-card-row"><span class="fine-card-label">Roblox:</span><span class="fine-card-value">${it.targetRbx || '—'}</span></div>
          <div class="fine-card-row"><span class="fine-card-label">Виписав:</span><span class="fine-card-value">${issuer.icon} ${issuer.label}${it.proposedBy ? ' (@' + it.proposedBy + ')' : ''}${it.issuedByRbx ? ' · ' + it.issuedByRbx : ''}</span></div>
          <div class="fine-card-row"><span class="fine-card-label">Сума:</span><span class="fine-card-value fine-card-amount">${amount}</span></div>
          <div class="fine-card-row"><span class="fine-card-label">До:</span><span class="fine-card-value">${due}</span></div>
          ${it.reason ? `<div class="fine-card-reason">${it.reason}</div>` : ''}
          <div style="margin-top:6px;">${evidence}</div>
          <div class="fine-actions">
            <button type="button" class="fine-btn fine-btn-approve"
                    onclick="approveFineUI('${it._pendingId}')">✅ Затвердити</button>
            <button type="button" class="fine-btn fine-btn-reject"
                    onclick="rejectFineUI('${it._pendingId}')">❌ Відхилити</button>
          </div>
        </div>`;
    }).join('')}`;
}
window.renderPendingApprovalSection = renderPendingApprovalSection;


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
          <div class="fine-card-status" style="color:#f0a000;">
            <span class="fine-status-dot" style="background:#f0a000;"></span>Очікує
          </div>
        </div>
        <div class="fine-card-row"><span class="fine-card-label">Гравець:</span><span class="fine-card-value">@${it.username || '—'}</span></div>
        <div class="fine-card-row"><span class="fine-card-label">Дата:</span><span class="fine-card-value">${it.submittedAt ? finesFormatDate(it.submittedAt.slice(0,10)) : '—'}</span></div>
        ${it.evidence
          ? `<img class="fine-evidence-img" src="${it.evidence}" alt="оплата"
                 onclick="openEvidenceFull('${it._paymentId}')"
                 style="max-width:100%;border-radius:10px;max-height:200px;object-fit:contain;margin-top:8px;cursor:zoom-in;">`
          : '<div class="ff-preview-info">⚠️ Без скріншоту</div>'}
        <div class="fine-actions" style="margin-top:10px;">
          <button type="button" class="fine-btn fine-btn-approve"
                  onclick="approvePaymentUI('${it._paymentId}')">✅ Підтвердити оплату</button>
          <button type="button" class="fine-btn fine-btn-reject"
                  onclick="rejectPaymentUI('${it._paymentId}')">❌ Відхилити</button>
        </div>
      </div>`).join('')}`;
}
window.renderPaymentRequestsSection = renderPaymentRequestsSection;

async function approveFineUI(pendingId) {
  if (typeof window.approvePendingFine !== 'function') return;
  const approver = window.state && window.state.telegram && window.state.telegram.username;
  const ok = await window.approvePendingFine(pendingId, approver);
  if (ok) {
    typeof showToast === 'function' && showToast('✅ Штраф затверджено');
    renderPendingApprovalSection();
  } else {
    typeof showToast === 'function' && showToast('❌ Не вдалося затвердити');
  }
}
window.approveFineUI = approveFineUI;

async function rejectFineUI(pendingId) {
  if (typeof window.rejectPendingFine !== 'function') return;
  const ok = await window.rejectPendingFine(pendingId);
  if (ok) {
    typeof showToast === 'function' && showToast('Штраф відхилено');
    renderPendingApprovalSection();
  } else {
    typeof showToast === 'function' && showToast('❌ Не вдалося відхилити');
  }
}
window.rejectFineUI = rejectFineUI;

async function approvePaymentUI(paymentId) {
  if (typeof window.approvePaymentRequest !== 'function') return;
  const approver = window.state && window.state.telegram && window.state.telegram.username;
  const ok = await window.approvePaymentRequest(paymentId, approver);
  if (ok) {
    typeof showToast === 'function' && showToast('✅ Оплату підтверджено');
    renderPaymentRequestsSection();
  } else {
    typeof showToast === 'function' && showToast('❌ Не вдалося підтвердити');
  }
}
window.approvePaymentUI = approvePaymentUI;

async function rejectPaymentUI(paymentId) {
  if (typeof window.rejectPaymentRequest !== 'function') return;
  const ok = await window.rejectPaymentRequest(paymentId);
  if (ok) {
    typeof showToast === 'function' && showToast('Запит відхилено');
    renderPaymentRequestsSection();
  } else {
    typeof showToast === 'function' && showToast('❌ Не вдалося відхилити');
  }
}
window.rejectPaymentUI = rejectPaymentUI;

function openEvidenceFull(id) {
  const img = document.querySelector(`.fine-evidence-img[onclick*="${id}"]`);
  if (!img) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:24px;cursor:zoom-out;';
  overlay.innerHTML = `<img src="${img.getAttribute('src')}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:12px;">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
window.openEvidenceFull = openEvidenceFull;

function updateIssueFineButtonVisibility() {
  const btn = document.getElementById('btn-issue-fine');
  if (!btn) return;
  const role = getUserIssuerRole();
  btn.style.display = (role.canIssueDirectly || role.canSubmitPending) ? '' : 'none';
}
window.updateIssueFineButtonVisibility = updateIssueFineButtonVisibility;

function openPendingFinesScreen() {
  typeof switchScreen === 'function' && switchScreen('fines');
  renderPendingApprovalSection();
  renderPaymentRequestsSection();
}
window.openPendingFinesScreen = openPendingFinesScreen;
