(() => {
  'use strict';

  const PC_QUERY = '(min-width: 769px)';
  const RESIZE_DEBOUNCE_MS = 100;
  const BUBBLE_SWAP_MS = 300;
  const AUTOPLAY_MS = 3000;
  const SLIDE_SPEED_MS = 300;
  const CLIP_OPEN = 'inset(0% 0% 0% 0%)';
  // data-from（道が届く向き）→ 開き始めの切り抜き
  const CLIP_FROM = { left: 'inset(0% 100% 0% 0%)', right: 'inset(0% 0% 0% 100%)', top: 'inset(0% 0% 100% 0%)', bottom: 'inset(100% 0% 0% 0%)' };
  // WORK STYLE の周りの写真: 出発位置(px)・長さ・開始位置（タイムライン上）
  const WORK_FROM = {
    top: { x: 0, y: -160, d: 0.6, at: 0.15 },
    left: { x: -180, y: 40, d: 0.5, at: 0.25 },
    bottom: { x: 30, y: 200, d: 0.7, at: 0.35 },
    right: { x: 200, y: -30, d: 0.55, at: 0.45 },
    drop: { x: 0, y: -260, d: 0.8, at: 0.05 },
  };

  const root = document.documentElement;
  const isReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- fixed banner（FV から表示） ---------- */
  const initBanner = () => {
    const banner = document.querySelector('.l-fvBanner');
    if (banner) banner.classList.add('is-visible'); /* FV から最後まで出しておく */
  };

  /* ---------- FV 背景動画（スマホは縦、PC は横。動きを減らす設定と省データ時は静止画のまま） ---------- */
  const initFvVideo = () => {
    const video = document.querySelector('.js-fvVideo');
    if (!video || isReduced() || (navigator.connection && navigator.connection.saveData)) return;
    const pc = window.matchMedia('(min-width: 769px)');
    let isVisible = true; /* FV か Statement が画面に入っているか（下の IntersectionObserver が更新する） */
    const setSource = () => {
      const src = pc.matches ? video.dataset.srcPc : video.dataset.srcSp;
      if (video.getAttribute('src') === src) return;
      video.classList.remove('is-playing');
      video.src = src;
      if (isVisible) video.play().catch(() => {}); /* 途中の位置で読み込み直したときは、画面外で再生し始めない */
    };
    video.addEventListener('playing', () => video.classList.add('is-playing'));
    pc.addEventListener('change', setSource);
    /* 動画（2〜3MB）は最初の1コマと同じ静止画を先に出しているので、ページの読み込みが終わってから取りに行き、
       FV の文字やフォント・画像と帯域を取り合わないようにする */
    if (document.readyState === 'complete') setSource(); else window.addEventListener('load', setSource, { once: true });
    /* FV と、背景が透けて見える Statement を過ぎたら止める */
    const areas = [document.querySelector('.js-fv'), document.querySelector('.l-topStatement')].filter(Boolean);
    if (!('IntersectionObserver' in window) || !areas.length) return;
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      isVisible = seen.size > 0;
      if (!video.getAttribute('src')) return; /* 動画はまだ取りに行っていない（load 後に setSource が見て判断する） */
      if (isVisible) video.play().catch(() => {}); else video.pause();
    });
    areas.forEach((a) => io.observe(a));
  };

  /* ---------- Statement の道順（写真の中心を通る点線。配置が変わるたびに引き直す） ---------- */
  const ROUTE_LEAD = 0.35; // 最初と最後の写真から外へ伸ばす長さ（写真幅に対する割合）
  const initStatementRoute = () => {
    const area = document.querySelector('.js-topStatement');
    const svg = area && area.querySelector('.stRoute');
    if (!svg) return;
    const paths = svg.querySelectorAll('path');
    const draw = () => {
      const box = area.getBoundingClientRect();
      const pts = [...area.querySelectorAll('.js-topStatement-img')].map((ph) => {
        const r = ph.getBoundingClientRect();
        return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2, w: r.width };
      });
      if (pts.length < 2) return;
      const first = pts[0];
      const last = pts[pts.length - 1];
      // 道は写真の顔を横切らないよう、隣どうしの写真の中間（すき間）を通す
      const mids = pts.slice(1).map((b, i) => ({ x: (pts[i].x + b.x) / 2, y: (pts[i].y + b.y) / 2 }));
      const all = [{ x: first.x - first.w * (0.5 + ROUTE_LEAD), y: first.y - first.w * 0.45 }, ...mids, { x: last.x - last.w * 0.2, y: last.y + last.w * (0.75 + ROUTE_LEAD) }];
      // 点どうしを縦に膨らむ3次曲線でつなぐ（ジグザグがS字にうねる）
      let d = `M${all[0].x.toFixed(1)} ${all[0].y.toFixed(1)}`;
      for (let i = 1; i < all.length; i += 1) {
        const a = all[i - 1];
        const b = all[i];
        const my = (a.y + b.y) / 2;
        d += ` C${a.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
      }
      svg.setAttribute('viewBox', `0 0 ${box.width.toFixed(1)} ${box.height.toFixed(1)}`);
      paths.forEach((p) => p.setAttribute('d', d));
    };
    draw();
    let timer;
    const redraw = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const before = paths[0] && paths[0].getAttribute('d');
        draw();
        /* 道の長さが変わったら、道が伸びるアニメーションの長さも測り直させる */
        if (window.ScrollTrigger && paths[0] && paths[0].getAttribute('d') !== before) window.ScrollTrigger.refresh();
      }, RESIZE_DEBOUNCE_MS / 2);
    };
    window.addEventListener('resize', redraw);
    /* 写真の配置を決める sections.css は後から読み込まれるので、窓の大きさが変わらなくても配置が変わったら引き直す */
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(redraw);
      ro.observe(area);
      area.querySelectorAll('.js-topStatement-img').forEach((ph) => ro.observe(ph));
    }
  };

  /* ---------- GSAP: statement route / work pin ---------- */
  const WORK_PIN_VH = 1; // 働き方の写真を止めて見せる長さ（画面の高さに対する倍率）
  const WORK_LEAD_VH = 0.3; // 止まる前に写真が動き始める距離（同上）
  const initScroll = () => {
    if (!window.gsap || !window.ScrollTrigger || isReduced()) {
      root.classList.add('noanim');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const rise = { y: 200, opacity: 0 };

    // Statement: 点線の道が伸び、道が届いた写真から届いた向きに切り抜くように現れる
    const statement = document.querySelector('.js-topStatement');
    if (statement) {
      const photos = gsap.utils.toArray('.js-topStatement-img');
      const reveal = statement.querySelector('.js-stRoute-reveal');
      const tl = gsap.timeline({ scrollTrigger: { trigger: statement, start: 'top center', end: 'bottom center+=25%', scrub: 1, invalidateOnRefresh: true } });
      if (reveal) {
        const len = () => reveal.getTotalLength() || 1;
        tl.fromTo(reveal, { strokeDasharray: () => len(), strokeDashoffset: () => len() }, { strokeDashoffset: 0, duration: 1, ease: 'none' }, 0);
      }
      photos.forEach((ph, i) => {
        const at = (i / photos.length) * 0.9;
        tl.fromTo(ph, { opacity: 1, clipPath: CLIP_FROM[ph.dataset.from] || CLIP_FROM.top }, { clipPath: CLIP_OPEN, duration: 0.3, ease: 'power2.out' }, at)
          .fromTo(ph.querySelector('img'), { scale: 1.2 }, { scale: 1, duration: 0.4, ease: 'power2.out' }, at);
      });
    }


    const work = document.querySelector('.js-topWork');
    if (work) {
      gsap.set('.js-topWork-text', rise);
      /* 写真のエリアが画面に収まりきった位置で止め、止まっている間に写真が出そろうようにする
         （以前は見出しが上端に来た位置で止めていたため、PC では下の写真が画面の外で動いていた） */
      const area = work.querySelector('.topWork__imageArea') || work;
      const pinStart = () => (area.offsetHeight > window.innerHeight ? 'center center' : 'bottom bottom');
      const pinEnd = () => '+=' + Math.round(window.innerHeight * WORK_PIN_VH);
      const pinST = ScrollTrigger.create({ trigger: area, start: pinStart, end: pinEnd, pin: work, scrub: 1, invalidateOnRefresh: true });
      /* 写真は止まる少し手前から集まり始め、止まっている間に出そろう */
      const tl = gsap.timeline({ scrollTrigger: { trigger: area, start: () => pinST.start - window.innerHeight * WORK_LEAD_VH, end: () => pinST.end, scrub: 1, invalidateOnRefresh: true } });
      // 主役は枠が開きながらカメラを引くように縮む。周りは別々の方向・速さで集まる
      gsap.utils.toArray('.js-topWork-img').forEach((ph) => {
        const from = ph.dataset.from;
        if (from === 'zoom') {
          tl.fromTo(ph, { opacity: 1, clipPath: 'inset(22% 22% 22% 22%)' }, { clipPath: CLIP_OPEN, duration: 0.9, ease: 'power1.inOut' }, 0)
            .fromTo(ph.querySelector('img'), { scale: 1.4 }, { scale: 1, duration: 1.1, ease: 'power1.out' }, 0);
          return;
        }
        const m = WORK_FROM[from] || WORK_FROM.bottom;
        tl.fromTo(ph, { opacity: 0, x: m.x, y: m.y }, { opacity: 1, x: 0, y: 0, duration: m.d, ease: 'power2.out' }, m.at);
      });
      tl.to('.js-topWork-text', { y: 0, opacity: 1, duration: 0.5 })
        .to('.js-fv', { opacity: 0, duration: 0.5 });
    }

    if (window.MichiAdd) window.MichiAdd.routeScroll(gsap);

    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => ScrollTrigger.refresh(true), RESIZE_DEBOUNCE_MS);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  };

  /* ---------- interview carousel ---------- */
  const initInterview = () => {
    const el = document.querySelector('.js-swiper-topInterview');
    const bubble = document.getElementById('bubble');
    if (!el || !window.Swiper || !bubble) return;
    const slider = el.closest('.topInterview__slider');
    const mq = window.matchMedia(PC_QUERY);
    let swiper = null;
    let swapTimer = null;
    let openId = null;
    const panel = document.getElementById('interviewBody');

    const toneOf = (swiperInstance) => {
      const slide = swiperInstance.slides[swiperInstance.activeIndex];
      return { text: slide.dataset.bubble, tone: slide.dataset.tone };
    };
    const showBubble = ({ text, tone }) => {
      bubble.textContent = text;
      bubble.className = `bubble ${tone}`;
      bubble.style.opacity = '1';
    };
    const create = (initialSlide) => {
      swiper = new Swiper(el, {
        centeredSlides: true,
        initialSlide,
        slidesPerView: 1.3,
        spaceBetween: 8,
        direction: 'horizontal',
        loop: true,
        speed: SLIDE_SPEED_MS,
        autoplay: isReduced() ? false : { delay: AUTOPLAY_MS, disableOnInteraction: false, pauseOnMouseEnter: true },
        breakpoints: { 769: { slidesPerView: 3.5, spaceBetween: 30 } },
        on: {
          slideChange: (sw) => {
            bubble.style.opacity = '0';
            clearTimeout(swapTimer);
            swapTimer = setTimeout(() => showBubble(toneOf(sw)), BUBBLE_SWAP_MS);
            if (openId) openBody(personOf(sw));
          },
          touchStart: () => bubble.setAttribute('aria-live', 'polite'),
        },
      });
      showBubble(toneOf(swiper));
      if (openId) stopAuto();
    };
    // 本文を開いている間は自動送りを止める（フォーカスやマウスが外れても再開しない）
    const stopAuto = () => { if (swiper && swiper.autoplay && swiper.autoplay.running) swiper.autoplay.stop(); };
    const startAuto = () => { if (!openId && !isReduced() && swiper && swiper.autoplay && !swiper.autoplay.running) swiper.autoplay.start(); };
    const keepFocusPause = () => {
      if (isReduced()) return;
      el.addEventListener('focusin', stopAuto);
      el.addEventListener('focusout', startAuto);
    };

    const personOf = (sw) => sw.slides[sw.activeIndex].dataset.person;
    const refreshLayout = () => { if (window.ScrollTrigger) window.ScrollTrigger.refresh(); };
    const syncButtons = () => {
      el.querySelectorAll('.card__more').forEach((btn) => {
        const isOpen = btn.closest('.card').dataset.person === openId;
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.querySelector('.card__moreLabel').textContent = isOpen ? '閉じる' : '続きを読む';
      });
    };
    const openBody = (id) => {
      if (!panel || !id) return;
      openId = id;
      panel.querySelectorAll('.interviewBody__item').forEach((item) => { item.hidden = item.dataset.person !== id; });
      if (panel.hidden) { panel.hidden = false; refreshLayout(); }
      stopAuto();
      syncButtons();
    };
    const closeBody = (fromPanel, byKeyboard) => {
      if (!panel || !openId) return;
      const id = openId;
      openId = null;
      panel.hidden = true;
      syncButtons();
      refreshLayout();
      startAuto();
      if (!fromPanel) return;
      // パネル下の「閉じる」は本文の分だけ下にあるので、カードが画面外ならカードまで戻す
      const btn = [...el.querySelectorAll('.card__more')].find((b) => b.closest('.card').dataset.person === id);
      if (!btn) return;
      const card = btn.closest('.card');
      if (card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: 'start', behavior: isReduced() ? 'auto' : 'smooth' });
      // キーボード操作のときだけフォーカスを戻す（カード内のフォーカスは自動送りを止めるため、マウスでは戻さない）
      if (byKeyboard) btn.focus({ preventScroll: true });
    };
    // カードのボタン: 開いている本人なら閉じる／別の人なら中央に寄せてその人の本文を出す
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.card__more');
      if (!btn) return;
      const card = btn.closest('.card');
      const id = card.dataset.person;
      if (openId === id) { closeBody(false, false); return; }
      const index = swiper.slides.indexOf(card);
      if (index !== swiper.activeIndex) swiper.slideToLoop(Number(card.dataset.swiperSlideIndex ?? index));
      openBody(id);
    });
    if (panel) panel.querySelector('.interviewBody__close').addEventListener('click', (e) => closeBody(true, e.detail === 0));

    create(0);
    keepFocusPause();
    const go = (dir) => {
      bubble.setAttribute('aria-live', 'polite');
      if (dir > 0) swiper.slideNext(); else swiper.slidePrev();
    };
    slider.querySelector('.sliderArrow--prev').addEventListener('click', () => go(-1));
    slider.querySelector('.sliderArrow--next').addEventListener('click', () => go(1));

    // PC/SP を跨いだときだけ destroy → 再初期化（realIndex を引き継ぐ）
    mq.addEventListener('change', () => {
      const index = swiper.realIndex;
      swiper.destroy(true, true);
      create(index);
    });
  };

  /* ---------- ライブラリは load 後に読む（FVの描画・LCPと帯域を競わせない） ---------- */
  const loadScript = (src) => new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = reject;
    document.head.appendChild(el);
  });
  const whenIdle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));

  const bootScroll = () => {
    if (isReduced()) { root.classList.add('noanim'); return Promise.resolve(); }
    return loadScript('vendor/gsap.min.js')
      .then(() => loadScript('vendor/ScrollTrigger.min.js'))
      .then(initScroll)
      .catch(() => root.classList.add('noanim'));
  };

  const bootInterview = () => {
    const slider = document.querySelector('.topInterview__slider');
    if (!slider) return;
    const run = () => loadScript('vendor/swiper-bundle.min.js').then(initInterview).catch(() => {});
    if (!('IntersectionObserver' in window)) { run(); return; }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    }, { rootMargin: '1500px 0px' });
    io.observe(slider);
  };

  initBanner();
  initFvVideo();
  initStatementRoute();
  const start = () => whenIdle(() => { bootScroll(); bootInterview(); });
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
