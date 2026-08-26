# lancha boat — System Handoff

A booking + operations system for **La Lancha** / *Quarters*, built on a website
plus your Google Workspace, JotForm, and Stripe. This brief covers **what it does,
how to run it, and what's left.**

Everything runs on **lalanchacharters@gmail.com**.

---

## 1. What a customer experiences

**Nothing is confirmed until you say yes.** Every charter comes to you as an offer first.

1. Visits the website → sees Quarters, photos, the 3 time blocks, "where we go," pricing.
2. **Requests a date**: picks a date → only open time blocks show (taken ones are greyed out) → picks Morning / Afternoon / Night → enters their details → **can write you a note** → sends the request.
3. Gets a **"we got it"** email: the slot is being held, they'll hear back within a day, nothing has been charged, nothing for them to do.
4. **You accept or decline.**
   - **Accepted** → they get the full confirmation email: bareboat model, captain, fuel, dock directions, "your invoice is coming," and "waivers get signed at the dock, arrive 15 min early."
   - **Declined** → a polite note, nothing charged, an invitation to pick another date.
5. **You send the invoice** and they pay it.
6. Shows up at **Diversey Harbor, K-Dock Slip 8**, **everyone signs the waiver right there**, and they go boating.
7. The morning after, gets a **"How was it?" email** asking for a Google review.

---

## 2. The offer email (this is the main thing)

Every request lands in your inbox as an offer showing **the date, time, party size, the price they
booked at, whether they need a captain, and whatever they wrote you** — with two buttons:

> **Accept**  ·  **Decline**

Tap one from your phone. That's the whole job.

- **Accept** → they get their confirmation, it goes on your calendar, they get the invite, and you get a
  short email reminding you to **invoice them** (with the amount, their email, and a link into Stripe).
- **Decline** → the slot reopens immediately and they get a gentle no.
- **Want to negotiate instead?** Just **hit reply**. The email replies straight to the customer, so you can
  counter on price, suggest a different time, or ask a question before you decide.
- **Backup:** you can also set **Status** to Accepted or Declined in the Bookings sheet. Same result.

### What happens automatically (you do nothing)

- **The slot is held** the moment the request comes in, and **stays held until you answer** — no timer, no
  auto-release. Website leads pay more than the other channels, so they keep the spot until you say no.
  You get a reminder after 12 hours and once a day after that, so nothing sits forgotten.
- **The calendar shows the price** right in the event title, so you can see what a day is worth at a glance.
  Unanswered ones read **⏳ REQUEST · $880 · Name**.
- **On accept**: calendar event + guest invite, a dedicated **Drive folder** for the charter, the guest's
  confirmation email, **their charter agreement to sign**, and **their invoice** (see §5).
- **The agreement chases itself.** If they haven't signed, we remind them automatically (up to 3 times,
  and it stops the moment they sign). You get a short daily list of who's outstanding.
- **Fuel** is set from the captain's post-charter report (flat $50) and emailed to you to invoice.
- **A daily list** of accepted charters that aren't marked paid yet, so nothing sails for free.
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
| **JotForm — Bareboat Charter Agreement** | Primary signs (payment is now separate — see §6) |
| **JotForm — 2026 Waiver** | Each guest signs, **at the dock** |
| **Stripe ("LaLancha Strip")** | Where you send the invoice |
| **Google Forms — Captain Post-Charter Report** | Captains fill after each trip (drives fuel) |
| **Apps Script "La Lancha Backend"** | The "brain" that connects all of the above |

---

## 4. Your day-to-day playbook

- **New request?** Tap **Accept** or **Decline** in the email. Or hit reply to negotiate first.
- **Just accepted one?** Two things: **send the invoice** (the email hands you the amount and the Stripe link)
  and **assign a captain** from your roster if they need one. Mark **Paid** in the Bookings sheet when it clears.
- **At the dock?** Pull up the waiver link from the accept email (it's already tagged to that booking) and pass
  the phone around, or use the printed QR card.
- **Need to block a day** (maintenance, weather, or a booking that came from Boatsetter / GetMyBoat / Sailo / the Playpen)? **Add an event to the Quarters Charters calendar** — the website will show that slot as taken.
- **Want a higher price on a special date?** Add a row to the **Pricing** tab (Date + price per block). Blank = standard **$880**.
- **Cancel an already-accepted charter?** **Delete its event** from the Quarters Charters calendar — the slot reopens automatically.
- **After a trip?** The captain fills the post-charter report → you get an email telling you the **fuel amount to invoice**.
- **Check status anytime** in the Bookings tab: Requested / Accepted / Declined / Expired, Paid, captain assigned, fuel due.

---

## 5. The money

| Item | Amount | How it's collected |
|---|---|---|
| **Charter fee** | **$880 per time block** | Invoice goes out when you accept (see below) |
| **Captain** | ~$100–$150/hr | Paid separately, directly to the captain |
| **Fuel** | **$50 flat**, wherever you go | Invoiced after the trip |

**Invoicing — your call, and you can change your mind any time:**

- **Automatic (Stripe).** The moment you accept, the invoice is built for you with the right amount and
  their email, and it's waiting in Stripe for you to glance at and send. We can also make it send itself.
  Costs you Stripe's card fee: on an $880 charter that's about **$25.80**.
- **Manual (your bank).** Leave Stripe switched off and the accept email just hands you the amount and
  their email, so you bill however you like. **No card fees**, a bit more typing.

Either way, if anything goes wrong on Stripe's end the charter is still confirmed — you just get told to
bill it by hand. **Nothing ever charges a card on its own.**

---

## 6. Status

### ✅ Done & working
- Branded website (real Quarters photos, mobile-ready), request flow, crew + captain pages, "where we go" SEO pages, shareable link previews
- **Offer flow**: every request comes to you to accept or decline, slot held while you decide, auto-release if you don't
- Live calendar availability (no double-booking)
- Google backend: per-charter folders, Bookings/Leads/Guests/Captains/Pricing
- Captain post-charter report → fuel amount to invoice
- Post-charter Google review requests (unhappy feedback routed to you privately)
- Daily "accepted but not paid yet" list
- Code backed up on GitHub

### ⏳ Remaining to go fully live
1. **A copy of the charter agreement without the payment step.** Everything for the automatic
   send-and-chase is already built and waiting on it. Until it exists, the system stays quiet rather than
   send anyone the old form and ask them to pay twice.
2. **Decide on invoicing**: Stripe automatic, or your bank (see §5). Stripe needs a key set up once.
3. **Deploy the website** to Cloudflare (connect the GitHub repo — settings provided).
4. **Choose the domain** (lanchaboat.com vs la-lancha.com) — then it's a one-line change and a custom-domain setup in Cloudflare.
5. **Cleanup**: delete the leftover test bookings (e.g., the "CAL TEST" Sept-15 calendar event/rows and any "TEST123" rows).

### 💡 Optional later
- A printed **QR card for the dock** so guests scan and sign the waiver on their own phone (you mentioned
  you may already have one — if so we'll point it at the right form).
- Counter-offer buttons (right now you counter by replying to the offer email, which works fine).
- Per-destination share images.

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
- **The calendar is your control panel.** Adding/removing events there is how you open, block, and cancel availability. A request you haven't answered shows up as **⏳ REQUEST** so you can tell it apart from a confirmed charter.
- **Nothing charges a card on its own.** Invoices get prepared for you, but no money moves until you send one.
- **A held slot stays held.** If you never answer a request, that time stays blocked. The daily reminder is
  what keeps that from quietly costing you a booking, so it's worth clearing them out.
