﻿/* ============================================================
   BARBER CODE â€” app.js
   Cinematic Scroll Engine Â· Russian Version
   ============================================================ */

// === CONSTANTS ===
// TOTAL_FRAMES: update after ffmpeg frame extraction
// Formula: total_seconds Ã— fps (e.g. 6 clips Ã— ~13sec Ã— 10fps â‰ˆ 800)
const TOTAL_FRAMES = 429;     // barber-code-ru frames
const PAGE_COUNT   = 6;
const LERP         = 0.02;   // Cinematic slow lerp
const CONCURRENCY  = 48;     // Parallel frame loads

// === DEVICE DETECTION ===
const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) || innerWidth < 768;
const FRAME_DIR = isMobile ? 'frames-mobile' : 'frames-webp';

// === CANVAS SETUP ===
const canvas = document.getElementById('gl-canvas');
const ctx    = canvas.getContext('2d');
let canvasDpr = 1; // Module-level! drawFrame uses same dpr as resize()

function resize() {
  canvasDpr = Math.min(devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width  = innerWidth  * canvasDpr;
  canvas.height = innerHeight * canvasDpr;
  canvas.style.width  = innerWidth  + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// === FRAME LOADING ===
const frames     = new Array(TOTAL_FRAMES);
let loadedCount  = 0;
let isReady      = false;
let preloaderDismissed = false;
const PRELOADER_THRESHOLD = 15;

function frameName(i) {
  return `${FRAME_DIR}/frame_${String(i + 1).padStart(6, '0')}.webp`;
}

async function loadAll() {
  const queue = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);

  async function worker() {
    while (queue.length) {
      const i = queue.shift();
      await new Promise(resolve => {
        const img = new Image();
                img.onload = img.onerror = () => {
          frames[i] = img;
          loadedCount++;
          if (loadedCount === 1) { isReady = true; if (typeof startAnim === "function") startAnim(); }
          const realPct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
          if (!preloaderDismissed) {
            const visualPct = Math.min(Math.round((realPct / PRELOADER_THRESHOLD) * 100), 100);
            const bar = document.getElementById('progress-bar') || document.getElementById('loader-bar');
            const pctEl = document.getElementById('loader-pct');
            if (bar) bar.style.width = visualPct + '%';
            if (pctEl) pctEl.textContent = visualPct + '%';
            if (realPct >= PRELOADER_THRESHOLD) {
              preloaderDismissed = true;
              const loader = document.getElementById('loader');
              if (loader) { 
                loader.style.transition = 'opacity 0.8s'; 
                loader.style.opacity = '0'; 
                setTimeout(() => { loader.style.display = 'none'; }, 800); 
              }
              const slb = document.getElementById('siteLoadingBar');
              if (slb) {
                slb.style.opacity = '1';
                slb.style.visibility = 'visible';
                slb.innerHTML = '<div class="slb-track"><div class="slb-fill" id="slbFill"></div></div><span class="slb-text" id="siteLoadingText">Loading video 0%</span>';
              }
            }
          } else {
            const slb = document.getElementById('slbFill');
            const txt = document.getElementById('siteLoadingText');
            const phase2Pct = Math.round(((realPct - PRELOADER_THRESHOLD) / (100 - PRELOADER_THRESHOLD)) * 100);
            if (slb) slb.style.width = phase2Pct + '%';
            if (txt) txt.textContent = 'Loading video ' + realPct + '%';
            if (realPct >= 100) {
              const sbar = document.getElementById('siteLoadingBar');
              if (txt) txt.textContent = 'Loading complete';
              if (sbar) {
                sbar.style.opacity = '0';
                sbar.style.visibility = 'hidden';
                setTimeout(() => sbar.remove(), 800);
              }
            }
          }
          resolve();
        };
        img.src = frameName(i);
      });
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// === ANIMATION LOOP ===
let currentFrame = 0;
let targetFrame  = 0;

window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  const progress  = maxScroll > 0 ? scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
}, { passive: true });

function drawFrame(idx) {
  const img = frames[Math.max(0, Math.min(Math.round(idx), TOTAL_FRAMES - 1))];
  if (!img || !img.complete || !img.naturalWidth) return;

  // Use innerWidth/innerHeight â€” ctx.setTransform already handles DPR scaling
  // DO NOT divide canvas.width by devicePixelRatio â€” use module-level canvasDpr
  const W = innerWidth;
  const H = innerHeight;

  // Cover-fit (background-size: cover)
  const r  = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth  * r;
  const ih = img.naturalHeight * r;
  const x  = (W - iw) / 2;
  const y  = (H - ih) / 2;

  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(img, x, y, iw, ih);

  // Radial vignette
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, H * 0.9);
  vig.addColorStop(0, 'rgba(6,5,10,0)');
  vig.addColorStop(1, 'rgba(6,5,10,0.82)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Bottom gradient darkening
  const bot = ctx.createLinearGradient(0, H * 0.55, 0, H);
  bot.addColorStop(0, 'rgba(6,5,10,0)');
  bot.addColorStop(1, 'rgba(6,5,10,0.92)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);

  // Top gradient (subtle)
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.2);
  top.addColorStop(0, 'rgba(6,5,10,0.5)');
  top.addColorStop(1, 'rgba(6,5,10,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.2);
}

function startAnim() {
  function loop() {
    requestAnimationFrame(loop);
    currentFrame += (targetFrame - currentFrame) * LERP;
    if (isReady) drawFrame(currentFrame);
  }
  loop();
}

// === SECTION INTERSECTION OBSERVER ===
const pages    = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
      navLinks.forEach((l, i) => l.classList.toggle('active', i === idx - 1));
    }
  });
}, { rootMargin: '-40% 0px -40% 0px' });

