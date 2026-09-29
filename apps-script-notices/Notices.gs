/**
 * Notices.gs — Chicago "Notice to Mariners" aggregator.
 *
 * STANDALONE project. This is its own Apps Script project + web-app deployment,
 * completely separate from the booking/checkout backend. It has its own doGet,
 * its own 15-minute trigger, and its own "La Lancha — Notices" Google Sheet.
 * It never touches booking code or data.
 *
 * Portability: fetchFeed_ / normalize* / classifyChicago_ are pure functions;
 * storage sits behind loadNotices_ / saveNotices_. To move this to Cloudflare
 * later, swap those two + the trigger; the frontend (/notices) is unchanged.
 *
 * Data flow:  RSS -> fetchFeed_ -> normalize -> classifyChicago_ -> upsert
 *             -> dedupe/cancellations/retention -> Sheet -> getNoticesPayload_
 *             -> JSON at ?action=notices -> /notices page.
 *
 * ONE-TIME SETUP (after `clasp push`): run setupNotices() once. It creates the
 * store, installs a 15-minute ingestion trigger, and backfills.
 */

var PROPS = PropertiesService.getScriptProperties();

/** Web app entry (this project only serves notices). GET ?action=notices. */
function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : null;
  var key = e && e.parameter ? e.parameter.key : null;
  if (action === 'notices') return json_(getNoticesPayload_());
  // Keyed manual kick/diagnostic: runs one ingest and returns the result (or the
  // caught error). Normal refresh is the 15-min trigger; this is for setup/debug.
  if (action === 'refresh' && key === NOTICES_CFG.REFRESH_KEY) {
    var hadTrigger = ensureIngestTrigger_();
    var res = ingestNotices();
    res.triggerAlreadyInstalled = hadTrigger;
    return json_(res);
  }
  return json_({ ok: true, service: 'La Lancha Notices' });
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

var NOTICES_CFG = {
  // Official USCG NAVCEN GovDelivery RSS feeds.
  BNM_RSS_URL: 'https://public.govdelivery.com/topics/USDHSCG_523/feed.rss', // Sector Lake Michigan BNM (individual notices)
  LNM_RSS_URL: 'https://public.govdelivery.com/topics/USDHSCG_94/feed.rss',  // Ninth District LNM (weekly PDF pointers)

  RETENTION_DAYS: 30,
  POLL_MINUTES: 15,
  STORE_NAME: 'La Lancha — Notices (Coast Guard)',
  MAX_SUMMARY: 240,
  REFRESH_KEY: 'lancha-refresh-8x2', // gate for the manual ?action=refresh kick/diagnostic

  // --- Chicago relevance config (tune here, nowhere else) ---
  // Hard state exclusions keyed off the "TYPE/STATE - ..." title structure.
  EXCLUDE_STATES: ['MI', 'WI', 'IN'],
  // Secondary non-Chicago location names (covers region-labeled titles).
  EXCLUDE_LOCATIONS: ['ST JOSEPH', 'ST. JOSEPH', 'SAUGATUCK', 'SOUTH HAVEN', 'NEW BUFFALO',
    'GRAND HAVEN', 'MUSKEGON', 'HOLLAND', 'MILWAUKEE', 'RACINE', 'KENOSHA', 'SHEBOYGAN',
    'GARY', 'HAMMOND', 'EAST CHICAGO', 'BURNS HARBOR', 'WHITING', 'INDIANA HARBOR', 'MICHIGAN CITY'],
  // Inland Illinois Waterway (industrial/river, not the Chicago lakefront) — excluded
  // unless the notice is a downtown Chicago River branch or a Chicago harbor.
  // NOTE: the Chicago Sanitary & Ship Canal is excluded in v1. A BNM title can't tell
  // the downtown/north-of-Cicero end from the industrial SW stretch, so we leave it out
  // rather than surface industrial traffic. Revisit if a reliable sub-location appears.
  EXCLUDE_INLAND: ['SANITARY AND SHIP CANAL', 'CAL-SAG', 'DES PLAINES', 'ILLINOIS RIVER',
    'LOCKPORT', 'BRANDON ROAD', 'DRESDEN', 'MARSEILLES', 'STARVED ROCK', 'SENECA', 'MORRIS',
    'OTTAWA', 'PEORIA', 'JOLIET'],
  // Strong Chicago includes.
  INCLUDE_STRONG: ['CHICAGO HARBOR', 'CHICAGO RIVER', 'CHICAGO LOCK', 'NAVY PIER', 'MONROE HARBOR',
    'DUSABLE', 'BURNHAM HARBOR', 'BELMONT HARBOR', 'DIVERSEY', 'MONTROSE', 'JACKSON PARK',
    '31ST STREET', 'LAKEFRONT', 'LAKE FRONT'],
};

