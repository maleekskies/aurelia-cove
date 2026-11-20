/* ==========================================================================
   Aurelia Cove - "Aura" AI concierge widget
   --------------------------------------------------------------------------
   Runs client side out of the box. To connect a real n8n / Groq / PostgreSQL
   stack, set this before the script loads:

       window.AC_CHAT_ENDPOINT = "https://your-n8n.example.com/webhook/aura";

   The widget POSTs { sessionId, message, state, draft } and expects
   { reply, quickReplies, action }. If the endpoint fails, the local agent
   below takes over so the site keeps working.
   ========================================================================== */
(function () {
  "use strict";

  const ENDPOINT = window.AC_CHAT_ENDPOINT || "";
  const SESSION_KEY = "ac_chat_session";
  const ACTIONS_KEY = "ac_actions";

  const S = {
    IDLE: "idle",
    BOOK_CHECKIN: "book_checkin",
    BOOK_CHECKOUT: "book_checkout",
    BOOK_GUESTS: "book_guests",
    BOOK_ROOM: "book_room",
    BOOK_NAME: "book_name",
    BOOK_EMAIL: "book_email",
    BOOK_DONE: "book_done",
    FLOW: "flow",
    FLOW_DONE: "flow_done",
    ESCALATE_NAME: "escalate_name",
    ESCALATE_PHONE: "escalate_phone",
    ESCALATE_DONE: "escalate_done",
  };

  // Service flows. Each one collects a few details and files a local action.
  const FLOWS = {
    dining: {
      label: "restaurant table",
      steps: [
        { key: "when", prompt: "What day and time should I book the table?" },
        { key: "party", prompt: "How many people are coming?" },
        { key: "name", prompt: "Name for the reservation?" },
      ],
      done: (v) => "Booked a table at Terra Restaurant for " + v.party + " on " + v.when + ", under " + v.name + ". You will get a confirmation email shortly.",
    },
    spa: {
      label: "spa appointment",
      steps: [
        { key: "treatment", prompt: "Which treatment would you like? Massage, facial, or a spa package?", options: ["Massage", "Facial", "Spa package"] },
        { key: "when", prompt: "What day and time works for you?" },
        { key: "name", prompt: "Name for the appointment?" },
      ],
      done: (v) => v.treatment + " at Spa Zara is reserved for " + v.when + " under " + v.name + ". Arrive ten minutes early and we will take care of the rest.",
    },
    shuttle: {
      label: "airport shuttle",
      steps: [
        { key: "when", prompt: "What day and time do you need the shuttle?" },
        { key: "flight", prompt: "Flight number, if you have it? Type 'none' if not." },
        { key: "name", prompt: "Name for the driver?" },
      ],
      done: (v) => "Airport shuttle confirmed for " + v.when + " under " + v.name + (v.flight.toLowerCase() === "none" ? "" : ", tracking flight " + v.flight.toUpperCase()) + ". The driver will meet you at arrivals.",
    },
    roomservice: {
      label: "room service order",
      steps: [
        { key: "item", prompt: "What would you like from the room service menu?" },
        { key: "when", prompt: "When should we bring it up? Type 'now' for right away." },
        { key: "room", prompt: "Your room number?" },
      ],
      done: (v) => "Order placed for room " + v.room + ": " + v.item + ". " + (v.when.toLowerCase() === "now" ? "It is on its way." : "We will deliver at " + v.when + "."),
    },
    housekeeping: {
      label: "housekeeping request",
      steps: [
        { key: "item", prompt: "What do you need? Extra towels, blankets, toiletries, or a full clean?" },
        { key: "room", prompt: "Your room number?" },
      ],
      done: (v) => "Housekeeping notified for room " + v.room + ": " + v.item + ". They will be with you shortly.",
    },
    wake: {
      label: "wake up call",
      steps: [
        { key: "when", prompt: "What time should we call you?" },
        { key: "room", prompt: "Your room number?" },
      ],
      done: (v) => "Wake up call set for " + v.when + " in room " + v.room + ". Sweet dreams.",
    },
    maintenance: {
      label: "maintenance request",
      steps: [
        { key: "issue", prompt: "What is the problem? For example, leaky tap, broken AC, or lights out." },
        { key: "room", prompt: "Your room number?" },
      ],
      done: (v) => "Maintenance ticket opened for room " + v.room + ": " + v.issue + ". Someone will knock soon.",
    },
    cancel: {
      label: "cancellation",
      steps: [
        { key: "ref", prompt: "What is your booking reference? It looks like AC-ABC123." },
        { key: "confirm", prompt: "I can cancel that. Type 'yes' to confirm or 'no' to keep it." },
      ],
      done: (v) => v.confirm.toLowerCase() === "yes"
        ? "Booking " + v.ref.toUpperCase() + " is cancelled. Any refund will follow the policy on your confirmation email."
        : "No problem. Booking " + v.ref.toUpperCase() + " is still active.",
    },
    modify: {
      label: " booking change",
      steps: [
        { key: "ref", prompt: "What is your booking reference?" },
        { key: "change", prompt: "What would you like to change? Dates, room, or guest count?" },
        { key: "value", prompt: "What should I change it to?" },
      ],
      done: (v) => "Change request logged for " + v.ref.toUpperCase() + ": " + v.change + " to " + v.value + ". Our reservations team will confirm it by email.",
    },
    loyalty: {
      label: "Cove Circle membership",
      steps: [
        { key: "name", prompt: "Name for the membership?" },
        { key: "email", prompt: "Email address for your account?" },
      ],
      done: (v) => "Welcome to Cove Circle, " + v.name + ". Points will be tracked against " + v.email + ". Members get late checkout, room upgrades when available, and a free night after ten stays.",
    },
  };

  const HOTEL_FAQ = [
    { keys: ["check in", "check-in", "arrival", "arrive"], answer: "Check-in is from 3:00 PM. Early check-in can be requested and depends on availability." },
    { keys: ["check out", "check-out", "leave", "departure"], answer: "Check-out is by 11:00 AM. Late checkout is usually possible until 1:00 PM, just ask the front desk or me." },
    { keys: ["cancel", "refund", "cancellation"], answer: "Most rates allow free cancellation up to 48 hours before arrival. Your confirmation email has the exact policy for your booking." },
    { keys: ["pet", "dog", "cat"], answer: "Pets stay in selected rooms for a one time $35 cleaning fee. We prepare a bed and bowls when you tell us in advance." },
    { keys: ["wi-fi", "wifi", "internet"], answer: "High speed Wi-Fi is free everywhere on the property, including the pool deck and restaurant." },
    { keys: ["park", "parking", "valet", "ev"], answer: "Parking is free in our garage. EV chargers are available and valet can be arranged at the front desk." },
    { keys: ["breakfast", "morning meal"], answer: "Breakfast runs 6:30 to 10:30 at Terra Restaurant. It is included with most rates." },
    { keys: ["pool", "swim"], answer: "The heated infinity pool is open 7:00 AM to 10:00 PM, with cabanas and poolside service." },
    { keys: ["spa", "massage", "facial", "sauna"], answer: "Spa Zara offers massage, facials, scrubs, a sauna, and a steam room. I can book an appointment for you." },
    { keys: ["gym", "fitness", "workout"], answer: "The fitness centre is open 24 hours with cardio machines, weights, and yoga mats." },
    { keys: ["shuttle", "airport", "transport", "taxi"], answer: "A free airport shuttle runs daily. I can reserve a seat and track your flight." },
    { keys: ["restaurant", "dinner", "lunch", "table", "bar", "cocktail"], answer: "Terra Restaurant serves breakfast, lunch, and dinner. The Cove Bar opens at 11:00 AM and has happy hour from 4:00 to 6:00 PM. I can book a table." },
    { keys: ["room service", "in room", "food to room"], answer: "Room service runs 24 hours. Tell me what you want and your room number and I will place the order." },
    { keys: ["meeting", "conference", "wedding", "event", "banquet"], answer: "The Grand Ballroom holds 220 guests and the boardroom seats 14. Our events team handles menus and room blocks." },
    { keys: ["address", "where", "location", "directions"], answer: "We are at 1 Cove Terrace, Aurelia Bay, CA 93101, about 15 minutes from the airport and a short walk from the beach." },
    { keys: ["child", "kid", "baby", "family"], answer: "Children are welcome. Cots are free, and the Garden Suite and Penthouse work well for families." },
    { keys: ["smoke", "smoking"], answer: "All rooms and indoor areas are non smoking. Designated outdoor areas are available." },
    { keys: ["accessible", "wheelchair", "disability"], answer: "Our Accessible King rooms have step free entry and roll in showers. Lifts serve every floor." },
    { keys: ["loyalty", "reward", "points", "member", "cove circle"], answer: "Cove Circle is our free loyalty programme. Members get late checkout, upgrades when available, and a free night after ten stays. I can sign you up." },
    { keys: ["wifi password", "password"], answer: "Connect to the Aurelia Guest network. The password is printed on the card in your room." },
    { keys: ["weather", "forecast"], answer: "I cannot read live weather data. This coast is usually mild and breezy, with warm afternoons and cool evenings. The front desk can give you today's forecast." },
  ];

  const LOCAL_TIPS = [
    "the beach path, a ten minute walk from the lobby",
    "the marina, good for sunset walks",
    "the old lighthouse, open until 5:00 PM",
    "the Saturday farmers market by the harbour",
    "the coastal hiking trail, about 20 minutes by car",
  ];

  const GENERAL_FACTS = {
    "capital of france": "Paris.",
    "capital of nigeria": "Abuja.",
    "capital of japan": "Tokyo.",
    "capital of the united states": "Washington, D.C.",
    "capital of the uk": "London.",
    "how many days in a week": "Seven.",
    "how many continents": "Seven.",
    "speed of light": "About 300,000 kilometres per second.",
    "largest ocean": "The Pacific Ocean.",
    "who wrote hamlet": "William Shakespeare.",
  };

  const JOKES = [
    "I told the hotel manager I had a skeleton in the closet. They said that was not included in the room rate.",
    "Why did the suitcase go to therapy? It had too many baggage issues.",
    "A guest asked for a wake up call at 6:00 AM. I said, 'Great, I will set two. One for you, one for your courage.'",
  ];

  const TRANSLATIONS = {
    "hello": "hola",
    "thank you": "gracias",
    "goodbye": "adios",
    "please": "por favor",
    "good morning": "buenos dias",
    "good night": "buenas noches",
    "yes": "si",
    "no": "no",
  };

  let state = S.IDLE;
  let draft = {};
  let activeFlow = null;
  let sessionId = loadSessionId();
  let panel, body, quickWrap, input;

  function loadSessionId() {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = "sess-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch (e) {
      return "sess-" + Date.now().toString(36);
    }
  }

  function saveAction(type, values) {
    try {
      const all = JSON.parse(localStorage.getItem(ACTIONS_KEY) || "[]");
      all.unshift({ type, values, at: new Date().toISOString() });
      localStorage.setItem(ACTIONS_KEY, JSON.stringify(all.slice(0, 25)));
    } catch (e) {}
  }

  function html() {
    return `
      <button class="chat-fab" id="chatFab" aria-label="Open AI assistant" aria-expanded="false">
        <span>💬</span><span class="badge"></span>
      </button>
      <section class="chat-panel" id="chatPanel" role="dialog" aria-label="Aura AI assistant" aria-modal="false">
        <div class="chat-head">
          <div class="bot-avatar">A</div>
          <div>
            <strong>Aura · AI Assistant</strong>
            <small>Online for anything</small>
          </div>
          <button class="chat-close" id="chatClose" aria-label="Close chat">✕</button>
        </div>
        <div class="chat-body" id="chatBody" aria-live="polite"></div>
        <div class="chat-quick" id="chatQuick"></div>
        <form class="chat-foot" id="chatForm">
          <input id="chatInput" type="text" autocomplete="off" placeholder="Ask me anything…" aria-label="Message">
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

  function bubble(text, who, asHTML) {
    typing(false);
    const el = document.createElement("div");
    el.className = "bubble bubble--" + who;
    if (asHTML) el.innerHTML = text;
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
        quickWrap.innerHTML = "";
        bubble(label, "user");
        submit(label);
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
      ? "Welcome back. I see your last stay was a " + lastBooking.room + ". I can help with that booking, arrange something new, or answer just about anything. What do you need?"
      : "Hi, I am Aura. I can book a room, arrange a table, spa treatment, shuttle or room service, answer questions, do quick maths, and chat. What can I do for you?";
    setTimeout(() => botSay(intro, ["Book a room", "Book a table", "What can you do?"], 350), 700);
  }

  /* -------------------- intent detection -------------------- */

  function detectIntent(text) {
    const t = " " + text.toLowerCase().replace(/[?!.,]/g, " ") + " ";
    if (/\b(help|what can you do|capabilities|options|features)\b/.test(t)) return "help";
    if (/\b(human|person|agent|staff|representative|call me|manager|complain)\b/.test(t)) return "human";
    if (/\b(table|restaurant|dinner|lunch|brunch|reserve a table|book a table|terra|cove bar)\b/.test(t)) return "dining";
    if (/\b(spa|massage|facial|scrub|sauna|steam room)\b/.test(t)) return "spa";
    if (/\b(shuttle|airport|pickup|pick up|ride to|transport)\b/.test(t)) return "shuttle";
    if (/\b(room service|in room dining|food to my room|order food)\b/.test(t)) return "roomservice";
    if (/\b(extra towel|towels|blanket|toiletries|housekeeping|clean my room|room clean)\b/.test(t)) return "housekeeping";
    if (/\b(wake up call|wake me|morning call)\b/.test(t)) return "wake";
    if (/\b(broken|leak|not working|no hot water|lights out|maintenance|repair|fix)\b/.test(t)) return "maintenance";
    if (/\b(cancel|refund)\b/.test(t)) return "cancel";
    if (/\b(change|modify|amend|move my|update my booking|reschedule)\b/.test(t)) return "modify";
    if (/\b(loyalty|reward|points|cove circle|join the club|membership)\b/.test(t)) return "loyalty";
    if (/\b(book|reserve|reservation|stay|room|suite|check in|check out|night|accommodation)\b/.test(t)) return "book";
    if (/\b(price|cost|rate|how much|per night|cheap|budget)\b/.test(t)) return "price";
    if (/\b(amenit|pool|wifi|wi-fi|gym|fitness|parking|breakfast|bar|pet|beach)\b/.test(t)) return "amenities";
    if (/\b(attractions?|nearby|things to do|to do nearby|visit|sightsee|market|lighthouse|marina)\b/.test(t)) return "local";
    if (/\b(weather|forecast|temperature)\b/.test(t)) return "weather";
    if (/\b(time|date|day of the week|today)\b/.test(t)) return "datetime";
    if (/\b(convert|km|miles|celsius|fahrenheit|kilograms|pounds)\b/.test(t)) return "convert";
    if (/\b(joke|make me laugh)\b/.test(t)) return "joke";
    if (/\b(coin|dice|die|random|flip)\b/.test(t)) return "random";
    if (/\b(translate|in spanish|spanish for)\b/.test(t)) return "translate";
    if (isMath(text)) return "math";
    for (const fact of Object.keys(GENERAL_FACTS)) {
      if (t.includes(fact)) return "faq";
    }
    if (/\b(what|why|how|who|when|where|which|is|are|can|do|does|about|explain|tell me)\b/.test(t)) return "faq";
    return "chat";
  }

  /* -------------------- small general helpers -------------------- */

  function isMath(text) {
    return /^[\s\d+\-*/().x×÷=]+$/.test(text) && /[+\-*/x×÷]/.test(text);
  }

  function calculate(text) {
    const s = text.replace(/[=x×÷]/g, (m) => (m === "x" || m === "×" ? "*" : m === "÷" ? "/" : m)).replace(/\s+/g, "");
    if (!/^[\d+\-*/().]+$/.test(s)) return null;
    let i = 0;
    function factor() {
      if (s[i] === "-") { i++; return -factor(); }
      if (s[i] === "(") {
        i++;
        const v = expr();
        if (s[i] !== ")") return NaN;
        i++;
        return v;
      }
      const start = i;
      while (i < s.length && /[\d.]/.test(s[i])) i++;
      if (start === i) return NaN;
      return Number(s.slice(start, i));
    }
    function term() {
      let v = factor();
      while (s[i] === "*" || s[i] === "/") {
        const op = s[i++];
        const n = factor();
        v = op === "*" ? v * n : v / n;
      }
      return v;
    }
    function expr() {
      let v = term();
      while (s[i] === "+" || s[i] === "-") {
        const op = s[i++];
        const n = term();
        v = op === "+" ? v + n : v - n;
      }
      return v;
    }
    const result = expr();
    return i === s.length && Number.isFinite(result) ? result : null;
  }

  function convertUnits(text) {
    const m = text.match(/(\d+(?:\.\d+)?)\s*(km|kilometers?|kilometres?|mi|miles?|c|celsius|f|fahrenheit|kg|kilograms?|lb|pounds?)\s*(?:to|in|into)\s*(km|kilometers?|kilometres?|mi|miles?|c|celsius|f|fahrenheit|kg|kilograms?|lb|pounds?)/i);
    if (!m) return null;
    const n = Number(m[1]);
    const from = m[2].toLowerCase();
    const to = m[3].toLowerCase();
    const km = /^(km|kilometer|kilometers|kilometre|kilometres)$/.test(from);
    const mi = /^(mi|mile|miles)$/.test(from);
    const c = /^(c|celsius)$/.test(from);
    const f = /^(f|fahrenheit)$/.test(from);
    const kg = /^(kg|kilogram|kilograms)$/.test(from);
    const lb = /^(lb|pound|pounds)$/.test(from);
    const toKm = /^(km|kilometer|kilometers|kilometre|kilometres)$/.test(to);
    const toMi = /^(mi|mile|miles)$/.test(to);
    const toC = /^(c|celsius)$/.test(to);
    const toF = /^(f|fahrenheit)$/.test(to);
    const toKg = /^(kg|kilogram|kilograms)$/.test(to);
    const toLb = /^(lb|pound|pounds)$/.test(to);
    let value = null, unit = null;
    if (km && toMi) { value = n * 0.621371; unit = "miles"; }
    else if (mi && toKm) { value = n / 0.621371; unit = "km"; }
    else if (c && toF) { value = n * 9 / 5 + 32; unit = "F"; }
    else if (f && toC) { value = (n - 32) * 5 / 9; unit = "C"; }
    else if (kg && toLb) { value = n * 2.20462; unit = "lb"; }
    else if (lb && toKg) { value = n / 2.20462; unit = "kg"; }
    if (value === null) return null;
    return Number(value.toFixed(2)) + " " + unit + ".";
  }

  function translate(text) {
    const t = text.toLowerCase();
    for (const key of Object.keys(TRANSLATIONS)) {
      if (t.includes("translate " + key) || t.includes(key + " in spanish") || t.includes("spanish for " + key)) {
        return "'" + key + "' in Spanish is '" + TRANSLATIONS[key] + "'.";
      }
    }
    return "I know a handful of Spanish basics: hello, thank you, goodbye, please, good morning, good night, yes, and no. Which one do you need?";
  }

  /* -------------------- answers -------------------- */

  function faqAnswer(text) {
    const t = text.toLowerCase();
    for (const item of HOTEL_FAQ) {
      if (item.keys.some((k) => t.includes(k))) return item.answer;
    }
    for (const fact of Object.keys(GENERAL_FACTS)) {
      if (t.includes(fact)) return GENERAL_FACTS[fact];
    }
    return "I do not have that on file. I can handle hotel requests, quick calculations, conversions, time and date, and a few general questions. Type 'help' for the full list, or ask for a human.";
  }

  function helpAnswer() {
    return "Here is what I can do:\n" +
      "Book, change, or cancel a room\n" +
      "Book a table, spa treatment, or airport shuttle\n" +
      "Order room service, extra towels, or a wake up call\n" +
      "Open a maintenance request or request a callback\n" +
      "Sign you up for Cove Circle\n" +
      "Answer hotel questions, do maths, convert units, tell the time, and chat\n" +
      "Tell me what you need, or tap one of the shortcuts below.";
  }

  /* -------------------- booking flow -------------------- */

  function promptBooking() {
    switch (state) {
      case S.BOOK_CHECKIN:
        botSay("What check-in date would you like? Format it like 2026-12-10.", ["Today", "This weekend", "Next week"]);
        break;
      case S.BOOK_CHECKOUT:
        botSay("Check-in on " + draft.checkin + ". What check-out date?");
        break;
      case S.BOOK_GUESTS:
        botSay("Got it. How many guests?");
        break;
      case S.BOOK_ROOM:
        botSay("Which room: Classic King, Ocean View, Garden Suite, or Aurelia Penthouse?", ["Classic King", "Ocean View", "Garden Suite", "Aurelia Penthouse"]);
        break;
      case S.BOOK_NAME:
        botSay("Good choice. Name for the reservation?");
        break;
      case S.BOOK_EMAIL:
        botSay("Thanks. Email address for the confirmation?");
        break;
    }
  }

  function advanceBooking() {
    const order = [
      ["checkin", S.BOOK_CHECKIN], ["checkout", S.BOOK_CHECKOUT], ["guests", S.BOOK_GUESTS],
      ["room", S.BOOK_ROOM], ["name", S.BOOK_NAME], ["email", S.BOOK_EMAIL],
    ];
    for (const [key, step] of order) {
      if (!draft[key]) {
        state = step;
        promptBooking();
        return;
      }
    }
    finishBooking();
  }

  function startBooking(text) {
    state = S.BOOK_CHECKIN;
    draft = {};
    activeFlow = null;
    const t = text || "";
    const dates = t.match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (dates[0]) draft.checkin = dates[0];
    if (dates[1]) draft.checkout = dates[1];
    const guests = t.match(/\bfor\s+(\d{1,2})\b/);
    if (guests) draft.guests = guests[1];
    const room = t.toLowerCase().match(/classic king|ocean view|garden suite|aurelia penthouse|penthouse/);
    if (room) {
      draft.room = room[0] === "penthouse" ? "Aurelia Penthouse" : room[0].replace(/\b\w/g, (c) => c.toUpperCase());
    }
    advanceBooking();
  }

  function finishBooking() {
    const ref = "AC-" + Math.random().toString(36).slice(2, 7).toUpperCase();
    const booking = { ...draft, ref, createdAt: new Date().toISOString() };
    try { localStorage.setItem("ac_last_booking", JSON.stringify(booking)); } catch (e) {}
    saveAction("booking", booking);
    state = S.BOOK_DONE;
    botSay("All set, " + draft.name + ". Your " + draft.room + " is booked from " + draft.checkin + " to " + draft.checkout + " for " + draft.guests + " guest(s). Confirmation email sent to " + draft.email + ". Reference " + ref + ". Anything else?", ["Book a table", "Book a shuttle", "Help"]);
  }

  function handleBookingFlow(text) {
    const keyByState = {
      [S.BOOK_CHECKIN]: "checkin",
      [S.BOOK_CHECKOUT]: "checkout",
      [S.BOOK_GUESTS]: "guests",
      [S.BOOK_ROOM]: "room",
      [S.BOOK_NAME]: "name",
      [S.BOOK_EMAIL]: "email",
    };
    const key = keyByState[state];
    if (!key) {
      state = S.IDLE;
      route(text);
      return;
    }
    draft[key] = text;
    advanceBooking();
  }

  /* -------------------- generic service flows -------------------- */

  function advanceFlow() {
    const flow = FLOWS[activeFlow.name];
    while (activeFlow.index < flow.steps.length && activeFlow.values[flow.steps[activeFlow.index].key]) {
      activeFlow.index++;
    }
  }

  function promptFlowStep() {
    const flow = FLOWS[activeFlow.name];
    const step = flow.steps[activeFlow.index];
    botSay(step.prompt, step.options || ["Help", "Never mind"]);
  }

  function finishFlow() {
    const flow = FLOWS[activeFlow.name];
    const values = activeFlow.values;
    saveAction(activeFlow.name, values);
    const reply = flow.done(values);
    activeFlow = null;
    state = S.FLOW_DONE;
    botSay(reply, ["Something else", "Talk to a human", "Help"]);
  }

  function startFlow(name, seed) {
    const flow = FLOWS[name];
    if (!flow) return false;
    activeFlow = { name, values: seed || {}, index: 0 };
    draft = {};
    state = S.FLOW;
    advanceFlow();
    if (activeFlow.index >= flow.steps.length) finishFlow();
    else promptFlowStep();
    return true;
  }

  function handleFlow(text) {
    if (/^(never mind|cancel that|forget it|stop)$/i.test(text.trim())) {
      activeFlow = null;
      state = S.IDLE;
      botSay("No problem, cancelled. What else can I do?", ["Book a room", "Help"]);
      return;
    }
    const flow = FLOWS[activeFlow.name];
    activeFlow.values[flow.steps[activeFlow.index].key] = text;
    activeFlow.index++;
    advanceFlow();
    if (activeFlow.index >= flow.steps.length) finishFlow();
    else promptFlowStep();
  }

  function seedFrom(text) {
    const t = text.toLowerCase();
    const seed = {};
    const room = text.match(/\b(?:room|rm)\s*#?\s*(\d{1,4})\b/) || text.match(/\b(\d{3,4})\b/);
    if (room) seed.room = room[1];
    const party = text.match(/\bfor\s+(\d{1,2})\b/);
    if (party) seed.party = party[1];
    const ref = text.match(/\bac-[a-z0-9]{3,}\b/i);
    if (ref) seed.ref = ref[0].toUpperCase();
    const when = text.match(/\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s*(?:am|pm))\b(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i);
    if (when) seed.when = when[0].trim();
    const flight = text.match(/\b([A-Z]{2}\s?\d{2,4})\b/);
    if (flight) seed.flight = flight[1];
    if (/towel/.test(t)) seed.item = "Extra towels";
    else if (/blanket/.test(t)) seed.item = "Extra blankets";
    else if (/toiletr/.test(t)) seed.item = "Extra toiletries";
    else if (/clean/.test(t)) seed.item = "Full clean";
    if (/massage/.test(t)) seed.treatment = "Massage";
    else if (/facial/.test(t)) seed.treatment = "Facial";
    else if (/spa package|package/.test(t)) seed.treatment = "Spa package";
    return seed;
  }

  /* -------------------- escalation -------------------- */

  function startEscalation() {
    state = S.ESCALATE_NAME;
    draft = {};
    activeFlow = null;
    botSay("Sure, I will bring in a person. May I have your name first?");
  }

  function handleEscalation(text) {
    if (state === S.ESCALATE_NAME) {
      draft.name = text;
      state = S.ESCALATE_PHONE;
      botSay("Thanks. What is the best number to reach you?");
    } else {
      draft.phone = text;
      saveAction("support_request", draft);
      state = S.ESCALATE_DONE;
      botSay("Got it, " + draft.name + ". I have alerted guest services and they will call " + draft.phone + " shortly. You can also call us on (805) 555-0147.", ["Book a room", "Help"]);
    }
  }

  /* -------------------- routing -------------------- */

  function route(text) {
    const intent = detectIntent(text);
    switch (intent) {
      case "help":
        botSay(helpAnswer(), ["Book a room", "Book a table", "Airport shuttle", "Room service", "Tell me a joke"]);
        break;
      case "human":
        startEscalation();
        break;
      case "dining":
        startFlow("dining", seedFrom(text));
        break;
      case "spa":
        startFlow("spa", seedFrom(text));
        break;
      case "shuttle":
        startFlow("shuttle", seedFrom(text));
        break;
      case "roomservice":
        startFlow("roomservice", seedFrom(text));
        break;
      case "housekeeping":
        startFlow("housekeeping", seedFrom(text));
        break;
      case "wake":
        startFlow("wake", seedFrom(text));
        break;
      case "maintenance":
        startFlow("maintenance", seedFrom(text));
        break;
      case "cancel":
        startFlow("cancel", seedFrom(text));
        break;
      case "modify":
        startFlow("modify", seedFrom(text));
        break;
      case "loyalty":
        startFlow("loyalty", seedFrom(text));
        break;
      case "book":
        startBooking(text);
        break;
      case "price":
        botSay("Rooms start at $189 for a Classic King, $269 for Ocean View, $389 for a Garden Suite, and $649 for the Aurelia Penthouse. Rates include breakfast, Wi-Fi, and parking. Want me to check a date?", ["Book a room", "Help"]);
        break;
      case "amenities":
        botSay("We have a heated pool, Spa Zara, a 24 hour gym, free Wi-Fi and parking, Terra Restaurant, the Cove Bar, EV charging, an airport shuttle, and pet friendly rooms. I can book any of the bookable ones.", ["Book a table", "Spa appointment", "Help"]);
        break;
      case "local":
        botSay("Nearby favourites: " + LOCAL_TIPS.join("; ") + ". Want a shuttle or a table somewhere?", ["Airport shuttle", "Book a table", "Help"]);
        break;
      case "weather":
        botSay(faqAnswer("weather"), ["Talk to a human", "Help"]);
        break;
      case "datetime": {
        const now = new Date();
        const date = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
        const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
        botSay("It is " + time + " on " + date + " here at the hotel.");
        break;
      }
      case "convert": {
        const out = convertUnits(text);
        botSay(out || "Try a format like '10 km to miles' or '20 celsius to fahrenheit'.");
        break;
      }
      case "math": {
        const value = calculate(text);
        botSay(value === null ? "I could not read that calculation. Try something like 12 * 8 or (20 + 5) / 3." : "That is " + Number(value.toFixed(4)) + ".");
        break;
      }
      case "joke":
        botSay(JOKES[Math.floor(Math.random() * JOKES.length)], ["Another joke", "Help"]);
        break;
      case "random":
        if (/coin|flip/.test(text.toLowerCase())) botSay("Heads or tails? It came up " + (Math.random() < 0.5 ? "heads" : "tails") + ".");
        else botSay("You rolled a " + (Math.floor(Math.random() * 6) + 1) + ".");
        break;
      case "translate":
        botSay(translate(text), ["Help"]);
        break;
      case "faq":
        botSay(faqAnswer(text), ["Book a room", "Talk to a human", "Help"]);
        break;
      default:
        botSay(faqAnswer(text), ["Book a room", "Tell me a joke", "Help"]);
    }
  }

  function readLastBooking() {
    try { return JSON.parse(localStorage.getItem("ac_last_booking") || "null"); } catch (e) { return null; }
  }

  /* -------------------- send pipeline -------------------- */

  async function submit(text) {
    if (state === S.BOOK_DONE || state === S.FLOW_DONE || state === S.ESCALATE_DONE) state = S.IDLE;

    if (ENDPOINT) {
      typing(true);
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text, state, draft, flow: activeFlow }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        typing(false);
        bubble(data.reply || "I am here to help.", "bot");
        quickReplies(data.quickReplies || []);
      } catch (e) {
        typing(false);
        bubble("I could not reach my server, so I will handle this locally.", "bot");
        route(text);
      }
      return;
    }

    typing(true);
    setTimeout(() => {
      if (state === S.FLOW && activeFlow) handleFlow(text);
      else if (state.indexOf("book_") === 0) handleBookingFlow(text);
      else if (state === S.ESCALATE_NAME || state === S.ESCALATE_PHONE) handleEscalation(text);
      else route(text);
    }, 420);
  }

  async function send(text) {
    bubble(text, "user");
    quickReplies([]);
    await submit(text);
  }

  window.ACChat = { open, close, send, get state() { return state; } };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
