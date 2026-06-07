const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const closeSide = document.querySelector('[data-close-side]');
const sideNav = document.querySelector('[data-side-nav]');
const scrim = document.querySelector('[data-scrim]');
const searchButton = document.querySelector('[data-search-button]');
const searchPopover = document.querySelector('[data-search-popover]');
const searchInput = document.querySelector('[data-search-input]');
const starCanvas = document.querySelector('[data-starfield]');
const hasSolarScene = Boolean(document.querySelector('.solar-map'));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let pointerX = window.innerWidth * 0.5;
let pointerY = window.innerHeight * 0.35;

const progress = document.createElement('div');
progress.className = 'progress-bar';
document.body.prepend(progress);

const pageTransition = document.createElement('div');
pageTransition.className = 'page-transition';
document.body.appendChild(pageTransition);

const meteorLayer = document.createElement('div');
meteorLayer.className = 'meteor-layer';
meteorLayer.setAttribute('aria-hidden', 'true');
meteorLayer.innerHTML = '<i></i><i></i><i></i><i></i>';
document.body.appendChild(meteorLayer);

function setPointerVars(x, y) {
  pointerX = x;
  pointerY = y;
  document.documentElement.style.setProperty('--mouse-x', `${x}px`);
  document.documentElement.style.setProperty('--mouse-y', `${y}px`);
  const heroX = ((x / Math.max(window.innerWidth, 1)) - 0.5) * 18;
  const heroY = ((y / Math.max(window.innerHeight, 1)) - 0.5) * 10;
  document.documentElement.style.setProperty('--hero-drift-x', `${heroX}px`);
  document.documentElement.style.setProperty('--hero-drift-y', `${heroY}px`);
}

setPointerVars(pointerX, pointerY);

if (document.body.classList.contains('page-atlas')) {
  let pendingPointerEvent = null;
  let pointerFrame = 0;

  document.addEventListener('pointermove', (event) => {
    pendingPointerEvent = event;
    if (pointerFrame) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (pendingPointerEvent) {
        setPointerVars(pendingPointerEvent.clientX, pendingPointerEvent.clientY);
      }
    });
  }, { passive: true });
}

if (starCanvas) {
  starCanvas.remove();
}

function setPageState() {
  const y = window.scrollY;
  const h = document.documentElement.scrollHeight - window.innerHeight;
  header.classList.toggle('is-solid', y > 18);
  document.documentElement.style.setProperty('--progress', `${h > 0 ? (y / h) * 100 : 0}%`);
}

function openSide() {
  sideNav.classList.add('is-open');
  scrim.classList.add('is-open');
}

function closeSideNav() {
  sideNav.classList.remove('is-open');
  scrim.classList.remove('is-open');
}

function clearMarks() {
  document.querySelectorAll('mark[data-search-mark]').forEach((mark) => {
    const text = document.createTextNode(mark.textContent);
    mark.replaceWith(text);
  });
}

function textNodes(root) {
  const nodes = [];
  const visit = (node) => {
    if (!node) return;
    if (node.nodeType === 3) {
      nodes.push(node);
      return;
    }
    if (node.nodeType !== 1 || ['SCRIPT', 'STYLE', 'MARK'].includes(node.tagName)) return;
    Array.from(node.childNodes).forEach(visit);
  };
  visit(root);
  return nodes;
}

function highlightTerm(term) {
  clearMarks();
  const needle = term.trim().toLocaleLowerCase('vi');
  if (!needle) return;
  const nodes = textNodes(document.querySelector('main')).filter((node) => node.nodeValue.toLocaleLowerCase('vi').includes(needle));
  nodes.slice(0, 24).forEach((node) => {
    const value = node.nodeValue;
    const lower = value.toLocaleLowerCase('vi');
    const idx = lower.indexOf(needle);
    if (idx < 0) return;
    const before = document.createTextNode(value.slice(0, idx));
    const mark = document.createElement('mark');
    mark.dataset.searchMark = 'true';
    mark.textContent = value.slice(idx, idx + term.length);
    const after = document.createTextNode(value.slice(idx + term.length));
    node.replaceWith(before, mark, after);
  });
}

window.addEventListener('scroll', setPageState, { passive: true });
setPageState();

function scrollToHashTarget() {
  if (!location.hash) return;
  const target = document.querySelector(location.hash);
  if (!target) return;
  const headerOffset = header?.offsetHeight ? header.offsetHeight + 12 : 86;
  const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  setPageState();
}

if (location.hash) {
  [80, 360, 900, 1500].forEach((delay) => setTimeout(scrollToHashTarget, delay));
}

window.addEventListener('hashchange', scrollToHashTarget);

menuButton.addEventListener('click', openSide);
closeSide.addEventListener('click', closeSideNav);
scrim.addEventListener('click', closeSideNav);

