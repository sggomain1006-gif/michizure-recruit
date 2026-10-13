/* 追加6セクションの挙動（FAQ・募集要項トグル・旅程表の路線・下見ノート） */
(() => {
  'use strict';

  const PC_QUERY = '(min-width: 769px)';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const isReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- C FAQ（複数開可・1問目だけ開いた状態から） ---------- */
  const initFaq = () => {
    document.querySelectorAll('.faq__q').forEach((q) => {
      q.addEventListener('click', () => {
        const isOpen = q.getAttribute('aria-expanded') !== 'true';
        q.setAttribute('aria-expanded', String(isOpen));
        q.closest('.faq__item').classList.toggle('is-open', isOpen);
      });
    });
  };

  /* ---------- F 募集要項（SP のみ折り畳み） ---------- */
  const initRequirements = () => {
    const btn = document.querySelector('.req__toggle');
    const all = document.getElementById('req-all');
    if (!btn || !all) return;
    const label = btn.querySelector('.req__toggleText');
    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(isOpen));
      all.classList.toggle('is-open', isOpen);
      label.textContent = isOpen ? '閉じる' : '募集要項をすべて見る';
    });
  };

  /* ---------- A 旅程表の路線 ---------- */
  const route = { wrap: null, svg: null, track: null, branches: [], L: 1, cum: [], thr: [], smallIdx: [], lit: [] };

  const mk = (cls, d) => {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('class', cls);
    p.setAttribute('d', d);
    return p;
  };

  const buildRoute = () => {
    const wrap = document.querySelector('.route');
    if (!wrap) return false;
    const svg = wrap.querySelector('.route__map');
    const wr = wrap.getBoundingClientRect();
    const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - wr.left, r.top + r.height / 2 - wr.top]; };
    const stops = [...wrap.querySelectorAll('.route__stop')];
    const pts = stops.map((li) => center(li.querySelector(':scope > .route__node')));
    const smalls = [...wrap.querySelectorAll('.route__node--small')].map(center);
    if (pts.length < 7 || smalls.length < 3) return false;

    const trackPts = pts.slice(0, 6);
    const trackD = 'M' + trackPts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L');
    const [fx, fy] = pts[5];
    const [nx, ny] = pts[6];
    const isPc = window.matchMedia(PC_QUERY).matches;
    const forkBody = stops[5].querySelector('.route__body').getBoundingClientRect();
    const list = stops[5].querySelector('.route__branches').getBoundingClientRect();
    const f2y = Math.max(fy + 20, forkBody.bottom - wr.top + 14);
    const branchD = smalls.map(([sx, sy], i) => {
      if (isPc) {
        const yb = list.bottom - wr.top - 6;
        const m1 = Math.max(16, (sy - f2y) * 0.5);
        const m2 = Math.max(16, (ny - yb) * 0.5);
        return `M${fx.toFixed(1)} ${fy.toFixed(1)} L${fx.toFixed(1)} ${f2y.toFixed(1)} C${fx.toFixed(1)} ${(f2y + m1).toFixed(1)} ${sx.toFixed(1)} ${(sy - m1).toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)} `
             + `L${sx.toFixed(1)} ${yb.toFixed(1)} C${sx.toFixed(1)} ${(yb + m2).toFixed(1)} ${nx.toFixed(1)} ${(ny - m2).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
      }
      const m1 = Math.max(20, (sy - fy) * 0.55);
      const m2 = Math.max(20, (ny - sy) * 0.55);
      const bend = (i - 1) * 6; // 3本が重ならないよう制御点を少しずらす
      return `M${fx.toFixed(1)} ${fy.toFixed(1)} C${(fx + bend).toFixed(1)} ${(fy + m1).toFixed(1)} ${sx.toFixed(1)} ${(sy - m1).toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)} `
           + `C${sx.toFixed(1)} ${(sy + m2).toFixed(1)} ${(nx + bend).toFixed(1)} ${(ny - m2).toFixed(1)} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    });
    svg.setAttribute('width', wr.width.toFixed(1));
    svg.setAttribute('height', wr.height.toFixed(1));
    svg.setAttribute('viewBox', `0 0 ${wr.width.toFixed(1)} ${wr.height.toFixed(1)}`);
    svg.replaceChildren(
      mk('route__ghost', trackD), ...branchD.map((d) => mk('route__ghost', d)),
      mk('route__track', trackD), ...branchD.map((d) => mk('route__branch', d)),
    );
    route.wrap = wrap;
    route.svg = svg;
    route.track = svg.querySelector('.route__track');
    route.branches = [...svg.querySelectorAll('.route__branch')];
    route.nodes = stops.map((li) => li.querySelector(':scope > .route__node'));
    route.smallNodes = [...wrap.querySelectorAll('.route__node--small')];
    route.cum = [0];
    for (let i = 1; i < trackPts.length; i += 1) {
      route.cum.push(route.cum[i - 1] + Math.hypot(trackPts[i][0] - trackPts[i - 1][0], trackPts[i][1] - trackPts[i - 1][1]));
    }
    route.L = route.track.getTotalLength();
    route.Lb = Math.max(...route.branches.map((b) => b.getTotalLength()));
    route.f1 = route.L / (route.L + route.Lb);
    // 点灯の閾値（タイムライン進捗 0〜1）
    route.thr = route.cum.map((c) => (c / route.L) * route.f1);
    return true;
  };

  const setRouteStatic = () => {
    if (!route.track) return;
    route.track.style.strokeDasharray = 'none';
    route.track.style.strokeDashoffset = '0';
    route.branches.forEach((b) => { b.style.strokeDasharray = 'none'; b.style.strokeDashoffset = '0'; });
  };

  const prepareDash = () => {
    route.track.style.strokeDasharray = String(route.L);
    route.branches.forEach((b) => { const l = b.getTotalLength(); b.style.strokeDasharray = String(l); });
  };

  const lightNodes = (progress) => {
    route.nodes.slice(0, 6).forEach((n, i) => n.classList.toggle('is-lit', progress >= route.thr[i] - 1e-6));
    const mid = route.f1 + (1 - route.f1) * 0.5;
    route.smallNodes.forEach((n) => n.classList.toggle('is-lit', progress >= mid));
    route.nodes[6].classList.toggle('is-lit', progress >= 0.999);
  };

  const routeScroll = (gsap) => {
    if (!buildRoute()) return;
    prepareDash();
    route.tl = gsap.timeline({
      scrollTrigger: { id: 'route', trigger: '.route', start: 'top 70%', end: 'bottom 70%', scrub: 1, invalidateOnRefresh: true },
      onUpdate: () => lightNodes(route.tl.progress()),
    });
    route.tl
      .fromTo(route.track, { strokeDashoffset: () => route.L }, { strokeDashoffset: 0, ease: 'none', duration: route.f1 })
      .fromTo(route.branches, { strokeDashoffset: (i, t) => t.getTotalLength() }, { strokeDashoffset: 0, ease: 'none', duration: 1 - route.f1 });
    lightNodes(0);
    route.animated = true;
  };

  const initRouteStatic = () => {
    if (!buildRoute()) return;
    setRouteStatic();
    let raf = 0;
    let refreshTimer = 0;
    let lastKey = '';
    const keyOf = () => { const r = route.wrap.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}|${window.matchMedia(PC_QUERY).matches}`; };
    lastKey = keyOf();
    const rebuild = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const key = keyOf();
        if (key === lastKey) return; // 実寸が変わっていなければ何もしない（無駄な再計算・refresh を避ける）
        lastKey = key;
        const progress = route.animated && route.tl ? route.tl.progress() : 1;
        const wasAnimated = route.animated;
        if (!buildRoute()) return;
        if (!wasAnimated) { setRouteStatic(); return; }
        prepareDash();
        route.tl.clear();
        route.tl
          .fromTo(route.track, { strokeDashoffset: () => route.L }, { strokeDashoffset: 0, ease: 'none', duration: route.f1 })
          .fromTo(route.branches, { strokeDashoffset: (i, t) => t.getTotalLength() }, { strokeDashoffset: 0, ease: 'none', duration: 1 - route.f1 });
        route.tl.progress(progress);
        lightNodes(progress);
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => window.ScrollTrigger && window.ScrollTrigger.refresh(), 250);
      });
    };
    if (window.ResizeObserver) new ResizeObserver(rebuild).observe(route.wrap);
    window.addEventListener('resize', rebuild);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rebuild);
  };

  /* ---------- 数字のカウントアップ（data-countup。HTMLには最終値を書いておく） ---------- */
  const COUNT_MS = 1400;
  const initCountUp = () => {
    const els = [...document.querySelectorAll('[data-countup]')];
    if (!els.length || isReduced() || !('IntersectionObserver' in window)) return;
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);
    const run = (el) => {
      const target = parseFloat(el.dataset.target);
      const digits = Number(el.dataset.digits);
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / COUNT_MS);
        el.textContent = (target * easeOut(t)).toFixed(digits);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        run(e.target);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => {
      const text = el.textContent.trim();
      el.dataset.target = text;
      el.dataset.digits = String((text.split('.')[1] || '').length);
      // 桁が増えても単位が動かないよう、最終値の幅を先に確保する（フォント読込前・画面幅の変化でもずれない ch 指定）
      el.style.display = 'inline-block';
      el.style.minWidth = el.dataset.digits === '0' ? `${text.length}ch` : `calc(${text.length - 1}ch + .4em)`; // 等幅数字なので字数で決まる。小数点は数字より細いので別に足す
      el.style.textAlign = 'right';
      el.textContent = (0).toFixed(Number(el.dataset.digits));
      io.observe(el);
    });
  };

  /* ---------- 公開 ---------- */
  window.MichiAdd = { routeScroll, debug: () => ({ route }) };

  // ページ内リンク（クリック・ハッシュ付き表示）では content-visibility を外して実高さで着地させる
  const cvOff = () => document.documentElement.classList.add('cv-off');
  if (location.hash) cvOff();
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('a[href^="#"]')) cvOff(); }, true);
  window.addEventListener('hashchange', cvOff);
  initFaq();
  initRequirements();
  initCountUp();
  initRouteStatic();
  if (isReduced()) document.documentElement.classList.add('noanim');
})();
