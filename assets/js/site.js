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

document.addEventListener('pointermove', (event) => {
  setPointerVars(event.clientX, event.clientY);
}, { passive: true });

if (starCanvas) {
  const ctx = starCanvas.getContext('2d');
  const stars = [];
  const meteors = [];
  let lastStarFrame = 0;

  function buildStars() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    starCanvas.width = Math.floor(window.innerWidth * dpr);
    starCanvas.height = Math.floor(window.innerHeight * dpr);
    starCanvas.style.width = `${window.innerWidth}px`;
    starCanvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars.length = 0;
    meteors.length = 0;
    const count = Math.min(110, Math.max(55, Math.floor(window.innerWidth * window.innerHeight / 26000)));
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        z: Math.random() * 0.95 + 0.08,
        r: Math.random() * 1.55 + 0.35,
        tw: Math.random() * Math.PI * 2
      });
    }
    for (let i = 0; i < 2; i += 1) {
      meteors.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        speed: Math.random() * 0.45 + 0.18,
        len: Math.random() * 90 + 70,
        delay: Math.random() * 6000
      });
    }
  }

  function drawStars(time = 0) {
    if (time - lastStarFrame < 48) {
      if (!reduceMotion && !hasSolarScene) requestAnimationFrame(drawStars);
      return;
    }
    lastStarFrame = time;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const dx = (pointerX / Math.max(window.innerWidth, 1) - 0.5) * 30;
    const dy = (pointerY / Math.max(window.innerHeight, 1) - 0.5) * 30;

    for (const star of stars) {
      const x = star.x + dx * star.z;
      const y = star.y + dy * star.z;
      const pulse = 0.45 + Math.sin(time * 0.0016 + star.tw) * 0.28 + star.z * 0.38;
      ctx.beginPath();
      ctx.fillStyle = `rgba(235, 250, 255, ${Math.max(0.18, Math.min(0.92, pulse))})`;
      ctx.arc(x, y, star.r * (0.7 + star.z), 0, Math.PI * 2);
      ctx.fill();
    }

    for (const meteor of meteors) {
      const travel = ((time + meteor.delay) * meteor.speed) % (window.innerWidth + window.innerHeight);
      const x = meteor.x + travel;
      const y = meteor.y + travel * 0.34;
      const gradient = ctx.createLinearGradient(x, y, x - meteor.len, y - meteor.len * 0.34);
      gradient.addColorStop(0, 'rgba(255,255,255,.52)');
      gradient.addColorStop(1, 'rgba(70,225,255,0)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - meteor.len, y - meteor.len * 0.34);
      ctx.stroke();
    }

    if (!reduceMotion && !hasSolarScene) requestAnimationFrame(drawStars);
  }

  buildStars();
  drawStars();
  window.addEventListener('resize', buildStars);
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

document.addEventListener('pointermove', (event) => {
  const card = event.target.closest('.project-card, .profile-card, .step-item, .planet');
  if (!card) return;
  const rect = card.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - .5) * 8;
  const y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - .5) * -8;
  if (card.classList.contains('planet')) {
    card.style.filter = `drop-shadow(${x}px ${-y}px 18px rgba(70,225,255,.38))`;
    return;
  }
  if (!reduceMotion) {
    card.style.transform = `perspective(1200px) rotateX(${y}deg) rotateY(${x}deg) translateY(-4px)`;
  }
});

document.addEventListener('pointerout', (event) => {
  const card = event.target.closest('.project-card, .profile-card, .step-item, .planet');
  if (!card) return;
  card.style.transform = '';
  card.style.filter = '';
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
