/* ==========================================================================
   Bella Vista Hotel — shared site behaviour
   Injects the header/footer so every page stays in sync, plus small UX bits.
   ========================================================================== */
(function () {
  "use strict";

  const BRAND = {
    name: "Bella Vista",
    tagline: "Hotel & Resort",
    phone: "+1 (805) 555-0147",
    email: "reservations@bellavista.hotel",
    address: "1 Oceanview Terrace, Vista Bay, CA 93101",
  };

  const NAV = [
    { href: "index.html", label: "Home" },
    { href: "rooms.html", label: "Rooms & Suites" },
    { href: "amenities.html", label: "Amenities" },
    { href: "dining.html", label: "Dining" },
    { href: "contact.html", label: "Contact" },
  ];

  const ICON = {
    phone: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg>',
    mail: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/></svg>',
    pin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  };

  function currentPage() {
    const p = location.pathname.split("/").pop() || "index.html";
    return p;
  }

  function headerHTML() {
    const page = currentPage();
    return `
      <div class="topbar">
        <div class="wrap">
          <div class="topbar-list">
            <span><span class="stars">★★★★</span> &nbsp;A 4-Star Coastal Retreat</span>
            <span>${ICON.pin} ${BRAND.address}</span>
          </div>
          <div class="topbar-list">
            <a href="tel:${BRAND.phone.replace(/[^+\d]/g, "")}">${ICON.phone} ${BRAND.phone}</a>
            <a href="mailto:${BRAND.email}">${ICON.mail} ${BRAND.email}</a>
          </div>
        </div>
      </div>
      <div class="wrap">
        <nav class="navbar" aria-label="Main navigation">
          <a href="index.html" class="logo">
            <span class="logo-mark">BV</span>
            <span class="logo-text"><strong>${BRAND.name}</strong><small>${BRAND.tagline}</small></span>
          </a>
          <ul class="nav-links" id="navLinks">
            ${NAV.map((n) => `<li><a href="${n.href}" class="${page === n.href ? "active" : ""}">${n.label}</a></li>`).join("")}
          </ul>
          <div class="nav-actions">
            <a href="#concierge" class="btn btn--outline btn--sm" data-chat-open>🤖 AI Concierge</a>
            <a href="booking.html" class="btn btn--gold btn--sm">Book Your Stay <span class="arrow">→</span></a>
            <button class="nav-toggle" id="navToggle" aria-label="Toggle menu" aria-expanded="false">
              <span></span><span></span><span></span>
            </button>
          </div>
        </nav>
      </div>`;
  }

  function footerHTML() {
    return `
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <a href="index.html" class="logo">
              <span class="logo-mark">BV</span>
              <span class="logo-text"><strong>${BRAND.name}</strong><small>${BRAND.tagline}</small></span>
            </a>
            <p style="margin-top:18px;max-width:300px">Where thoughtful comfort meets the coast. Four stars, five-star heart — and an AI concierge available around the clock.</p>
            <div class="socials">
              <a href="#" aria-label="Instagram">◎</a>
              <a href="#" aria-label="Facebook">f</a>
              <a href="#" aria-label="X">𝕏</a>
              <a href="#" aria-label="TripAdvisor">★</a>
            </div>
          </div>
          <div>
            <h3>Explore</h3>
            <ul>
              <li><a href="rooms.html">Rooms & Suites</a></li>
              <li><a href="amenities.html">Amenities</a></li>
              <li><a href="dining.html">Dining</a></li>
              <li><a href="booking.html">Book a Stay</a></li>
              <li><a href="contact.html">Contact Us</a></li>
            </ul>
          </div>
          <div>
            <h3>Guest Services</h3>
            <ul>
              <li><a href="#" data-chat-open>AI Concierge</a></li>
              <li><a href="contact.html#support">Request Human Support</a></li>
              <li><a href="amenities.html">Spa & Wellness</a></li>
              <li><a href="amenities.html">Meetings & Events</a></li>
              <li><a href="contact.html#faq">FAQ</a></li>
            </ul>
          </div>
          <div class="footer-newsletter">
            <h3>Newsletter</h3>
            <p>Seasonal offers and local happenings, straight to your inbox.</p>
            <form class="input-row" id="newsletterForm">
              <input type="email" placeholder="Your email address" aria-label="Email address" required>
              <button class="btn btn--gold btn--sm" type="submit">Join</button>
            </form>
            <p class="form-hint" style="color:rgba(255,255,255,.68);margin-top:10px">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${new Date().getFullYear()} ${BRAND.name} Hotel & Resort. All rights reserved.</span>
          <span><span class="stars">★★★★</span> &nbsp; Member of the Coastal Hotels Collection</span>
        </div>
      </div>`;
  }

  function mount() {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (header) {
      header.className = "site-header";
      header.innerHTML = headerHTML();
    }
    if (footer) {
      footer.className = "site-footer";
      footer.innerHTML = footerHTML();
    }
    initNav();
    initReveal();
    initTestimonials();
    initQuickBook();
    initNewsletter();
    initImageFallbacks();
    initChatTriggers();
    initHashScroll();
  }

  function initNav() {
    const toggle = document.getElementById("navToggle");
    const links = document.getElementById("navLinks");
    if (!toggle || !links) return;
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        links.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !els.length) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  }

  function initTestimonials() {
    const slider = document.querySelector(".testimonial-slider");
    if (!slider) return;
    const items = slider.querySelectorAll(".testimonial");
    const dots = slider.querySelectorAll(".slider-dots button");
    if (!items.length) return;
    let i = 0;
    function show(n) {
      i = (n + items.length) % items.length;
      items.forEach((el, idx) => el.classList.toggle("is-active", idx === i));
      dots.forEach((el, idx) => el.classList.toggle("is-active", idx === i));
    }
    dots.forEach((dot, idx) => dot.addEventListener("click", () => show(idx)));
    show(0);
    if (items.length > 1) setInterval(() => show(i + 1), 6500);
  }

  // Home hero quick-booking bar -> hand off to the booking wizard.
  function initQuickBook() {
    const form = document.getElementById("quickBookForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const params = new URLSearchParams({
        checkin: data.get("checkin") || "",
        checkout: data.get("checkout") || "",
        guests: data.get("guests") || "2",
      });
      location.href = "booking.html?" + params.toString();
    });
  }

  function initNewsletter() {
    const form = document.getElementById("newsletterForm");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input");
      window.BVToast && window.BVToast(`Thanks! You're on the list — welcome to ${BRAND.name}.`);
      form.reset();
    });
  }

  // If an image fails to load, swap in a tasteful gradient placeholder.
  function initImageFallbacks() {
    document.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => {
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = "1";
        img.style.visibility = "hidden";
        const parent = img.parentElement;
        if (parent) parent.classList.add("img-fallback");
      });
    });
  }

  function initChatTriggers() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-chat-open]")) {
        e.preventDefault();
        window.BVChat && window.BVChat.open();
      }
    });
  }

  function initHashScroll() {
    // Sticky-header friendly anchor scrolling for same-page links.
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute("href").slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Global toast helper
  let toastTimer;
  window.BVToast = function (message) {
    let toast = document.querySelector(".toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("is-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-show"), 3200);
  };

  window.BVBrand = BRAND;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