pages.forEach(p => observer.observe(p));

// === BURGER / DRAWER ===
const burger        = document.getElementById('burger');
const navDrawer     = document.getElementById('nav-drawer');
const drawerClose   = document.getElementById('drawer-close');
const drawerOverlay = document.getElementById('drawer-overlay');
const drawerLinks   = document.querySelectorAll('.drawer-link, .drawer-cta');

function openDrawer() {
  navDrawer.classList.add('is-open');
  drawerOverlay.classList.add('is-visible');
  navDrawer.removeAttribute('aria-hidden');
  burger.setAttribute('aria-expanded', 'true');
  burger.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  navDrawer.classList.remove('is-open');
  drawerOverlay.classList.remove('is-visible');
  navDrawer.setAttribute('aria-hidden', 'true');
  burger.setAttribute('aria-expanded', 'false');
  burger.classList.remove('is-open');
  document.body.style.overflow = '';
}

burger.addEventListener('click', openDrawer);
drawerClose.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);
drawerLinks.forEach(link => link.addEventListener('click', closeDrawer));

// === SMOOTH SCROLL FOR NAV LINKS ===
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// === INIT ===
// Ensure first section is active on load
if (pages.length > 0) {
  pages[0].classList.add('is-active');
}

loadAll();



// Site loading bar CSS (Phase 2 - deferred)
const siteBarStyle = document.createElement('style');
siteBarStyle.textContent = '.site-loading-bar{position:fixed;bottom:0;left:0;width:100%;height:28px;background:rgba(10,10,10,.85);backdrop-filter:blur(8px);z-index:9998;display:flex;align-items:center;padding:0 16px;gap:10px;opacity:0;visibility:hidden;transition:opacity .5s,visibility .5s;border-top:1px solid rgba(255,255,255,.08)}.site-loading-bar.active{opacity:1;visibility:visible}.site-loading-bar.done{opacity:0;visibility:hidden}.site-loading-fill{flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden}.site-loading-fill-inner{height:100%;width:0;background:linear-gradient(90deg,var(--gold,var(--accent,#c9a84c)),var(--gold-light,#e8c97a));border-radius:2px;transition:width .2s}.site-loading-text{font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap}';
document.head.appendChild(siteBarStyle);

// === SITE LOADING BAR (Phase 2 — deferred) ===
(function(){
  if (document.getElementById('siteLoadingBar')) return;
  var el = document.createElement('div');
  el.id = 'siteLoadingBar';
  el.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;height:32px;background:rgba(10,10,10,.88);backdrop-filter:blur(10px);z-index:9998;display:flex;align-items:center;padding:0 20px;gap:12px;opacity:0;visibility:hidden;transition:opacity .5s,visibility .5s;border-top:1px solid rgba(255,255,255,.08);';
  el.innerHTML = '<div style="flex:1;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;"><div id="slbFill" style="height:100%;width:0;background:linear-gradient(90deg,var(--gold,var(--accent,#c9a84c)),#e8c97a);border-radius:2px;transition:width .25s;"></div></div><span id="siteLoadingText" style="font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;">Loading video...</span>';
  document.body.appendChild(el);
})();
