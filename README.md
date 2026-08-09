# 3D Break-Apart (Exploded View) Effect — complete guide

A scroll-driven product page where a phone tumbles, **breaks apart into its
internal layers**, and reassembles as you scroll — the "PHONEX ULTRA" demo.
This repo is the complete, self-contained recipe: the original AI prompt, every
asset, the working page, and a single-file artifact you can open or share
anywhere. **No backend, no keys, no server config — nothing here to leak.**

| What | Where |
|---|---|
| The original AI video prompt + generation settings | [`PROMPT.md`](PROMPT.md) |
| The working site (open `index.html`, or serve the folder) | [`site/`](site/) |
| Single-file version — every asset inlined, works from a double-click | [`artifact/phonex-ultra-exploded-effect.html`](artifact/phonex-ultra-exploded-effect.html) |
| Script that builds the single file from `site/` | [`artifact/build.mjs`](artifact/build.mjs) |

## How the effect is made, step by step

**Step 1 — one product photo.** A single clean product shot on a dark/neutral
background. Everything downstream is derived from it.

**Step 2 — generate the exploded-view film.** Send the photo to an
image-to-video model (Veo 3.1-class) as the clip's **first frame**, with the
prompt in [`PROMPT.md`](PROMPT.md): 8 seconds, 720p, 16:9, no audio. The model
returns a continuous shot of the product tumbling, separating into layers,
holding, and reassembling.

**Step 3 — explode the film into frames.** Extract ≤120 evenly spaced
1280px-wide JPEGs with ffmpeg (exact commands in `PROMPT.md` §3) into
`site/assets/frames/frame_000.jpg … frame_119.jpg`. Frame 0 doubles as the
poster image.

**Step 4 — the scroll page scrubs the frames.** No `<video>` is ever played:

- **S1 · Film** (`site/main.js`): the section pins for 450% of the viewport
  height (300% on mobile; GSAP ScrollTrigger, `scrub: 1`), and scroll progress maps linearly to
  a frame index painted cover-fit onto a `<canvas>`. Frames preload in two
  passes (every 6th first, then the rest) so early scrubbing always has
  coverage; copy "beats" fade in/out at fixed points of the same timeline.
- **S2 · Teardown**: eight hand-drawn SVG layers (front glass, OLED, vapor
  chamber, board, camera, battery, frame, back glass) start stacked as one
  angled phone, then fan out to per-layer slots (`SLOTS` in `main.js`) under a
  pinned scrubbed timeline — horizontal spread on desktop, cascading fan on
  mobile — each label chasing its own layer.
- **S3–S5**: static blueprint / features / specs sections with one-shot
  scroll reveals.
- Smooth scrolling is Lenis, driven from GSAP's ticker. `prefers-reduced-motion`
  gets a fully static, readable page; no-JS gets a poster + flowed copy.

**Step 5 — build the single-file artifact.**

```bash
node artifact/build.mjs
```

reads `site/`, inlines the fonts, the 120 frames, the stills and the vendor
libraries as data URIs, and writes `artifact/phonex-ultra-exploded-effect.html`
(~7.7 MB) — a complete page with zero network dependencies.

## Run the site locally

```bash
cd site && python3 -m http.server 8000   # or any static server
# open http://localhost:8000
```

(Or just double-click `artifact/phonex-ultra-exploded-effect.html` — the
single-file build needs no server at all.)

## Assets inventory

| Asset | Count / size | Origin |
|---|---|---|
| `site/assets/frames/frame_000–119.jpg` | 120 frames, ~5.3 MB, 1280×720 | extracted from the AI-generated film |
| `site/assets/img/*.jpg` | 5 stills, ~280 KB (`phone-assembled.jpg` is a spare, unused by the page) | frames/crops of the same film |
| `site/assets/fonts/*.woff2` | Inter 400/500/600 · Space Grotesk 500/600/700 (latin subset) | self-hosted, SIL OFL licensed |
| `site/assets/vendor/` | GSAP 3.13.0 + ScrollTrigger 3.13.0 (GreenSock standard license) · Lenis 1.3.8 (MIT) | vendored, pinned |
| `site/index.html` / `styles.css` / `main.js` | ~51 KB | the page itself — markup, design system, animation |

## Reusing this for your own product

1. Generate your own film from your product photo (`PROMPT.md`).
2. Replace the frames + stills (`PROMPT.md` §3–4). Update `FRAME_COUNT` in
   `site/main.js` if you extracted fewer than 120 frames.
3. Edit the copy in `site/index.html` (beats, blueprint list, specs) and, if
   you like, redraw the eight teardown SVG layers for your product.
4. `node artifact/build.mjs` → share the single file.

**If you change the teardown layers**, keep the three-way contract intact:
each `.layer` div's `data-layer` name must match a key in `SLOTS`
(`site/main.js`) *and* a label's `data-for` attribute in `index.html`, and the
layers' DOM order is their paint order (back glass first, front glass last) as
well as their fan-out order. Adding, removing, or renaming a layer means
touching all three places.

**If you rename assets**: `artifact/build.mjs` auto-detects how many
`frame_NNN.jpg` files exist, but inlines the stills and fonts by name — a
renamed or added still/font needs a matching edit to the lists at the top of
`build.mjs` (the build fails loudly, never silently, if a reference is left
un-inlined).

## Disclaimer

The PHONEX ULTRA is not a real product; all product footage is AI-generated.
Not affiliated with any phone maker. This is a practice project for learning
scroll-driven animation.
