/**
 * Casia Vacanze - JavaScript
 * Animazioni e interattività
 */

(function() {
    'use strict';

    // ----- DOM Elements -----
    const navbar = document.getElementById('navbar');
    const statusBarCover = document.querySelector('.status-bar-cover');
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
            if (statusBarCover) statusBarCover.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
            if (statusBarCover) statusBarCover.classList.remove('scrolled');
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

    // ----- Active Nav Link on Scroll -----
    function updateActiveNavLink() {
        const sections = document.querySelectorAll('section[id]');
        const scrollY = window.scrollY;
        const navbarHeight = navbar ? navbar.offsetHeight : 0;

        sections.forEach(section => {
            const sectionTop = section.offsetTop - navbarHeight - 100;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + sectionId) {
                        link.classList.add('active');
                    }
                });
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
        updateActiveNavLink();

        // Event listeners
        window.addEventListener('scroll', handleNavbarScroll, { passive: true });
        window.addEventListener('scroll', revealOnScroll, { passive: true });
        window.addEventListener('scroll', updateActiveNavLink, { passive: true });
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

/* =============================================
   BOOKING MODULE
   ============================================= */

(function() {
    'use strict';

    const API_BASE = '/api';

    // Orari standard check-in / check-out
    const CHECKIN_TIME = '15:00';
    const CHECKOUT_TIME = '10:00';

    // Capacità massima ospiti per appartamento
    const APT_CAPACITY = { oliva: 4, venica: 5 };

    // State
    let bookingState = {
        apartment: 'oliva',
        checkin: null,
        checkout: null,
        nights: 0,
        adults: 2,
        children: 0,
        totalCents: 0,
        totalFormatted: '',
        unavailableDates: [],
        priceData: null,
    };

    let flatpickrInstance = null;
    let priceDebounce = null;
    let priceRequestSeq = 0;

    function init() {
        const widget = document.getElementById('booking-widget');
        if (!widget) return;

        initCalendar();
        initCounters();
        initStepNavigation();
        initForm();
        initApartmentCTA();
        checkUrlParams();
    }

    // ----- Apartment CTA -----
    function initApartmentCTA() {
        document.querySelectorAll('.appartamento-cta[data-apartment]').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const apt = this.dataset.apartment;
                const radio = document.querySelector(`input[name="apartment"][value="${apt}"]`);
                if (radio && !radio.disabled) {
                    radio.checked = true;
                    bookingState.apartment = apt;
                    updateCounterLimits();
                    loadAvailability();
                }
                // Scroll alla sezione prenota
                const target = document.getElementById('prenota');
                if (target) {
                    const offset = 80; // navbar height
                    const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({ top, behavior: 'smooth' });
                }
            });
        });
    }

    // ----- Calendar -----
    function initCalendar() {
        const calendarEl = document.getElementById('booking-calendar');
        if (!calendarEl || typeof flatpickr === 'undefined') return;

        flatpickrInstance = flatpickr(calendarEl, {
            mode: 'range',
            inline: true,
            minDate: 'today',
            maxDate: new Date().fp_incr(365),
            dateFormat: 'Y-m-d',
            locale: typeof flatpickr.l10ns !== 'undefined' && flatpickr.l10ns.it ? flatpickr.l10ns.it : 'default',
            showMonths: window.innerWidth > 600 ? 2 : 1,
            disable: [function(date) {
                const d = date.getFullYear() + '-' +
                    String(date.getMonth() + 1).padStart(2, '0') + '-' +
                    String(date.getDate()).padStart(2, '0');
                return bookingState.unavailableDates.includes(d);
            }],
            onChange: onDateChange,
            onMonthChange: onMonthChange,
        });

        // Carica disponibilità dopo che flatpickrInstance è assegnato
        loadAvailability();

        // Resize handler
        window.addEventListener('resize', function() {
            if (flatpickrInstance) {
                const months = window.innerWidth > 600 ? 2 : 1;
                if (flatpickrInstance.config.showMonths !== months) {
                    flatpickrInstance.set('showMonths', months);
                }
            }
        });
    }

    function onDateChange(selectedDates) {
        if (selectedDates.length === 2) {
            bookingState.checkin = formatDateISO(selectedDates[0]);
            bookingState.checkout = formatDateISO(selectedDates[1]);
            bookingState.nights = Math.round((selectedDates[1] - selectedDates[0]) / (1000 * 60 * 60 * 24));

            showSummaryDetails();
            updateSummary();
            calculatePrice();
        } else {
            bookingState.checkin = null;
            bookingState.checkout = null;
            bookingState.nights = 0;
            bookingState.totalCents = 0;
            hidePriceInfo();
            disableNextBtn();
        }
    }

    function onMonthChange() {
        loadAvailability();
    }

    async function loadAvailability() {
        if (!flatpickrInstance) return;

        const currentMonth = flatpickrInstance.currentMonth;
        const currentYear = flatpickrInstance.currentYear;

        // Load current + next month
        const months = [];
        for (let i = 0; i < 3; i++) {
            let m = currentMonth + i;
            let y = currentYear;
            if (m > 11) { m -= 12; y++; }
            months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
        }

        try {
            const res = await fetch(`${API_BASE}/availability?apartment=${bookingState.apartment}&months=${months.join(',')}`);
            if (!res.ok) return;
            const data = await res.json();

            bookingState.unavailableDates = data.unavailable || [];

            // Forza Flatpickr a rivalutare le date disabilitate
            flatpickrInstance.set('disable', [function(date) {
                const d = date.getFullYear() + '-' +
                    String(date.getMonth() + 1).padStart(2, '0') + '-' +
                    String(date.getDate()).padStart(2, '0');
                return bookingState.unavailableDates.includes(d);
            }]);
        } catch (err) {
            console.error('Errore caricamento disponibilità:', err);
        }
    }

    // ----- Price Calculation -----
    async function calculatePrice() {
        if (!bookingState.checkin || !bookingState.checkout) return;

        showPriceLoading();

        clearTimeout(priceDebounce);
        const seq = ++priceRequestSeq;
        priceDebounce = setTimeout(async () => {
            try {
                const res = await fetch(`${API_BASE}/calculate-price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apartment: bookingState.apartment,
                        checkin: bookingState.checkin,
                        checkout: bookingState.checkout,
                        guests: bookingState.adults + bookingState.children,
                    }),
                });

                const data = await res.json();

                // Risposta superata da una richiesta più recente: ignora
                if (seq !== priceRequestSeq) return;

                if (!res.ok) {
                    let msg;
                    if (data && data.min_nights) {
                        msg = (tt('booking_min_nights_error') || 'Soggiorno minimo di {n} notti per queste date').replace('{n}', data.min_nights);
                    } else if (data && data.error && data.error.indexOf('prezzo configurato') !== -1) {
                        msg = tt('booking_no_price_error') || 'Prezzi non ancora disponibili per queste date: contattaci';
                    } else {
                        msg = (data && data.error) || tt('booking_price_error') || 'Errore nel calcolo prezzo';
                    }
                    showPriceError(msg);
                    disableNextBtn();
                    return;
                }

                bookingState.totalCents = data.total_cents;
                bookingState.totalFormatted = formatEuro(data.total_cents);
                bookingState.priceData = data;

                showPrice();
                enableNextBtn();
            } catch (err) {
                if (seq !== priceRequestSeq) return;
                showPriceError(tt('booking_connection_error') || 'Errore di connessione');
                disableNextBtn();
            }
        }, 300);
    }

    // ----- Counters -----
    function updateCounterLimits() {
        const cap = APT_CAPACITY[bookingState.apartment] || 4;
        const adultsInput = document.getElementById('booking-adults');
        const childrenInput = document.getElementById('booking-children');
        if (!adultsInput || !childrenInput) return;

        // Adulti: max = capacità - bambini attuali (minimo 1)
        const maxAdults = Math.max(1, cap - bookingState.children);
        adultsInput.max = maxAdults;
        if (bookingState.adults > maxAdults) {
            bookingState.adults = maxAdults;
            adultsInput.value = maxAdults;
        }

        // Bambini: max = capacità - adulti attuali (minimo 0)
        const maxChildren = Math.max(0, cap - bookingState.adults);
        childrenInput.max = maxChildren;
        if (bookingState.children > maxChildren) {
            bookingState.children = maxChildren;
            childrenInput.value = maxChildren;
        }
    }

    function initCounters() {
        document.querySelectorAll('.booking-counter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = this.dataset.target;
                const dir = parseInt(this.dataset.dir);
                const input = document.getElementById(targetId);
                if (!input) return;

                const min = parseInt(input.min) || 0;
                const max = parseInt(input.max) || 10;
                let val = parseInt(input.value) || 0;
                val += dir;
                if (val < min) val = min;
                if (val > max) val = max;
                input.value = val;

                if (targetId === 'booking-adults') bookingState.adults = val;
                if (targetId === 'booking-children') bookingState.children = val;

                updateCounterLimits();

                // Il numero di ospiti incide sul prezzo: ricalcola il preventivo
                if (bookingState.checkin && bookingState.checkout) calculatePrice();
            });
        });

        // Cambio appartamento → aggiorna limiti
        document.querySelectorAll('input[name="apartment"]').forEach(radio => {
            radio.addEventListener('change', function() {
                bookingState.apartment = this.value;
                updateCounterLimits();
                loadAvailability();
            });
        });

        updateCounterLimits();
    }

    // ----- Step Navigation -----
    function initStepNavigation() {
        const nextBtn = document.getElementById('booking-next-btn');
        const backBtn = document.getElementById('booking-back-1');
        const payBtn = document.getElementById('booking-pay-btn');

        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (!bookingState.checkin || !bookingState.checkout || bookingState.totalCents <= 0) return;
                goToStep2();
            });
        }

        if (backBtn) {
            backBtn.addEventListener('click', function() {
                goToStep1();
            });
        }

        if (payBtn) {
            payBtn.addEventListener('click', function() {
                submitBooking();
            });
        }
    }

    // ----- Timer -----
    let timerInterval = null;
    let timerEndTime = null;
    const TIMER_MINUTES = 30;

    function startTimer() {
        stopTimer();
        timerEndTime = Date.now() + TIMER_MINUTES * 60 * 1000;

        const timerEl = document.getElementById('booking-timer');
        if (timerEl) timerEl.style.display = 'flex';

        updateTimerDisplay();
        timerInterval = setInterval(updateTimerDisplay, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        const timerEl = document.getElementById('booking-timer');
        if (timerEl) timerEl.style.display = 'none';
    }

    function updateTimerDisplay() {
        const remaining = Math.max(0, timerEndTime - Date.now());
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        const timerText = document.getElementById('booking-timer-text');
        if (timerText) {
            timerText.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        // Sotto 5 minuti: diventa rosso
        const timerEl = document.getElementById('booking-timer');
        if (timerEl) {
            timerEl.classList.toggle('booking-timer--urgent', minutes < 5);
        }

        // Scaduto
        if (remaining <= 0) {
            stopTimer();
            goToStep1();
            showBanner(tt('timer_expired') || 'Il tempo per completare la prenotazione è scaduto. Seleziona di nuovo le date.', 'cancelled');
        }
    }

    function goToStep2() {
        document.getElementById('booking-step-1').style.display = 'none';
        document.getElementById('booking-step-2').style.display = 'block';

        // Update final summary
        const apartmentName = bookingState.apartment === 'oliva' ? 'Oliva' : 'Venica';
        setText('final-apartment', apartmentName);
        setText('final-dates', `${formatDateHuman(bookingState.checkin)} (${CHECKIN_TIME}) → ${formatDateHuman(bookingState.checkout)} (${CHECKOUT_TIME})`);
        setText('final-nights', bookingState.nights);
        setText('final-guests', formatGuests(bookingState.adults, bookingState.children));
        setText('final-price', bookingState.totalFormatted);

        // Avvia timer 20 minuti
        startTimer();

        // Scroll all'inizio della sezione prenota
        const section = document.getElementById('prenota');
        const top = section.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top, behavior: 'smooth' });
    }

    function goToStep1() {
        stopTimer();
        document.getElementById('booking-step-2').style.display = 'none';
        document.getElementById('booking-step-1').style.display = 'block';
        const section = document.getElementById('prenota');
        const top = section.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top, behavior: 'smooth' });
    }

    // ----- Form -----
    function initForm() {
        // Real-time validation
        const nameInput = document.getElementById('guest-name');
        const emailInput = document.getElementById('guest-email');
        const phoneInput = document.getElementById('guest-phone');

        if (nameInput) {
            nameInput.addEventListener('blur', function() {
                validateField(this, 'Inserisci il tuo nome');
            });
        }

        if (emailInput) {
            emailInput.addEventListener('blur', function() {
                validateEmail(this);
            });
        }

        if (phoneInput) {
            phoneInput.addEventListener('blur', function() {
                validateField(this, 'Inserisci il tuo numero di telefono');
            });
        }
    }

    function tt(key, params) {
        return (window.I18n && I18n.t(key, params)) || null;
    }

    function validateField(input, message) {
        const errorEl = input.parentElement.querySelector('.booking-field-error');
        if (!input.value.trim()) {
            input.classList.add('error');
            if (errorEl) errorEl.textContent = message;
            return false;
        }
        input.classList.remove('error');
        if (errorEl) errorEl.textContent = '';
        return true;
    }

    function validateCheckbox(input, message) {
        if (!input) return true;
        const errorEl = input.closest('.booking-field')?.querySelector('.booking-field-error');
        if (!input.checked) {
            input.classList.add('error');
            if (errorEl) errorEl.textContent = message;
            return false;
        }
        input.classList.remove('error');
        if (errorEl) errorEl.textContent = '';
        return true;
    }

    function validateEmail(input) {
        const errorEl = input.parentElement.querySelector('.booking-field-error');
        const email = input.value.trim();
        if (!email) {
            input.classList.add('error');
            if (errorEl) errorEl.textContent = tt('validate_email') || 'Inserisci la tua email';
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            input.classList.add('error');
            if (errorEl) errorEl.textContent = tt('validate_email_invalid') || 'Email non valida';
            return false;
        }
        input.classList.remove('error');
        if (errorEl) errorEl.textContent = '';
        return true;
    }

    // ----- Submit Booking -----
    async function submitBooking() {
        const nameInput = document.getElementById('guest-name');
        const emailInput = document.getElementById('guest-email');
        const phoneInput = document.getElementById('guest-phone');
        const privacyInput = document.getElementById('privacy-consent');

        const nameValid = validateField(nameInput, tt('validate_name') || 'Inserisci il tuo nome');
        const emailValid = validateEmail(emailInput);
        const phoneValid = validateField(phoneInput, tt('validate_phone') || 'Inserisci il tuo numero di telefono');
        const privacyValid = validateCheckbox(privacyInput, tt('validate_privacy') || 'Devi accettare la privacy policy per procedere');

        if (!nameValid || !emailValid || !phoneValid || !privacyValid) return;

        const payBtn = document.getElementById('booking-pay-btn');
        const errorEl = document.getElementById('booking-pay-error');
        const widget = document.getElementById('booking-widget');

        payBtn.disabled = true;
        payBtn.textContent = tt('booking_pay_processing') || 'Elaborazione...';
        errorEl.style.display = 'none';

        const currentLang = (window.I18n && I18n.getCurrentLang()) || 'it';

        try {
            const res = await fetch(`${API_BASE}/create-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apartment: bookingState.apartment,
                    checkin: bookingState.checkin,
                    checkout: bookingState.checkout,
                    adults: bookingState.adults,
                    children: bookingState.children,
                    guest_name: nameInput.value.trim(),
                    guest_email: emailInput.value.trim(),
                    guest_phone: phoneInput.value.trim(),
                    message: document.getElementById('guest-message')?.value.trim() || null,
                    marketing_consent: document.getElementById('marketing-consent')?.checked ? 1 : 0,
                    source_page: widget.dataset.source || 'index',
                    lang: currentLang,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(tt('booking_pay_error') || 'Errore nella creazione del pagamento');
            }

            // Redirect to Stripe Checkout
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error(tt('url_payment_error') || 'URL pagamento non disponibile');
            }
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
            payBtn.disabled = false;
            payBtn.textContent = tt('booking_pay_btn') || 'Prenota e paga';
        }
    }

    // ----- URL Params (success/cancel) -----
    function checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const bookingStatus = params.get('booking');
        const reservationId = params.get('id');

        if (bookingStatus === 'success' && reservationId) {
            // Clean URL subito
            window.history.replaceState({}, '', window.location.pathname);
            // Mostra modal di conferma con dati dalla API
            showConfirmationModal(reservationId);
        } else if (bookingStatus === 'success') {
            showBanner(tt('banner_success') || 'Prenotazione confermata! Controlla la tua email per il riepilogo.', 'success');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (bookingStatus === 'cancelled') {
            showBanner(tt('banner_cancelled') || 'Pagamento annullato. Puoi riprovare quando vuoi.', 'cancelled');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }

    // ----- Confirmation Modal -----
    async function showConfirmationModal(reservationId) {
        // Crea overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirmation-overlay';
        overlay.innerHTML = `
            <div class="confirmation-card">
                <div class="confirmation-loading">
                    <div class="booking-spinner"></div> ${tt('confirmation_loading') || 'Caricamento...'}
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        try {
            const res = await fetch(`${API_BASE}/reservation/${reservationId}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Errore nel recupero dati');
            }

            const card = overlay.querySelector('.confirmation-card');
            const guestsText = formatGuests(data.adults, data.children);

            card.innerHTML = `
                <div class="confirmation-check">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" stroke="#059669" stroke-width="3"/>
                        <path d="M20 33L28 41L44 24" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h2 class="confirmation-title">${tt('confirmation_title') || 'Grazie per la tua prenotazione!'}</h2>
                <p class="confirmation-subtitle">${(tt('confirmation_subtitle') || 'La prenotazione <strong>#{id}</strong> è stata confermata con successo.').replace('{id}', data.id)}</p>

                <div class="confirmation-details">
                    <div class="confirmation-detail-row">
                        <span>${tt('confirmation_apartment') || 'Appartamento'}</span>
                        <strong>${data.apartment_name}</strong>
                    </div>
                    <div class="confirmation-detail-row">
                        <span>${tt('confirmation_checkin') || 'Check-in'}</span>
                        <strong>${formatDateHuman(data.checkin)} · ${CHECKIN_TIME}</strong>
                    </div>
                    <div class="confirmation-detail-row">
                        <span>${tt('confirmation_checkout') || 'Check-out'}</span>
                        <strong>${formatDateHuman(data.checkout)} · ${CHECKOUT_TIME}</strong>
                    </div>
                    <div class="confirmation-detail-row">
                        <span>${tt('confirmation_nights') || 'Notti'}</span>
                        <strong>${data.nights}</strong>
                    </div>
                    <div class="confirmation-detail-row">
                        <span>${tt('confirmation_guests') || 'Ospiti'}</span>
                        <strong>${guestsText}</strong>
                    </div>
                    <div class="confirmation-detail-divider"></div>
                    <div class="confirmation-detail-row confirmation-detail-total">
                        <span>${tt('confirmation_total') || 'Totale pagato'}</span>
                        <strong>${formatEuro(data.total_cents)}</strong>
                    </div>
                </div>

                <p class="confirmation-email-note">${(tt('confirmation_email_note') || 'Una email di conferma con tutti i dettagli è stata inviata a <strong>{email}</strong>').replace('{email}', data.guest_email)}</p>

                <div class="confirmation-actions">
                    <button class="btn btn-outline confirmation-print-btn">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        ${tt('confirmation_print') || 'Stampa riepilogo'}
                    </button>
                    <button class="btn btn-primary confirmation-close-btn">${tt('confirmation_close') || 'Chiudi'}</button>
                </div>

                <p class="confirmation-thankyou">${tt('confirmation_thankyou') || 'Vi aspettiamo a CASIA!'}</p>
            `;

            // Stampa riepilogo in pagina dedicata
            card.querySelector('.confirmation-print-btn').addEventListener('click', () => {
                printBookingSummary(data);
            });

            // Chiudi modal
            card.querySelector('.confirmation-close-btn').addEventListener('click', () => {
                closeConfirmationModal(overlay);
            });
        } catch (err) {
            // Fallback se l'API fallisce
            const card = overlay.querySelector('.confirmation-card');
            card.innerHTML = `
                <div class="confirmation-check">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="32" r="30" stroke="#059669" stroke-width="3"/>
                        <path d="M20 33L28 41L44 24" stroke="#059669" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h2 class="confirmation-title">${tt('confirmation_fallback_title') || 'Prenotazione confermata!'}</h2>
                <p class="confirmation-subtitle">${tt('confirmation_fallback_subtitle') || 'Controlla la tua email per il riepilogo completo della prenotazione.'}</p>
                <div class="confirmation-actions">
                    <button class="btn btn-primary confirmation-close-btn">${tt('confirmation_close') || 'Chiudi'}</button>
                </div>
                <p class="confirmation-thankyou">${tt('confirmation_thankyou') || 'Vi aspettiamo a CASIA!'}</p>
            `;
            card.querySelector('.confirmation-close-btn').addEventListener('click', () => {
                closeConfirmationModal(overlay);
            });
        }
    }

    function printBookingSummary(data) {
        const guestsText = formatGuests(data.adults, data.children);
        const lang = (window.I18n && I18n.getCurrentLang()) || 'it';
        const locale = lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : lang === 'en' ? 'en-GB' : 'it-IT';
        const totalFormatted = (data.total_cents / 100).toLocaleString(locale, { style: 'currency', currency: 'EUR' });

        const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<title>${tt('print_title') || 'Conferma Prenotazione'} #${data.id} - Casia Vacanze</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Jost:wght@300;400;500&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Jost', sans-serif; font-weight: 300; color: #2D2926; padding: 48px 56px; max-width: 700px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 2px solid #B8956B; }
  .header h1 { font-family: 'Cormorant Garamond', serif; font-size: 28px; font-weight: 500; color: #2D2926; margin-bottom: 4px; }
  .header p { font-size: 13px; color: #5a5652; letter-spacing: 1px; text-transform: uppercase; }
  .badge { display: inline-block; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 500; margin: 20px 0 0; }
  .section-title { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 1.5px; color: #B8956B; margin-bottom: 16px; margin-top: 32px; }
  .details-table { width: 100%; border-collapse: collapse; }
  .details-table tr { border-bottom: 1px solid #eee; }
  .details-table tr:last-child { border-bottom: none; }
  .details-table td { padding: 12px 0; font-size: 15px; }
  .details-table td:first-child { color: #5a5652; width: 160px; }
  .details-table td:last-child { font-weight: 500; text-align: right; }
  .total-row td { padding-top: 16px; border-top: 2px solid #2D2926; font-size: 17px; }
  .total-row td:last-child { font-family: 'Cormorant Garamond', serif; font-size: 22px; color: #B8956B; }
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #ddd; text-align: center; }
  .footer p { font-size: 13px; color: #5a5652; line-height: 1.8; }
  .footer .thanks { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-style: italic; color: #B8956B; margin-bottom: 12px; }
  @media print { body { padding: 32px 40px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${tt('print_header') || 'Casia Vacanze'}</h1>
    <p>${tt('print_location') || 'Santo Stefano &middot; Bene Vagienna &middot; Cuneo'}</p>
    <div class="badge">${tt('print_badge') || 'Prenotazione confermata'}</div>
  </div>

  <div class="section-title">${tt('print_details_title') || 'Dettagli prenotazione'} #${data.id}</div>
  <table class="details-table">
    <tr><td>${tt('print_apartment') || 'Appartamento'}</td><td>${data.apartment_name}</td></tr>
    <tr><td>${tt('print_guest') || 'Ospite'}</td><td>${data.guest_name}</td></tr>
    <tr><td>${tt('print_email') || 'Email'}</td><td>${data.guest_email}</td></tr>
    <tr><td>${tt('print_checkin') || 'Check-in'}</td><td>${formatDateHuman(data.checkin)} · ${CHECKIN_TIME}</td></tr>
    <tr><td>${tt('print_checkout') || 'Check-out'}</td><td>${formatDateHuman(data.checkout)} · ${CHECKOUT_TIME}</td></tr>
    <tr><td>${tt('print_nights') || 'Notti'}</td><td>${data.nights}</td></tr>
    <tr><td>${tt('print_guests') || 'Ospiti'}</td><td>${guestsText}</td></tr>
    <tr class="total-row"><td>${tt('print_total') || 'Totale pagato'}</td><td>${totalFormatted}</td></tr>
  </table>

  <div class="footer">
    <p class="thanks">${tt('print_thanks') || 'Vi aspettiamo a CASIA!'}</p>
    <p>
      ${tt('print_address') || 'Loc. Santo Stefano, Bene Vagienna (CN)'}<br>
      info@casiavacanze.com
    </p>
  </div>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.top = '-10000px';
        iframe.style.left = '-10000px';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write(html);
        iframe.contentDocument.close();

        iframe.onload = function() {
            iframe.contentWindow.print();
            setTimeout(() => iframe.remove(), 1000);
        };
    }

    function closeConfirmationModal(overlay) {
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.3s ease';
        document.body.style.overflow = '';
        setTimeout(() => overlay.remove(), 300);
    }

    function showBanner(message, type) {
        const banner = document.createElement('div');
        banner.className = `booking-banner booking-banner--${type}`;
        banner.textContent = message;
        document.body.appendChild(banner);

        setTimeout(() => {
            banner.style.opacity = '0';
            banner.style.transition = 'opacity 0.5s';
            setTimeout(() => banner.remove(), 500);
        }, 6000);
    }

    // ----- UI Helpers -----
    function showSummaryDetails() {
        const empty = document.getElementById('booking-summary-empty');
        const details = document.getElementById('booking-summary-details');
        if (empty) empty.style.display = 'none';
        if (details) details.style.display = 'block';
    }

    function updateSummary() {
        const apartmentName = bookingState.apartment === 'oliva' ? 'Oliva' : 'Venica';
        setText('summary-apartment', apartmentName);
        setText('summary-checkin', `${formatDateHuman(bookingState.checkin)} · ${CHECKIN_TIME}`);
        setText('summary-checkout', `${formatDateHuman(bookingState.checkout)} · ${CHECKOUT_TIME}`);
        setText('summary-nights', bookingState.nights);
    }

    function showPriceLoading() {
        const loading = document.getElementById('booking-price-loading');
        const priceRow = document.getElementById('booking-price-row');
        const errorEl = document.getElementById('booking-price-error');
        if (loading) loading.style.display = 'block';
        if (priceRow) priceRow.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        // Mentre il totale è in ricalcolo non si può avanzare col prezzo vecchio
        disableNextBtn();
    }

    function showPrice() {
        const loading = document.getElementById('booking-price-loading');
        const priceRow = document.getElementById('booking-price-row');
        const errorEl = document.getElementById('booking-price-error');
        if (loading) loading.style.display = 'none';
        if (priceRow) priceRow.style.display = 'flex';
        if (errorEl) errorEl.style.display = 'none';
        setText('summary-price', bookingState.totalFormatted);
        // Se il riepilogo finale è già visibile, aggiorna anche quello
        setText('final-price', bookingState.totalFormatted);
    }

    function showPriceError(msg) {
        const loading = document.getElementById('booking-price-loading');
        const priceRow = document.getElementById('booking-price-row');
        const errorEl = document.getElementById('booking-price-error');
        if (loading) loading.style.display = 'none';
        if (priceRow) priceRow.style.display = 'none';
        if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
    }

    function hidePriceInfo() {
        const loading = document.getElementById('booking-price-loading');
        const priceRow = document.getElementById('booking-price-row');
        const errorEl = document.getElementById('booking-price-error');
        if (loading) loading.style.display = 'none';
        if (priceRow) priceRow.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
    }

    function enableNextBtn() {
        const btn = document.getElementById('booking-next-btn');
        if (btn) btn.disabled = false;
    }

    function disableNextBtn() {
        const btn = document.getElementById('booking-next-btn');
        if (btn) btn.disabled = true;
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    // ----- Date Formatting -----
    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDateHuman(dateStr) {
        if (!dateStr) return '·';
        const [y, m, d] = dateStr.split('-');
        const defaultMonths = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
        const months = tt('months_short') || defaultMonths;
        return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
    }

    function formatEuro(cents) {
        return (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    }

    // ----- i18n: format guests text -----
    function formatGuests(adults, children) {
        const adultsText = tt('adults_count', { count: adults }) ||
            `${adults} adult${adults > 1 ? 'i' : 'o'}`;
        if (children > 0) {
            const childrenText = tt('children_count', { count: children }) ||
                `${children} bambin${children > 1 ? 'i' : 'o'}`;
            const sep = tt('guests_separator') || ' + ';
            return adultsText + sep + childrenText;
        }
        return adultsText;
    }

    // ----- i18n: langchange listener -----
    window.addEventListener('langchange', function(e) {
        const lang = e.detail.lang;

        // Update Flatpickr locale
        if (flatpickrInstance && typeof flatpickr !== 'undefined') {
            let fpLocale;
            if (lang === 'it' && flatpickr.l10ns.it) fpLocale = flatpickr.l10ns.it;
            else if (lang === 'fr' && flatpickr.l10ns.fr) fpLocale = flatpickr.l10ns.fr;
            else if (lang === 'de' && flatpickr.l10ns.de) fpLocale = flatpickr.l10ns.de;
            else fpLocale = flatpickr.l10ns.default;

            flatpickrInstance.set('locale', fpLocale);
            flatpickrInstance.redraw();
        }

        // Re-render dynamic content that isn't covered by data-i18n
        if (bookingState.checkin && bookingState.checkout) {
            updateSummary();
        }
    });

    // ----- Init -----
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

