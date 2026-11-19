/* ==========================================================================
   Bella Vista — "Bella" AI Concierge widget
   --------------------------------------------------------------------------
   Runs fully client-side out of the box (simulated agent) so the site works
   with zero backend. To connect a real n8n / Groq / PostgreSQL stack, set:

       window.BV_CHAT_ENDPOINT = "https://your-n8n.example.com/webhook/bella";

   before this script loads. The widget will POST { sessionId, message, state }
   and expects JSON back: { reply: "...", quickReplies?: [], action?: "..." }.
   See README.md for the full integration contract.
   ========================================================================== */
(function () {
  "use strict";

  const ENDPOINT = window.BV_CHAT_ENDPOINT || "";
  const STORAGE_KEY = "bv_chat_session";

  // Conversational state machine used by the local demo agent.
  const S = {
    IDLE: "idle",
    BOOK_CHECKIN: "book_checkin",
    BOOK_CHECKOUT: "book_checkout",
    BOOK_GUESTS: "book_guests",
    BOOK_ROOM: "book_room",
    BOOK_NAME: "book_name",
    BOOK_EMAIL: "book_email",
    BOOK_DONE: "book_done",
    ESCALATE_NAME: "escalate_name",
    ESCALATE_PHONE: "escalate_phone",
    ESCALATE_DONE: "escalate_done",
  };

  let state = S.IDLE;
  let draft = {};
  let sessionId = loadSessionId();
  let panel, body, quickWrap, input;

  function loadSessionId() {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch (e) {
      return "sess-" + Date.now().toString(36);
    }
  }

  function html() {
    return `
      <button class="chat-fab" id="chatFab" aria-label="Open AI concierge" aria-expanded="false">
        <span>💬</span><span class="badge"></span>
      </button>
      <section class="chat-panel" id="chatPanel" role="dialog" aria-label="Bella AI concierge" aria-modal="false">
        <div class="chat-head">
          <div class="bot-avatar">B</div>
          <div>
            <strong>Bella · AI Concierge</strong>
            <small>Online — replies instantly</small>
          </div>
          <button class="chat-close" id="chatClose" aria-label="Close chat">✕</button>
        </div>
        <div class="chat-body" id="chatBody" aria-live="polite"></div>
        <div class="chat-quick" id="chatQuick"></div>
        <form class="chat-foot" id="chatForm">
          <input id="chatInput" type="text" autocomplete="off" placeholder="Type your message…" aria-label="Message">
          <button type="submit" aria-label="Send">➤</button>
        </form>
      </section>`;
  }

  function mount() {
    const host = document.createElement("div");
    host.innerHTML = html();
    document.body.appendChild(host);

    panel = document.getElementById("chatPanel");
    body = document.getElementById("chatBody");
    quickWrap = document.getElementById("chatQuick");
    input = document.getElementById("chatInput");

    document.getElementById("chatFab").addEventListener("click", open);
    document.getElementById("chatClose").addEventListener("click", close);
    document.getElementById("chatForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send(text);
    });

    greet();
  }

  function open() {
    if (!panel) return;
    panel.classList.add("is-open");
    document.getElementById("chatFab").setAttribute("aria-expanded", "true");
    setTimeout(() => input.focus(), 120);
  }
  function close() {
    if (!panel) return;
    panel.classList.remove("is-open");
    document.getElementById("chatFab").setAttribute("aria-expanded", "false");
  }

  function typing(on) {
    let t = body.querySelector(".typing");
    if (on && !t) {
      t = document.createElement("div");
      t.className = "typing";
      t.innerHTML = "<i></i><i></i><i></i>";
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
    } else if (!on && t) {
      t.remove();
    }
  }

  function bubble(text, who, htmlContent) {
    typing(false);
    const el = document.createElement("div");
    el.className = "bubble bubble--" + who;
    if (htmlContent) el.innerHTML = text;
    else el.textContent = text;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  function quickReplies(options) {
    quickWrap.innerHTML = "";
    (options || []).forEach((label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.addEventListener("click", () => {
        if (label === "🔔 Talk to a human") {
          bubble(label, "user");
          startEscalation();
        } else if (label === "🛎️ Book a room") {
          bubble(label, "user");
          startBooking();
        } else {
          input.value = label;
          send(label);
        }
        quickWrap.innerHTML = "";
      });
      quickWrap.appendChild(b);
    });
  }

  function botSay(text, options, delay) {
    typing(true);
    setTimeout(() => {
      bubble(text, "bot");
      quickReplies(options);
    }, delay || 550);
  }

  function greet() {
    const lastBooking = readLastBooking();
    const intro = lastBooking
      ? `Welcome back! I see your last stay with us was a ${lastBooking.room}. Need anything for that trip, or planning another getaway?`
      : "Hi there! I'm Bella, your AI concierge at Bella Vista. I can book a room, answer questions, or get a human from our team to help. What can I do for you?";
    setTimeout(() => botSay(intro, ["🛎️ Book a room", "What amenities do you have?", "🔔 Talk to a human"], 350), 700);
  }

  /* -------------------- Local agent brain -------------------- */

  function detectIntent(text) {
    const t = text.toLowerCase();
    if (/\b(human|person|agent|staff|representative|call me|someone real|manager|complain|complaint)\b/.test(t)) return "human";
    if (/\b(book|reserve|reservation|stay|room|suite|check ?in|check ?out|night|accommodation)\b/.test(t)) return "book";
    if (/\b(price|cost|rate|how much|per night|cheap|budget)\b/.test(t)) return "price";
    if (/\b(amenit|pool|spa|wifi|wi-fi|gym|fitness|parking|breakfast|restaurant|bar|pet|shuttle|beach)\b/.test(t)) return "amenities";
    if (/\b(location|address|where|directions|airport|near)\b/.test(t)) return "location";
    if (/\b(cancel|refund|modify|change my)\b/.test(t)) return "cancel";
    if (/\b(hi|hello|hey|good morning|good evening)\b/.test(t)) return "hello";
    return "faq";
  }

  function answerFAQ(text) {
    const t = text.toLowerCase();
    if (/check.?in|check.?out|arrival|departure/.test(t))
      return "Check-in is from 3:00 PM and check-out is by 11:00 AM. Early check-in and late check-out can be requested — subject to availability.";
    if (/cancel/.test(t))
      return "Free cancellation is available up to 48 hours before arrival on most rates. Need to cancel or change a booking? I can connect you with our team.";
    if (/pet/.test(t))
      return "We're pet-friendly in selected rooms! A one-time $35 cleaning fee applies. Let me know and I'll add it to your reservation.";
    if (/park/.test(t))
      return "Complimentary on-site parking is included for all guests, plus EV charging stations near the lobby.";
    if (/breakfast/.test(t))
      return "Breakfast is served daily from 6:30–10:30 AM at Terra Restaurant. It's included with most rates.";
    if (/wifi|wi-fi|internet/.test(t))
      return "High-speed Wi-Fi is free throughout the property — rooms, lobby, pool deck, and meeting spaces.";
    return "Great question. Our team is available 24/7 for anything specific — would you like me to connect you with a person, or shall I book you a room?";
  }

  function startBooking() {
    state = S.BOOK_CHECKIN;
    draft = {};
    botSay("Wonderful! Let's get you a room. What check-in date would you like? (e.g. 2026-12-10)", ["Today", "This weekend", "Next week"]);
  }

  function startEscalation() {
    state = S.ESCALATE_NAME;
    draft = {};
    botSay("Of course — I'll bring in a human from our guest services team. May I have your name first?");
  }

  function formatBookingCard(b) {
    return `<div class="chat-booking-card">
      <strong>Reservation summary</strong><br>
      ${b.room} · ${b.checkin} → ${b.checkout}<br>
      ${b.guests} guest${b.guests === "1" ? "" : "s"} · ${b.name}<br>
      Confirmation: <strong>${b.ref}</strong>
    </div>`;
  }

  function finishBooking() {
    const ref = "BV-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const booking = { ...draft, ref, createdAt: new Date().toISOString() };
    try { localStorage.setItem("bv_last_booking", JSON.stringify(booking)); } catch (e) {}
    state = S.BOOK_DONE;
    botSay(`All set, ${draft.name}! I've reserved your ${draft.room} from ${draft.checkin} to ${draft.checkout} for ${draft.guests} guest(s). A confirmation email is on its way to ${draft.email}. Your reference is ${ref}. Is there anything else?`, ["🔔 Talk to a human", "What amenities do you have?"]);
  }

  function finishEscalation() {
    state = S.ESCALATE_DONE;
    try { localStorage.setItem("bv_support_request", JSON.stringify(draft)); } catch (e) {}
    botSay(`Thanks, ${draft.name}. I've notified our support team and they'll call you at ${draft.phone} shortly. You can also reach us anytime at (805) 555-0147. Anything else I can help with?`, ["🛎️ Book a room"]);
  }

  function handleBookingFlow(text) {
    switch (state) {
      case S.BOOK_CHECKIN:
        draft.checkin = text;
        state = S.BOOK_CHECKOUT;
        botSay("Got it — check-in on " + text + ". And what check-out date?");
        break;
      case S.BOOK_CHECKOUT:
        draft.checkout = text;
        state = S.BOOK_GUESTS;
        botSay("Perfect. How many guests will be staying?");
        break;
      case S.BOOK_GUESTS:
        draft.guests = text;
        state = S.BOOK_ROOM;
        botSay("Lovely. Which room type interests you — Classic King, Ocean View, Garden Suite, or the Vista Penthouse?", ["Classic King", "Ocean View", "Garden Suite", "Vista Penthouse"]);
        break;
      case S.BOOK_ROOM:
        draft.room = text;
        state = S.BOOK_NAME;
        botSay("Excellent choice. May I have the name for the reservation?");
        break;
      case S.BOOK_NAME:
        draft.name = text;
        state = S.BOOK_EMAIL;
        botSay("Thank you. And the email address where I should send your confirmation?");
        break;
      case S.BOOK_EMAIL:
        draft.email = text;
        finishBooking();
        break;
      default:
        state = S.IDLE;
        handleLocal(text);
    }
  }

  function handleEscalationFlow(text) {
    if (state === S.ESCALATE_NAME) {
      draft.name = text;
      state = S.ESCALATE_PHONE;
      botSay("Thanks. What's the best phone number for our team to reach you?");
    } else if (state === S.ESCALATE_PHONE) {
      draft.phone = text;
      finishEscalation();
    } else {
      state = S.IDLE;
      handleLocal(text);
    }
  }

  function handleLocal(text) {
    const intent = detectIntent(text);
    switch (intent) {
      case "human":
        startEscalation();
        break;
      case "book":
        startBooking();
        break;
      case "price":
        botSay("Our rooms start at $189 per night for a Classic King, with Ocean View rooms from $269 and Suites from $389. Rates include Wi-Fi, parking, and breakfast. Shall I check availability?", ["🛎️ Book a room", "🔔 Talk to a human"]);
        break;
      case "amenities":
        botSay("We have a heated pool, full-service spa, fitness center, free Wi-Fi & parking, Terra Restaurant, the Vista Bar, pet-friendly rooms, EV charging, and an airport shuttle. Want me to book a room or get a human for details?", ["🛎️ Book a room", "🔔 Talk to a human"]);
        break;
      case "location":
        botSay("We're at 1 Oceanview Terrace, Vista Bay, CA 93101 — a 15-minute drive from the airport and steps from the beach. Would you like directions from a team member?", ["🔔 Talk to a human"]);
        break;
      case "cancel":
        botSay("I can help with that. Most rates allow free cancellation up to 48 hours before arrival. For a specific booking, let me connect you with our team.", ["🔔 Talk to a human"]);
        break;
      case "hello":
        botSay("Hello! Great to meet you. I can book a room or bring in a human whenever you'd prefer. What sounds good?", ["🛎️ Book a room", "🔔 Talk to a human"]);
        break;
      default:
        botSay(answerFAQ(text), ["🛎️ Book a room", "🔔 Talk to a human"]);
    }
  }

  function readLastBooking() {
    try { return JSON.parse(localStorage.getItem("bv_last_booking") || "null"); } catch (e) { return null; }
  }

  /* -------------------- Send pipeline -------------------- */

  async function send(text) {
    bubble(text, "user");
    quickReplies([]);

    if (state === S.BOOK_DONE || state === S.ESCALATE_DONE) state = S.IDLE;

    if (ENDPOINT) {
      // Real backend (n8n webhook → Groq → PostgreSQL/PGVector + Gmail).
      typing(true);
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text, state, draft }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        typing(false);
        bubble(data.reply || "I'm here to help!", "bot");
        quickReplies(data.quickReplies || []);
      } catch (err) {
        typing(false);
        bubble("I'm having trouble reaching the server right now. Let me try to help locally — what would you like to do?", "bot", false);
        handleLocal(text);
      }
      return;
    }

    // Local simulated agent.
    typing(true);
    setTimeout(() => {
      if (state.startsWith("book_") && state !== S.BOOK_DONE) handleBookingFlow(text);
      else if (state.startsWith("escalate_") && state !== S.ESCALATE_DONE) handleEscalationFlow(text);
      else handleLocal(text);
    }, 420);
  }

  window.BVChat = { open, close, send, get state() { return state; } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