var NOTICE_COLS = ['id', 'source', 'officialNoticeId', 'category', 'geographicArea',
  'title', 'displayTitle', 'summary', 'officialUrl', 'publishedAt', 'effectiveAt', 'expiresAt',
  'status', 'chicagoRelevant', 'relevanceReason', 'relevanceConfidence', 'createdAt', 'updatedAt'];

// ── Entry points ──────────────────────────────────────────────────────────

/** One-time setup: create store, install the 15-min trigger, backfill. */
function setupNotices() {
  noticesStore_(); // create the store spreadsheet + header
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'ingestNotices') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('ingestNotices').timeBased().everyMinutes(NOTICES_CFG.POLL_MINUTES).create();
  ingestNotices();
  Logger.log('Notices: setup complete, polling every %s min.', NOTICES_CFG.POLL_MINUTES);
}

/** Ensure the 15-min ingestion trigger exists (idempotent). Returns true if already present. */
function ensureIngestTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'ingestNotices'; });
  if (!has) ScriptApp.newTrigger('ingestNotices').timeBased().everyMinutes(NOTICES_CFG.POLL_MINUTES).create();
  return has;
}

/** Trigger target: fetch feeds, classify, upsert. Failure-safe per source. */
function ingestNotices() {
  var summary = { ok: true, bnm: null, lnm: null, bnmError: null, lnmError: null };
  // BNM — the primary, fully-parsed source.
  try {
    var raw = fetchFeed_(NOTICES_CFG.BNM_RSS_URL);
    var notices = [], cancellations = [], counts = { inc: 0, exc: 0, nr: 0, canc: 0 };
    raw.forEach(function (r) {
      var n = normalizeBnm_(r);
      if (n.status === 'cancellation') { cancellations.push(n); counts.canc++; return; }
      if (n.chicagoRelevant) counts.inc++;
      else if (n.status === 'needs_review') counts.nr++;
      else counts.exc++;
      notices.push(n);
    });
    upsertNotices_(notices);
    applyCancellations_(cancellations);
    PROPS.setProperty('NOTICES_LAST_BNM_SYNC', new Date().toISOString());
    summary.bnm = counts;
    Logger.log('Notices BNM: fetched %s | Chicago %s | excluded %s | needs_review %s | cancellations %s',
      raw.length, counts.inc, counts.exc, counts.nr, counts.canc);
  } catch (err) {
    summary.ok = false;
    summary.bnmError = String((err && err.stack) || err);
    Logger.log('Notices BNM fetch FAILED (keeping existing): ' + err);
  }
  // LNM — weekly PDFs only; v1 surfaces one "current weekly LNM" reference.
  try {
    ingestLnmReference_();
    PROPS.setProperty('NOTICES_LAST_LNM_SYNC', new Date().toISOString());
  } catch (err) {
    summary.lnmError = String((err && err.stack) || err);
    Logger.log('Notices LNM fetch FAILED (keeping existing): ' + err);
  }
  pruneRetention_();
  return summary;
}

