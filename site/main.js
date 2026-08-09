/* ============================================================
   PHONEX ULTRA — exploded-effect scrollytelling
   S1: canvas image-sequence scrubbed by scroll (120 frames)
   S2: vector teardown — 8 layers fan out under a pinned scrub
   ============================================================ */

/* Only opt out of the static no-js fallback once the vendor libraries
   actually loaded — otherwise the CSS fallback keeps the page readable. */
if (window.gsap && window.ScrollTrigger && window.Lenis) {
  document.documentElement.classList.remove('no-js');
}

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (REDUCED) document.documentElement.classList.add('reduced-motion');

gsap.registerPlugin(ScrollTrigger);

/* ---- Smooth scroll (Lenis), wired to ScrollTrigger the canonical way ---- */
let lenis = null;
if (!REDUCED) {
  lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* Smooth anchor navigation that respects pinned sections.
   Focus moves to the target so keyboard users (and the skip link)
   keep a sensible sequential focus point after the scroll. */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -64 });
    else target.scrollIntoView();
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    history.pushState(null, '', a.getAttribute('href'));
  });
});

/* ---- Chrome: top bar backdrop + scroll progress hairline ----
   The topbar class is driven from onUpdate (not toggleClass) so it can't
   drop off at the exact bottom of the page, where an end:'max' trigger
   momentarily deactivates. */
const topbarEl = document.getElementById('topbar');
const setProgress = gsap.quickSetter('#progressFill', 'scaleX');
ScrollTrigger.create({
  start: 0,
  end: 'max',
  invalidateOnRefresh: true,
  onUpdate: (self) => {
    setProgress(self.progress);
    /* Reduced-motion keeps the solid topbar unconditionally — without the
       REDUCED short-circuit this toggle would strip the class again on the
       first scroll event above the 80px threshold. */
    topbarEl.classList.toggle('topbar--scrolled', REDUCED || self.scroll() > 80);
  },
});
if (REDUCED) topbarEl.classList.add('topbar--scrolled');

/* ============================================================
   S1 · Film — preload the frame sequence, draw cover-fit,
   scrub frame index + copy beats through one pinned timeline
   ============================================================ */
const FRAME_COUNT = 120;
const framePath = (i) => `assets/frames/frame_${String(i).padStart(3, '0')}.jpg`;

