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
  // Fuel rule: if the captain's post-charter report says the trip stayed at the
  // Playpen -> flat fee; anywhere else -> hourly on engine time.
  FUEL_PLAYPEN_FLAT: 25,    // flat fuel fee for Playpen-only trips
  FUEL_HOURLY_RATE:  25,    // $/hr of engine time for trips beyond the Playpen
  CAPTAIN_RATE_LOW:  100,   // $/hr, low end
  CAPTAIN_RATE_HIGH: 150,   // $/hr, high end (weekend / high demand)
  DEFAULT_BLOCK_PRICE: 400, // default price per 4-hr block ($100/hr × 4); overridable per date in the Pricing tab

  // --- Logistics & links (from Luis's onboarding email) ---
  DOCK_LOCATION:  'Diversey Harbor, K-Dock, Slip 8',
  CALENDAR_NAME:  'Quarters Charters',   // dedicated availability calendar (auto-created in setup)
  // Block time windows (24h, America/Chicago) used for calendar events + availability.
  BLOCK_WINDOWS: { morning: [10, 0, 14, 0], afternoon: [14, 30, 18, 30], night: [19, 0, 23, 0] },
  LINK_AGREEMENT: 'https://agreement.la-lancha.com',
  LINK_WAIVER:    'https://waiver.la-lancha.com',
  LINK_DIRECTIONS:'https://k8.la-lancha.com',
  LINK_CAPTAINS:  'https://drive.google.com/file/d/1961Eq70KU8SnwpasENDAAH3YB4cOLGmx/view',

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
             'Destination', 'EngineHours', 'FuelDue', 'Status', 'FolderURL', 'EventId', 'Notes'],
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

  installTriggers_();

  Logger.log('✅ Setup complete.');
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

// ====================== CORE: NEW BOOKING ==================================
/**
 * The heart of the system. Call this when a charter is BOOKED (from doPost,
 * or manually for testing). `data` shape:
 * {
 *   charterDate: '2026-07-04', timeBlock: 'afternoon',
 *   primaryName: 'Maria R.', primaryEmail: 'maria@x.com', phone: '...',
 *   partySize: 6, captainStatus: 'need' | 'have',
 *   addOns: 'Water toys, +1hr', amountPaid: 1500, stripeRef: 'pi_123',
 *   guests: [ {name:'Guest 2', email:'g2@x.com'}, ... ]   // optional
 * }
 */
function createBooking(data) {
  const ss = openSS_();

  // 0) Race guard — re-check the calendar; the slot may have just been taken.
  if (getAvailability_(data.charterDate)[data.timeBlock]) {
    return { ok: false, error: 'slot_taken' };
  }

  const bookingId = newBookingId_(data.charterDate);

  // 1) Dedicated Drive folder for this charter + copy templates in
  const charters = DriveApp.getFolderById(PROPS.getProperty('CHARTERS_FOLDER_ID'));
  const folderName = data.charterDate + ' — ' + (data.primaryName || 'Guest') + ' (' + bookingId + ')';
  const folder = charters.createFolder(folderName);
  copyTemplatesInto_(folder);

  // 2) Auto-confirm onto the calendar — this is also what blocks the slot.
  const eventId = createCalendarEvent_(data, bookingId, folder.getUrl());

  // 3) Log the booking
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
    AmountPaid: data.amountPaid || '',
    StripeRef: data.stripeRef || '',
    Status: 'Booked',
    FolderURL: folder.getUrl(),
    EventId: eventId,
    Notes: ''
  });

  // 3) Seed the guest signing roster (primary + any guests) — also captures leads
  var guests = [{ name: data.primaryName, email: data.primaryEmail, primary: true }];
  (data.guests || []).forEach(function (g) { guests.push({ name: g.name, email: g.email, primary: false }); });
  guests.forEach(function (g) {
    if (!g.email) return;
    appendRow_(ss, 'Guests', {
      BookingID: bookingId, GuestName: g.name || '', Email: g.email,
      IsPrimary: g.primary ? 'YES' : '', WaiverSent: '', WaiverSigned: '', SignedPDF: ''
    });
  });

  // Emails: guest confirmation + Luis notification (one email, captain-need flagged)
  sendBookingConfirmation_(data, bookingId);
  notifyLuisNewBooking_(data, bookingId, folder.getUrl());

  return { ok: true, bookingId: bookingId, folderUrl: folder.getUrl() };
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

/** Email Luis a "who still needs to sign" summary per active booking. */
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
      case 'newBooking':   out = createBooking(body); break;
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
 * GET endpoint for the Astro site.
 *   ?action=pricing&date=YYYY-MM-DD  -> { ok, date, blocks:{morning,afternoon,night} }
 *   (no action)                      -> health check
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;
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
  const isPlaypen   = String(destination).trim().toLowerCase() === 'playpen';

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
    (isPlaypen ? '  (flat Playpen rate)' : '  (' + engineHours + ' hr × $' + CONFIG.FUEL_HOURLY_RATE + '/hr)') +
    '\n\n' + (matched ? 'Booking row updated.' : '⚠ No matching booking found — check the Party Name/Date.') +
    '\nFull report is in the form-responses tab.');
}

