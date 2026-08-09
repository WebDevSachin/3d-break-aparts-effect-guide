# Prompt template — have an AI build a break-apart scrollytelling page

Fill in the `{PLACEHOLDERS}`, attach your product film (or let Phase 0 tell the
AI to help you generate one), and paste the whole thing into Claude Code or a
similar agentic coding tool. The phase structure — *assets → design system →
sections → engineering rules → verification* — is the part that makes the
output reliable; keep it even if you rewrite every detail.

---

You are building a **single-page scrollytelling product site** for
**{PRODUCT NAME}** — a fictional {PRODUCT TYPE} presented like a premium
launch page. The signature effect: as the user scrolls, the product **breaks
apart into its internal layers and reassembles**. This is a practice project —
invent a brand; do not imitate a real company's trademarks.

Work step by step, in this order. After each phase, verify before moving on.

## Phase 0 — Assets

I am supplying an ~8–10-second AI-generated product film: `{VIDEO FILE}`.
(If I haven't, stop and give me an **image-to-video** prompt for it — my
product photo goes in as the clip's first frame; one continuous shot, dark
studio, the product tumbles, separates into {N} layers like an exploded
diagram at the midpoint, reassembles at the end, and explicitly: no cuts, no
text overlays, no hands, no invented logos. See this repo's `PROMPT.md` for
the verbatim prompt and generation settings that produced the reference film.)

1. Extract a scrub sequence with ffmpeg: ≤120 evenly spaced frames
   (`fps=120/DURATION`), 1280 px wide, JPEG `-q:v 4`, into
   `assets/frames/frame_%03d.jpg` (numbered from 000) — or run this repo's
   `scripts/extract-frames.sh`. Verify: ~100–120 files, each 30–80 KB,
   first/last frames look assembled.
2. Save frame 0 as `assets/img/poster.jpg` (the pre-JS placeholder — with
   image-to-video it IS your original product photo).
3. Pick 2 clean stills from the film for feature cards.

## Phase 1 — Design system

CSS custom properties: near-black page base (`#0a0c10`-ish), one cool accent
(`{ACCENT}`), one warm material accent (`{MATERIAL COLOR}`, e.g. copper), light
interlude section (`#eef0f3`). Fonts: `{DISPLAY FONT}` for headlines,
`{BODY FONT}` for UI — self-hosted woff2, `font-display: swap`, preloaded.

Libraries, pinned, loaded before `main.js`: GSAP 3.13.0 + ScrollTrigger +
Lenis 1.3.8. Wire Lenis canonically: `lenis.on('scroll', ScrollTrigger.update)`,
drive it from `gsap.ticker`, `gsap.ticker.lagSmoothing(0)`.

## Phase 2 — Sections

- **Chrome**: fixed topbar (transparent → blurred after 80 px), 2 px scroll
  progress hairline, skip link.
- **S1 · Film (pinned ~450 vh, scrub 1)**: `<canvas>` draws the frame sequence
  cover-fit; frame index tweened 0→last with `ease: 'none'`. Poster `<img>`
  underneath. Title beat + {3–4} copy beats fading in/out at fractions matched
  to the footage's story moments. Two-pass preload (every 6th frame first) with
  a thin loader bar; nearest-loaded fallback while frames stream in.
- **S2 · Teardown (pinned ~350 vh)**: {N} inline SVG layers of the product,
  hand-drawn,
  DOM-ordered back→front so stacking needs no z-index. Start stacked as one
  product; fan out to a per-breakpoint `SLOTS` table (x in vw, y in vh) with a
  0.03 stagger; labels (real text) reveal as each layer seats. Use
  `gsap.matchMedia()` with contiguous queries (e.g. 900.1 / 900.09 px).
- **S3 · Light interlude**: labeled component list (the accessible twin of the
  teardown).
- **S4 · Feature split rows** with the film stills.
- **S5 · Spec cards** (definition list).
- **Footer**: oversized outlined brand, honesty note (AI footage, practice
  project), section links.

## Phase 3 — Engineering rules (non-negotiable)

1. Three files only (`index.html`, `styles.css`, `main.js`) + assets. No build.
2. Animate only `transform` / `opacity` / `clip-path` / `filter` (canvas
   repaints excepted). Never top/left/width/height.
3. Every ScrollTrigger: `invalidateOnRefresh: true`; call
   `ScrollTrigger.refresh()` on `window.load`.
4. Explicit dimensions on images; `loading="lazy"` below the fold; preload the
   poster and fonts.
5. `prefers-reduced-motion: reduce` → no pins, no scrub, no smooth scroll; all
   copy visible via CSS alone. Also handle no-JS with an `html.no-js` fallback.
6. ≤ 900 px: shorter pins, vertical teardown fan, no horizontal scroll ever.
7. Semantic landmarks, alt text on every image, visible focus rings, body
   contrast ≥ 4.5:1.
8. Comment `main.js` generously — each section gets a banner comment.

## Phase 4 — Verify like a pro

1. Serve locally; script Playwright to screenshot desktop 1440×900 at
   0/15/30/45/60/75/90 % scroll and mobile 390×844 at 3 positions.
2. **Look at every screenshot** — broken images, text over busy footage,
   pins not pinning, overflow.
3. Assert zero console errors and zero failed requests; assert
   reduced-motion leaves all copy visible.
4. Fix, re-screenshot, repeat until clean, then summarize what was built and
   how I can swap in my own assets.

**Definition of done:** frames verified · film scrubs smoothly through the
break-apart · teardown fans out with labels · reduced-motion readable ·
mobile clean · zero console errors · screenshots reviewed.
