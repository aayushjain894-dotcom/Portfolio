// Vibe: Glitch - Controlled bursts with safety gating and reduced-motion support
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const GAP = 1200; // ms between burst starts, shared across the page
let lastBurst = -Infinity;

const heroName = document.querySelector('.hero-name');

// Adds two aria-hidden copies of the real text for the glitch split.
// The real text itself is never changed or obscured.
function glitchify(el) {
  if (reduce || !el || el.querySelector('.g-copy')) return;
  const text = el.textContent.trim();
  ['g-a', 'g-b'].forEach((cls) => {
    const copy = document.createElement('span');
    copy.className = 'g-copy ' + cls;
    copy.setAttribute('aria-hidden', 'true');
    copy.textContent = text;
    el.append(copy);
  });

  el.addEventListener('animationend', (e) => {
    if (e.target.classList.contains('g-copy')) {
      el.classList.remove('burst-load', 'burst-hover', 'burst-small');
    }
  });
}

// Safety gate: ensures bursts never fire faster than once per GAP (1200ms)
function burst(el, kind) {
  const now = performance.now();
  if (reduce || !el || now - lastBurst < GAP) return false;
  lastBurst = now;
  el.classList.remove('burst-load', 'burst-hover', 'burst-small');
  void el.offsetWidth; // restart animation cleanly
  el.classList.add('burst-' + kind);
  return true;
}

// 1. Initialize glitch copies on headings
document.querySelectorAll('.glitch').forEach(glitchify);

// 2. Page load burst for hero title
if (heroName && !reduce) {
  if (window.scrollY < 100) {
    const triggerHero = () => burst(heroName, 'load');
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(triggerHero);
    } else {
      triggerHero();
    }
  }
}

// 3. Hover burst when mouse enters headings
document.querySelectorAll('.glitch').forEach((heading) => {
  heading.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') {
      burst(heading, 'hover');
    }
  });
});

// 4. Scroll entrance: section headings slice once as they scroll into view
const titles = [...document.querySelectorAll('.section-title')];
if (!reduce && 'IntersectionObserver' in window) {
  const waiting = new Set(titles);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const past = entry.boundingClientRect.top < 0;
      if (!entry.isIntersecting && !past) return;
      waiting.delete(entry.target);
      observer.unobserve(entry.target);

      // Give hero the first moment; headings already visible on initial load stay calm
      if (entry.isIntersecting && !past && performance.now() > 1000) {
        burst(entry.target, 'small');
      }
    });
  }, { rootMargin: '0px 0px -20% 0px' });

  titles.forEach((title) => observer.observe(title));

  window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 2 || !waiting.size) return;
    const last = [...waiting].pop();
    waiting.forEach((title) => observer.unobserve(title));
    waiting.clear();
    burst(last, 'small');
  }, { passive: true });
}

// 5. Active section navigation tracking
const navLinks = [...document.querySelectorAll('.site-nav a')];
const sections = [...document.querySelectorAll('main section[id]')];
let locked = null;

function setCurrent(id) {
  navLinks.forEach((a) => {
    if (a.hash === '#' + id) {
      a.setAttribute('aria-current', 'location');
    } else {
      a.removeAttribute('aria-current');
    }
  });
}

function currentFromScroll() {
  if (window.scrollY < 8) return sections[0]?.id;
  if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
    return sections[sections.length - 1]?.id;
  }
  const triggerLine = window.innerHeight * 0.4;
  let activeId = sections[0]?.id;
  sections.forEach((s) => {
    if (s.getBoundingClientRect().top <= triggerLine) {
      activeId = s.id;
    }
  });
  return activeId;
}

function updateNav() {
  if (!sections.length) return;
  if (locked) {
    const el = document.getElementById(locked.id);
    if (el) {
      const box = el.getBoundingClientRect();
      const onScreen = box.bottom > 0 && box.top < window.innerHeight;
      if (onScreen) locked.seen = true;
      else if (locked.seen) locked = null;
    }
  }
  setCurrent(locked ? locked.id : currentFromScroll());
}

function jump(id) {
  if (document.getElementById(id)) {
    locked = { id, seen: false };
    setCurrent(id);
  }
}

function release() {
  locked = null;
  updateNav();
}

navLinks.forEach((a) => {
  a.addEventListener('click', () => jump(a.hash.slice(1)));
});

window.addEventListener('hashchange', () => jump(location.hash.slice(1)));
['wheel', 'touchmove'].forEach((type) => window.addEventListener(type, release, { passive: true }));
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
    release();
  }
});

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    updateNav();
  });
}, { passive: true });

window.addEventListener('resize', updateNav);
if (location.hash.length > 1) {
  jump(location.hash.slice(1));
}
updateNav();
