# lancha boat — System Handoff

A booking + operations system for **La Lancha** / *Quarters*, built on a website
plus your Google Workspace, JotForm, and Stripe. This brief covers **what it does,
how to run it, and what's left.**

Everything runs on **lalanchacharters@gmail.com**.

---

## 1. What a customer experiences

1. Visits the website → sees Quarters, photos, the 3 time blocks, "where we go," pricing.
2. **Books**: picks a date → only open time blocks show (booked ones are greyed out) → picks Morning / Afternoon / Night → enters their details → confirms.
3. Gets an instant **confirmation email** explaining the bareboat model, captain, and fuel, with their dock directions and two links: **Charter Agreement** (sign + pay) and **Guest Waiver**.
4. **Signs the Charter Agreement and pays the $880** (Stripe, right in the form).
5. **Each guest signs the Waiver.**
6. Shows up at **Diversey Harbor, K-Dock Slip 8** and goes boating.
7. The morning after, gets a **"How was it?" email** asking for a Google review.

---

## 2. What happens automatically (you do nothing)

- **The booking lands on your Google Calendar** ("Quarters Charters") with the guest's name + booking code, and the guest gets a calendar invite.
- **The website blocks that slot** so nobody else can book the same time (no double-booking).
- **A dedicated Drive folder** is created for every charter (fuel policy + info docs inside).
- **You get an email** for every booking ("⚓ NEW BOOKING — captain needed" when they need a captain).
- **Payment, agreement, and waivers flow back into your records**: when the agreement is signed/paid, the booking is marked **Paid + Agreement ✓ + Confirmed**; when guests sign, they're marked **Waiver ✓**. (Checked every 10 minutes.)
- **If someone pays the wrong amount**, you get a warning email.
- **Fuel is calculated** from the captain's post-charter report (Playpen = flat $25, anywhere else = $25/hr).
- **A daily digest** lists who still hasn't signed a waiver.
- **A review request** goes out automatically after each charter.
- **Every inquiry is captured** as a lead for follow-up.

---

## 3. Where everything lives

| Thing | What it's for |
|---|---|
| **Website** (lancha boat) | The public booking + marketing site |
| **"La Lancha — Operations" Google Sheet** | Your dashboard: tabs for **Bookings, Leads, Guests, Captains, Pricing** |
| **"Quarters Charters" Google Calendar** | The source of truth for availability — bookings land here; you block here |
| **Drive → La Lancha → Charters/** | A folder per booked charter |
| **JotForm — Bareboat Charter Agreement** | Primary signs + pays the $880 |
| **JotForm — 2026 Waiver** | Each guest signs (no payment) |
| **Stripe ("LaLancha Strip")** | Processes the charter payment |
| **Google Forms — Captain Post-Charter Report** | Captains fill after each trip (drives fuel) |
| **Apps Script "La Lancha Backend"** | The "brain" that connects all of the above |

---

## 4. Your day-to-day playbook

- **New booking?** It's already on your calendar + you got an email. **Assign a captain** from your roster and note it on the booking.
- **Need to block a day** (maintenance, weather, or a booking that came from Boatsetter / GetMyBoat / Sailo / the Playpen)? **Add an event to the Quarters Charters calendar** — the website will show that slot as booked.
- **Want a higher price on a special date?** Add a row to the **Pricing** tab (Date + price per block). Blank = standard **$880**.
- **Cancel / decline a booking?** **Delete its event** from the Quarters Charters calendar — the slot reopens automatically.
- **After a trip?** The captain fills the post-charter report → you get an email telling you the **fuel amount to invoice**.
- **Check status anytime** in the Bookings tab: Paid, Agreement signed, captain assigned, fuel due.

---

## 5. The money

| Item | Amount | How it's collected |
|---|---|---|
| **Charter fee** | **$880 per time block** | Stripe, inside the Charter Agreement |
| **Captain** | ~$100–$150/hr | Paid separately, directly to the captain |
| **Fuel** | $25 flat (Playpen) or $25/hr (beyond) | Invoiced after the trip |

---

## 6. Status

### ✅ Done & working
- Branded website (real Quarters photos, mobile-ready), booking flow, "where we go" SEO pages, shareable link previews
- Live calendar availability + auto-confirm (no double-booking)
- Google backend: per-charter folders, Bookings/Leads/Guests/Captains/Pricing
- JotForm + Stripe: sign + pay, waivers, auto-reconciled into your sheet, wrong-amount alerts
- Captain post-charter report → automatic fuel calculation
- Post-charter Google review requests (unhappy feedback routed to you privately)
- Daily "who hasn't signed" waiver digest
- Code backed up on GitHub

### ⏳ Remaining to go fully live
1. **Deploy the website** to Cloudflare (connect the GitHub repo — settings provided).
2. **Choose the domain** (lanchaboat.com vs la-lancha.com) — then it's a one-line change and a custom-domain setup in Cloudflare.
3. **Confirm Stripe is in Live mode** for real charges (it's currently the live "LaLancha Strip" account — just verify before the first real booking).
4. **Cleanup**: delete the leftover test bookings (e.g., the "CAL TEST" Sept-15 calendar event/rows and any "TEST123" rows).

### 💡 Optional later
- Premium per-date pricing flowing to Stripe automatically (currently $880 standard; premium dates need a small tweak).
- Per-destination share images.
- Pretty links (agreement.la-lancha.com) instead of the JotForm URLs in emails.

---

## 7. Key links (for reference)
- **GitHub repo:** github.com/jmaitner/lalancha
- **Operations sheet:** docs.google.com/spreadsheets/d/1TDLwR1AKJF4Di76Pm90qoTgrd1n1jbCRnhY0Vo6J11g
- **Quarters Charters calendar:** in lalanchacharters@gmail.com's Google Calendar
- **Charter Agreement form:** form.jotform.com/260923725423052
- **Waiver form:** form.jotform.com/261307203350039
- **Backend:** Apps Script project "La Lancha Backend" (script.google.com)

---

## 8. Good to know
- **Other platforms don't auto-sync.** Bookings from Boatsetter / GetMyBoat / Sailo / the Playpen won't appear automatically — **block those dates on the Quarters Charters calendar** so the website stays accurate. Your own site is the only channel that auto-blocks.
- **The calendar is your control panel.** Adding/removing events there is how you open, block, and cancel availability.
- **Stripe is live** — real cards get charged once a booking pays.
