/**
 * ============================================================================
 *  LA LANCHA — Charter Operations Backend  (Google Apps Script)
 * ============================================================================
 *  One script that bootstraps and runs Luis's whole back office in Google:
 *
 *   • Builds the Drive folder structure
 *   • Builds the master Operations spreadsheet (Bookings / Leads / Guests /
 *     Captains / CaptainReports tabs)
 *   • Builds two Google Forms (Inquiry  +  Captain Post-Charter Report)
 *       - Waivers stay on JotForm (Google Forms can't do legal e-sign).
 *   • On every BOOKED charter:  creates a dedicated Drive folder, copies the
 *     fuel + info templates in, logs the booking, seeds the guest signing
 *     roster, emails the guest, and pings Luis if a captain is needed.
 *   • On every INQUIRY:  appends a row to the Leads sheet + acks the lead.
 *   • Exposes a doPost() web-app endpoint so the future Astro site (and the
 *     JotForm waiver webhook) can talk to all of this.
 *
 *  SETUP:  open Extensions ▸ Apps Script, paste this in, set OWNER_EMAIL
 *  below, then run  setupLaLanchaSystem()  once and authorize it.
 *  Deploy ▸ New deployment ▸ Web app  to get the URL for Astro/JotForm.
 * ============================================================================
 */

// ============================ CONFIG ========================================
const CONFIG = {
  BUSINESS_NAME: 'La Lancha',
  BOAT_NAME:     'Quarters',
  OWNER_EMAIL:   'lalanchacharters@gmail.com', // Luis's email (captain pings, alerts)
  TIMEZONE:      'America/Chicago',

  // --- Money ---
  // Fuel rule: every website booking gets the same flat fee (direct-lead deal),
  // regardless of destination or engine hours.
  FUEL_FLAT_RATE: 50,    // flat fuel fee for all website bookings
  CAPTAIN_RATE_LOW:  100,   // $/hr, low end
  CAPTAIN_RATE_HIGH: 150,   // $/hr, high end (weekend / high demand)
  DEFAULT_BLOCK_PRICE: 880, // standard price per time segment; overridable per date in the Pricing tab

  // --- Logistics & links (from Luis's onboarding email) ---
  DOCK_LOCATION:  'Diversey Harbor, K-Dock, Slip 8',
  CALENDAR_NAME:  'Quarters Charters',   // dedicated availability calendar (auto-created in setup)
  // Block time windows (24h, America/Chicago) used for calendar events + availability.
  BLOCK_WINDOWS: { morning: [10, 0, 14, 0], afternoon: [14, 30, 18, 30], night: [19, 0, 23, 0] },
  // Direct JotForm URLs (reliable prefill). Swap back to agreement.la-lancha.com /
  // waiver.la-lancha.com once confirmed those subdomains pass ?params through.
  LINK_AGREEMENT: 'https://form.jotform.com/260923725423052', // Bareboat Charter Agreement (sign + pay)
  LINK_WAIVER:    'https://form.jotform.com/261307203350039', // 2026 Waiver (per-guest, no payment)
  // JotForm → Google Sheets spreadsheets (read by the reconcile script).
  AGREEMENT_SHEET_ID: '1hf2hLcHrEOEgtLQ0B9Rg5240Lupw5fCrNAaaaPanaxA', // Charter Agreement v2
  WAIVER_SHEET_ID:    '1nGspti46J9PI4evPaoJJP3QLtRIe4TzQuL9rR16jYVY', // Waiver v3 (has bookingId)
  LINK_DIRECTIONS:'https://k8.la-lancha.com',
  GOOGLE_REVIEW_URL: 'https://share.google/RewjcwDIgFhDb8Gzs', // post-charter review ask
  LINK_CAPTAINS:  'https://drive.google.com/file/d/1961Eq70KU8SnwpasENDAAH3YB4cOLGmx/view',

  // --- Offer flow (Luis approves every charter before it is confirmed) ---
  // A request pencils the slot in on the calendar so nobody else can take it while
  // Luis decides. If he never answers, the hold releases itself.
  HOLD_HOURS:  48,   // pending request auto-expires (slot reopens) after this long
  NUDGE_HOURS: 12,   // remind Luis about a still-unanswered request after this long
  // Charter Agreement WITHOUT the Stripe payment widget. Luis invoices separately now,
  // so the pay-bundled form (LINK_AGREEMENT) must NOT go to guests. Until this clone
  // exists, the accepted-charter email simply omits the agreement link.
  LINK_AGREEMENT_NOPAY:     '',   // e.g. 'https://form.jotform.com/XXXXXXXXXXXXX'
  AGREEMENT_NOPAY_SHEET_ID: '',   // its Google Sheet (reconcile reads this if set)
  STRIPE_INVOICE_URL: 'https://dashboard.stripe.com/invoices/create',

  // Existing Drive folder to build everything INSIDE (the shared La Lancha root).
  // Leave '' to instead create a new "La Lancha" folder in My Drive.
  ROOT_FOLDER_ID: '15f-hxuD-qsdAk4HtzGZ4sAHfuf_jz9jn',
  TIME_BLOCKS: {
    morning:   'Morning · 10:00 AM – 2:00 PM',
    afternoon: 'Afternoon · 2:30 PM – 6:30 PM',
    night:     'Night · 7:00 PM – 11:00 PM'
  },

  // Luis's captain roster (drives the captain dropdown + seeds the Captains tab)
  CAPTAIN_ROSTER: ['Charlie Koules', 'Connor Bernhard', 'Jordan Dingle',
                   'Denise Bowker', 'Nick Moreno', 'Joseph Crulcich',
                   'Luis Vecchio - Non Charter'],

  // Destination options on the post-charter report. ONLY 'Playpen' bills flat fuel.
  DESTINATIONS: ['Playpen', 'Navy Pier', 'Monroe/Playpen South', 'River',
                 'Burnham/Northerly']
};

const PROPS = PropertiesService.getScriptProperties();

// Sheet headers (single source of truth for column order)
const HEADERS = {
  Bookings: ['BookingID', 'Created', 'CharterDate', 'TimeBlock', 'PrimaryName',
             'PrimaryEmail', 'Phone', 'PartySize', 'CaptainStatus',
             'CaptainAssigned', 'AddOns', 'AmountPaid', 'StripeRef',
             'Destination', 'EngineHours', 'FuelDue', 'Paid', 'AgreementSigned',
             'Status', 'FolderURL', 'EventId', 'ReviewRequested', 'Notes',
             // Appended for the offer flow. Always add new columns at the END —
             // appendRow_/updateBooking_ map by position against the live sheet.
             'GuestMessage', 'RespondedAt', 'InvoiceSent'],
  Leads:    ['Created', 'Name', 'Email', 'Phone', 'Source', 'Interest',
             'Status', 'Notes'],
  Guests:   ['BookingID', 'GuestName', 'Email', 'IsPrimary', 'WaiverSent',
             'WaiverSigned', 'SignedPDF'],
  Captains: ['Name', 'Email', 'Phone', 'LicenseInfo', 'Notes'],
  // Per-date price overrides. Leave a cell blank to fall back to DEFAULT_BLOCK_PRICE.
  Pricing:  ['Date', 'MorningPrice', 'AfternoonPrice', 'NightPrice', 'Note'],
  CaptainReports: []  // built automatically from the linked Google Form
};

// ============================ SETUP ========================================
/**
 * Run this ONCE. Idempotent — safe to re-run; it reuses anything it already
 * created (IDs are remembered in Script Properties).
 */
function setupLaLanchaSystem() {
  // Use the configured shared folder as the root, or create one in My Drive.
  const root      = CONFIG.ROOT_FOLDER_ID
                      ? DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID)
                      : getOrCreateFolder_(DriveApp.getRootFolder(), CONFIG.BUSINESS_NAME);
  const charters  = getOrCreateFolder_(root, 'Charters');
  const templates = getOrCreateFolder_(root, 'Templates');

  const ss = getOrCreateSpreadsheet_(root, CONFIG.BUSINESS_NAME + ' — Operations');
  ['Bookings', 'Leads', 'Guests', 'Captains', 'Pricing'].forEach(function (name) {
    ensureSheet_(ss, name, HEADERS[name]);
  });
  removeDefaultSheet_(ss);
  seedCaptains_(ss);

  const inquiryForm = getOrCreateInquiryForm_(root, ss);
  const captainForm = getOrCreateCaptainForm_(root, ss);

  // Seed template docs that get copied into each charter folder
  getOrCreateDoc_(templates, 'Fuel Policy',
    'FUEL POLICY — ' + CONFIG.BOAT_NAME + '\n\nFuel is yours to arrange under the bareboat model. '
    + 'You may top off on the way back in, or we invoice a flat rate of $' + CONFIG.FUEL_FLAT_RATE
    + ' after the trip (most guests prefer the flat rate). Invoice sent via Stripe.');
  getOrCreateDoc_(templates, 'General Info',
    'WELCOME ABOARD ' + CONFIG.BOAT_NAME.toUpperCase() + '\n\nArrival, parking, what to bring, '
    + 'captain & gratuity info, house rules. (Luis: fill this in.)');

  const calendar = getOrCreateCalendar_();

  PROPS.setProperties({
    ROOT_FOLDER_ID:     root.getId(),
    CHARTERS_FOLDER_ID: charters.getId(),
    TEMPLATES_FOLDER_ID: templates.getId(),
    SPREADSHEET_ID:     ss.getId(),
    INQUIRY_FORM_ID:    inquiryForm.getId(),
    CAPTAIN_FORM_ID:    captainForm.getId(),
    CALENDAR_ID:        calendar.getId()
  });

  secret_();              // mint the accept/decline signing key if it does not exist
  migrateToOfferFlow();   // offer-flow columns + Status dropdown on the live sheet
  installTriggers_();

  Logger.log('✅ Setup complete.');
  Logger.log('Now deploy, then run setWebAppUrl(\'<your /exec url>\') so the Accept/Decline '
    + 'buttons in Luis’s offer emails point at the live deployment.');
  Logger.log('Operations sheet: ' + ss.getUrl());
  Logger.log('Inquiry form:     ' + inquiryForm.getPublishedUrl());
  Logger.log('Captain form:     ' + captainForm.getPublishedUrl());
  Logger.log('Calendar:         ' + CONFIG.CALENDAR_NAME + ' (' + calendar.getId() + ')');
  Logger.log('Root folder:      ' + root.getUrl());
}