const canvas = document.getElementById('filmCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const loaderBar = document.getElementById('filmLoaderBar');
const filmState = { frame: 0 };
const frames = [];
let framesLoaded = 0;

function sizeCanvas() {
  /* Cap the backing store at the frames' native width (1280px) — a larger
     store just upscales already-upscaled JPEGs and slows every scrub draw */
  const dpr = Math.min(window.devicePixelRatio || 1, 2, 1280 / canvas.clientWidth);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  drawFrame(filmState.frame);
}

/* If the exact frame isn't decoded yet, fall back to the nearest one that is */
function nearestLoaded(i) {
  for (let d = 0; d < FRAME_COUNT; d++) {
    const lo = frames[i - d], hi = frames[i + d];
    if (lo && lo.complete && lo.naturalWidth) return lo;
    if (hi && hi.complete && hi.naturalWidth) return hi;
  }
  return null;
}

function drawFrame(i) {
  if (!ctx) return;
  const img = nearestLoaded(Math.round(i));
  if (!img) return;
  const cw = canvas.width, ch = canvas.height;
  const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // cover fit
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
}

function preloadFrames() {
  /* Two passes: coarse first (every 6th frame) so early scrubbing has coverage,
     then fill in the rest. */
  const order = [];
  for (let i = 0; i < FRAME_COUNT; i += 6) order.push(i);
  for (let i = 0; i < FRAME_COUNT; i++) if (i % 6 !== 0) order.push(i);

  const bumpLoaded = () => {
    framesLoaded++;
    gsap.set(loaderBar, { scaleX: framesLoaded / FRAME_COUNT });
    if (framesLoaded >= FRAME_COUNT) {
      gsap.to(canvas, { opacity: 1, duration: 0.4, overwrite: true });
      gsap.to('#filmLoader', { opacity: 0, duration: 0.4 });
    }
  };
  order.forEach((i) => {
    const img = new Image();
    img.src = framePath(i);
    img.onload = () => {
      bumpLoaded();
      if (i === 0 || Math.abs(i - filmState.frame) < 6) drawFrame(filmState.frame);
    };
    img.onerror = () => {
      frames[i] = null;   /* nearestLoaded() will skip it */
      bumpLoaded();
    };
    frames[i] = img;
  });
}

if (!REDUCED && ctx) {
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  preloadFrames();
  /* Show the canvas as soon as frame 0 paints (poster sits underneath anyway) */
  gsap.to(canvas, { opacity: 1, duration: 0.6, delay: 0.2 });
}

/* ============================================================
   S2 · Exploded view — layer slots
   Desktop: horizontal spread (like the reference render).
   Mobile: tighter cascading fan.
   x in vw, y in vh, measured from stage center.
   ============================================================ */
const SLOTS = {
  desktop: {
    glass:   { x: -39.5, y: 0 },
    oled:    { x: -28,   y: 0 },
    vapor:   { x: -17,   y: 0 },
    board:   { x: -6.5,  y: 0 },
    camera:  { x: 3,     y: -21 },
    battery: { x: 5,     y: 8 },
    frame:   { x: 17.5,  y: 0 },
    back:    { x: 30.5,  y: 0 },
  },
  mobile: {
    /* Strict left/right zigzag with a 16vh same-column step: a phone layer
       is ~21vh tall here, so 16vh keeps the cascading-overlap look without
       any two same-column parts interpenetrating. */
    glass:   { x: -9,  y: -28 },
    oled:    { x: 9,   y: -20 },
    vapor:   { x: -9,  y: -12 },
    board:   { x: 9,   y: -4 },
    camera:  { x: -13, y: 4 },
    battery: { x: 9,   y: 12 },
    frame:   { x: -9,  y: 20 },
    back:    { x: 9,   y: 28 },
  },
};

/* Which side each label sits on (desktop: above/below the layer) */
const LABEL_GAP = 44;

function buildExplode(isDesktop) {
  const key = isDesktop ? 'desktop' : 'mobile';
  const layers = gsap.utils.toArray('.layer');
  const labels = gsap.utils.toArray('.llabel');
  const vw = (v) => (v * window.innerWidth) / 100;
  const vh = (v) => (v * window.innerHeight) / 100;

  /* Stacked start: a single angled phone (slight per-layer offset sells depth) */
  layers.forEach((el, i) => {
    gsap.set(el, { x: i * 2, y: i * -1.5, rotationY: -16, transformPerspective: 1600 });
  });

  const tl = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: {
      trigger: '#explode',
      start: 'top top',
      end: isDesktop ? '+=350%' : '+=250%',
      pin: true,
      scrub: 1,
      invalidateOnRefresh: true,
    },
  });

  /* Section heading drifts in first, then clears out as the spread opens
     (the camera module and its label need that headroom) */
  tl.fromTo('#explodeHead', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.08, ease: 'none' }, 0);
  tl.to('#explodeHead', { opacity: 0, y: -30, duration: 0.12, ease: 'none' }, 0.34);

  /* The stacked phone starts large (fills the stage while it has the
     screen to itself), easing back to 1 as the fan needs the width */
  tl.fromTo('#explodeStage', { scale: 1.22 }, { scale: 1, duration: 0.5, ease: 'power2.inOut' }, 0.06);

  /* Layers fan out to their slots */
  layers.forEach((el, i) => {
    const name = el.dataset.layer;
    const slot = SLOTS[key][name];
    tl.to(el, {
      x: () => vw(slot.x),
      y: () => vh(slot.y),
      rotationY: isDesktop ? -10 : -8,
      duration: 0.5,
    }, 0.06 + i * 0.03);
  });

  /* Labels chase their own layers: each one fades in just as its layer
     seats into its slot (layer i departs at 0.06 + i*0.03, travels 0.5) */
  labels.forEach((el) => {
    const name = el.dataset.for;
    const slot = SLOTS[key][name];
    const layerEl = document.querySelector(`.layer[data-layer="${name}"]`);
    const layerIdx = layers.indexOf(layerEl);
    const above = el.classList.contains('llabel--above');
    tl.fromTo(el,
      { opacity: 0, y: () => labelY(slot, layerEl, above, vh) + (above ? -14 : 14), x: () => labelX(slot, isDesktop, vw) },
      { opacity: 1, y: () => labelY(slot, layerEl, above, vh), x: () => labelX(slot, isDesktop, vw), duration: 0.1, ease: 'none' },
      0.06 + layerIdx * 0.03 + 0.44);
  });

  /* Hold: the whole spread eases back a touch, like the camera settling */
  tl.to('#explodeStage', { scale: 0.965, duration: 0.25, ease: 'none' }, 0.75);

  /* Gentle idle float on the artwork itself (not scrubbed, skipped on mobile) */
  if (isDesktop) {
    layers.forEach((el, i) => {
      gsap.to(el.querySelector('svg'), {
        y: 5 + (i % 3) * 2.5,
        duration: 2.6 + (i % 4) * 0.45,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });
    });
  }
  return tl;
}