/** Public JSON payload for the /notices page (debug fields stripped). */
function getNoticesPayload_() {
  var rows = loadNotices_();
  var cutoff = Date.now() - NOTICES_CFG.RETENTION_DAYS * 864e5;
  var out = rows
    .filter(function (n) {
      return n.chicagoRelevant === true &&
        n.status !== 'expired' && n.status !== 'cancellation' &&
        (new Date(n.publishedAt).getTime() || 0) >= cutoff;
    })
    .sort(function (a, b) { return new Date(b.publishedAt) - new Date(a.publishedAt); })
    .map(function (n) {
      return {
        id: n.id, source: n.source, officialNoticeId: n.officialNoticeId,
        category: n.category, area: n.geographicArea,
        title: n.displayTitle || n.title, summary: n.summary,
        publishedAt: n.publishedAt, effectiveAt: n.effectiveAt || null, expiresAt: n.expiresAt || null,
        officialUrl: n.officialUrl,
      };
    });
  var lastBnm = PROPS.getProperty('NOTICES_LAST_BNM_SYNC');
  return { ok: true, updated: lastBnm || null, count: out.length, notices: out };
}

// ── Ingestion helpers (pure-ish) ──────────────────────────────────────────

/** Fetch an RSS feed and return raw items. Throws on transport/parse failure. */
function fetchFeed_(url) {
  var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (resp.getResponseCode() >= 400) throw new Error('HTTP ' + resp.getResponseCode() + ' for ' + url);
  var doc = XmlService.parse(resp.getContentText());
  var channel = doc.getRootElement().getChild('channel');
  if (!channel) return [];
  return channel.getChildren('item').map(function (it) {
    var txt = function (tag) { var c = it.getChild(tag); return c ? c.getText() : ''; };
    return { title: txt('title').trim(), guid: (txt('guid') || txt('link')).trim(),
      link: txt('link').trim(), pubDate: txt('pubDate').trim(), description: txt('description') };
  });
}