/** Seed the Captains tab from CONFIG.CAPTAIN_ROSTER (only if it's empty). */
function seedCaptains_(ss) {
  const sh = ss.getSheetByName('Captains');
  if (sh.getLastRow() > 1) return;            // already has captains, leave it
  CONFIG.CAPTAIN_ROSTER.forEach(function (name) {
    appendRow_(ss, 'Captains', { Name: name });
  });
}

/**
 * Run ONCE to replace the old captain form with the rebuilt 5-section version.
 * (setupLaLanchaSystem reuses an existing form, so changes to the form layout
 * need this to take effect.) Trashes the old form, then rebuilds + re-triggers.
 */
function rebuildCaptainForm() {
  const oldId = PROPS.getProperty('CAPTAIN_FORM_ID');
  if (oldId) { try { DriveApp.getFileById(oldId).setTrashed(true); } catch (err) {} }
  PROPS.deleteProperty('CAPTAIN_FORM_ID');

  const root = DriveApp.getFolderById(PROPS.getProperty('ROOT_FOLDER_ID'));
  const ss   = openSS_();
  const form = getOrCreateCaptainForm_(root, ss);
  PROPS.setProperty('CAPTAIN_FORM_ID', form.getId());
  installTriggers_();
  Logger.log('Rebuilt captain form: ' + form.getPublishedUrl());
}

/**
 * One-time helper: prints the column headers (+ first data row) of the JotForm
 * Sheets, so we can map them for the reconcile. Run it, then paste the log.
 */
function dumpJotformSheets() {
  [['AGREEMENT', CONFIG.AGREEMENT_SHEET_ID], ['WAIVER', CONFIG.WAIVER_SHEET_ID]].forEach(function (pair) {
    try {
      var sh = SpreadsheetApp.openById(pair[1]).getSheets()[0];
      var v = sh.getDataRange().getValues();
      Logger.log('=== ' + pair[0] + ' tab "' + sh.getName() + '" (' + (v.length - 1) + ' rows) ===');
      Logger.log('HEADERS: ' + JSON.stringify(v[0]));
      if (v[1]) Logger.log('FIRST ROW: ' + JSON.stringify(v[1]));
    } catch (e) { Logger.log(pair[0] + ' ERROR: ' + e); }
  });
}

/**
 * One-time: generates a polished Google Doc handoff brief for Luis (in the
 * La Lancha Drive folder) and logs the URL. Run it, then share the doc.
 */
function createHandoffDoc() {
  var doc = DocumentApp.create('lancha boat — System Handoff for Luis');
  var b = doc.getBody();
  var P = DocumentApp.ParagraphHeading, G = DocumentApp.GlyphType;
  function title(t){ b.appendParagraph(t).setHeading(P.TITLE); }
  function h1(t){ b.appendParagraph(t).setHeading(P.HEADING1); }
  function p(t){ b.appendParagraph(t); }
  function li(t){ b.appendListItem(t).setGlyphType(G.BULLET); }
  function num(t){ b.appendListItem(t).setGlyphType(G.NUMBER); }
  function tbl(rows){ b.appendTable(rows); }

  title('lancha boat — System Handoff');
  p('A booking + operations system for La Lancha / Quarters, built on a website plus your Google Workspace, JotForm, and Stripe. Everything runs on lalanchacharters@gmail.com.');

  h1('1. What a customer experiences');
  num('Visits the website — sees Quarters, photos, the 3 time blocks, "where we go," and pricing.');
  num('Books: picks a date (booked blocks are greyed out), picks Morning / Afternoon / Night, enters details, confirms.');
  num('Gets an instant confirmation email (bareboat model, captain, fuel, dock directions) with two links: Charter Agreement (sign + pay) and Guest Waiver.');
  num('Signs the agreement and pays $880 (Stripe, inside the form).');
  num('Each guest signs the waiver.');
  num('Meets the boat at Diversey Harbor, K-Dock Slip 8.');
  num('The next morning, gets a "How was it?" email asking for a Google review.');

  h1('2. What happens automatically (you do nothing)');
  li('The booking lands on your "Quarters Charters" Google Calendar with the guest name + booking code; the guest gets a calendar invite.');
  li('The website blocks that slot so nobody double-books.');
  li('A dedicated Drive folder is created for every charter.');
  li('You get an email for every booking (flagged when a captain is needed).');
  li('Payment, agreement, and waivers flow back into your sheet (Paid / Agreement / Waiver), checked every 10 minutes.');
  li('If someone pays the wrong amount, you get a warning email.');
  li('Fuel is calculated from the captain’s post-charter report (a flat $50 for every charter).');
  li('A daily digest lists who still hasn’t signed a waiver.');
  li('A Google review request goes out after each charter (unhappy feedback routes privately to you).');
  li('Every inquiry is captured as a lead.');

  h1('3. Where everything lives');
  tbl([
    ['Website (lancha boat)', 'The public booking + marketing site'],
    ['"La Lancha — Operations" Google Sheet', 'Your dashboard: Bookings, Leads, Guests, Captains, Pricing'],
    ['"Quarters Charters" Google Calendar', 'The source of truth for availability'],
    ['Drive → La Lancha → Charters/', 'A folder per booked charter'],
    ['JotForm — Charter Agreement', 'Primary signs + pays the $880'],
    ['JotForm — 2026 Waiver', 'Each guest signs (no payment)'],
    ['Stripe ("LaLancha Strip")', 'Processes the charter payment'],
    ['Google Form — Captain Report', 'Captains fill after each trip (drives fuel)'],
    ['Apps Script "La Lancha Backend"', 'The brain connecting all of the above'],
  ]);

  h1('4. Your day-to-day playbook');
  li('New booking? It’s already on your calendar + emailed. Assign a captain from your roster and note it.');
  li('Block a day (maintenance, weather, or a booking from Boatsetter / GetMyBoat / Sailo / the Playpen)? Add an event to the Quarters Charters calendar — the website will show that slot booked.');
  li('Premium price for a special date? Add a row to the Pricing tab. Blank = standard $880.');
  li('Cancel / decline? Delete the booking’s calendar event — the slot reopens automatically.');
  li('After a trip? The captain fills the report → you get an email with the fuel amount to invoice.');
  li('Check status anytime in the Bookings tab (Paid, Agreement, captain, fuel).');

  h1('5. The money');
  tbl([
    ['Item', 'Amount', 'How it’s collected'],
    ['Charter fee', '$880 per time block', 'Stripe, inside the Charter Agreement'],
    ['Captain', '~$100–$150/hr', 'Paid separately, directly to the captain'],
    ['Fuel', '$50 flat per charter', 'Invoiced after the trip'],
  ]);

  h1('6. What’s done, and what’s left');
  p('DONE & working:');
  li('Branded website (real Quarters photos, mobile-ready), booking flow, "where we go" SEO pages, shareable link previews.');
  li('Live calendar availability + auto-confirm (no double-booking).');
  li('Google backend: per-charter folders, Bookings/Leads/Guests/Captains/Pricing.');
  li('JotForm + Stripe: sign + pay, waivers, auto-reconciled into your sheet, wrong-amount alerts.');
  li('Captain post-charter report → automatic fuel calculation.');
  li('Post-charter Google review requests; daily waiver digest; code backed up on GitHub.');
  p('REMAINING to go fully live:');
  num('Deploy the website to Cloudflare (connect the GitHub repo).');
  num('Choose the domain (lanchaboat.com vs la-lancha.com), then add the custom domain.');
  num('Confirm Stripe is in Live mode before the first real booking.');
  num('Delete the leftover test bookings (CAL TEST / TEST123).');

  h1('7. Using Claude to understand & change this in the future');
  p('You can use your own Claude account to ask questions about this system or make changes — you don’t have to be technical.');
  p('Easiest: ask questions in plain English. Open claude.ai, paste any part of this brief, and ask things like "explain how the fuel charge works" or "what happens when a guest books?"');
  p('Deeper (work with the actual code): the whole system lives in a GitHub repository, and it includes a CLAUDE.md file that briefs Claude on everything automatically.');
  num('Ask Jackson to add you as a collaborator on the repo: github.com/jmaitner/lalancha');
  num('Install Claude Code (claude.com/claude-code) on your computer, or use the GitHub connector on claude.ai.');
  num('Point Claude at the repo (clone github.com/jmaitner/lalancha). Claude reads CLAUDE.md and instantly understands the project.');
  num('Ask it anything, e.g.: "Explain how booking works." / "Change the standard price to $950." / "Add a new destination page for Montrose Harbor." / "Reword the confirmation email." / "How do I take the site live?"');
  p('Claude can make the change, test it, and push it. For anything that touches live bookings or payments, ask it to explain the change first and test before going live.');

  h1('8. Good to know');
  li('Other platforms don’t auto-sync. Bookings from Boatsetter / GetMyBoat / Sailo / the Playpen won’t appear automatically — block those dates on the Quarters Charters calendar so the website stays accurate.');
  li('The calendar is your control panel. Adding/removing events is how you open, block, and cancel availability.');
  li('Stripe is live — real cards get charged once a booking pays.');

  h1('Key links');
  li('GitHub repo: github.com/jmaitner/lalancha');
  li('Operations sheet: ' + openSS_().getUrl());
  li('Charter Agreement form: form.jotform.com/260923725423052');
  li('Waiver form: form.jotform.com/261307203350039');
  li('Backend: Apps Script project "La Lancha Backend" (script.google.com)');

  doc.saveAndClose();
  try { DriveApp.getFileById(doc.getId()).moveTo(DriveApp.getFolderById(PROPS.getProperty('ROOT_FOLDER_ID'))); } catch (e) {}
  Logger.log('✅ Handoff doc created: ' + doc.getUrl());
}