searchButton.addEventListener('click', () => {
  searchPopover.classList.toggle('is-open');
  if (searchPopover.classList.contains('is-open')) searchInput.focus();
});

searchInput.addEventListener('input', (event) => {
  highlightTerm(event.target.value);
});

document.querySelectorAll('main > section:not(.orbit-section), .project-card, .step-item, .article-body > h2, figure, .analysis-upgrade, .result-link').forEach((el) => {
  el.classList.add('reveal');
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -70px 0px' });

document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

document.querySelectorAll('.solar-map:not(.solar-map-3d)').forEach((map) => {
  map.addEventListener('pointermove', (event) => {
    const rect = map.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 14;
    const y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 10;
    map.style.setProperty('--solar-tilt-x', `${y}deg`);
    map.style.setProperty('--solar-tilt-y', `${-x}deg`);
    map.style.setProperty('--solar-light-x', `${event.clientX - rect.left}px`);
    map.style.setProperty('--solar-light-y', `${event.clientY - rect.top}px`);
  }, { passive: true });
  map.addEventListener('pointerleave', () => {
    map.style.setProperty('--solar-tilt-x', '0deg');
    map.style.setProperty('--solar-tilt-y', '0deg');
  });
});

const atlasViewport = document.querySelector('[data-star-atlas]');
const atlasMap = document.querySelector('[data-star-atlas-map]');

if (atlasViewport && atlasMap) {
  let atlasX = window.innerWidth <= 700 ? -560 : -300;
  let atlasY = window.innerWidth <= 700 ? -170 : -190;
  let startX = 0;
  let startY = 0;
  let startAtlasX = 0;
  let startAtlasY = 0;
  let dragging = false;
  let moved = false;
  let suppressClick = false;

  function clampAtlas() {
    const view = atlasViewport.getBoundingClientRect();
    const map = atlasMap.getBoundingClientRect();
    const minX = Math.min(0, view.width - 1800);
    const minY = Math.min(0, view.height - 1040);
    atlasX = Math.max(minX, Math.min(0, atlasX));
    atlasY = Math.max(minY, Math.min(0, atlasY));
    atlasMap.style.setProperty('--atlas-x', `${atlasX}px`);
    atlasMap.style.setProperty('--atlas-y', `${atlasY}px`);
  }

  atlasViewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    startAtlasX = atlasX;
    startAtlasY = atlasY;
    atlasViewport.classList.add('is-dragging');
    atlasViewport.setPointerCapture?.(event.pointerId);
  });

  atlasViewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    atlasX = startAtlasX + dx;
    atlasY = startAtlasY + dy;
    clampAtlas();
  });

  function endAtlasDrag(event) {
    if (!dragging) return;
    dragging = false;
    atlasViewport.classList.remove('is-dragging');
    atlasViewport.releasePointerCapture?.(event.pointerId);
    suppressClick = moved;
    window.setTimeout(() => {
      suppressClick = false;
    }, 80);
  }

  atlasViewport.addEventListener('pointerup', endAtlasDrag);
  atlasViewport.addEventListener('pointercancel', endAtlasDrag);
  atlasViewport.addEventListener('click', (event) => {
    if (suppressClick) {
      event.preventDefault();
      event.stopPropagation();
    }
    moved = false;
  }, true);
  window.addEventListener('resize', clampAtlas);
  clampAtlas();
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || link.target) return;
  const url = new URL(href, location.href);
  if (url.origin !== location.origin || url.pathname === location.pathname && url.hash) return;
  event.preventDefault();
  pageTransition.classList.remove('transition-up', 'transition-diagonal');
  const variants = ['', 'transition-up', 'transition-diagonal'];
  const variant = variants[Math.floor(Math.random() * variants.length)];
  if (variant) pageTransition.classList.add(variant);
  pageTransition.classList.add('is-active');
  window.setTimeout(() => {
    location.href = url.href;
  }, 220);
});

const lightbox = document.createElement('div');
lightbox.className = 'lightbox';
lightbox.innerHTML = '<button class="lightbox-close" type="button" aria-label="Đóng ảnh">×</button><div class="lightbox-inner"><img alt=""><p></p></div>';
document.body.appendChild(lightbox);
const lightboxImage = lightbox.querySelector('img');
const lightboxCaption = lightbox.querySelector('p');

function closeLightbox() {
  lightbox.classList.remove('is-open');
  lightboxImage.removeAttribute('src');
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-lightbox-src]');
  if (!button) return;
  lightboxImage.src = button.dataset.lightboxSrc;
  lightboxImage.alt = button.dataset.lightboxCaption || 'Ảnh phóng to';
  lightboxCaption.textContent = button.dataset.lightboxCaption || '';
  lightbox.classList.add('is-open');
});

lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox || event.target.closest('.lightbox-close')) closeLightbox();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSideNav();
    searchPopover.classList.remove('is-open');
    closeLightbox();
  }
});