/** Fuel rule: destination is exactly "Playpen" -> flat fee; anything else
 *  (Navy Pier, Monroe/Playpen South, River, Burnham/Northerly, Other) -> hourly. */
function computeFuel_(destination, engineHours) {
  return String(destination).trim().toLowerCase() === 'playpen'
    ? CONFIG.FUEL_PLAYPEN_FLAT
    : (Number(engineHours) || 0) * CONFIG.FUEL_HOURLY_RATE;
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

  // Daily waiver-reminder digest at 9am
  ScriptApp.newTrigger('sendWaiverReminders').timeBased().atHour(9).everyDays(1).create();
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

/**
 * Luis's real onboarding email (bareboat/demise model). Sent on every booking.
 * Captain paragraph adapts to whether the guest needs one or is bringing their own.
 */
function sendBookingConfirmation_(data, bookingId) {
  if (!data.primaryEmail) return;
  const block = CONFIG.TIME_BLOCKS[data.timeBlock] || data.timeBlock;
  const needsCaptain = String(data.captainStatus).toLowerCase() === 'need';
  const firstName = data.firstName || String(data.primaryName || '').split(' ')[0] || 'there';

  const captainPara = needsCaptain
    ? 'We don’t expect you to have a captain in your back pocket, so we maintain a roster of independent captains familiar with the boat. I’ve reached out to that full list already to see who is available, and I’ll follow up again if we don’t hear back soon. We’ll have someone confirmed for you, no worries on that front. You’re also welcome to bring your own qualified captain.'
    : 'You let us know you’re bringing your own qualified captain — perfect. Please send their credentials over so we can confirm them. If anything changes, we keep a roster of independent captains familiar with the boat and can help.';

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;max-width:600px">' +
    '<p>Hi ' + esc_(firstName) + ',</p>' +
    '<p>You’re locked in for the charter aboard <strong>' + CONFIG.BOAT_NAME + '</strong> — we appreciate you booking with us. ' +
    'This email should cover everything you need before boarding.</p>' +
    '<p><strong>Your charter:</strong> ' + esc_(data.charterDate) + ' &middot; ' + esc_(block) +
    (data.partySize ? ' &middot; party of ' + esc_(data.partySize) : '') + '</p>' +
    '<p>We operate under a <strong>bareboat/demise charter model</strong>. This means the vessel is legally released to you, as if it were yours for the trip. Because you take operational control, things like captains, fuel, food, and drinks are yours to arrange.</p>' +
    '<p>' + captainPara + '</p>' +
    '<p>The expected rate for a captain is between <strong>$' + CONFIG.CAPTAIN_RATE_LOW + '/hr and $' + CONFIG.CAPTAIN_RATE_HIGH + '/hr</strong> depending on the weekend and demand for that captain.</p>' +
    '<p>Fuel works the same way — you can top off on the way back in, or we invoice it after the trip: a <strong>flat $' + CONFIG.FUEL_PLAYPEN_FLAT + '</strong> if we stay at the Playpen, or <strong>$' + CONFIG.FUEL_HOURLY_RATE + '/hr</strong> of engine time if you head beyond it. Most guests prefer to have us invoice it for simplicity and to keep that extra time on the water.</p>' +
    '<p>We believe these are the easiest and most legally compliant interpretations of the law. Other operators may interpret some of these regulations differently, though we all share the same rigorous compliance with USCG vessel safety standards.</p>' +
    '<p>Please fill out the <strong>Charter Agreement</strong>, and have all of your other guests fill out the <strong>Guest Waiver</strong>:</p>' +
    '<ul>' +
    '<li>Charter Agreement &rarr; <a href="' + CONFIG.LINK_AGREEMENT + '">' + CONFIG.LINK_AGREEMENT.replace(/^https?:\/\//, '') + '</a></li>' +
    '<li>Guest Waiver &rarr; <a href="' + CONFIG.LINK_WAIVER + '">' + CONFIG.LINK_WAIVER.replace(/^https?:\/\//, '') + '</a></li>' +
    '</ul>' +
    '<p>The boat is located at <strong>' + CONFIG.DOCK_LOCATION + '</strong>. Her name is <strong>' + CONFIG.BOAT_NAME + '</strong>. ' +
    'Directions to the right spot &rarr; <a href="' + CONFIG.LINK_DIRECTIONS + '">' + CONFIG.LINK_DIRECTIONS.replace(/^https?:\/\//, '') + '</a></p>' +
    '<p>Charter captains list &rarr; <a href="' + CONFIG.LINK_CAPTAINS + '">view the roster</a></p>' +
    '<p>Have fun and stay hydrated!</p>' +
    '<p>— ' + CONFIG.BUSINESS_NAME + '<br><span style="color:#888;font-size:12px">Booking ' + bookingId + '</span></p>' +
    '</div>';

  GmailApp.sendEmail(data.primaryEmail,
    'You’re locked in — your ' + CONFIG.BOAT_NAME + ' charter (' + bookingId + ')',
    htmlToText_(html),                       // plain-text fallback
    { htmlBody: html, name: CONFIG.BUSINESS_NAME });
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function htmlToText_(html) {
  return html.replace(/<\/(p|li|ul|div)>/g, '\n').replace(/<li>/g, ' - ')
             .replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
             .replace(/&rarr;/g, '->').replace(/&middot;/g, '-').replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim();
}

function pingCaptainNeeded_(data, bookingId) {
  GmailApp.sendEmail(CONFIG.OWNER_EMAIL,
    '⚓ CAPTAIN NEEDED — ' + data.charterDate + ' ' + (CONFIG.TIME_BLOCKS[data.timeBlock] || data.timeBlock),
    'Booking ' + bookingId + ' needs a captain.\n\n' +
    'Guest: ' + data.primaryName + ' (' + data.primaryEmail + ')\n' +
    'Date: ' + data.charterDate + '\nBlock: ' + (CONFIG.TIME_BLOCKS[data.timeBlock] || data.timeBlock) +
    '\nParty: ' + (data.partySize || '') + '\n\nAssign a captain and update the Bookings sheet.');
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
/** Create the confirmed charter event (guest invited). Returns event id. */
function createCalendarEvent_(data, bookingId, folderUrl) {
  var cal = calendar_();
  var win = blockWindow_(data.charterDate, data.timeBlock);
  if (!cal || !win) return '';
  var needs = String(data.captainStatus).toLowerCase() === 'need';
  var title = CONFIG.BOAT_NAME + ' Charter — ' + (data.primaryName || 'Guest') + ' (' + bookingId + ')';
  var desc = 'Party of ' + (data.partySize || '?') + '\n' +
             'Contact: ' + (data.primaryName || '') + ' · ' + (data.primaryEmail || '') + ' · ' + (data.phone || '') + '\n' +
             'Captain: ' + (needs ? 'NEEDED — assign one' : 'guest bringing own') + '\n' +
             (data.addOns ? 'Add-ons: ' + data.addOns + '\n' : '') +
             (folderUrl ? 'Folder: ' + folderUrl + '\n' : '') + 'Booking ' + bookingId;
  var ev = cal.createEvent(title, win.start, win.end,
    { description: desc, location: CONFIG.DOCK_LOCATION, guests: data.primaryEmail || '', sendInvites: true });
  return ev.getId();
}
function notifyLuisNewBooking_(data, bookingId, folderUrl) {
  var needs = String(data.captainStatus).toLowerCase() === 'need';
  var block = CONFIG.TIME_BLOCKS[data.timeBlock] || data.timeBlock;
  GmailApp.sendEmail(CONFIG.OWNER_EMAIL,
    (needs ? '⚓ NEW BOOKING — captain needed' : '✅ NEW BOOKING') + ' · ' + data.charterDate + ' · ' + block,
    'New confirmed charter aboard ' + CONFIG.BOAT_NAME + '.\n\n' +
    'Booking: ' + bookingId + '\nGuest: ' + (data.primaryName || '') + ' (' + (data.primaryEmail || '') + ', ' + (data.phone || '') + ')\n' +
    'Date: ' + data.charterDate + '\nBlock: ' + block + '\nParty: ' + (data.partySize || '') + '\n' +
    'Captain: ' + (needs ? 'NEEDED — assign one from the roster' : 'guest bringing their own') + '\n' +
    (data.addOns ? 'Add-ons: ' + data.addOns + '\n' : '') +
    '\nIt\'s on the "' + CONFIG.CALENDAR_NAME + '" calendar. To cancel/decline, delete that event — the slot reopens automatically.\n' +
    (folderUrl ? '\nFolder: ' + folderUrl : ''));
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

// ====================== QUICK TEST =========================================
/** Run this after setup to create a fake booking end-to-end. */
function _testBooking() {
  Logger.log(createBooking({
    charterDate: '2026-07-04', timeBlock: 'afternoon',
    primaryName: 'Test Guest', primaryEmail: CONFIG.OWNER_EMAIL, phone: '555-1234',
    partySize: 6, captainStatus: 'need', addOns: 'Water toys',
    amountPaid: 1500, stripeRef: 'pi_test',
    guests: [{ name: 'Friend Two', email: CONFIG.OWNER_EMAIL }]
  }));
}
