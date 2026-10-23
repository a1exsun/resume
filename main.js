import { escape, render } from './render.js';

const root = document.getElementById('resume');
const html = document.documentElement;
const themeButton = document.querySelector('.theme');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const systemDark = matchMedia('(prefers-color-scheme: dark)');

// GSAP comes from the CDN scripts in index.html; without them the page works, just stays still.
const { gsap, ScrollTrigger, SplitText, ScrambleTextPlugin } = window;
const motion = Boolean(gsap && ScrollTrigger && SplitText && ScrambleTextPlugin);
if (motion) gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

// ---- Theme ----

const remember = (theme) => {
  try { sessionStorage.setItem('theme', theme); } catch {}
};
const remembered = () => {
  try { return sessionStorage.getItem('theme'); } catch { return null; }
};
const syncThemeButton = () => {
  const label = `Switch to ${html.dataset.theme === 'dark' ? 'light' : 'dark'} mode`;
  themeButton.setAttribute('aria-label', label);
  themeButton.title = label;
};

// The new theme grows out of `origin` as a circle while the old page sinks back and blurs.
async function setTheme(theme, origin = themeButton) {
  if (html.dataset.theme === theme) return;
  const swap = () => {
    html.dataset.theme = theme;
    syncThemeButton();
  };
  if (!document.startViewTransition || reducedMotion.matches) return swap();

  const box = origin.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(swap);
  try {
    await transition.ready;
  } catch {
    return; // Skipped by the browser; the theme has still changed.
  }
  const timing = { duration: 1100, easing: 'cubic-bezier(0.76, 0, 0.24, 1)' };
  html.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
    { ...timing, pseudoElement: '::view-transition-new(root)' },
  );
  html.animate(
    { transform: ['none', 'scale(0.92)'], filter: ['blur(0px)', 'blur(8px)'], transformOrigin: [`${x}px ${y}px`, `${x}px ${y}px`] },
    { ...timing, pseudoElement: '::view-transition-old(root)' },
  );
  if (motion) gsap.fromTo(themeButton, { scale: 0 }, { scale: 1, duration: 1.4, delay: 0.25, ease: 'elastic.out(1, 0.35)' });
  await transition.finished;
}

syncThemeButton();
themeButton.addEventListener('click', () => {
  const theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  remember(theme);
  setTheme(theme);
});
systemDark.addEventListener('change', (event) => {
  if (!remembered()) setTheme(event.matches ? 'dark' : 'light');
});

// ---- Portfolio handoff ----

// The portfolio is dark, so go dark here first, then fade into its black before leaving.
const leaving = ['.nav', 'main', '.foot'];
for (const link of document.querySelectorAll('.to-portfolio')) {
  link.addEventListener('click', async (event) => {
    if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    remember('dark');
    await setTheme('dark', link);
    if (motion && !reducedMotion.matches) {
      await gsap.to(leaving, { autoAlpha: 0, y: -12, filter: 'blur(8px)', duration: 0.5, stagger: 0.05, ease: 'power2.in' });
    }
    location.href = link.href;
  });
}
// Back from the portfolio restores this page from the cache mid-fade.
addEventListener('pageshow', (event) => {
  if (event.persisted && motion) gsap.set(leaving, { clearProps: 'all' });
});

// ---- Content ----

