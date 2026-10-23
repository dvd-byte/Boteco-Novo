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

let selectedReviewRating = 0;
let reviewIndex = 0;
const demoReviews = [
    { name: 'Exemplo demonstrativo', comment: 'Um ambiente agradável para reunir os amigos.', rating: 5 },
    { name: 'Exemplo demonstrativo', comment: 'Uma experiência gostosa para comemorar juntos.', rating: 5 },
    { name: 'Exemplo demonstrativo', comment: 'Um boteco acolhedor para aproveitar sem pressa.', rating: 4 }
];
const reviewTrack = document.getElementById('reviewTrack');
const reviewForm = document.getElementById('reviewForm');
const reviewName = document.getElementById('reviewName');
const reviewComment = document.getElementById('reviewComment');

const renderReviews = () => {
    const reviews = JSON.parse(localStorage.getItem('botecoReviews') || '[]');
    reviewIndex = 0;
    const visibleReviews = reviews.length ? reviews : demoReviews;
    reviewTrack.innerHTML = visibleReviews.length ? visibleReviews.map(review => `
        <article class="review-card${reviews.length ? '' : ' demo-review'}">
            ${reviews.length ? '' : '<span class="review-demo-label">Exemplo demonstrativo</span>'}
            <div class="review-card-stars" aria-label="${review.rating} de 5 estrelas">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</div>
            <blockquote>"${review.comment.replace(/[<>]/g, '')}"</blockquote>
            <cite>${review.name.replace(/[<>]/g, '')}</cite>
        </article>
    `).join('') : '<div class="review-empty">Ainda não há avaliações publicadas.</div>';
};

document.querySelectorAll('.review-star').forEach(star => {
    star.addEventListener('click', () => {
        const rating = Number(star.dataset.rating);
        selectedReviewRating = rating;
        document.querySelectorAll('.review-star').forEach((item, index) => {
            item.classList.toggle('selected', index < rating);
            item.querySelector('i').className = index < rating ? 'fas fa-star' : 'far fa-star';
        });
    });
});

reviewForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!selectedReviewRating) {
        alert('Escolha uma quantidade de estrelas antes de publicar.');
        return;
    }
    const reviews = JSON.parse(localStorage.getItem('botecoReviews') || '[]');
    reviews.push({ name: reviewName.value.trim(), comment: reviewComment.value.trim(), rating: selectedReviewRating });
    localStorage.setItem('botecoReviews', JSON.stringify(reviews));
    reviewForm.reset();
    selectedReviewRating = 0;
    document.querySelectorAll('.review-star').forEach(star => {
        star.classList.remove('selected');
        star.querySelector('i').className = 'far fa-star';
    });
    renderReviews();
});

renderReviews();
setInterval(() => {
    const reviewCards = reviewTrack.querySelectorAll('.review-card');
    if (reviewCards.length > 1) {
        reviewIndex = (reviewIndex + 1) % reviewCards.length;
        reviewTrack.style.transform = `translateX(-${reviewIndex * 100}%)`;
    }
}, 5000);

// Navbar scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');

const setMenuState = (isOpen) => {
    hamburger.classList.toggle('active', isOpen);
    navMenu.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
    hamburger.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('menu-open', isOpen);
};

hamburger.addEventListener('click', () => setMenuState(!navMenu.classList.contains('open')));

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
        const id = section.getAttribute('id');
        const link = document.querySelector('.nav-menu a[href="#' + id + '"]');
        if (link) {
            if (scrollY >= top && scrollY < top + height) {
                document.querySelectorAll('.nav-menu a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
            }
        }
    });
});

// Menu filter
const filterBtns = document.querySelectorAll('.filter-btn');
const menuCards = document.querySelectorAll('.menu-card');

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;

        menuCards.forEach(card => {
            const match = filter === 'all' || card.dataset.cat === filter;
            card.style.display = match ? '' : 'none';
            if (match) {
                card.classList.remove('visible');
                card.style.opacity = '0';
                card.style.transform = 'translateY(15px)';
                requestAnimationFrame(() => {
                    card.style.transition = 'opacity 0.4s, transform 0.4s';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                    card.classList.add('visible');
                });
            }
        });
    });
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
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

fadeEls.forEach(el => observer.observe(el));

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
            const offset = navbar.offsetHeight + 20;
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});