var _norm = function (s) { return (s || '').toUpperCase().replace(/[‒-―]/g, '-').replace(/\s+/g, ' ').trim(); };
var _stripHtml = function (s) { return (s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim(); };
var _titleCase = function (s) {
  return (s || '').toLowerCase().replace(/\b([a-z])/g, function (m) { return m.toUpperCase(); })
    .replace(/\bIl\b/g, 'IL').replace(/\bAton\b/gi, 'Aids to Navigation').replace(/\bBnm\b/gi, 'BNM');
};

/** Normalize one BNM RSS item into the MarineNotice shape + classify it. */
function normalizeBnm_(raw) {
  var t = _norm(raw.title);
  var parts = t.split('/');
  var bnmPart = parts[parts.length - 1] || '';
  var idMatch = bnmPart.match(/BNM\s+(\d{3,4}-\d{2})/);
  var officialNoticeId = idMatch ? idMatch[1] : '';
  var category = parts.length >= 3 ? parts[parts.length - 2] : '';
  var geoRaw = parts.slice(1, Math.max(1, parts.length - 2)).join(' / ');
  var location = cleanLocation_(geoRaw);
  var c = classifyChicago_(t);
  var body = _stripHtml(raw.description); // Coast Guard source text, left in its original formatting for v1
  var summary = body.length > NOTICES_CFG.MAX_SUMMARY ? body.slice(0, NOTICES_CFG.MAX_SUMMARY).replace(/\s\S*$/, '') + '…' : body;
  var nowIso = new Date().toISOString();
  return {
    id: 'bnm-' + (raw.guid || officialNoticeId || raw.title),
    source: 'BNM', officialNoticeId: officialNoticeId,
    category: _titleCase(category), geographicArea: location,
    title: raw.title, displayTitle: (_titleCase(category) ? _titleCase(category) + ' — ' : '') + (location || 'Chicago area'),
    summary: summary, officialUrl: raw.link,
    publishedAt: safeIso_(raw.pubDate), effectiveAt: '', expiresAt: '',
    status: c.status, chicagoRelevant: c.rel, relevanceReason: c.reason,
    relevanceConfidence: c.conf || '', createdAt: nowIso, updatedAt: nowIso,
    _cancelNumber: c.status === 'cancellation' ? officialNoticeId : '',
  };
}

/** LNM v1: store a single reference to the current weekly Great Lakes LNM. */
function ingestLnmReference_() {
  var raw = fetchFeed_(NOTICES_CFG.LNM_RSS_URL);
  if (!raw.length) return;
  var latest = raw[0];
  var nowIso = new Date().toISOString();
  upsertNotices_([{
    id: 'lnm-weekly-current', source: 'LNM', officialNoticeId: '',
    category: 'Weekly LNM', geographicArea: 'Great Lakes (District 9)',
    title: latest.title,
    displayTitle: 'Great Lakes Weekly Local Notice to Mariners',
    summary: 'The full official weekly Local Notice to Mariners for the Great Lakes (District 9). Per-notice Chicago filtering for the LNM is coming; for now, open the official weekly notice for LNM details.',
    officialUrl: latest.link, publishedAt: safeIso_(latest.pubDate), effectiveAt: '', expiresAt: '',
    status: 'active', chicagoRelevant: true, relevanceReason: 'LNM weekly reference',
    relevanceConfidence: '', createdAt: nowIso, updatedAt: nowIso,
  }]);
}

/**
 * Deterministic Chicago relevance engine. Ported verbatim from the Node test
 * harness that was validated against the live feed. No AI / no invented data.
 */
function classifyChicago_(rawTitle) {
  var t = _norm(rawTitle);
  if (/^CANCELLATION\b/.test(t)) return { rel: false, status: 'cancellation', reason: 'Cancellation' };
  var toChi = /TO CHICAGO/.test(t);

  var m = t.match(/^[^/]*\/\s*([A-Z .]+?)\s+-\s+/);
  var region = m ? m[1].trim() : '';
  var state = /^(IL|MI|WI|IN)$/.test(region) ? region : '';
  if (NOTICES_CFG.EXCLUDE_STATES.indexOf(state) !== -1 && !toChi)
    return { rel: false, status: 'active', reason: 'Excluded: state ' + state };

  if (!toChi && anyOf_(t, NOTICES_CFG.EXCLUDE_LOCATIONS))
    return { rel: false, status: 'active', reason: 'Excluded: non-Chicago location' };

  if (/CALUMET/.test(t) && !/CHICAGO HARBOR|CHICAGO RIVER|CHICAGO LOCK|NAVY PIER/.test(t))
    return { rel: false, status: 'active', reason: 'Excluded: Calumet (conservative)' };

  var dtRiver = /CHICAGO RIVER|NORTH BRANCH|SOUTH BRANCH|MAIN BRANCH/.test(t);
  if (anyOf_(t, NOTICES_CFG.EXCLUDE_INLAND) && !dtRiver && !/CHICAGO HARBOR/.test(t))
    return { rel: false, status: 'active', reason: 'Excluded: inland Illinois Waterway' };

  if (anyOf_(t, NOTICES_CFG.INCLUDE_STRONG) || /- CHICAGO[\/,]|LAKE MICHIGAN - CHICAGO|- CHICAGO -/.test(t) || toChi)
    return { rel: true, status: 'active', conf: 0.9, reason: 'Strong Chicago match' };

  // v1 is intentionally narrow: Chicago-proper only. IL-but-not-clearly-Chicago
  // (Wilmette, Clarks Point, north-shore, unnamed IL Lake Michigan) is held for
  // review, not shown. Widen later by re-adding an IL/Lake-Michigan include here.
  return { rel: false, status: 'needs_review', reason: 'Ambiguous - not clearly Chicago-proper' };
}

function anyOf_(t, list) { for (var i = 0; i < list.length; i++) if (t.indexOf(list[i]) !== -1) return true; return false; }

function cleanLocation_(geoRaw) {
  var g = _norm(geoRaw)
    .replace(/^(IL|MI|WI|IN)\s*-\s*/, '')
    .replace(/^SOUTHERN LAKE MICHIGAN\s*-\s*/, '')
    .replace(/\bLAKE MICHIGAN\s*-\s*/, '')
    .replace(/\bILLINOIS WATERWAYS?\s*-\s*/, '')
    .replace(/\s*-\s*/g, ', ').replace(/,\s*IL\b/g, '').replace(/,\s*$/, '').trim();
  return _titleCase(g) || 'Chicago area';
}

// ── Storage (Sheet-backed; swap for KV to port) ───────────────────────────

function noticesStore_() {
  var id = PROPS.getProperty('NOTICES_STORE_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(NOTICES_CFG.STORE_NAME);
    PROPS.setProperty('NOTICES_STORE_ID', ss.getId());
  }
  var sh = ss.getSheetByName('Notices') || ss.insertSheet('Notices');
  if (sh.getLastRow() === 0) sh.appendRow(NOTICE_COLS);
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) {} }
  return sh;
}

