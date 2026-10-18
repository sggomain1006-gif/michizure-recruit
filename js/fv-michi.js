/* FV を横切って飛ぶミチ。動きを減らす設定では出さない。FV が画面外のときは止める。
   スクロールを始めると右下のチャットボタンまで飛んでいき、着地したら html に is-michiLanded を付ける（chat.js がこれを見てボタンを出す）。
   一番上まで戻ると FV に帰ってまた飛ぶ */
(() => {
  const SRC = 'assets/img/michi-fly/michi-fly.svg';
  const DEPART_AT = 0.12;  /* FV の高さの 12% スクロールしたら飛び立つ */
  const RETURN_AT = 0.04;  /* ほぼ一番上まで戻ったら FV へ帰す */
  const FLIGHT_MS = 1800;
  const LAND_AT = 0.8;     /* 飛行のこの時点でボタンを出し、ミチがボタンに吸い込まれるように見せる */
  const TRIGGER = '.chatBot__trigger';
  const root = document.documentElement;
  const fv = document.querySelector('.fv');
  if (!fv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const img = document.createElement('img');
  img.className = 'fvMichi';
  img.src = SRC;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.decoding = 'async';
  /* 画面の外で休んでいる間（右へ 118vw）や飛行中にミチがはみ出すと、スマホはページ幅が広がったとみなして
     全体を縮小表示し、追従バナーも右へずれる。body の overflow-x: clip では防げないので、枠で切り取る */
  const stage = document.createElement('div');
  stage.className = 'fvMichi__stage';
  stage.appendChild(img);
  fv.appendChild(stage);
  const sky = document.createElement('div');
  sky.className = 'fvMichi__sky';
  document.body.appendChild(sky);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => img.classList.toggle('is-paused', !e.isIntersecting));
    }).observe(fv);
  }

  let state = 'fv'; /* fv → flying → landed */
  let flyer = null;
  let landTimer = null;
  const fvArea = document.querySelector('.js-fv') || fv;

  function setState(next) {
    state = next;
    root.classList.toggle('is-michiAway', next !== 'fv');
    root.classList.toggle('is-michiLanded', next === 'landed');
    document.dispatchEvent(new CustomEvent('michi:change'));
  }

  /* ボタンは隠れている間 translateY でずれているので、CSS の right/bottom から出たときの位置を出す */
  function triggerBox(trigger) {
    const cs = getComputedStyle(trigger);
    const w = parseFloat(cs.width);
    const h = parseFloat(cs.height);
    return { left: innerWidth - parseFloat(cs.right) - w, top: innerHeight - parseFloat(cs.bottom) - h, width: w, height: h };
  }

  function depart() {
    const trigger = document.querySelector(TRIGGER);
    if (!trigger) { setState('landed'); return; } /* チャットがまだ組み上がっていなければ飛ばずに着地扱い */
    const s = img.getBoundingClientRect();
    const t = triggerBox(trigger);
    const w = s.width;
    /* 画面の外で休んでいるときは右上の外から入ってくる */
    const isOff = s.right < 0 || s.left > innerWidth || s.bottom < 0 || s.top > innerHeight;
    const sx = isOff ? innerWidth + w * 0.1 : s.left;
    const sy = isOff ? innerHeight * 0.12 : s.top;
    const k = (t.width * 1.6) / w; /* 羽を広げた絵なので、体がボタンと同じくらいになる倍率 */
    const tx = t.left + t.width / 2 - w / 2;
    const ty = t.top + t.height / 2 - w * 0.45;
    const flip = tx < sx ? -1 : 1; /* 左へ向かうときは向きを反転 */
    /* 一度上へふくらんでから降りる弧 */
    const mx = (sx + tx) / 2 + flip * innerWidth * 0.08;
    const my = Math.min(sy, ty) - innerHeight * 0.06;

    flyer = img.cloneNode(true);
    flyer.className = 'fvMichi__flyer';
    flyer.style.width = w + 'px';
    sky.appendChild(flyer);
    setState('flying');
    /* 区間ごとに緩急をつける（全体に1本の緩急をかけると、前半ほとんど動かず最後に一瞬で落ちる） */
    const anim = flyer.animate([
      { transform: `translate(${sx}px,${sy}px) scale(${flip},1) rotate(-8deg)`, opacity: 1, easing: 'cubic-bezier(.4,0,.6,1)' },
      { transform: `translate(${mx}px,${my}px) scale(${flip * 0.8},.8) rotate(-14deg)`, opacity: 1, offset: 0.35, easing: 'cubic-bezier(.5,0,.5,1)' },
      { transform: `translate(${tx}px,${ty}px) scale(${flip * k},${k}) rotate(6deg)`, opacity: 1, offset: LAND_AT, easing: 'ease-in' },
      { transform: `translate(${tx}px,${ty}px) scale(${flip * k * 0.6},${k * 0.6}) rotate(0deg)`, opacity: 0 }
    ], { duration: FLIGHT_MS, fill: 'forwards' });
    landTimer = setTimeout(() => { if (state === 'flying') setState('landed'); }, FLIGHT_MS * LAND_AT);
    anim.onfinish = removeFlyer;
  }

  function removeFlyer() {
    if (flyer) { flyer.remove(); flyer = null; }
  }

  function comeBack() {
    clearTimeout(landTimer);
    removeFlyer();
    setState('fv');
  }

  function onScroll() {
    const p = window.scrollY / fvArea.offsetHeight;
    if (state === 'fv' && p > DEPART_AT) { depart(); return; }
    if (state !== 'fv' && p < RETURN_AT) { comeBack(); }
  }

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; onScroll(); });
  }, { passive: true });
  /* ページの途中で読み込み直したときは、飛ばさずに着地した状態から始める */
  if (window.scrollY / fvArea.offsetHeight > DEPART_AT) setState('landed');
})();