function labelX(slot, isDesktop, vw) {
  if (isDesktop) return vw(slot.x);
  /* Mobile: labels sit outboard of their OWN layer's column, so each
     label reads as attached to the component beside it */
  return vw(slot.x > 0 ? 30 : -30);
}
function labelY(slot, layerEl, above, vh) {
  const half = layerEl ? layerEl.offsetHeight / 2 : 160;
  if (window.innerWidth <= 900) return vh(slot.y); /* beside the layer on mobile */
  return vh(slot.y) + (above ? -(half + LABEL_GAP) : half + LABEL_GAP);
}

/* ============================================================
   S1 + S2 scenes, responsive via gsap.matchMedia
   ============================================================ */
if (!REDUCED) {
  const mm = gsap.matchMedia();

  /* Contiguous queries — a plain 900px/901px pair leaves a dead zone at
     fractional widths (browser zoom), where NEITHER matches and no scene
     would ever build. */
  mm.add({ desktop: '(min-width: 900.1px)', mobile: '(max-width: 900.09px)' }, (mmCtx) => {
    const { desktop } = mmCtx.conditions;

    /* ---- S1: film scrub timeline ---- */
    const film = gsap.timeline({
      scrollTrigger: {
        trigger: '#film',
        start: 'top top',
        end: desktop ? '+=450%' : '+=300%',
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
      },
    });

    /* Frame index rides the whole timeline (duration 1 = full pin) */
    film.to(filmState, {
      frame: FRAME_COUNT - 1,
      ease: 'none',
      duration: 1,
      onUpdate: () => drawFrame(filmState.frame),
    }, 0);

    /* Copy beats, mapped to the film's story arc:
       tumble → screen → explosion → chip → reassembly.
       Opacity only (not autoAlpha) so the copy is never yanked out of
       the accessibility tree. */
    film.to('#beatTitle', { opacity: 0, y: -60, scale: 0.97, duration: 0.1, ease: 'none' }, 0.06);

    const beatIn  = { opacity: 1, y: 0, duration: 0.05, ease: 'none' };
    const beatOut = { opacity: 0, y: -34, duration: 0.05, ease: 'none' };
    film.fromTo('#beat1', { opacity: 0, y: 40 }, beatIn, 0.24).to('#beat1', beatOut, 0.37);
    film.fromTo('#beat2', { opacity: 0, y: 40 }, beatIn, 0.45).to('#beat2', beatOut, 0.58);
    film.fromTo('#beat3', { opacity: 0, y: 40 }, beatIn, 0.65).to('#beat3', beatOut, 0.78);
    film.fromTo('#beatEnd', { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.07, ease: 'none' }, 0.88);

    /* ---- S2: teardown ---- */
    buildExplode(desktop);
  });

  /* ---- Scroll-reveals for the calm sections (once, opacity+drift only) ---- */
  gsap.utils.toArray('.reveal').forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 26 },
      {
        opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true, invalidateOnRefresh: true },
        delay: (i % 4) * 0.05,
      });
  });
} else {
  /* Reduced motion: no pins, no scrub, no smooth scroll.
     CSS lays everything out statically; nothing left to animate. */
}

/* ---- Recalculate everything once all images have loaded ---- */
window.addEventListener('load', () => ScrollTrigger.refresh());
