(function () {
  var F = window.MICHI_FORM;
  var DRAFT_KEY = 'michizure_seminar_draft';
  var form = document.getElementById('seminar-form');
  var slotsBox = document.getElementById('slots');
  var status = document.getElementById('form-status');
  var submitButton = form.querySelector('button[type="submit"]');
  var started = false;
  var submitting = false;

  var $ = function (id) { return document.getElementById(id); };
  var val = function (name) { return (form.elements[name].value || '').trim(); };
  var radios = function (name) { return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]')); };

  /* ---------- 正規化 ---------- */
  var half = function (s) { return s.normalize('NFKC').trim(); };
  var toHiragana = function (s) {
    return s.replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  };

  /* ---------- 検証ルール（null なら OK）---------- */
  var RULES = {
    slot: function () { return form.elements.slot && form.elements.slot.value ? null : '日程を選んでください。'; },
    name: function () { return val('name') ? null : '氏名を入力してください。'; },
    kana: function () {
      var v = val('kana');
      if (!v) { return 'ふりがなを入力してください。'; }
      return /^[ぁ-ゖー゛゜\s　]+$/.test(v) ? null : 'ふりがなはひらがなで入力してください。';
    },
    email: function () {
      var v = val('email');
      if (!v) { return 'メールアドレスを入力してください。'; }
      return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)+$/.test(v) ? null : 'メールアドレスの形式で入力してください。例 hinata@example.com';
    },
    tel: function () {
      var v = val('tel').replace(/[\s\-ー‐]/g, '');
      if (!v) { return '電話番号を入力してください。'; }
      return /^0\d{9,10}$/.test(v) ? null : '電話番号は市外局番から数字だけで入力してください。例 09012345678';
    },
    school: function () { return val('school') ? null : '学校名を入力してください。'; },
    dept: function () { return val('dept') ? null : '学部・学科を入力してください。'; },
    grad: function () {
      var y = Number(val('gradYear'));
      var m = Number(val('gradMonth'));
      if (!y || !m) { return '卒業（予定）の年と月を選んでください。'; }
      if (y === 2027 && m > 3) { return '対象は2027年3月までに卒業見込みの方と、卒業後3年以内の方です。年月を確かめてください。'; }
      return null;
    },
    consent: function () { return form.elements.consent.checked ? null : '個人情報の取り扱いに同意してください。'; }
  };
  var ORDER = ['slot', 'name', 'kana', 'email', 'tel', 'school', 'dept', 'grad', 'consent'];

  var CONTROLS = {
    slot: function () { return radios('slot').filter(function (r) { return !r.disabled; }); },
    grad: function () { return [$('gradYear'), $('gradMonth')]; }
  };
  var controlsOf = function (key) { return CONTROLS[key] ? CONTROLS[key]() : [$(key)]; };

  function showError(key, message) {
    var box = $('err-' + key);
    box.textContent = message || '';
    box.classList.toggle('is-on', Boolean(message));
    controlsOf(key).forEach(function (el) {
      if (message) { el.setAttribute('aria-invalid', 'true'); } else { el.removeAttribute('aria-invalid'); }
    });
    if (message) { F.track('form_error', { field: key }); }
  }
  function check(key) {
    var message = RULES[key]();
    showError(key, message);
    return message;
  }

  /* ---------- 日程の描画 ---------- */
  function renderSlots(selectedId) {
    slotsBox.textContent = '';
    var list = F.slots;
    list.forEach(function (s) {
      var label = document.createElement('label');
      label.className = 'f-slot' + (s.full ? ' is-full' : '');
      var input = document.createElement('input');
      input.type = 'radio'; input.name = 'slot'; input.value = s.id;
      input.setAttribute('aria-describedby', 'err-slot');
      if (s.full) { input.disabled = true; }
      if (s.id === selectedId && !s.full) { input.checked = true; }
      var body = document.createElement('span');
      body.className = 'f-slot__body';
      var add = function (cls, text) {
        var el = document.createElement('span'); el.className = cls; el.textContent = text; body.appendChild(el);
      };
      add('f-slot__date', F.dateLabel(s));
      add('f-slot__time', F.timeLabel(s));
      add('f-slot__place', F.places[s.place]);
      if (s.full) { add('f-slot__full', '満席'); }
      label.appendChild(input); label.appendChild(body);
      slotsBox.appendChild(label);
    });
  }

  /* ---------- 下書き（セッション内で保持）---------- */
  var DRAFT_FIELDS = ['name', 'kana', 'email', 'tel', 'school', 'dept', 'gradYear', 'gradMonth', 'ask'];
  function saveDraft() {
    var data = { slot: form.elements.slot ? form.elements.slot.value : '' };
    DRAFT_FIELDS.forEach(function (n) { data[n] = form.elements[n].value; });
    F.store(DRAFT_KEY, data);
  }
  function restoreDraft() {
    var data = F.load(DRAFT_KEY);
    if (!data) { return; }
    DRAFT_FIELDS.forEach(function (n) { if (typeof data[n] === 'string') { form.elements[n].value = data[n]; } });
    renderSlots(data.slot);
  }

  /* ---------- 計測（gtag があるときだけ）---------- */
  function markStart() {
    if (started) { return; }
    started = true;
    F.track('form_start', { form_id: 'seminar' });
  }

  /* ---------- イベント ---------- */
  form.addEventListener('change', function (e) {
    var t = e.target;
    markStart();
    if (t.name === 'slot') {
      check('slot');
    } else if (t.name === 'gradYear' || t.name === 'gradMonth') {
      if (val('gradYear') && val('gradMonth')) { check('grad'); }
    } else if (t.name === 'consent') {
      check('consent');
    }
    saveDraft();
  });
  form.addEventListener('input', markStart);

  form.addEventListener('focusout', function (e) {
    var t = e.target;
    var key = t.name;
    if (!key || t.type === 'radio' || t.type === 'checkbox' || t.tagName === 'SELECT') { return; }
    if (key === 'kana') { t.value = toHiragana(half(t.value)); }
    if (key === 'email') { t.value = half(t.value); }
    if (key === 'tel') { t.value = half(t.value); }
    if (RULES[key]) { check(key); }
    saveDraft();
  });
  $('gradMonth').addEventListener('blur', function () { if (val('gradYear') && val('gradMonth')) { check('grad'); } });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitting) { return; }
    var firstBad = null;
    var count = 0;
    ORDER.forEach(function (key) {
      if (check(key)) { count += 1; if (!firstBad) { firstBad = key; } }
    });
    if (firstBad) {
      status.textContent = '入力内容をご確認ください。' + count + '件の項目に直しがあります。';
      status.classList.add('is-on');
      var target = controlsOf(firstBad)[0];
      if (target) { target.focus(); target.scrollIntoView({ block: 'center' }); }
      F.track('form_submit_blocked', { errors: count });
      return;
    }
    status.textContent = '';
    status.classList.remove('is-on');
    setSending(true);
    var slotId = val('slot');
    send(buildPayload(slotId)).then(function () {
      F.track('form_submit', { form_id: 'seminar', slot_id: slotId });
      F.store('michizure_seminar_done', { slot: slotId, email: val('email') });
      F.drop(DRAFT_KEY);
      location.href = 'seminar-thanks.html?slot=' + encodeURIComponent(slotId);
    }).catch(function (err) {
      setSending(false);
      status.textContent = '送信できませんでした。通信の状態を確かめて、もう一度「この内容で予約する」を押してください。入力した内容は残っています。';
      status.classList.add('is-on');
      status.scrollIntoView({ block: 'center' });
      F.track('form_send_error', { form_id: 'seminar', reason: err && err.message ? err.message : 'unknown' });
    });
  });

  /* ---------- 送信（スプレッドシートへ）---------- */
  var SEND_TIMEOUT_MS = 15000;
  var requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  function setSending(on) {
    submitting = on;
    submitButton.disabled = on;
    submitButton.setAttribute('aria-busy', on ? 'true' : 'false');
  }
  function buildPayload(slotId) {
    var slot = F.findSlot(slotId);
    return {
      requestId: requestId,
      slot: slotId,
      slotLabel: slot ? F.dateLabel(slot) + ' ' + F.timeLabel(slot) + ' ' + F.places[slot.place] : '',
      name: val('name'),
      kana: toHiragana(val('kana')),
      email: half(val('email')),
      tel: half(val('tel')).replace(/[\s\-ー‐]/g, ''),
      school: val('school'),
      dept: val('dept'),
      gradYear: val('gradYear'),
      gradMonth: val('gradMonth'),
      ask: val('ask'),
      website: val('website')
    };
  }
  function send(payload) {
    if (!F.endpoint) { return Promise.resolve(); }
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, SEND_TIMEOUT_MS);
    /* text/plain にすると事前確認（preflight）が起きず、Apps Script がそのまま受け取れる */
    return fetch(F.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (!res.ok) { throw new Error('http_' + res.status); }
      return res.json();
    }).then(function (data) {
      if (!data || data.ok !== true) { throw new Error(data && data.error ? data.error : 'rejected'); }
    }).finally(function () { clearTimeout(timer); });
  }

  /* ---------- 初期化 ---------- */
  renderSlots('');
  restoreDraft();
  F.track('form_view', { form_id: 'seminar' });
})();