try {
  const res = await fetch(root.dataset.src, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  root.innerHTML = render(await res.json());
  await document.fonts.ready; // Lines must be split in the final font.
  if (motion) animate();
} catch (err) {
  root.innerHTML = `<p class="notice">Could not load ${escape(root.dataset.src)}: ${escape(err.message)}</p>`;
} finally {
  root.removeAttribute('aria-busy');
}

function animate() {
  const now = document.querySelector('.now');
  const showSection = (text) =>
    reducedMotion.matches
      ? (now.textContent = text)
      : gsap.to(now, { duration: 0.7, scrambleText: { text, chars: 'lowerCase', speed: 0.6 }, overwrite: true });

  gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
  for (const section of root.querySelectorAll('section')) {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: ({ isActive }) => isActive && showSection(section.dataset.title),
    });
  }

  const mm = gsap.matchMedia();

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const off = new AbortController();
    const name = SplitText.create('.name', { type: 'words,chars' });
    const intro = SplitText.create('.intro p', { type: 'lines', mask: 'lines', aria: 'none' });

    const tl = gsap.timeline({ defaults: { duration: 1.1, ease: 'expo.out' } });
    tl.from(['.mark', '.links > *'], { y: -14, autoAlpha: 0, stagger: 0.06, duration: 0.8 })
      .from(name.chars, { yPercent: 115, rotation: 8, autoAlpha: 0, stagger: 0.035 }, 0.1)
      .from('.role', { y: 14, autoAlpha: 0 }, 0.45)
      .from(intro.lines, { yPercent: 100, stagger: 0.07, onComplete: () => intro.revert() }, 0.55)
      .from('.contact > li', { y: 12, autoAlpha: 0, stagger: 0.06 }, 0.85);

    // A small wave through the name on hover.
    document.querySelector('.name').addEventListener(
      'pointerenter',
      () => gsap.to(name.chars, { keyframes: { y: [0, -9, 0] }, duration: 0.6, stagger: 0.025, ease: 'sine.inOut', overwrite: 'auto' }),
      { signal: off.signal },
    );

    // Rows, headings and skill keywords drift up out of a blur as they scroll in.
    const items = gsap.utils.toArray('section:not(.hero) h2, .list:not(.skills) > .row, .skills h3, .skills .kw');
    gsap.set(items, { y: 28, autoAlpha: 0, filter: 'blur(6px)' });
    ScrollTrigger.batch(items, {
      start: 'top 92%',
      once: true,
      onEnter: (batch) =>
        gsap.to(batch, {
          y: 0,
          autoAlpha: 1,
          filter: 'blur(0px)',
          duration: 1,
          ease: 'expo.out',
          stagger: 0.05,
          delay: Math.max(0, 0.9 - tl.time()), // what's already on screen waits for the intro
          overwrite: true,
          clearProps: 'filter',
        }),
    });

    // Section rules draw across while their numbers scramble in.
    for (const h2 of root.querySelectorAll('section:not(.hero) h2')) {
      gsap
        .timeline({ scrollTrigger: { trigger: h2, start: 'top 92%', once: true } })
        .from(h2.querySelector('.rule'), { scaleX: 0, duration: 1.4, ease: 'expo.inOut' })
        .to(h2.querySelector('.n'), { duration: 0.8, scrambleText: { text: '{original}', chars: '0123456789' } }, 0);
    }

    const qr = document.getElementById('qr');
    qr?.addEventListener(
      'toggle',
      (event) =>
        event.newState === 'open' &&
        gsap.fromTo(qr, { scale: 0.6, rotation: -8, autoAlpha: 0 }, { scale: 1, rotation: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(2)' }),
      { signal: off.signal },
    );

    return () => off.abort();
  });

  // On pointer devices a highlight glides from row to row under the cursor.
  mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    const off = new AbortController();
    const pills = [...root.querySelectorAll('.list')].map((list) => {
      const pill = list.appendChild(document.createElement(list.tagName === 'UL' ? 'li' : 'div'));
      pill.className = 'pill';
      pill.setAttribute('aria-hidden', 'true');
      const moveY = gsap.quickTo(pill, 'y', { duration: 0.5, ease: 'power3' });
      const resize = gsap.quickTo(pill, 'height', { duration: 0.5, ease: 'power3' });
      list.addEventListener(
        'pointerover',
        (event) => {
          const row = event.target.closest('.row');
          if (row?.parentElement !== list) return;
          const pad = parseFloat(getComputedStyle(list).rowGap) / 2;
          const y = row.offsetTop - pad;
          const height = row.offsetHeight + pad * 2;
          if (gsap.getProperty(pill, 'opacity') < 0.05) gsap.set(pill, { y, height });
          moveY(y);
          resize(height);
          gsap.to(pill, { autoAlpha: 1, duration: 0.3, overwrite: 'auto' });
        },
        { signal: off.signal },
      );
      list.addEventListener('pointerleave', () => gsap.to(pill, { autoAlpha: 0, duration: 0.4, overwrite: 'auto' }), {
        signal: off.signal,
      });
      return pill;
    });
    return () => {
      off.abort();
      pills.forEach((pill) => pill.remove());
    };
  });
}