// ====================== CORE: REQUEST -> ACCEPT / DECLINE ==================
/**
 * OFFER FLOW. Nothing is confirmed until Luis says yes.
 *
 *   site  -> createRequest()   pencils the slot in, emails Luis the offer
 *   Luis  -> acceptRequest()   confirms it, invites the guest, he invoices
 *         -> declineRequest()  releases the slot, lets the guest down easy
 *
 * The pencilled-in calendar event is what holds the slot: getAvailability_()
 * counts any event, so a pending request blocks the time automatically and
 * declining/expiring just deletes the event to reopen it.
 *
 * `data` shape:
 * {
 *   charterDate: '2026-07-04', timeBlock: 'afternoon',
 *   primaryName: 'Maria R.', primaryEmail: 'maria@x.com', phone: '...',
 *   partySize: 6, captainStatus: 'need' | 'have',
 *   addOns: 'Water toys, +1hr', message: 'birthday trip, any chance of...',
 *   amountPaid: 880,                                    // the price they saw
 *   guests: [ {name:'Guest 2', email:'g2@x.com'}, ... ] // optional
 * }
 */
function createRequest(data) {
  const ss = openSS_();

  // Race guard — the slot may have just been taken or pencilled in by someone else.
  if (getAvailability_(data.charterDate)[data.timeBlock]) {
    return { ok: false, error: 'slot_taken' };
  }

  const bookingId = newBookingId_(data.charterDate);

  // Pencil it in. No guest invite yet — an invite would read as a confirmation.
  const eventId = createCalendarEvent_(data, bookingId, '', true);

  appendRow_(ss, 'Bookings', {
    BookingID: bookingId,
    Created: now_(),
    CharterDate: data.charterDate,
    TimeBlock: CONFIG.TIME_BLOCKS[data.timeBlock] || data.timeBlock,
    PrimaryName: data.primaryName,
    PrimaryEmail: data.primaryEmail,
    Phone: data.phone || '',
    PartySize: data.partySize || '',
    CaptainStatus: data.captainStatus || '',
    CaptainAssigned: '',
    AddOns: data.addOns || '',
    AmountPaid: data.amountPaid || '',   // quoted price, not money received
    StripeRef: '',
    Status: 'Requested',
    FolderURL: '',
    EventId: eventId,
    Notes: '',
    GuestMessage: data.message || '',
    RespondedAt: '',
    InvoiceSent: ''
  });

  sendOfferToLuis_(data, bookingId);
  sendRequestAck_(data, bookingId);

  return { ok: true, bookingId: bookingId, status: 'requested' };
}

/**
 * Luis said yes. Confirms the charter: folder, calendar invite, guest email.
 * Idempotent — tapping Accept twice (or after the sheet dropdown) is harmless.
 */
function acceptRequest(bookingId) {
  const b = findBooking_(bookingId);
  if (!b) return { ok: false, error: 'not_found' };
  if (b.Status === 'Accepted') return { ok: true, already: true, booking: b };
  if (b.Status === 'Declined' || b.Status === 'Expired') {
    return { ok: false, error: 'slot_released', booking: b };
  }

  // Dedicated Drive folder, created now that the charter is real.
  const charters = DriveApp.getFolderById(PROPS.getProperty('CHARTERS_FOLDER_ID'));
  const folder = charters.createFolder(
    b.CharterDate + ' \u2014 ' + (b.PrimaryName || 'Guest') + ' (' + bookingId + ')');
  copyTemplatesInto_(folder);

  confirmCalendarEvent_(b, folder.getUrl());

  // Seed the roster with the primary only (deferred from request time so declines
  // leave no junk). The rest of the party lands here as they sign at the dock —
  // recordWaiverSigned() upserts anyone who was not pre-entered.
  if (b.PrimaryEmail) {
    appendRow_(openSS_(), 'Guests', {
      BookingID: bookingId, GuestName: b.PrimaryName || '', Email: b.PrimaryEmail,
      IsPrimary: 'YES', WaiverSent: '', WaiverSigned: '', SignedPDF: ''
    });
  }

  updateBooking_(bookingId, { Status: 'Accepted', RespondedAt: now_(), FolderURL: folder.getUrl() });

  sendAcceptedEmail_(b, bookingId);
  sendAcceptedReceiptToLuis_(b, bookingId, folder.getUrl());

  return { ok: true, booking: b, folderUrl: folder.getUrl() };
}

/** Luis passed. Releases the slot and emails the guest. */
function declineRequest(bookingId, reason) {
  const b = findBooking_(bookingId);
  if (!b) return { ok: false, error: 'not_found' };
  if (b.Status === 'Declined') return { ok: true, already: true, booking: b };
  if (b.Status === 'Accepted') return { ok: false, error: 'already_accepted', booking: b };

  releaseHold_(b);   // delete the pencilled-in event -> slot reopens
  updateBooking_(bookingId, {
    Status: 'Declined', RespondedAt: now_(),
    Notes: reason || b.Notes || ''
  });
  sendDeclinedEmail_(b, bookingId);
  return { ok: true, booking: b };
}

/**
 * Hourly. Nudges Luis about requests he hasn't answered, and releases the hold
 * on ones that have gone stale so the boat doesn't sit blocked by a dead lead.
 */
function expireStaleRequests() {
  const sh = openSS_().getSheetByName('Bookings');
  const rows = sh.getDataRange().getValues();
  const H = HEADERS.Bookings;
  const nowMs = new Date().getTime();
  var nudges = [];

  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][H.indexOf('Status')]) !== 'Requested') continue;
    var b = rowToBooking_(rows[r], H);
    var ageH = (nowMs - parseStamp_(rows[r][H.indexOf('Created')])) / 3600000;
    if (!isFinite(ageH)) continue;

    if (ageH >= CONFIG.HOLD_HOURS) {
      releaseHold_(b);
      sh.getRange(r + 1, H.indexOf('Status') + 1).setValue('Expired');
      sh.getRange(r + 1, H.indexOf('RespondedAt') + 1).setValue(now_());
      PROPS.deleteProperty('NUDGED_' + b.BookingID);
      sendExpiredEmail_(b);
    } else if (ageH >= CONFIG.NUDGE_HOURS && !PROPS.getProperty('NUDGED_' + b.BookingID)) {
      // Nudge-once flag lives in Script Properties, not the sheet, so Luis
      // writing his own note on a request does not suppress the reminder.
      nudges.push(b);
      PROPS.setProperty('NUDGED_' + b.BookingID, now_());
    }
  }

  if (nudges.length) {
    var body = 'These charter requests are still waiting on you. They release themselves '
      + CONFIG.HOLD_HOURS + 'h after they came in.\n\n'
      + nudges.map(function (b) {
          return b.CharterDate + ' \u00b7 ' + b.TimeBlock + ' \u00b7 ' + b.PrimaryName
               + ' \u00b7 $' + b.AmountPaid + '\n  Accept:  ' + actionUrl_('accept', b.BookingID)
               + '\n  Decline: ' + actionUrl_('decline', b.BookingID);
        }).join('\n\n');
    GmailApp.sendEmail(CONFIG.OWNER_EMAIL,
      '\u23f3 ' + nudges.length + ' charter request(s) waiting on you', body);
  }
}

/** Daily. Accepted charters with nothing in the Paid column, so none sail unpaid. */
function unpaidDigest() {
  const rows = openSS_().getSheetByName('Bookings').getDataRange().getValues();
  const H = HEADERS.Bookings;
  var open = [];
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][H.indexOf('Status')]) !== 'Accepted') continue;
    if (rows[r][H.indexOf('Paid')]) continue;
    var b = rowToBooking_(rows[r], H);
    var win = blockWindowFromLabel_(rows[r][H.indexOf('CharterDate')], rows[r][H.indexOf('TimeBlock')]);
    if (win && win.end < new Date()) continue;   // already sailed; not worth nagging
    open.push(b);
  }
  if (!open.length) return;
  GmailApp.sendEmail(CONFIG.OWNER_EMAIL, '\ud83d\udcb5 Charters not marked paid (' + open.length + ')',
    'Accepted and coming up, with nothing in the Paid column yet:\n\n' +
    open.map(function (b) {
      return '  ' + b.CharterDate + ' \u00b7 ' + b.TimeBlock + ' \u00b7 ' + b.PrimaryName +
             ' \u00b7 $' + b.AmountPaid + '  (' + b.BookingID + ')';
    }).join('\n') +
    '\n\nMark the Paid column in the Bookings sheet once the invoice clears and this stops.');
}

/** Back-compat: direct-confirm a charter without an offer round-trip. */
function createBooking(data) {
  const out = createRequest(data);
  if (!out.ok) return out;
  acceptRequest(out.bookingId);
  return out;
}

// --- booking row helpers ---
function rowToBooking_(row, H) {
  var b = {};
  H.forEach(function (h, i) {
    var v = row[i];
    if (h === 'CharterDate' && v instanceof Date) v = Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    b[h] = v;
  });
  return b;
}
function findBooking_(bookingId) {
  const rows = openSS_().getSheetByName('Bookings').getDataRange().getValues();
  const H = HEADERS.Bookings;
  for (var r = 1; r < rows.length; r++) {
    if (String(rows[r][H.indexOf('BookingID')]) === String(bookingId)) return rowToBooking_(rows[r], H);
  }
  return null;
}
/** Parse a now_()-style 'yyyy-MM-dd HH:mm' stamp (or a real Date) into epoch ms. */
function parseStamp_(v) {
  if (v instanceof Date) return v.getTime();
  var m = String(v).match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() : NaN;
}

