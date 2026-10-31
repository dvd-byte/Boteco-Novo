document.querySelectorAll('.insta-item img').forEach((image, index) => {
    image.src = [
        'imagens/foto-1.jpeg',
        'imagens/foto-3.jpeg',
        'imagens/foto-4.jpeg',
        'imagens/foto-5.jpeg',
        'imagens/ambiente-3.jpeg',
        'imagens/ambiente2.jpeg'
    ][index];
    image.loading = 'eager';
    image.decoding = 'async';
});

// External image fallback keeps the demo independent from expiring third-party URLs.
const localImageFallbacks = {
    gallery: ['imagens/ambiente2.jpeg', 'imagens/ambiente-3.jpeg', 'imagens/ambiente-4.jpeg', 'imagens/ambiente1.jpeg'],
    events: ['imagens/ambiente-3.jpeg'],
    instagram: ['imagens/foto-1.jpeg', 'imagens/foto-3.jpeg', 'imagens/foto-4.jpeg', 'imagens/foto-5.jpeg', 'imagens/ambiente-3.jpeg', 'imagens/ambiente2.jpeg']
};

const attachLocalFallbacks = (selector, fallbacks) => {
    document.querySelectorAll(selector).forEach((image, index) => {
        const fallback = fallbacks[index % fallbacks.length];
        const useFallback = () => {
            if (image.dataset.fallbackApplied) return;
            image.dataset.fallbackApplied = 'true';
            image.src = fallback;
        };
        image.addEventListener('error', useFallback, { once: true });
        if (image.complete && image.naturalWidth === 0) useFallback();
        setTimeout(() => {
            if (!image.complete || image.naturalWidth === 0) useFallback();
        }, 1500);
    });
};

attachLocalFallbacks('.gallery-item img[src^="http"]', localImageFallbacks.gallery);
attachLocalFallbacks('.events-img img[src^="http"]', localImageFallbacks.events);
attachLocalFallbacks('.insta-item img[src^="http"]', localImageFallbacks.instagram);

// Navbar scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const compactNavigation = window.matchMedia('(max-width: 1024px)');

const setMenuState = (isOpen) => {
    hamburger.classList.toggle('active', isOpen);
    navMenu.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    hamburger.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('menu-open', isOpen);
    navMenu.inert = compactNavigation.matches && !isOpen;
};

hamburger.addEventListener('click', () => setMenuState(!navMenu.classList.contains('open')));
compactNavigation.addEventListener('change', () => setMenuState(false));
setMenuState(false);

document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        setMenuState(false);
    });
});

document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
        setMenuState(false);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        setMenuState(false);
        closeLightbox();
    }
});

// Active nav link
const sections = document.querySelectorAll('section[id]');
window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset + 150;
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        // About and gallery share the same navigation item.
        const id = section.id === 'gallery' ? 'about' : section.id;
        const link = document.querySelector('.nav-menu a[href="#' + id + '"]');
        if (link) {
            if (scrollY >= top && scrollY < top + height) {
                document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
            }
        }
    });
});

// Category, search and expansion share a single visibility calculation.
let filterBtns = document.querySelectorAll('.filter-btn');
let menuCards = document.querySelectorAll('.menu-card');
const menuSearch = document.getElementById('menuSearch');
const menuMore = document.getElementById('menuMore');
const menuGrid = document.getElementById('menuGrid');
const getMenuPreviewCount = () => {
    // Computed CSS exposes the actual grid tracks, including auto-fill columns.
    const tracks = getComputedStyle(menuGrid).gridTemplateColumns;
    const columns = tracks && tracks !== 'none' ? tracks.trim().split(/\s+/).length : 1;
    return Math.max(4, columns * 2);
};
let menuPreviewCount = getMenuPreviewCount();
let activeCategory = null;
let menuExpanded = false;
const normalizeMenuText = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const filterMenu = () => {
    const query = normalizeMenuText(menuSearch.value.trim());
    let count = 0;
    let shown = 0;
    menuCards.forEach(card => {
        const match = (!activeCategory || card.dataset.cat === activeCategory)
            && normalizeMenuText(card.dataset.name).includes(query);
        if (match) count++;
        const show = match && (menuExpanded || count <= menuPreviewCount);
        if (show) {
            shown++;
            card.hidden = false;
            observer.observe(card);
        } else {
            observer.unobserve(card);
            card.classList.remove('visible');
            card.hidden = true;
        }
    });
    document.getElementById('menuCount').textContent = count
        ? `Mostrando ${shown} de ${count} ${count === 1 ? 'opção' : 'opções'}`
        : 'Nenhuma opção encontrada';
    document.getElementById('menuEmpty').hidden = count !== 0;
    menuMore.hidden = count <= menuPreviewCount;
    menuMore.textContent = menuExpanded ? 'Ver menos' : 'Ver mais';
    menuMore.setAttribute('aria-expanded', String(menuExpanded));
};
// Recalculate only when the column count changes, avoiding resize feedback loops.
const updateMenuPreview = () => {
    const nextCount = getMenuPreviewCount();
    if (nextCount === menuPreviewCount) return;
    menuPreviewCount = nextCount;
    filterMenu();
};
if ('ResizeObserver' in window) {
    const menuResizeObserver = new ResizeObserver(updateMenuPreview);
    menuResizeObserver.observe(menuGrid);
} else {
    window.addEventListener('resize', updateMenuPreview);
}

const bindMenuFilters = () => filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        activeCategory = activeCategory === btn.dataset.filter ? null : btn.dataset.filter;
        menuExpanded = false;
        filterBtns.forEach(b => {
            const active = b.dataset.filter === activeCategory;
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', String(active));
        });
        filterMenu();
    });
});
bindMenuFilters();
menuSearch.addEventListener('input', () => {
    menuExpanded = false;
    filterMenu();
});
menuMore.addEventListener('click', () => {
    menuExpanded = !menuExpanded;
    filterMenu();
    if (!menuExpanded) document.getElementById('menuFilters').scrollIntoView({ block: 'center' });
});

// Gallery lightbox
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxClose = document.getElementById('lightboxClose');

const closeLightbox = () => {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    lightboxImage.removeAttribute('src');
};

document.querySelectorAll('.gallery-item').forEach(item => {
    const openLightbox = () => {
        const image = item.querySelector('img');
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt;
        lightbox.classList.add('open');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.classList.add('lightbox-open');
        lightboxClose.focus();
    };

    item.addEventListener('click', openLightbox);
    item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openLightbox();
        }
    });
});

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
});

// Scroll animations
const fadeEls = document.querySelectorAll('.fade-in');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        // Reverse the reveal at the lower boundary when scrolling back up.
        // Content already passed above the viewport stays revealed.
        const aboveViewport = entry.boundingClientRect.top < 0;
        const revealed = aboveViewport || (entry.isIntersecting && entry.intersectionRatio >= 0.1);
        entry.target.classList.toggle('visible', revealed);
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

fadeEls.forEach(el => observer.observe(el));
document.addEventListener('boteco:menu-will-update', () => {
    document.querySelectorAll('#menuGrid .fade-in, #specialsGrid .fade-in').forEach(el=>observer.unobserve(el));
});
document.addEventListener('boteco:menu-updated', () => {
    filterBtns=document.querySelectorAll('.filter-btn');menuCards=document.querySelectorAll('.menu-card');
    activeCategory=null;menuExpanded=false;bindMenuFilters();filterMenu();
    document.querySelectorAll('#specialsGrid .fade-in').forEach(el=>observer.observe(el));
});
filterMenu();

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (!href || !href.startsWith('#') || href === '#') return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            const offset = navbar.offsetHeight + 20;
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});
