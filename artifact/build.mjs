// Builds artifact/phonex-ultra-exploded-effect.html — the single-file version
// of site/ with every asset (fonts, 120 frames, stills, vendor JS) inlined as
// data URIs. Run from anywhere: node artifact/build.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const OUT = join(ROOT, 'artifact', 'phonex-ultra-exploded-effect.html');

const b64 = (p, mime) => `data:${mime};base64,${readFileSync(join(SITE, p)).toString('base64')}`;

// Fonts: rewrite each url() in fonts.css to a data URI.
let fontsCss = readFileSync(join(SITE, 'assets/fonts/fonts.css'), 'utf8');
for (const f of ['Inter-400', 'Inter-500', 'Inter-600', 'SpaceGrotesk-500', 'SpaceGrotesk-600', 'SpaceGrotesk-700']) {
  fontsCss = fontsCss.replace(`url(${f}.woff2)`, `url(${b64(`assets/fonts/${f}.woff2`, 'font/woff2')})`);
}
if (/url\((?!data:)/.test(fontsCss)) throw new Error('fonts.css still has a non-data url()');

const stylesCss = readFileSync(join(SITE, 'styles.css'), 'utf8');

// The scroll film, as one JS array — however many frames are on disk.
// (site/main.js's FRAME_COUNT still governs the scrub; keep them in step.)
const frameFiles = readdirSync(join(SITE, 'assets/frames'))
  .filter((n) => /^frame_\d{3}\.jpg$/.test(n))
  .sort();
if (frameFiles.length === 0) throw new Error('no frame_NNN.jpg files in site/assets/frames');
const frames = frameFiles.map((n) => b64(`assets/frames/${n}`, 'image/jpeg'));

// main.js is untouched except for one line: frames come from the inlined
// array instead of files on disk.
let mainJs = readFileSync(join(SITE, 'main.js'), 'utf8');
const needle = "const framePath = (i) => `assets/frames/frame_${String(i).padStart(3, '0')}.jpg`;";
if (!mainJs.includes(needle)) throw new Error('framePath needle not found in main.js');
mainJs = mainJs.replace(needle, 'const framePath = (i) => window.__FRAMES[i];');

const gsap = readFileSync(join(SITE, 'assets/vendor/gsap.min.js'), 'utf8');
const scrollTrigger = readFileSync(join(SITE, 'assets/vendor/ScrollTrigger.min.js'), 'utf8');
const lenis = readFileSync(join(SITE, 'assets/vendor/lenis.min.js'), 'utf8');

// Body content: inline the stills, drop the external <script src> tags.
const html = readFileSync(join(SITE, 'index.html'), 'utf8');
let body = html.match(/<body>([\s\S]*)<\/body>/)[1];
for (const img of ['poster', 'phone-exploded-labeled', 'feature-screen', 'feature-layers']) {
  body = body.replaceAll(`assets/img/${img}.jpg`, b64(`assets/img/${img}.jpg`, 'image/jpeg'));
}
if (/assets\/img\//.test(body)) throw new Error('un-inlined image reference remains');
body = body.replace(/\s*<!-- Libraries[\s\S]*?<script src="main.js"><\/script>/, '').trim();
if (/src="assets\//.test(body)) throw new Error('external asset reference remains in body');

const favicon = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%230a0c10'/%3E%3Crect x='30' y='14' width='40' height='72' rx='10' fill='none' stroke='%2361b3ff' stroke-width='6'/%3E%3C/svg%3E`;

const out = `<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PHONEX ULTRA — Exploded Effect</title>
  <meta name="description" content="A scroll-driven exploded-view product page: the PHONEX ULTRA comes apart layer by layer as you scroll. Practice project built with GSAP, ScrollTrigger and Lenis.">
  <link rel="icon" href="${favicon}">
</head>
<body>
<style>
${fontsCss}
</style>
<style>
${stylesCss}
</style>
${body}

<script>
${gsap}
</script>
<script>
${scrollTrigger}
</script>
<script>
${lenis}
</script>
<script>
window.__FRAMES = ${JSON.stringify(frames)};
</script>
<script>
${mainJs}
</script>
</body>
</html>
`;

writeFileSync(OUT, out);
console.log(`wrote ${OUT} (${(out.length / 1024 / 1024).toFixed(1)} MB)`);
