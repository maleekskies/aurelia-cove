/* ==========================================================================
   Aurelia Cove — booking wizard
   A front-end reservation flow. In production, step 4 would POST to the
   booking API / n8n webhook; for now it produces a local confirmation and
   hands the details to the AI concierge via localStorage.
   ========================================================================== */
(function () {
  "use strict";

  const ROOMS = {
    "Classic King":    { price: 189, img: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=300&q=80", desc: "2 guests · King bed · 32 m²" },
    "Ocean View":      { price: 269, img: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=300&q=80", desc: "2 guests · Sea-view balcony · 38 m²" },
    "Garden Suite":    { price: 389, img: "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=300&q=80", desc: "3 guests · Separate lounge · 52 m²" },
    "Aurelia Penthouse": { price: 649, img: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=300&q=80", desc: "4 guests · Two bedrooms · 88 m²" },
    "Coastal Twin":    { price: 179, img: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=300&q=80", desc: "2 guests · Two twin beds · 30 m²" },
    "Accessible King": { price: 199, img: "https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=300&q=80", desc: "2 guests · Step-free access · 34 m²" },
  };

  const TAX_RATE = 0.12;
  const params = new URLSearchParams(location.search);
  let current = 1;
  let selectedRoom = params.get("room") && ROOMS[params.get("room")] ? params.get("room") : "Ocean View";

  function ymd(date) {
    const d = new Date(date);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return ymd(d);
  }
  function prettyDate(value) {
    if (!value) return "—";
    const d = new Date(value + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }
  function nights() {
    const a = document.getElementById("checkin").value;
    const b = document.getElementById("checkout").value;
    if (!a || !b) return 0;
    const diff = (new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000;
    return diff > 0 ? Math.round(diff) : 0;
  }
  function money(n) { return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function buildRoomChoices() {
    const host = document.getElementById("roomChoices");
    host.innerHTML = Object.keys(ROOMS).map(function (name) {
      const r = ROOMS[name];
      return '<label><input type="radio" name="room" value="' + name + '" ' + (name === selectedRoom ? "checked" : "") + '>' +
        '<img src="' + r.img + '" alt="" loading="lazy">' +
        '<span class="rc-info"><strong>' + name + '</strong><small>' + r.desc + '</small></span>' +
        '<span class="rc-price">$' + r.price + '</span></label>';
    }).join("");
  }

  function setStep(n, scroll) {
    current = n;
    document.querySelectorAll(".wizard-panel").forEach(function (p) {
      p.classList.toggle("is-active", Number(p.dataset.step) === n);
    });
    document.querySelectorAll(".step").forEach(function (s) {
      const idx = Number(s.dataset.step);
      s.classList.toggle("is-active", idx === n);
      s.classList.toggle("is-done", idx < n);
    });
    if (n === 4) renderSummary();
    if (scroll !== false) document.querySelector(".wizard").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function fieldValue(id) { return (document.getElementById(id).value || "").trim(); }

  function validateStep1() {
    const a = document.getElementById("checkin");
    const b = document.getElementById("checkout");
    let ok = true;
    a.parentElement.classList.remove("has-error");
    b.parentElement.classList.remove("has-error");
    if (!a.value) { a.parentElement.classList.add("has-error"); ok = false; }
    if (!b.value || nights() === 0) { b.parentElement.classList.add("has-error"); ok = false; }
    if (!ok) window.ACToast && window.ACToast("Please choose valid check-in and check-out dates.");
    return ok;
  }

  function validateStep3() {
    let ok = true;
    ["guestName", "guestEmail"].forEach(function (id) {
      const el = document.getElementById(id);
      el.parentElement.classList.remove("has-error");
      if (!fieldValue(id)) { el.parentElement.classList.add("has-error"); ok = false; }
    });
    const email = document.getElementById("guestEmail");
    if (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      email.parentElement.classList.add("has-error"); ok = false;
    }
    if (!ok) window.ACToast && window.ACToast("Please check your name and email address.");
    return ok;
  }

  function renderSummary() {
    const ci = fieldValue("checkin"), co = fieldValue("checkout");
    const n = nights();
    const guests = fieldValue("guests");
    const base = ROOMS[selectedRoom].price * n;
    const tax = Math.round(base * TAX_RATE * 100) / 100;
    const total = base + tax;
    document.getElementById("sumDates").textContent = prettyDate(ci) + " → " + prettyDate(co);
    document.getElementById("sumNights").textContent = n + " night" + (n === 1 ? "" : "s");
    document.getElementById("sumGuests").textContent = guests + " guest" + (guests === "1" ? "" : "s");
    document.getElementById("sumRoom").textContent = selectedRoom;
    document.getElementById("sumBase").textContent = "Room rate";
    document.getElementById("sumBaseVal").textContent = money(ROOMS[selectedRoom].price) + " × " + n;
    document.getElementById("sumTax").textContent = money(tax);
    document.getElementById("sumTotal").textContent = money(total);
  }

  function selectedRoomName() {
    const checked = document.querySelector('input[name="room"]:checked');
    return checked ? checked.value : selectedRoom;
  }

  function confirmBooking() {
    if (!document.getElementById("terms").checked) {
      window.ACToast && window.ACToast("Please accept the booking terms to continue.");
      return;
    }
    const ci = fieldValue("checkin"), co = fieldValue("checkout"), n = nights();
    const base = ROOMS[selectedRoom].price * n;
    const tax = Math.round(base * TAX_RATE * 100) / 100;
    const ref = "AC-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const booking = {
      ref: ref,
      room: selectedRoom,
      checkin: ci,
      checkout: co,
      nights: n,
      guests: fieldValue("guests"),
      name: fieldValue("guestName"),
      email: fieldValue("guestEmail"),
      phone: fieldValue("guestPhone"),
      requests: fieldValue("requests"),
      total: base + tax,
      createdAt: new Date().toISOString(),
    };
    try { localStorage.setItem("ac_last_booking", JSON.stringify(booking)); } catch (e) {}
    window.__bvBooking = booking;

    document.getElementById("confirmRef").textContent = ref;
    document.getElementById("confirmDetails").innerHTML =
      "<strong>" + booking.room + "</strong> · " + prettyDate(ci) + " → " + prettyDate(co) + "<br>" +
      booking.nights + " night" + (booking.nights === 1 ? "" : "s") + " · " + booking.guests + " guest" + (booking.guests === "1" ? "" : "s") + "<br>" +
      "Confirmation sent to " + booking.email;
    setStep(5);
  }

  function downloadICS() {
    const b = window.__bvBooking;
    if (!b) return;
    const stamp = function (d) { return d.replace(/-/g, ""); };
    const end = new Date(b.checkout + "T11:00:00");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aurelia Cove Hotel//Booking//EN",
      "BEGIN:VEVENT", "UID:" + b.ref + "@aureliacove.hotel",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z",
      "DTSTART;VALUE=DATE:" + stamp(b.checkin),
      "DTEND;VALUE=DATE:" + stamp(b.checkout),
      "SUMMARY:Stay at Aurelia Cove — " + b.room,
      "DESCRIPTION:Confirmation " + b.ref + ". " + b.nights + " nights, " + b.guests + " guests.",
      "LOCATION:1 Cove Terrace, Aurelia Bay, CA 93101",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "aurelia-cove-" + b.ref + ".ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  function init() {
    buildRoomChoices();

    const ci = document.getElementById("checkin");
    const co = document.getElementById("checkout");
    ci.value = params.get("checkin") || addDays(7);
    co.value = params.get("checkout") || addDays(9);
    document.getElementById("guests").value = params.get("guests") || "2";
    // Keep checkout strictly after check-in if prefilled weirdly.
    if (new Date(co.value) <= new Date(ci.value)) co.value = addDays(8);

    document.getElementById("btnNext1").addEventListener("click", function () { if (validateStep1()) setStep(2); });
    document.getElementById("btnNext2").addEventListener("click", function () {
      selectedRoom = selectedRoomName();
      setStep(3);
    });
    document.getElementById("btnNext3").addEventListener("click", function () { if (validateStep3()) setStep(4); });
    document.getElementById("btnBack2").addEventListener("click", function () { setStep(1); });
    document.getElementById("btnBack3").addEventListener("click", function () { setStep(2); });
    document.getElementById("btnBack4").addEventListener("click", function () { setStep(3); });
    document.getElementById("btnConfirm").addEventListener("click", confirmBooking);
    document.getElementById("addCalendar").addEventListener("click", downloadICS);

    // Breadcrumb steps are clickable for going backwards.
    document.querySelectorAll(".step").forEach(function (s) {
      s.style.cursor = "pointer";
      s.addEventListener("click", function () {
        const target = Number(s.dataset.step);
        if (target < current) setStep(target);
      });
    });

    setStep(1, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