// ====================== CORE: NEW LEAD =====================================
/** Append an inquiry to the Leads sheet + send an acknowledgement. */
function createLead(data) {
  const ss = openSS_();
  appendRow_(ss, 'Leads', {
    Created: now_(), Name: data.name || '', Email: data.email || '',
    Phone: data.phone || '', Source: data.source || 'website',
    Interest: data.interest || data.message || '', Status: 'New', Notes: ''
  });
  if (data.email) {
    GmailApp.sendEmail(data.email, 'Thanks for reaching out to ' + CONFIG.BUSINESS_NAME,
      'Hi ' + (data.name || 'there') + ',\n\nThanks for your interest in chartering ' +
      CONFIG.BOAT_NAME + '! Luis will follow up shortly with availability and details.\n\n— ' +
      CONFIG.BUSINESS_NAME);
  }
  return { ok: true };
}

// ====================== WAIVER STATUS (from JotForm) =======================
/**
 * Mark a guest's waiver signed (call from the JotForm webhook via doPost).
 * UPSERT: because guest emails are now optional at checkout, a guest may sign
 * without having been pre-entered — in that case we ADD them to the roster.
 */
function recordWaiverSigned(bookingId, email, signedPdfUrl, guestName) {
  const ss = openSS_();
  const sh = ss.getSheetByName('Guests');
  const rows = sh.getDataRange().getValues();
  const H = HEADERS.Guests;
  for (var r = 1; r < rows.length; r++) {
    if (rows[r][H.indexOf('BookingID')] === bookingId &&
        String(rows[r][H.indexOf('Email')]).toLowerCase() === String(email).toLowerCase()) {
      sh.getRange(r + 1, H.indexOf('WaiverSigned') + 1).setValue(now_());
      if (signedPdfUrl) sh.getRange(r + 1, H.indexOf('SignedPDF') + 1).setValue(signedPdfUrl);
      if (guestName && !rows[r][H.indexOf('GuestName')]) sh.getRange(r + 1, H.indexOf('GuestName') + 1).setValue(guestName);
      return { ok: true, matched: true };
    }
  }
  // Not pre-entered — add the guest now (also captures them as a lead/contact).
  appendRow_(ss, 'Guests', {
    BookingID: bookingId, GuestName: guestName || '', Email: email,
    IsPrimary: '', WaiverSent: '', WaiverSigned: now_(), SignedPDF: signedPdfUrl || ''
  });
  return { ok: true, added: true };
}

/**
 * Email Luis a "who still needs to sign" summary per active booking.
 * NO LONGER ON A TRIGGER — waivers are signed at the dock. Kept because it is
 * still useful to run by hand for a big group that wants to sign ahead.
 */
function sendWaiverReminders() {
  const ss = openSS_();
  const rows = ss.getSheetByName('Guests').getDataRange().getValues();
  const H = HEADERS.Guests;
  const unsigned = {};
  for (var r = 1; r < rows.length; r++) {
    if (!rows[r][H.indexOf('WaiverSigned')]) {
      var id = rows[r][H.indexOf('BookingID')];
      (unsigned[id] = unsigned[id] || []).push(rows[r][H.indexOf('GuestName')] + ' <' + rows[r][H.indexOf('Email')] + '>');
    }
  }
  var body = '';
  Object.keys(unsigned).forEach(function (id) {
    body += '\n' + id + ' — still unsigned:\n  - ' + unsigned[id].join('\n  - ') + '\n';
  });
  if (body) GmailApp.sendEmail(CONFIG.OWNER_EMAIL, '[' + CONFIG.BUSINESS_NAME + '] Waivers outstanding', body);
}

// ====================== WEB APP ENDPOINT ===================================
/**
 * Single endpoint for Astro + JotForm. POST JSON with an `action` field:
 *   { action: 'newBooking', ...bookingData }
 *   { action: 'newLead', ...leadData }
 *   { action: 'waiverSigned', bookingId, email, signedPdfUrl }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    var out;
    switch (body.action) {
      // 'newBooking' is the old name. It maps here too, so a cached copy of the
      // old site page creates a request instead of silently auto-confirming.
      case 'newRequest':
      case 'newBooking':   out = createRequest(body); break;
      case 'newLead':      out = createLead(body); break;
      case 'waiverSigned': out = recordWaiverSigned(body.bookingId, body.email, body.signedPdfUrl, body.guestName); break;
      default: out = { ok: false, error: 'unknown action: ' + body.action };
    }
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * GET endpoint.
 *   ?action=pricing&date=YYYY-MM-DD   -> { ok, date, blocks, booked }   (site)
 *   ?action=accept|decline&id=..&t=.. -> HTML page                      (Luis)
 *   (no action)                       -> health check
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;

  // --- Luis's one-tap accept / decline from the offer email ---
  if (action === 'accept' || action === 'decline') return handleDecision_(e, action);

  if (action === 'pricing') {
    return json_({ ok: true, date: e.parameter.date || null,
      blocks: getPricing_(e.parameter.date), booked: getAvailability_(e.parameter.date) });
  }
  if (action === 'availability') {
    return json_({ ok: true, date: e.parameter.date || null, booked: getAvailability_(e.parameter.date) });
  }
  return json_({ ok: true, service: CONFIG.BUSINESS_NAME + ' backend' });
}

/**
 * Returns { morning, afternoon, night } prices for a date. Uses a per-date row
 * in the Pricing tab if present, otherwise CONFIG.DEFAULT_BLOCK_PRICE.
 */
function getPricing_(dateStr) {
  const def = CONFIG.DEFAULT_BLOCK_PRICE;
  const out = { morning: def, afternoon: def, night: def };
  if (!dateStr) return out;
  const sh = openSS_().getSheetByName('Pricing');
  const rows = sh.getDataRange().getValues();
  const H = HEADERS.Pricing;
  for (var r = 1; r < rows.length; r++) {
    var rowDate = rows[r][H.indexOf('Date')];
    if (rowDate instanceof Date) rowDate = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    if (String(rowDate) === String(dateStr)) {
      if (rows[r][H.indexOf('MorningPrice')]   !== '') out.morning   = rows[r][H.indexOf('MorningPrice')];
      if (rows[r][H.indexOf('AfternoonPrice')] !== '') out.afternoon = rows[r][H.indexOf('AfternoonPrice')];
      if (rows[r][H.indexOf('NightPrice')]     !== '') out.night     = rows[r][H.indexOf('NightPrice')];
      break;
    }
  }
  return out;
}

// ====================== FORM SUBMIT TRIGGERS ===============================
/** Inquiry form -> Leads sheet. Bound trigger installed by setup. */
function onInquiryFormSubmit(e) {
  const a = namedResponses_(e);
  createLead({
    name: a['Name'], email: a['Email'], phone: a['Phone'],
    interest: a['What are you interested in?'] || a['Message'], source: 'inquiry form'
  });
}

/**
 * Captain post-charter report -> compute the fuel charge from the destination +
 * engine hours, write it onto the booking, and tell Luis what to invoice.
 */
function onCaptainFormSubmit(e) {
  const a = namedResponses_(e);
  const date        = formatRespDate_(a['Date']);
  const partyName   = a['Party Name'] || '';
  const captain     = a['Captain'] || '';
  const destination = a['Destinations'] || '';
  const engineHours = parseFloat(a['Engine Hours use Est']) || 0;
  const fuel        = computeFuel_(destination, engineHours);

  const matched = updateBookingByDateName_(date, partyName, {
    Destination: destination, EngineHours: engineHours, FuelDue: fuel, CaptainAssigned: captain
  });

  GmailApp.sendEmail(CONFIG.OWNER_EMAIL,
    '[' + CONFIG.BUSINESS_NAME + '] Post-charter report — fuel to invoice: $' + fuel,
    'Party: ' + partyName + '   Date: ' + date + '\n' +
    'Captain: ' + captain + '\n' +
    'Destination: ' + destination + '\n' +
    'Engine hours: ' + engineHours + '\n\n' +
    '➡ Fuel to invoice via Stripe: $' + fuel +
    '  (flat rate)' +
    '\n\n' + (matched ? 'Booking row updated.' : '⚠ No matching booking found — check the Party Name/Date.') +
    '\nFull report is in the form-responses tab.');
}

/** Fuel: a flat fee for every website booking (Luis's direct-lead deal).
 *  Destination and engine hours are still logged on the booking for records,
 *  but they no longer change the fee. */
function computeFuel_(destination, engineHours) {
  return CONFIG.FUEL_FLAT_RATE;
}

/** Update fields on an existing Bookings row, matched by BookingID. */
function updateBooking_(bookingId, fields) {
  return updateBookingWhere_(function (row, H) {
    return row[H.indexOf('BookingID')] === bookingId;
  }, fields);
}

/** Update a Bookings row matched by charter date + party/primary name (case-insensitive). */
function updateBookingByDateName_(date, name, fields) {
  const n = String(name).trim().toLowerCase();
  return updateBookingWhere_(function (row, H) {
    var rowDate = row[H.indexOf('CharterDate')];
    if (rowDate instanceof Date) rowDate = Utilities.formatDate(rowDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
    return String(rowDate) === String(date) &&
           String(row[H.indexOf('PrimaryName')]).trim().toLowerCase() === n;
  }, fields);
}

function updateBookingWhere_(predicate, fields) {
  const sh = openSS_().getSheetByName('Bookings');
  const rows = sh.getDataRange().getValues();
  const H = HEADERS.Bookings;
  for (var r = 1; r < rows.length; r++) {
    if (predicate(rows[r], H)) {
      Object.keys(fields).forEach(function (k) {
        var c = H.indexOf(k);
        if (c >= 0) sh.getRange(r + 1, c + 1).setValue(fields[k]);
      });
      return true;
    }
  }
  return false;
}

/** Normalize a Forms date response to 'yyyy-MM-dd'. */
function formatRespDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return String(v || '');
}

