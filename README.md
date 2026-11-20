# Aurelia Cove Hotel & Resort — Website

A complete, dependency-free website for a fictional 4-star coastal hotel, built around an **AI concierge** that can book reservations and escalate to human support.

Everything runs in the browser with plain HTML, CSS, and JavaScript. No build step, no framework, no npm install.

---

## What's included

| Page | What it does |
|------|--------------|
| `index.html` | Home — hero, quick booking bar, rooms, amenities, dining, testimonials, stats, AI concierge section |
| `rooms.html` | Six room types with filter chips and direct "Book" links |
| `amenities.html` | Pool, spa, fitness, parking, EV, shuttle, pet-friendly, meetings & events |
| `dining.html` | Terra Restaurant, Cove Bar, room service, private dining, sample menu |
| `booking.html` | 4-step reservation wizard with live pricing, validation, confirmation reference and `.ics` calendar download |
| `contact.html` | Contact form, info, map, callback request, FAQ |

### The AI concierge ("Aura")

The floating chat widget appears on every page. Out of the box it runs entirely client-side with a small intent/state engine:

- **Reservations** — book, change, or cancel a room with a confirmation reference.
- **Bookable services** — restaurant tables, spa appointments, airport shuttle, room service, extra towels, wake up calls, maintenance tickets.
- **Guest information** — check-in/out, pricing, amenities, policies, parking, pets, local attractions, loyalty signup.
- **General use** — quick maths, unit conversions, time and date, small talk, jokes, coin flips, translations, and a short set of general facts.
- **Human support escalation** — collects the guest's name and phone number and saves a support request.
- **Persistent memory** — session ID, last booking, and recent actions are stored in `localStorage`.
- **Help command** — typing `help` lists every capability. Every action is saved under `ac_actions`.

### Brand

- **Name:** Aurelia Cove Hotel & Resort
- **Positioning:** "Four stars, five-star heart"
- **Location:** 1 Cove Terrace, Aurelia Bay, CA 93101
- **Palette:** deep ink navy, warm gold, cream, teal

---

## Run locally

Because the site uses only relative paths, any static server works:

```bash
# Python
python -m http.server 8080

# Node (no install needed on modern versions)
npx serve .
```

Then open <http://localhost:8080>.

You can also open `index.html` directly in a browser — Google Fonts and Unsplash images need internet, but everything else works offline.

---

## Deploy as a web page

The whole folder is static, so it can be hosted anywhere:

- **GitHub Pages** — push this folder to a repo, then Settings → Pages → Deploy from branch.
- **Netlify** — drag-and-drop the `aurelia-cove` folder onto Netlify Drop.
- **Vercel** — `npx vercel --prod` from inside the folder.
- **Cloudflare Pages** — connect the repo, build command empty, output directory `/`.
- **Any shared hosting / cPanel** — upload the files via FTP into `public_html`.

No environment variables or server runtime required for the demo version.

---

## Connecting the real AI stack (n8n + Groq + PostgreSQL + Gmail)

The chat widget is designed with a single integration seam. Before `js/chat.js` loads, set an endpoint:

```html
<script>window.AC_CHAT_ENDPOINT = "https://YOUR-N8N-HOST/webhook/aura";</script>
<script src="js/chat.js"></script>
```

The widget then `POST`s JSON:

```json
{
  "sessionId": "sess-xxxx",
  "message": "I'd like a room this weekend",
  "state": "book_checkin",
  "draft": { "checkin": "2026-12-10" },
  "flow": null
}
```

And expects back:

```json
{
  "reply": "Great — what check-out date works for you?",
  "quickReplies": ["This weekend", "Next week"],
  "action": "none"
}
```

Suggested n8n workflow:

1. **Webhook** → receives the payload above.
2. **Postgres Chat Memory** keyed by `sessionId` (persistent conversational context).
3. **Groq Chat Model** as the LLM, with a system prompt describing the hotel and the two supported tasks.
4. **AI Agent + Tools**
   - `create_reservation` tool → writes to PostgreSQL and returns a reference code.
   - `request_human_support` tool → stores the callback request.
   - `send_email` tool → Gmail node sends a booking confirmation or a support notification to the team.
5. **PGVector + Ollama embeddings** → optional knowledge base of hotel policies/amenities for retrieval-augmented answers.
6. **Respond to Webhook** → returns `{ reply, quickReplies, action }`.

If the endpoint is unreachable, the widget automatically falls back to the built-in local agent so the site never breaks.

The booking wizard in `js/booking.js` has a similar seam: replace `confirmBooking()` with a `fetch()` to the same n8n endpoint to persist real reservations.

---

## File map

```
aurelia-cove/
├── assets/logo.svg     # custom emblem + favicon
├── css/styles.css      # all styling and responsive rules
├── js/site.js          # shared header/footer, nav, slider, reveals, toast
├── js/chat.js          # AI concierge widget + n8n integration seam
├── js/booking.js       # reservation wizard logic
├── index.html
├── rooms.html
├── amenities.html
├── dining.html
├── booking.html
├── contact.html
└── README.md
```

To rebrand, edit the `BRAND` object at the top of `js/site.js` and the CSS variables in `:root` at the top of `css/styles.css`.

---

*Built as a demo/prototype. Images are served from Unsplash and fonts from Google Fonts; replace with licensed assets before going live commercially.*
