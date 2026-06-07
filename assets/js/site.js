
const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const closeSide = document.querySelector('[data-close-side]');
const sideNav = document.querySelector('[data-side-nav]');
const scrim = document.querySelector('[data-scrim]');
const searchButton = document.querySelector('[data-search-button]');
const searchPopover = document.querySelector('[data-search-popover]');
const searchInput = document.querySelector('[data-search-input]');

function setSolidHeader() {
  header.classList.toggle('is-solid', window.scrollY > 18);
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
  nodes.slice(0, 20).forEach((node) => {
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

window.addEventListener('scroll', setSolidHeader, { passive: true });
setSolidHeader();

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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeSideNav();
    searchPopover.classList.remove('is-open');
    closeLightbox();
  }
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