// ============================ HELPERS ======================================
function installTriggers_() {
  // clear existing to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });

  const inquiryForm = FormApp.openById(PROPS.getProperty('INQUIRY_FORM_ID'));
  ScriptApp.newTrigger('onInquiryFormSubmit').forForm(inquiryForm).onFormSubmit().create();

  const captainForm = FormApp.openById(PROPS.getProperty('CAPTAIN_FORM_ID'));
  ScriptApp.newTrigger('onCaptainFormSubmit').forForm(captainForm).onFormSubmit().create();

  // Offer flow: nudge Luis on stale requests, release dead holds. Hourly.
  ScriptApp.newTrigger('expireStaleRequests').timeBased().everyHours(1).create();

  // Backup path for accept/decline: change Status in the Bookings sheet.
  ScriptApp.newTrigger('onBookingsEdit')
    .forSpreadsheet(PROPS.getProperty('SPREADSHEET_ID')).onEdit().create();

  // Daily "accepted but not marked paid" digest at 9am.
  // (Waiver reminders are gone: guests sign at the dock now.)
  ScriptApp.newTrigger('unpaidDigest').timeBased().atHour(9).everyDays(1).create();

  // Daily post-charter review request at 10am
  ScriptApp.newTrigger('requestReviews').timeBased().atHour(10).everyDays(1).create();

  // Reconcile JotForm submissions (agreement signature + waivers) every 10 min
  ScriptApp.newTrigger('reconcileJotform').timeBased().everyMinutes(10).create();
}

/**
 * Backup accept/decline: set Status to Accepted or Declined in the Bookings
 * sheet and this fires the same code the email buttons do. Handy when Luis is
 * already in the sheet, or if an email link ever misbehaves.
 */
function onBookingsEdit(e) {
  try {
    if (!e || !e.range || e.range.getSheet().getName() !== 'Bookings') return;
    var H = HEADERS.Bookings;
    if (e.range.getColumn() !== H.indexOf('Status') + 1 || e.range.getRow() < 2) return;
    var v = String(e.value || '').trim();
    if (v !== 'Accepted' && v !== 'Declined') return;
    var sh = e.range.getSheet();
    var bookingId = sh.getRange(e.range.getRow(), H.indexOf('BookingID') + 1).getValue();
    if (!bookingId) return;
    // Put the old value back first; accept/declineRequest writes the real one,
    // and this keeps the guard in those functions meaningful.
    e.range.setValue(e.oldValue || 'Requested');
    if (v === 'Accepted') acceptRequest(bookingId); else declineRequest(bookingId, 'Declined in sheet');
  } catch (err) {
    Logger.log('onBookingsEdit: ' + err);
  }
}

/**
 * Run once on the existing Operations sheet. Adds the offer-flow columns to the
 * live Bookings tab (at the end, so nothing shifts) and puts a Status dropdown
 * on the column. Safe to re-run.
 */
