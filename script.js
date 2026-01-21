/**
 * CASIA Country House - JavaScript
 * Animazioni e interattività
 */

(function() {
    'use strict';

    // ----- DOM Elements -----
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const reveals = document.querySelectorAll('.reveal');
    
    // Modal elements
    const modal = document.getElementById('gallery-modal');
    const modalImage = document.getElementById('modal-image');
    const modalClose = document.getElementById('modal-close');
    const modalPrev = document.getElementById('modal-prev');
    const modalNext = document.getElementById('modal-next');
    const galleryItems = document.querySelectorAll('[data-image]');
    
    let currentImageIndex = 0;
    const galleryImages = Array.from(galleryItems).map(item => item.dataset.image).filter(Boolean);

    // ----- Navbar Scroll Effect -----
    function handleNavbarScroll() {
        const scrollY = window.scrollY;
        
        if (scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    // ----- Mobile Menu Toggle -----
    function toggleMenu() {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    }

    function closeMenu() {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    // ----- Reveal on Scroll -----
    function revealOnScroll() {
        const windowHeight = window.innerHeight;
        const revealPoint = 120;

        reveals.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            
            if (elementTop < windowHeight - revealPoint) {
                element.classList.add('active');
            }
        });
    }

    // ----- Smooth Scroll for Anchor Links -----
    function smoothScroll(e) {
        const href = this.getAttribute('href');
        
        if (href.startsWith('#')) {
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const navbarHeight = navbar.offsetHeight;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Close mobile menu if open
                closeMenu();
            }
        }
    }

    // ----- Modal Gallery -----
    function openModal(index) {
        currentImageIndex = index;
        modalImage.src = galleryImages[currentImageIndex];
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function nextImage() {
        currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
        modalImage.src = galleryImages[currentImageIndex];
    }

    function prevImage() {
        currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
        modalImage.src = galleryImages[currentImageIndex];
    }

    // ----- Initialize -----
    function init() {
        // Initial checks
        handleNavbarScroll();
        revealOnScroll();

        // Event listeners
        window.addEventListener('scroll', handleNavbarScroll, { passive: true });
        window.addEventListener('scroll', revealOnScroll, { passive: true });
        window.addEventListener('resize', revealOnScroll, { passive: true });

        if (navToggle) {
            navToggle.addEventListener('click', toggleMenu);
        }

        // Smooth scroll for all anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', smoothScroll);
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (navMenu.classList.contains('active') && 
                !navMenu.contains(e.target) && 
                !navToggle.contains(e.target)) {
                closeMenu();
            }
        });

        // Close menu on escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                if (navMenu.classList.contains('active')) {
                    closeMenu();
                }
                if (modal.classList.contains('active')) {
                    closeModal();
                }
            }
        });

        // Gallery modal events
        galleryItems.forEach((item, index) => {
            item.addEventListener('click', () => openModal(index));
        });

        if (modalClose) {
            modalClose.addEventListener('click', closeModal);
        }

        if (modalNext) {
            modalNext.addEventListener('click', nextImage);
        }

        if (modalPrev) {
            modalPrev.addEventListener('click', prevImage);
        }

        // Close modal when clicking outside image
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeModal();
                }
            });
        }

        // Keyboard navigation for modal
        document.addEventListener('keydown', function(e) {
            if (modal.classList.contains('active')) {
                if (e.key === 'ArrowRight') {
                    nextImage();
                } else if (e.key === 'ArrowLeft') {
                    prevImage();
                }
            }
        });
    }

    // ----- Run on DOM Ready -----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