function loadNotices_() {
  var sh = noticesStore_();
  var values = sh.getDataRange().getValues();
  var header = values.shift() || [];
  return values.map(function (row) {
    var o = {}; header.forEach(function (h, i) { o[h] = row[i]; });
    o.chicagoRelevant = (o.chicagoRelevant === true || o.chicagoRelevant === 'TRUE' || o.chicagoRelevant === 'true');
    if (o.publishedAt instanceof Date) o.publishedAt = o.publishedAt.toISOString();
    return o;
  });
}

function saveNotices_(rows) {
  var sh = noticesStore_();
  sh.clearContents();
  sh.appendRow(NOTICE_COLS);
  if (!rows.length) return;
  var data = rows.map(function (n) { return NOTICE_COLS.map(function (c) { return n[c] === undefined ? '' : n[c]; }); });
  sh.getRange(2, 1, data.length, NOTICE_COLS.length).setValues(data);
}

/** Upsert by id (stable dedupe): update existing rows, append new ones. */
function upsertNotices_(incoming) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { Logger.log('Notices: lock busy, skipping'); return; }
  try {
    var rows = loadNotices_();
    var byId = {}; rows.forEach(function (r, i) { byId[r.id] = i; });
    incoming.forEach(function (n) {
      if (byId[n.id] !== undefined) {
        var ex = rows[byId[n.id]];
        n.createdAt = ex.createdAt || n.createdAt;      // preserve first-seen
        if (ex.status === 'expired') n.status = 'expired'; // cancelled stays cancelled
        rows[byId[n.id]] = n;
      } else {
        rows.push(n);
      }
    });
    saveNotices_(rows);
  } finally { lock.releaseLock(); }
}

/** Expire any stored notice referenced by a cancellation. */
function applyCancellations_(cancellations) {
  if (!cancellations.length) return;
  var nums = {}; cancellations.forEach(function (c) { if (c.officialNoticeId) nums[c.officialNoticeId] = true; });
  if (!Object.keys(nums).length) return;
  var rows = loadNotices_(), changed = false;
  rows.forEach(function (r) {
    if (r.source === 'BNM' && nums[r.officialNoticeId] && r.status !== 'expired') { r.status = 'expired'; changed = true; }
  });
  if (changed) saveNotices_(rows);
}

/** Drop rows older than retention window (behave as if deleted). */
function pruneRetention_() {
  var cutoff = Date.now() - (NOTICES_CFG.RETENTION_DAYS + 1) * 864e5;
  var rows = loadNotices_();
  var kept = rows.filter(function (r) {
    if (r.id === 'lnm-weekly-current') return true; // always keep the LNM reference
    return (new Date(r.publishedAt).getTime() || Date.now()) >= cutoff;
  });
  if (kept.length !== rows.length) saveNotices_(kept);
}

// ── small utils ───────────────────────────────────────────────────────────

function safeIso_(s) { var d = new Date(s); return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); }