function migrateToOfferFlow() {
  var sh = openSS_().getSheetByName('Bookings');
  var live = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  var added = [];
  HEADERS.Bookings.forEach(function (h) {
    if (live.indexOf(h) < 0) { live.push(h); added.push(h); }
  });
  if (added.length) {
    sh.getRange(1, 1, 1, live.length).setValues([live]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  if (live.join('|') !== HEADERS.Bookings.join('|')) {
    Logger.log('\u26a0\ufe0f Live column order differs from HEADERS.Bookings.\n live: ' +
      JSON.stringify(live) + '\n code: ' + JSON.stringify(HEADERS.Bookings) +
      '\n Fix the sheet to match before relying on appendRow_/updateBooking_.');
  }
  var c = HEADERS.Bookings.indexOf('Status') + 1;
  sh.getRange(2, c, Math.max(sh.getMaxRows() - 1, 1)).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Requested', 'Accepted', 'Declined', 'Expired', 'Cancelled'], true)
      .setAllowInvalid(true).build());
  Logger.log('Migration done. Added: ' + (added.join(', ') || 'nothing'));
}

function getOrCreateInquiryForm_(folder, ss) {
  var id = PROPS.getProperty('INQUIRY_FORM_ID');
  if (id) { try { return FormApp.openById(id); } catch (err) {} }
  var form = FormApp.create(CONFIG.BUSINESS_NAME + ' — Charter Inquiry');
  form.setDescription('Ask about chartering ' + CONFIG.BOAT_NAME + ' on Lake Michigan.');
  form.addTextItem().setTitle('Name').setRequired(true);
  form.addTextItem().setTitle('Email').setRequired(true);
  form.addTextItem().setTitle('Phone');
  form.addParagraphTextItem().setTitle('What are you interested in?');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  moveFile_(form.getId(), folder);
  return form;
}

function getOrCreateCaptainForm_(folder, ss) {
  var id = PROPS.getProperty('CAPTAIN_FORM_ID');
  if (id) { try { return FormApp.openById(id); } catch (err) {} }
  // Mirrors Luis's "La Lancha - Quarters Charter" post-charter form (5 sections).
  var form = FormApp.create(CONFIG.BUSINESS_NAME + ' — Quarters Charter (Post-Charter Report)');
  form.setDescription('Captains: complete after each charter. This drives the fuel invoice.');

  // — Section: Trip Overview —
  form.addPageBreakItem().setTitle('Trip Overview');
  form.addDateItem().setTitle('Date').setRequired(true);
  form.addMultipleChoiceItem().setTitle('Charter Time Window').setRequired(true)
      .setChoiceValues([CONFIG.TIME_BLOCKS.morning, CONFIG.TIME_BLOCKS.afternoon, CONFIG.TIME_BLOCKS.night]);
  form.addTextItem().setTitle('Party Name').setRequired(true);
  form.addListItem().setTitle('Captain').setRequired(true).setChoiceValues(CONFIG.CAPTAIN_ROSTER);

  // — Section: Trip Details —
  form.addPageBreakItem().setTitle('Trip Details');
  form.addMultipleChoiceItem().setTitle('Number of Passengers').setRequired(true)
      .setChoiceValues(['10', '9', '8', '7', '6', '5']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('Engine Hours use Est').setRequired(true)
      .setChoiceValues(['1', '2', '3', '4', '5']).showOtherOption(true);
  form.addMultipleChoiceItem().setTitle('Destinations').setRequired(true)
      .setChoiceValues(CONFIG.DESTINATIONS).showOtherOption(true);

  // — Section: Operations & Conditions —
  form.addPageBreakItem().setTitle('Operations & Conditions');
  form.addTextItem().setTitle('Weather Conditions of note');
  form.addTextItem().setTitle('Fuel Added? Just put the dollar amount if yes');
  form.addMultipleChoiceItem().setTitle('Potable Water Added?').setChoiceValues(['Yes', 'No']);
  form.addMultipleChoiceItem().setTitle('Tank Pumped?').setRequired(true).setChoiceValues(['Yes', 'No']);
  form.addParagraphTextItem().setTitle('Incidents or anything to interesting?');
  form.addParagraphTextItem().setTitle('Maintenance or Safety Items to note?');

  // — Section: Captain Confirmation —
  form.addPageBreakItem().setTitle('Captain Confirmation');
  form.addCheckboxItem().setTitle('Confirmation').setRequired(true)
      .setChoiceValues(['I confirm this information is accurate to the best of my knowledge.']);

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  moveFile_(form.getId(), folder);
  return form;
}

// ====================== EMAILS ============================================
/** Shared wrapper so every guest-facing email looks like the same business. */
function shell_(inner) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;' +
         'color:#1a1a1a;max-width:600px">' + inner + '</div>';
}
function sendHtml_(to, subject, html, replyTo) {
  var opts = { htmlBody: html, name: CONFIG.BUSINESS_NAME };
  if (replyTo) opts.replyTo = replyTo;
  GmailApp.sendEmail(to, subject, htmlToText_(html), opts);
}

/**
 * THE OFFER. What Luis actually gets: the charter, the price they booked at,
 * whatever they wrote him, and two buttons. Reply-to is the guest, so hitting
 * reply is how he counter-offers or asks a question.
 */
function sendOfferToLuis_(data, bookingId) {
  var block = CONFIG.TIME_BLOCKS[data.timeBlock] || data.timeBlock;
  var needs = String(data.captainStatus).toLowerCase() === 'need';
  var row = function (k, v) {
    return '<tr><td style="padding:5px 14px 5px 0;color:#5f6b53;white-space:nowrap">' + k +
           '</td><td style="padding:5px 0"><strong>' + v + '</strong></td></tr>';
  };
  var btn = function (href, label, bg) {
    return '<a href="' + href + '" style="display:inline-block;padding:14px 30px;margin:0 8px 10px 0;' +
           'background:' + bg + ';color:#fff;text-decoration:none;border-radius:999px;' +
           'font-weight:bold;font-size:16px">' + label + '</a>';
  };

  var html = shell_(
    '<p style="font-size:13px;color:#5f6b53;margin:0 0 4px;letter-spacing:.08em">NEW CHARTER REQUEST</p>' +
    '<h2 style="margin:0 0 16px;font-size:22px">' + esc_(data.primaryName || 'Guest') +
      ' wants ' + esc_(CONFIG.BOAT_NAME) + '</h2>' +
    '<table style="font-size:15px;border-collapse:collapse;margin-bottom:18px">' +
      row('Date', esc_(data.charterDate)) +
      row('Time', esc_(block)) +
      row('Party', esc_(data.partySize || '?')) +
      row('Their price', '$' + esc_(data.amountPaid || CONFIG.DEFAULT_BLOCK_PRICE)) +
      row('Captain', needs ? 'needs one from the roster' : 'bringing their own') +
      (data.addOns ? row('Asks for', esc_(data.addOns)) : '') +
      row('Contact', esc_(data.primaryEmail || '') + (data.phone ? '<br>' + esc_(data.phone) : '')) +
    '</table>' +
    (data.message
      ? '<p style="background:#fff;border-left:3px solid #c2185b;padding:12px 14px;margin:0 0 18px">' +
        '<span style="color:#5f6b53;font-size:13px">They wrote:</span><br>' + esc_(data.message) + '</p>'
      : '') +
    '<p style="margin:0 0 6px">' +
      btn(actionUrl_('accept', bookingId), 'Accept', '#2e7d32') +
      btn(actionUrl_('decline', bookingId), 'Decline', '#8d8d8d') + '</p>' +
    '<p style="color:#5f6b53;font-size:13px">Accepting confirms them, puts it on the calendar and sends ' +
      'their details. You invoice the $' + esc_(data.amountPaid || CONFIG.DEFAULT_BLOCK_PRICE) +
      ' yourself. Waivers get signed at the dock.</p>' +
    '<p style="color:#5f6b53;font-size:13px">The slot is held for you until then, and releases itself after ' +
      CONFIG.HOLD_HOURS + ' hours. Want to negotiate instead? Just hit reply, it goes straight to them.</p>' +
    '<p style="color:#999;font-size:12px">Booking ' + bookingId + '</p>');

  sendHtml_(CONFIG.OWNER_EMAIL,
    (needs ? '\u2693 ' : '\u2693 ') + 'Charter request \u00b7 ' + data.charterDate + ' \u00b7 ' +
      block.split('\u00b7')[0].trim() + ' \u00b7 $' + (data.amountPaid || CONFIG.DEFAULT_BLOCK_PRICE),
    html, data.primaryEmail || '');
}

/** Guest ack the moment they submit. Sets expectations, promises nothing. */
function sendRequestAck_(data, bookingId) {
  if (!data.primaryEmail) return;
  var block = CONFIG.TIME_BLOCKS[data.timeBlock] || data.timeBlock;
  var first = data.firstName || String(data.primaryName || '').split(' ')[0] || 'there';
  sendHtml_(data.primaryEmail,
    'We got your request for ' + CONFIG.BOAT_NAME + ' (' + bookingId + ')',
    shell_(
      '<p>Hi ' + esc_(first) + ',</p>' +
      '<p>Your request is in and we are holding the slot while Luis takes a look.</p>' +
      '<p><strong>' + esc_(data.charterDate) + ' &middot; ' + esc_(block) +
        (data.partySize ? ' &middot; party of ' + esc_(data.partySize) : '') + '</strong><br>' +
        '<span style="color:#5f6b53">$' + esc_(data.amountPaid || CONFIG.DEFAULT_BLOCK_PRICE) +
        ' for the boat. Captain and fuel are billed separately.</span></p>' +
      '<p>You will hear back within a day, usually much sooner. Nothing is charged yet, and there is ' +
        'nothing for you to do until Luis confirms.</p>' +
      '<p>Just reply to this email if anything changes.</p>' +
      '<p>&mdash; ' + CONFIG.BUSINESS_NAME + '<br>' +
        '<span style="color:#888;font-size:12px">Request ' + bookingId + '</span></p>'),
    CONFIG.OWNER_EMAIL);
}

/**
 * Luis said yes. Luis's onboarding email (bareboat/demise model), rebuilt for the
 * offer flow: no payment link (he invoices), no waiver chase (they sign at the dock).
 */
function sendAcceptedEmail_(b, bookingId) {
  if (!b.PrimaryEmail) return;
  var needsCaptain = String(b.CaptainStatus).toLowerCase() === 'need';
  var firstName = String(b.PrimaryName || '').split(' ')[0] || 'there';
  var amount = b.AmountPaid || CONFIG.DEFAULT_BLOCK_PRICE;

  var captainPara = needsCaptain
    ? 'We do not expect you to have a captain in your back pocket, so we maintain a roster of independent captains familiar with the boat. Luis has reached out to that list already and will confirm someone for you. You are also welcome to bring your own qualified captain.'
    : 'You let us know you are bringing your own qualified captain, perfect. Please send their credentials over so we can confirm them. If anything changes, we keep a roster of independent captains familiar with the boat and can help.';

  // Only surface an agreement link once the payment-free version of the form exists.
  var agreementBlock = CONFIG.LINK_AGREEMENT_NOPAY
    ? '<p>One thing to do before the trip: sign the <strong>Charter Agreement</strong>. No payment on it, ' +
      'that comes on your invoice.<br><a href="' + CONFIG.LINK_AGREEMENT_NOPAY + '?bookingId=' +
      encodeURIComponent(bookingId) + '&name=' + encodeURIComponent(b.PrimaryName || '') +
      '&email=' + encodeURIComponent(b.PrimaryEmail || '') + '">Open the charter agreement</a></p>'
    : '';

  sendHtml_(b.PrimaryEmail,
    'Confirmed, you are on the water (' + bookingId + ')',
    shell_(
      '<p>Hi ' + esc_(firstName) + ',</p>' +
      '<p>Luis confirmed it. You are locked in aboard <strong>' + CONFIG.BOAT_NAME + '</strong>.</p>' +
      '<p><strong>Your charter:</strong> ' + esc_(b.CharterDate) + ' &middot; ' + esc_(b.TimeBlock) +
        (b.PartySize ? ' &middot; party of ' + esc_(b.PartySize) : '') + '</p>' +
      '<p>We operate under a <strong>bareboat / demise charter model</strong>. The vessel is legally released ' +
        'to you, as if it were yours for the trip. Because you take operational control, things like captains, ' +
        'fuel, food and drinks are yours to arrange.</p>' +
      '<p>' + captainPara + '</p>' +
      '<p>The expected rate for a captain is between <strong>$' + CONFIG.CAPTAIN_RATE_LOW + '/hr and $' +
        CONFIG.CAPTAIN_RATE_HIGH + '/hr</strong> depending on the weekend and demand for that captain.</p>' +
      '<p>Fuel works the same way: you can top off on the way back in, or we invoice a <strong>flat $' +
        CONFIG.FUEL_FLAT_RATE + '</strong> after the trip, wherever you go. Most guests prefer to have us ' +
        'invoice it, for simplicity and to keep that extra time on the water.</p>' +
      '<p><strong>Payment:</strong> Luis will send you an invoice for the <strong>$' + esc_(amount) +
        '</strong> charter. Nothing to do right now.</p>' +
      agreementBlock +
      '<p><strong>Waivers:</strong> every guest signs one, and we handle it right at the dock before you board. ' +
        'Please arrive about 15 minutes early so it is quick.</p>' +
      '<p>The boat is at <strong>' + CONFIG.DOCK_LOCATION + '</strong>. Her name is <strong>' +
        CONFIG.BOAT_NAME + '</strong>.<br>Directions to the right spot: <a href="' + CONFIG.LINK_DIRECTIONS +
        '">' + CONFIG.LINK_DIRECTIONS.replace(/^https?:\/\//, '') + '</a></p>' +
      '<p>Charter captains list: <a href="' + CONFIG.LINK_CAPTAINS + '">view the roster</a></p>' +
      '<p>Have fun and stay hydrated!</p>' +
      '<p>&mdash; ' + CONFIG.BUSINESS_NAME + '<br>' +
        '<span style="color:#888;font-size:12px">Booking ' + bookingId + '</span></p>'),
    CONFIG.OWNER_EMAIL);
}

/** What Luis gets right after accepting, so the invoice job is sitting in his inbox. */
function sendAcceptedReceiptToLuis_(b, bookingId, folderUrl) {
  var waiverUrl = CONFIG.LINK_WAIVER + '?bookingId=' + encodeURIComponent(bookingId);
  sendHtml_(CONFIG.OWNER_EMAIL,
    '\u2705 Accepted \u00b7 ' + b.CharterDate + ' \u00b7 ' + b.PrimaryName + ' \u00b7 invoice $' + b.AmountPaid,
    shell_(
      '<h2 style="margin:0 0 14px;font-size:20px">Confirmed. Two things left.</h2>' +
      '<p class="box" style="background:#fff;border:1px solid #e5e0d4;border-radius:12px;padding:14px">' +
        '<strong>1. Invoice $' + esc_(b.AmountPaid || '') + '</strong><br>' + esc_(b.PrimaryEmail || '') +
        '<br><a href="' + CONFIG.STRIPE_INVOICE_URL + '">Create it in Stripe &rarr;</a><br>' +
        '<span style="color:#5f6b53;font-size:13px">Mark the Paid column in the Bookings sheet once it clears.</span></p>' +
      '<p class="box" style="background:#fff;border:1px solid #e5e0d4;border-radius:12px;padding:14px">' +
        '<strong>2. Waivers at the dock</strong><br>' +
        '<a href="' + waiverUrl + '">Open this booking\u2019s waiver &rarr;</a><br>' +
        '<span style="color:#5f6b53;font-size:13px">Already tagged to ' + bookingId +
        '. Pull it up on a phone and pass it around, or show the QR card.</span></p>' +
      '<p>' + esc_(b.CharterDate) + ' &middot; ' + esc_(b.TimeBlock) + ' &middot; party of ' +
        esc_(b.PartySize || '?') + ' &middot; captain ' +
        (String(b.CaptainStatus).toLowerCase() === 'need' ? '<strong>NEEDED</strong>' : 'theirs') + '</p>' +
      (folderUrl ? '<p><a href="' + folderUrl + '">Charter folder</a></p>' : '') +
      '<p style="color:#999;font-size:12px">Booking ' + bookingId + '</p>'),
    b.PrimaryEmail || '');
}

/** Luis passed. Keep the door open. */
function sendDeclinedEmail_(b, bookingId) {
  if (!b.PrimaryEmail) return;
  sendHtml_(b.PrimaryEmail,
    'About your ' + CONFIG.BOAT_NAME + ' request (' + bookingId + ')',
    shell_(
      '<p>Hi ' + esc_(String(b.PrimaryName || '').split(' ')[0] || 'there') + ',</p>' +
      '<p>Sorry, we cannot take ' + esc_(b.CharterDate) + ' &middot; ' + esc_(b.TimeBlock) +
        '. Nothing has been charged.</p>' +
      '<p>Other dates are likely wide open, so it is worth another look: ' +
        '<a href="https://la-lancha.com/book">check availability</a>. Or just reply here and Luis will ' +
        'find you something that works.</p>' +
      '<p>&mdash; ' + CONFIG.BUSINESS_NAME + '</p>'),
    CONFIG.OWNER_EMAIL);
}

/** Hold ran out before Luis answered. Same tone, different reason. */
function sendExpiredEmail_(b) {
  if (!b.PrimaryEmail) return;
  sendHtml_(b.PrimaryEmail,
    'Your ' + CONFIG.BOAT_NAME + ' request (' + b.BookingID + ')',
    shell_(
      '<p>Hi ' + esc_(String(b.PrimaryName || '').split(' ')[0] || 'there') + ',</p>' +
      '<p>We were not able to lock in ' + esc_(b.CharterDate) + ' &middot; ' + esc_(b.TimeBlock) +
        ' in time, so we have released the hold. Nothing has been charged.</p>' +
      '<p>Reply to this email and Luis will sort it out personally, or ' +
        '<a href="https://la-lancha.com/book">pick another date</a>.</p>' +
      '<p>&mdash; ' + CONFIG.BUSINESS_NAME + '</p>'),
    CONFIG.OWNER_EMAIL);
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function htmlToText_(html) {
  return html.replace(/<\/(p|li|ul|div|h1|h2|h3|tr|table)>/g, '\n')
             .replace(/<\/t[dh]>/g, '  ')          // keep table cells apart
             .replace(/<li>/g, ' - ')
             .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, '$2 <$1>')
             .replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
             .replace(/&rarr;/g, '->').replace(/&mdash;/g, '--').replace(/&middot;/g, '-')
             .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
             .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function copyTemplatesInto_(folder) {
  var tpl = DriveApp.getFolderById(PROPS.getProperty('TEMPLATES_FOLDER_ID'));
  var files = tpl.getFiles();
  while (files.hasNext()) { files.next().makeCopy().moveTo(folder); }
}

// --- calendar (source of truth for availability) ---
function getOrCreateCalendar_() {
  var existing = CalendarApp.getCalendarsByName(CONFIG.CALENDAR_NAME);
  if (existing && existing.length) return existing[0];
  return CalendarApp.createCalendar(CONFIG.CALENDAR_NAME, {
    summary: 'Availability + confirmed charters for ' + CONFIG.BOAT_NAME, timeZone: CONFIG.TIMEZONE
  });
}
function calendar_() {
  var id = PROPS.getProperty('CALENDAR_ID');
  return id ? CalendarApp.getCalendarById(id) : null;
}
/** {start,end} Date objects for a block on a yyyy-MM-dd date (script tz = Chicago). */
function blockWindow_(dateStr, blockId) {
  var w = CONFIG.BLOCK_WINDOWS[blockId];
  if (!w || !dateStr) return null;
  var p = String(dateStr).split('-');
  return { start: new Date(+p[0], +p[1] - 1, +p[2], w[0], w[1]),
           end:   new Date(+p[0], +p[1] - 1, +p[2], w[2], w[3]) };
}
/** {morning,afternoon,night} booleans — true = already booked/blocked on the calendar. */
function getAvailability_(dateStr) {
  var out = { morning: false, afternoon: false, night: false };
  var cal = calendar_();
  if (!cal || !dateStr) return out;
  Object.keys(CONFIG.BLOCK_WINDOWS).forEach(function (b) {
    var win = blockWindow_(dateStr, b);
    out[b] = cal.getEvents(win.start, win.end).length > 0;
  });
  return out;
}
/**
 * Create the charter event. Returns event id.
 *   pending = true  -> pencilled-in hold. Titled REQUEST, guest NOT invited (an
 *                      invite would land in their inbox looking like a yes).
 *   pending = false -> confirmed charter, guest invited.
 */
function createCalendarEvent_(data, bookingId, folderUrl, pending) {
  var cal = calendar_();
  var win = blockWindow_(data.charterDate, data.timeBlock);
  if (!cal || !win) return '';
  var ev = cal.createEvent(
    eventTitle_(data, bookingId, pending), win.start, win.end,
    {
      description: eventDesc_(data, bookingId, folderUrl, pending),
      location: CONFIG.DOCK_LOCATION,
      guests: pending ? '' : (data.primaryEmail || ''),
      sendInvites: !pending
    });
  return ev.getId();
}

function eventTitle_(data, bookingId, pending) {
  return (pending ? '\u23f3 REQUEST \u2014 ' : '') + CONFIG.BOAT_NAME + ' Charter \u2014 ' +
         (data.primaryName || data.PrimaryName || 'Guest') + ' (' + bookingId + ')';
}
function eventDesc_(data, bookingId, folderUrl, pending) {
  var needs = String(data.captainStatus || data.CaptainStatus).toLowerCase() === 'need';
  var name  = data.primaryName  || data.PrimaryName  || '';
  var email = data.primaryEmail || data.PrimaryEmail || '';
  var price = data.amountPaid   || data.AmountPaid   || '';
  return (pending ? 'NOT CONFIRMED YET \u2014 holding this slot while you decide.\n' +
                    'Accept:  ' + actionUrl_('accept', bookingId) + '\n' +
                    'Decline: ' + actionUrl_('decline', bookingId) + '\n\n' : '') +
         'Party of ' + (data.partySize || data.PartySize || '?') + '\n' +
         'Contact: ' + name + ' \u00b7 ' + email + ' \u00b7 ' + (data.phone || data.Phone || '') + '\n' +
         'Quoted: $' + price + '\n' +
         'Captain: ' + (needs ? 'NEEDED \u2014 assign one' : 'guest bringing own') + '\n' +
         ((data.addOns || data.AddOns) ? 'Add-ons: ' + (data.addOns || data.AddOns) + '\n' : '') +
         (folderUrl ? 'Folder: ' + folderUrl + '\n' : '') + 'Booking ' + bookingId;
}

/** Promote a pencilled-in hold to a confirmed charter and invite the guest. */
function confirmCalendarEvent_(b, folderUrl) {
  var cal = calendar_();
  if (!cal) return;
  var ev = b.EventId ? cal.getEventById(b.EventId) : null;
  if (!ev) {   // hold went missing (deleted by hand) — recreate it confirmed
    createCalendarEvent_(b, b.BookingID, folderUrl, false);
    return;
  }
  ev.setTitle(eventTitle_(b, b.BookingID, false));
  ev.setDescription(eventDesc_(b, b.BookingID, folderUrl, false));
  if (b.PrimaryEmail) ev.addGuest(b.PrimaryEmail);
}

/** Delete the pencilled-in event so the slot reopens. */
function releaseHold_(b) {
  var cal = calendar_();
  if (!cal || !b.EventId) return;
  try { var ev = cal.getEventById(b.EventId); if (ev) ev.deleteEvent(); }
  catch (err) { Logger.log('releaseHold_ ' + b.BookingID + ': ' + err); }
}

// --- post-charter reviews ---
/**
 * Daily: email the primary guest of any FINISHED charter a Google-review request
 * (once per booking). Light gate: happy -> Google review button; unhappy -> reply privately.
 */
function requestReviews() {
  const ss = openSS_();
  const sh = ss.getSheetByName('Bookings');
  const rows = sh.getDataRange().getValues();
  const H = HEADERS.Bookings;
  const now = new Date();
  for (var r = 1; r < rows.length; r++) {
    var row = rows[r];
    if (row[H.indexOf('ReviewRequested')]) continue;                        // already asked
    if (String(row[H.indexOf('Status')]).toLowerCase().indexOf('cancel') >= 0) continue;
    var email = row[H.indexOf('PrimaryEmail')];
    if (!email) continue;
    var win = blockWindowFromLabel_(row[H.indexOf('CharterDate')], row[H.indexOf('TimeBlock')]);
    if (!win || win.end > now) continue;                                    // charter not over yet
    sendReviewEmail_(row[H.indexOf('PrimaryName')], email);
    sh.getRange(r + 1, H.indexOf('ReviewRequested') + 1).setValue(now_());
  }
}

/** Resolve a block window from the Bookings sheet's stored values (label or id). */
function blockWindowFromLabel_(dateVal, blockLabel) {
  var dateStr = (dateVal instanceof Date) ? Utilities.formatDate(dateVal, CONFIG.TIMEZONE, 'yyyy-MM-dd') : String(dateVal);
  var id = null;
  Object.keys(CONFIG.TIME_BLOCKS).forEach(function (k) { if (CONFIG.TIME_BLOCKS[k] === blockLabel) id = k; });
  if (!id && CONFIG.BLOCK_WINDOWS[blockLabel]) id = blockLabel;            // stored as id
  return id ? blockWindow_(dateStr, id) : null;
}

function sendReviewEmail_(name, email) {
  var first = String(name || '').split(' ')[0] || 'there';
  var html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:600px">' +
    '<p>Hi ' + esc_(first) + ',</p>' +
    '<p>Thanks for spending the day on the water with us aboard <strong>' + CONFIG.BOAT_NAME + '</strong> — we hope it was a blast! 🌊</p>' +
    '<p>If you had a great time, it would mean the world if you left us a quick <strong>Google review</strong>:</p>' +
    '<p><a href="' + CONFIG.GOOGLE_REVIEW_URL + '" style="display:inline-block;background:#444AEB;color:#FFFDEF;font-family:Arial,sans-serif;font-weight:700;padding:13px 26px;border-radius:999px;text-decoration:none">⭐ Leave a Google review</a></p>' +
    '<p style="color:#5f6b53">And if anything fell short, just reply to this email and tell us — we read every one and want to make it right.</p>' +
    '<p>Hope to see you back on the water,<br>— ' + CONFIG.BUSINESS_NAME + '</p></div>';
  GmailApp.sendEmail(email, 'How was your day aboard ' + CONFIG.BOAT_NAME + '? 🚤',
    htmlToText_(html), { htmlBody: html, name: CONFIG.BUSINESS_NAME, replyTo: CONFIG.OWNER_EMAIL });
}

// --- JotForm reconcile (agreement payment/sign + waivers -> our sheets) ---
/** Runs on a timer: pull new JotForm submissions into Bookings/Guests. */
function reconcileJotform() {
  try { reconcileAgreement_(); } catch (e) { Logger.log('Agreement reconcile error: ' + e); }
  try { reconcileWaivers_();  } catch (e) { Logger.log('Waiver reconcile error: ' + e); }
}

/**
 * Stamps AgreementSigned only. It no longer touches Status or Paid: Luis owns
 * both now (he accepts the charter, and he invoices), so writing them here
 * would fight the offer flow and overwrite his own bookkeeping.
 */
function reconcileAgreement_() {
  var sheetId = CONFIG.AGREEMENT_NOPAY_SHEET_ID || CONFIG.AGREEMENT_SHEET_ID;
  if (!sheetId) return;
  var sh = SpreadsheetApp.openById(sheetId).getSheets()[0];
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return;
  var cBooking = findCol_(v[0], ['booking']);
  if (cBooking < 0) { Logger.log('AGREEMENT: no bookingId column in ' + JSON.stringify(v[0])); return; }
  var key = 'CURSOR_' + sheetId;                                      // cursor keyed by sheet id
  var start = Number(PROPS.getProperty(key) || 1);
  for (var i = Math.max(start, 1); i < v.length; i++) {
    var bId = String(v[i][cBooking]).trim();
    if (bId) updateBooking_(bId, { AgreementSigned: now_() });
  }
  PROPS.setProperty(key, String(v.length));
}

function reconcileWaivers_() {
  var sh = SpreadsheetApp.openById(CONFIG.WAIVER_SHEET_ID).getSheets()[0];
  var v = sh.getDataRange().getValues();
  if (v.length < 2) return;
  var hdr = v[0];
  var cBooking = findCol_(hdr, ['booking']);
  var cEmail = findCol_(hdr, ['email']);
  var cName = findCol_(hdr, ['print name', 'name of charterer', 'name']);
  var cSig = findCol_(hdr, ['signature']);
  Logger.log('WAIVER cols -> bookingId=' + cBooking + ' email=' + cEmail + ' name=' + cName + ' sig=' + cSig + ' (' + JSON.stringify(hdr) + ')');
  var key = 'CURSOR_' + CONFIG.WAIVER_SHEET_ID;                       // cursor keyed by sheet id
  var start = Number(PROPS.getProperty(key) || 1);
  for (var i = Math.max(start, 1); i < v.length; i++) {
    var bId = cBooking >= 0 ? String(v[i][cBooking]).trim() : '';
    var email = cEmail >= 0 ? String(v[i][cEmail]).trim() : '';
    if (!bId || !email) continue;
    recordWaiverSigned(bId, email, cSig >= 0 ? String(v[i][cSig]) : '', cName >= 0 ? String(v[i][cName]) : '');
  }
  PROPS.setProperty(key, String(v.length));
}

function findCol_(hdr, keywords) {
  for (var k = 0; k < keywords.length; k++)
    for (var c = 0; c < hdr.length; c++)
      if (String(hdr[c]).toLowerCase().indexOf(keywords[k]) >= 0) return c;
  return -1;
}

// --- generic Drive / Sheet / Form utilities ---
function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function getOrCreateSpreadsheet_(folder, name) {
  var it = folder.getFilesByName(name);
  if (it.hasNext()) return SpreadsheetApp.open(it.next());
  var ss = SpreadsheetApp.create(name);
  moveFile_(ss.getId(), folder);
  return ss;
}
function getOrCreateDoc_(folder, name, body) {
  var it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  var doc = DocumentApp.create(name);
  doc.getBody().setText(body);
  doc.saveAndClose();
  moveFile_(doc.getId(), folder);
  return DriveApp.getFileById(doc.getId());
}
function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (headers && headers.length) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function removeDefaultSheet_(ss) {
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
}
function appendRow_(ss, sheetName, obj) {
  var sh = ss.getSheetByName(sheetName);
  var headers = HEADERS[sheetName];
  sh.appendRow(headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; }));
}
function namedResponses_(e) {
  var out = {};
  e.response.getItemResponses().forEach(function (ir) {
    out[ir.getItem().getTitle()] = ir.getResponse();
  });
  return out;
}
function moveFile_(fileId, folder) { DriveApp.getFileById(fileId).moveTo(folder); }
function openSS_()  { return SpreadsheetApp.openById(PROPS.getProperty('SPREADSHEET_ID')); }
function now_()     { return Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm'); }
function newBookingId_(dateStr) {
  return 'LL-' + String(dateStr).replace(/-/g, '') + '-' + Utilities.getUuid().slice(0, 4).toUpperCase();
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ====================== ACCEPT / DECLINE LINKS =============================
/**
 * doGet is a PUBLIC endpoint, so accept/decline URLs carry an HMAC token.
 * Without it anyone could confirm or kill Luis's charters by guessing an ID.
 * The secret lives in Script Properties and is minted once, on first use.
 */
function secret_() {
  var s = PROPS.getProperty('ACTION_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); PROPS.setProperty('ACTION_SECRET', s); }
  return s;
}
function token_(action, bookingId) {
  var raw = Utilities.computeHmacSha256Signature(action + '|' + bookingId, secret_());
  return Utilities.base64EncodeWebSafe(raw).replace(/=+$/, '').slice(0, 24);
}
function tokenOk_(action, bookingId, t) {
  var want = token_(action, bookingId);
  if (!t || String(t).length !== want.length) return false;
  var diff = 0;                                   // length-constant compare
  for (var i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ String(t).charCodeAt(i);
  return diff === 0;
}
/** The tap-me URL Luis gets in email. */
function actionUrl_(action, bookingId) {
  return webAppUrl_() + '?action=' + action + '&id=' + encodeURIComponent(bookingId) +
         '&t=' + encodeURIComponent(token_(action, bookingId));
}
/**
 * Base URL of the deployed web app. ScriptApp.getService().getUrl() returns the
 * /dev URL in some contexts, so a WEBAPP_URL script property wins if it is set.
 */
function webAppUrl_() {
  return PROPS.getProperty('WEBAPP_URL') || ScriptApp.getService().getUrl();
}
/** Run once after deploying to pin the /exec URL used in emails. */
function setWebAppUrl(url) {
  PROPS.setProperty('WEBAPP_URL', url || ScriptApp.getService().getUrl());
  Logger.log('WEBAPP_URL = ' + webAppUrl_());
}

function handleDecision_(e, action) {
  var id = e.parameter.id, t = e.parameter.t;
  if (!tokenOk_(action, id, t)) {
    return htmlPage_('Link not valid',
      'That accept/decline link is not valid. Open the Bookings sheet and set the Status there instead.');
  }
  var out = action === 'accept' ? acceptRequest(id) : declineRequest(id, 'Declined by Luis');
  var b = out.booking || findBooking_(id) || {};
  var when = (b.CharterDate || '') + ' \u00b7 ' + (b.TimeBlock || '');

  if (!out.ok && out.error === 'not_found')       return htmlPage_('Not found', 'No booking ' + esc_(id) + '.');
  if (!out.ok && out.error === 'already_accepted') return htmlPage_('Already accepted', esc_(when) + ' is already confirmed.');
  if (!out.ok && out.error === 'slot_released')   return htmlPage_('Already released', 'That request was already declined or expired, and the slot is open again.');
  if (!out.ok)                                    return htmlPage_('Something went wrong', esc_(String(out.error || '')));

  if (action === 'decline') {
    return htmlPage_('Declined', '<p><strong>' + esc_(when) + '</strong> \u2014 ' + esc_(b.PrimaryName || '') +
      '</p><p>They have been let down gently and the slot is open again.</p>');
  }
  return htmlPage_(out.already ? 'Already accepted' : 'Accepted \u2014 nice one',
    '<p><strong>' + esc_(when) + '</strong> \u2014 ' + esc_(b.PrimaryName || '') +
    ' \u00b7 party of ' + esc_(b.PartySize || '?') + '</p>' +
    '<p>They have their confirmation. It is on the calendar and they are invited.</p>' +
    '<p class="box"><strong>Now invoice them $' + esc_(b.AmountPaid || '') + '</strong><br>' +
    esc_(b.PrimaryEmail || '') + '<br>' +
    '<a href="' + CONFIG.STRIPE_INVOICE_URL + '">Create the invoice in Stripe \u2192</a></p>' +
    '<p style="color:#5f6b53">Waivers get signed at the dock. Booking ' + esc_(b.BookingID || id) + '</p>');
}

function htmlPage_(title, bodyHtml) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:34px 22px;' +
    'background:#fdfbf6;color:#1a1a1a;line-height:1.55}h1{font-size:24px;margin:0 0 14px}' +
    'p{margin:0 0 12px;font-size:16px}.box{background:#fff;border:1px solid #e5e0d4;' +
    'border-radius:12px;padding:14px}a{color:#c2185b}</style>' +
    '<h1>' + title + '</h1>' + bodyHtml)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle(CONFIG.BUSINESS_NAME);
}

// ====================== QUICK TEST =========================================
/**
 * Run after setup. Creates a fake REQUEST so you get the offer email with real
 * Accept / Decline buttons, exactly as Luis will see it. Tap one to test the
 * rest of the flow, then delete the row and the calendar event.
 */
function _testRequest() {
  var out = createRequest({
    charterDate: '2026-07-04', timeBlock: 'afternoon',
    primaryName: 'Test Guest', primaryEmail: CONFIG.OWNER_EMAIL, phone: '555-1234',
    partySize: 6, captainStatus: 'need', addOns: 'Water toys',
    message: 'It is my brother’s 30th. Any chance of a slightly later return?',
    amountPaid: CONFIG.DEFAULT_BLOCK_PRICE
  });
  Logger.log(out);
  if (out.ok) {
    Logger.log('Accept:  ' + actionUrl_('accept', out.bookingId));
    Logger.log('Decline: ' + actionUrl_('decline', out.bookingId));
  }
}
