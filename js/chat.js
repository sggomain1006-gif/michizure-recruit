/* チャットボット：右下の丸ボタンと窓。
   返答は自分のサーバー（/api/chat → Claude）が作る（段階3）。サーバーに届かないときはスプシの keywords タブとのキーワード一致で答える（段階2） */
(function () {
  'use strict';

  var CONFIG = {
    title: 'ミチに聞く',
    sub: 'ミチヅレ新卒採用の案内係',
    greeting: 'こんにちは。ミチヅレ新卒採用の案内係、ツバメのミチです。説明会や募集要項について、わかる範囲でお答えします。',
    suggestions: ['説明会の日程は？', '給与はいくらですか？', '地元で働けますか？', '書類選考はありますか？'],
    note: 'AIが自動で回答しています。',
    placeholder: '質問を入力してください',
    avatar: 'assets/img/54_michi_greet-240.webp',
    errorAnswer: 'うまくお答えできませんでした。時間をおいてもう一度お試しください。',
    maxLength: 200
  };
  /* スプシを「ウェブに公開」したCSV。タブは gid で選ぶ（タブを作り直したら gid も変わるので直す） */
  var SHEET = {
    base: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTtK5OHI0i83c5-BimeIJtNl5HB-ATXIuld26fM6LTSSR6MjAiyoaBBU0EV2ss3b5_TMi2lerHHhZtz/pub',
    gids: { keywords: '0', settings: '661187282' }
  };
  var PAPA_SRC = 'vendor/papaparse.min.js';
  var LOAD_TIMEOUT_MS = 8000;
  var REPLY_DELAY_MS = 400; /* 一瞬で返すと読まれずに流れるので、少し間を置く */
  var API_URL = '/api/chat';
  var API_TIMEOUT_MS = 20000;
  var HISTORY_TURNS = 6; /* サーバーへ送る直近の会話（3往復） */
  var SP_QUERY = '(max-width: 768px)';

  var root = document.documentElement;
  var els = {};
  var isOpen = false;
  var isBusy = false;

  /* ---------- スプシの読み込み（最初に開いたときに1回だけ） ---------- */
  var dataPromise = null;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.Papa) { resolve(); return; }
      var tag = document.createElement('script');
      tag.src = src;
      tag.onload = resolve;
      tag.onerror = function () { reject(new Error('script_load_failed')); };
      document.head.appendChild(tag);
    });
  }
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }
  function fetchTab(name) {
    /* 末尾の _ はブラウザの5分キャッシュをよけて、スプシの更新を再読み込みで拾うため */
    var url = SHEET.base + '?gid=' + SHEET.gids[name] + '&single=true&output=csv&_=' + Date.now();
    return fetch(url).then(function (res) {
      if (!res.ok) { throw new Error('http_' + res.status); }
      return res.text();
    }).then(function (text) {
      return window.Papa.parse(text, { header: true, skipEmptyLines: 'greedy' }).data;
    });
  }
  function toSettings(rows) {
    var map = {};
    rows.forEach(function (row) { if (row.key) { map[String(row.key).trim()] = String(row.value || '').trim(); } });
    return {
      greeting: map.greeting || CONFIG.greeting,
      suggestions: map.suggestions ? map.suggestions.split('|').map(function (q) { return q.trim(); }).filter(Boolean) : CONFIG.suggestions,
      errorAnswer: map.error_answer || CONFIG.errorAnswer
    };
  }
  function loadData() {
    if (!dataPromise) {
      dataPromise = withTimeout(loadScript(PAPA_SRC).then(function () {
        return Promise.all([fetchTab('keywords'), fetchTab('settings')]);
      }), LOAD_TIMEOUT_MS).then(function (tabs) {
        return { keywords: tabs[0], settings: toSettings(tabs[1]) };
      });
      dataPromise.catch(function () { dataPromise = null; }); /* 失敗したら次の質問でもう一度読みにいく */
    }
    return dataPromise;
  }

  /* ---------- キーワード判定（全角半角・大文字小文字をそろえてから部分一致。上の行から順に見る） ---------- */
  function normalize(s) { return String(s || '').normalize('NFKC').toLowerCase(); }
  function findAnswer(input, rows) {
    var text = normalize(input);
    for (var i = 0; i < rows.length; i++) {
      var keyword = String(rows[i].keyword || '').trim();
      if (!keyword) { continue; } /* keyword が空の行は「どれにも当てはまらないとき」用なので最後に使う */
      var hit = keyword.split('|').some(function (k) { k = normalize(k).trim(); return k && text.indexOf(k) !== -1; });
      if (hit) { return rows[i].answer; }
    }
    var fallback = rows.filter(function (row) { return !String(row.keyword || '').trim(); })[0];
    return fallback ? fallback.answer : CONFIG.errorAnswer;
  }

  /* ---------- 返答 ---------- */
  var history = [];
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function askServer(text) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) { ctrl.abort(); } }, API_TIMEOUT_MS);
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-HISTORY_TURNS) }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok || !data.ok || !data.answer) { throw new Error(data.error || 'http_' + res.status); }
        return data.answer;
      });
    }).finally(function () { clearTimeout(timer); });
  }
  function askKeywords(text) {
    return Promise.all([loadData(), wait(REPLY_DELAY_MS)]).then(function (res) { return findAnswer(text, res[0].keywords); });
  }
  function getReply(text) {
    return askServer(text).catch(function () { return askKeywords(text); }).then(function (answer) {
      history = history.concat([{ role: 'user', content: text }, { role: 'assistant', content: answer }]).slice(-HISTORY_TURNS);
      return answer;
    });
  }

  /* ---------- DOM ---------- */
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" fill="none"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 20.5l18-8.5L3 3.5l2.6 7.2L14 12l-8.4 1.3z"/></svg>';

  function build() {
    var wrap = document.createElement('div');
    wrap.className = 'chatBot';
    wrap.innerHTML =
      '<button class="chatBot__trigger" type="button" aria-expanded="false" aria-controls="chatBot-window" aria-label="' + CONFIG.title + '（チャットを開く）">' +
        '<span class="chatBot__triggerFace"><img class="chatBot__triggerImg" src="' + CONFIG.avatar + '" width="240" height="214" alt="" decoding="async"></span>' +
        '<span class="chatBot__badge" aria-hidden="true">質問する</span>' +
      '</button>' +
      '<section class="chatBot__window" id="chatBot-window" role="dialog" aria-labelledby="chatBot-title" tabindex="-1">' +
        '<header class="chatBot__head">' +
          '<span class="chatBot__avatar"><img src="' + CONFIG.avatar + '" width="240" height="214" alt="" decoding="async"></span>' +
          '<div><h2 class="chatBot__title" id="chatBot-title">' + CONFIG.title + '</h2><p class="chatBot__sub">' + CONFIG.sub + '</p></div>' +
          '<button class="chatBot__close" type="button" aria-label="チャットを閉じる">' + ICON_CLOSE + '</button>' +
        '</header>' +
        '<div class="chatBot__log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<form class="chatBot__form" novalidate>' +
          '<div class="chatBot__row">' +
            '<label class="sr-only" for="chatBot-input">質問</label>' +
            '<textarea class="chatBot__input" id="chatBot-input" rows="1" maxlength="' + CONFIG.maxLength + '" placeholder="' + CONFIG.placeholder + '" enterkeyhint="send"></textarea>' +
            '<button class="chatBot__send" type="submit" aria-label="送信する" disabled>' + ICON_SEND + '</button>' +
          '</div>' +
          '<p class="chatBot__note">' + CONFIG.note + '</p>' +
        '</form>' +
      '</section>';
    document.body.appendChild(wrap);

    els.trigger = wrap.querySelector('.chatBot__trigger');
    els.window = wrap.querySelector('.chatBot__window');
    els.close = wrap.querySelector('.chatBot__close');
    els.log = wrap.querySelector('.chatBot__log');
    els.form = wrap.querySelector('.chatBot__form');
    els.input = wrap.querySelector('.chatBot__input');
    els.send = wrap.querySelector('.chatBot__send');
    els.window.inert = true;
  }

  /* ---------- メッセージ ---------- */
  function addMessage(role, text) {
    var row = document.createElement('div');
    row.className = 'chatBot__msg chatBot__msg--' + role;
    var bubble = document.createElement('p');
    bubble.className = 'chatBot__bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    els.log.appendChild(row);
    scrollToEnd();
    return row;
  }
  function addTyping() {
    var row = document.createElement('div');
    row.className = 'chatBot__msg chatBot__msg--bot';
    row.setAttribute('aria-label', '返答を準備しています');
    row.innerHTML = '<p class="chatBot__bubble"><span class="chatBot__typing" aria-hidden="true"><span></span><span></span><span></span></span></p>';
    els.log.appendChild(row);
    scrollToEnd();
    return row;
  }
  var errorAnswer = CONFIG.errorAnswer; /* settings タブを読めたらその文に替わる */
  function currentErrorAnswer() { return errorAnswer; }
  function addSuggestions(suggestions) {
    var list = document.createElement('ul');
    list.className = 'chatBot__suggest';
    list.setAttribute('aria-label', 'よくある質問');
    suggestions.forEach(function (q) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chatBot__chip';
      btn.textContent = q;
      btn.addEventListener('click', function () { ask(q); });
      li.appendChild(btn);
      list.appendChild(li);
    });
    els.log.appendChild(list);
  }
  function scrollToEnd() { els.log.scrollTop = els.log.scrollHeight; }

  /* ---------- 送信 ---------- */
  function ask(raw) {
    var text = String(raw || '').trim().slice(0, CONFIG.maxLength);
    if (!text || isBusy) { return; }
    isBusy = true;
    addMessage('user', text);
    els.input.value = '';
    resizeInput();
    updateSend();
    var typing = addTyping();
    getReply(text).then(function (reply) {
      typing.remove();
      addMessage('bot', reply);
    }).catch(function () {
      typing.remove();
      addMessage('error', currentErrorAnswer());
    }).finally(function () {
      isBusy = false;
      updateSend();
    });
  }
  function updateSend() { els.send.disabled = isBusy || !els.input.value.trim(); }
  function resizeInput() {
    els.input.style.height = 'auto';
    els.input.style.height = els.input.scrollHeight + 2 + 'px';
  }

  /* ---------- 開閉 ---------- */
  var greeted = false;
  /* あいさつとおすすめの質問はスプシの settings タブから。読めなければ CONFIG の文で出す */
  function greet() {
    var typing = addTyping();
    loadData().then(function (data) { return data.settings; }, function () { return CONFIG; }).then(function (settings) {
      typing.remove();
      errorAnswer = settings.errorAnswer || errorAnswer;
      addMessage('bot', settings.greeting);
      addSuggestions(settings.suggestions);
    });
  }
  function open() {
    if (isOpen) { return; }
    isOpen = true;
    if (!greeted) { greeted = true; greet(); }
    els.window.inert = false;
    els.window.classList.add('is-open');
    els.trigger.setAttribute('aria-expanded', 'true');
    root.classList.add('is-chatOpen');
    if (matchMedia(SP_QUERY).matches) {
      els.window.focus({ preventScroll: true }); /* スマホではキーボードを勝手に出さない */
    } else {
      els.input.focus({ preventScroll: true });
    }
  }
  function close() {
    if (!isOpen) { return; }
    isOpen = false;
    els.window.classList.remove('is-open');
    els.window.inert = true;
    els.trigger.setAttribute('aria-expanded', 'false');
    root.classList.remove('is-chatOpen');
    els.trigger.focus({ preventScroll: true });
  }

  /* ---------- イベント ---------- */
  function bind() {
    els.trigger.addEventListener('click', function () { if (isOpen) { close(); } else { open(); } });
    els.close.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen) { close(); } });
    els.form.addEventListener('submit', function (e) { e.preventDefault(); ask(els.input.value); });
    els.input.addEventListener('input', function () { resizeInput(); updateSend(); });
    els.input.addEventListener('keydown', function (e) {
      /* 日本語の変換を確定する Enter では送らない */
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) { return; }
      e.preventDefault();
      ask(els.input.value);
    });
  }

  /* CSS を読み終えてから部品を出す（読み込み途中の崩れた丸ボタンを見せない）。ページの表示を優先して load 後に始める */
  var CSS_HREF = 'css/chat.css?v=3';
  function init() {
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    link.onload = function () { build(); bind(); };
    document.head.appendChild(link);
  }
  if (document.readyState === 'complete') { init(); } else { window.addEventListener('load', init); }
})();
