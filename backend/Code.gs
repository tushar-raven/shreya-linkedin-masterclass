/**
 * The LinkedIn Masterclass: Google Sheet backend + private admin panel.
 *
 * Paste into the Sheet's Extensions → Apps Script (README step 2).
 * - The public website reads settings (countdown, photos) with GET ?action=config
 *   and saves registrations with POST. Both answer with JSON.
 * - The admin panel opens from the Sheet's "Masterclass" menu, so only people
 *   with edit access to this Sheet can see registrations or change settings.
 */

const TABS = { regs: 'Registrations', settings: 'Settings', dash: 'Dashboard' };
const HEADERS = ['Registered at', 'First name', 'Last name', 'Email', 'Role', 'LinkedIn', 'Goal',
  'Marketing consent', 'Source page', 'UTM source', 'UTM medium', 'UTM campaign', 'Status'];

const DEFAULT_SETTINGS = [
  ['eventDate', '2026-12-12T12:30:00.000Z', 'ISO time in UTC. Edit from the admin panel, not by hand.'],
  ['eventTimeZone', 'Asia/Kolkata', 'Timezone shown to visitors'],
  ['duration', '90 minutes', 'Shown under the date'],
  ['eventConfirmed', 'FALSE', 'FALSE shows "(to be confirmed)" next to the date'],
  ['registrationOpen', 'TRUE', 'FALSE closes the form'],
  ['heroPhoto', 'assets/shreya-hero.jpg', 'Approved photo path or URL'],
  ['aboutPhoto', 'assets/shreya-about.jpg', 'Approved photo path or URL'],
  ['notifyEmail', '', 'Optional: email to notify on each new registration'],
  ['sendConfirmation', 'FALSE', 'TRUE emails each registrant a short confirmation'],
  ['confirmationNote', 'The joining link will be emailed before the session.', 'Extra line in the confirmation email']
];
const PUBLIC_KEYS = ['eventDate', 'eventTimeZone', 'duration', 'eventConfirmed', 'registrationOpen', 'heroPhoto', 'aboutPhoto'];

/* ---------------- Menu + setup ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Masterclass')
    .addItem('Open admin panel', 'openAdminPanel')
    .addSeparator()
    .addItem('Set up / repair tabs', 'setup')
    .addToUi();
}

function openAdminPanel() {
  setup_(false);
  const html = HtmlService.createHtmlOutputFromFile('AdminPanel').setTitle('Masterclass admin');
  SpreadsheetApp.getUi().showSidebar(html);
}

function setup() { setup_(true); }

function setup_(announce) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let regs = ss.getSheetByName(TABS.regs);
  if (!regs) regs = ss.insertSheet(TABS.regs);
  if (regs.getLastRow() === 0) {
    regs.appendRow(HEADERS);
    regs.setFrozenRows(1);
    regs.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#17233d').setFontColor('#ffffff');
  }
  let st = ss.getSheetByName(TABS.settings);
  if (!st) st = ss.insertSheet(TABS.settings);
  if (st.getLastRow() === 0) {
    st.appendRow(['Key', 'Value', 'Notes']);
    st.getRange(1, 1, 1, 3).setFontWeight('bold');
    st.setFrozenRows(1);
  }
  const have = st.getRange(1, 1, Math.max(st.getLastRow(), 1), 1).getValues().map(r => String(r[0]));
  DEFAULT_SETTINGS.forEach(row => { if (have.indexOf(row[0]) === -1) st.appendRow(row); });
  st.getRange('B:B').setNumberFormat('@'); // keep values as plain text

  let dash = ss.getSheetByName(TABS.dash);
  if (!dash) {
    dash = ss.insertSheet(TABS.dash, 0);
    dash.getRange('A1:B1').setValues([['Masterclass dashboard', '']]).setFontWeight('bold').setFontSize(14);
    const R = "'" + TABS.regs + "'";
    dash.getRange('A3:B9').setValues([
      ['Total registrations', '=MAX(COUNTA(' + R + '!D:D)-1,0)'],
      ['Last 24 hours', '=COUNTIF(' + R + '!A:A,">="&(NOW()-1))'],
      ['Last 7 days', '=COUNTIF(' + R + '!A:A,">="&(NOW()-7))'],
      ['Opted in to updates', '=COUNTIF(' + R + '!H:H,"Yes")'],
      ['Founders / business owners', '=COUNTIF(' + R + '!E:E,"Founder / Business owner")'],
      ['Creators / freelancers', '=COUNTIF(' + R + '!E:E,"Creator / Freelancer")'],
      ['Working professionals', '=COUNTIF(' + R + '!E:E,"Working professional")']
    ]);
    dash.getRange('A11').setValue('Open Masterclass → Open admin panel to change the countdown, photos or registration status.').setFontColor('#606b7a');
    dash.setColumnWidth(1, 260);
  }
  if (announce) SpreadsheetApp.getActive().toast('Tabs are ready.', 'Masterclass');
}

/* ---------------- Settings ---------------- */

function readSettings_() {
  const st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.settings);
  const out = {};
  DEFAULT_SETTINGS.forEach(r => (out[r[0]] = r[1]));
  if (st && st.getLastRow() > 1) {
    st.getRange(2, 1, st.getLastRow() - 1, 2).getValues().forEach(r => { if (r[0]) out[String(r[0])] = String(r[1]); });
  }
  ['eventConfirmed', 'registrationOpen', 'sendConfirmation'].forEach(k => (out[k] = String(out[k]).toUpperCase() === 'TRUE'));
  return out;
}

function writeSettings_(changes) {
  const st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.settings);
  const keys = st.getRange(2, 1, st.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
  Object.keys(changes).forEach(k => {
    if (!DEFAULT_SETTINGS.some(d => d[0] === k)) return; // only known keys
    const v = typeof changes[k] === 'boolean' ? (changes[k] ? 'TRUE' : 'FALSE') : String(changes[k]).slice(0, 500);
    const i = keys.indexOf(k);
    if (i === -1) st.appendRow([k, v, '']); else st.getRange(i + 2, 2).setValue(v);
  });
  CacheService.getScriptCache().remove('public-settings');
}

/* ---------------- Public API (website) ---------------- */

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;
  if (action === 'config') {
    const cache = CacheService.getScriptCache();
    const hit = cache.get('public-settings');
    if (hit) return json_({ ok: true, settings: JSON.parse(hit) });
    const all = readSettings_();
    const pub = {};
    PUBLIC_KEYS.forEach(k => (pub[k] = all[k]));
    cache.put('public-settings', JSON.stringify(pub), 60);
    return json_({ ok: true, settings: pub });
  }
  return json_({ ok: true, service: 'masterclass' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const d = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true }); // honeypot: pretend success to bots
    const email = String(d.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json_({ ok: false, error: 'Please enter a valid email address.' });
    if (!d.consent) return json_({ ok: false, error: 'Please tick the consent box to register.' });
    if (String(d.firstName || '').trim().length < 2) return json_({ ok: false, error: 'Please enter your first name.' });

    const settings = readSettings_();
    if (!settings.registrationOpen) return json_({ ok: false, error: 'Registrations are closed for now.' });

    // Light abuse protection: one attempt per email every 30 seconds.
    const cache = CacheService.getScriptCache();
    if (cache.get('rl:' + email)) return json_({ ok: false, error: 'Please wait a few seconds and try again.' });
    cache.put('rl:' + email, '1', 30);

    lock.waitLock(10000);
    setup_(false);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.regs);
    if (sheet.getLastRow() > 1) {
      const emails = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).getValues().map(r => String(r[0]).toLowerCase());
      if (emails.indexOf(email) !== -1) return json_({ ok: true, duplicate: true });
    }
    const safe = v => {
      const s = String(v == null ? '' : v).trim().slice(0, 500);
      return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    };
    sheet.appendRow([new Date(), safe(d.firstName), safe(d.lastName), safe(email), safe(d.role), safe(d.linkedin),
      safe(d.goal), d.consent ? 'Yes' : 'No', safe(d.page), safe(d.utmSource), safe(d.utmMedium), safe(d.utmCampaign), 'Registered']);
    SpreadsheetApp.flush();
    lock.releaseLock();

    notify_(settings, d, email);
    return json_({ ok: true, duplicate: false });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'We could not save your registration. Please try again.' });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function notify_(settings, d, email) {
  try {
    if (settings.notifyEmail) {
      MailApp.sendEmail(settings.notifyEmail, 'New masterclass registration: ' + d.firstName + ' ' + (d.lastName || ''),
        [d.firstName + ' ' + (d.lastName || ''), email, d.role, d.linkedin, d.goal].filter(Boolean).join('\n'));
    }
    if (settings.sendConfirmation) {
      const when = settings.eventDate
        ? Utilities.formatDate(new Date(settings.eventDate), settings.eventTimeZone || 'Asia/Kolkata', "EEE d MMM yyyy, h:mm a z") + (settings.eventConfirmed ? '' : ' (to be confirmed)')
        : 'Date to be announced';
      MailApp.sendEmail({
        to: email,
        name: 'The LinkedIn Masterclass',
        subject: "You're registered: The LinkedIn Masterclass with Shreya Pattar",
        body: 'Hi ' + d.firstName + ',\n\nYour seat for The LinkedIn Masterclass is saved.\n\nWhen: ' + when +
          '\nFormat: Live online, ' + settings.duration + '\n\n' + settings.confirmationNote +
          '\n\nSee you there.\n\nTo stop receiving emails about this event, reply with "unsubscribe".'
      });
    }
  } catch (err) { console.warn('Email not sent', err); }
}

/* ---------------- Admin panel (called from the sidebar only) ---------------- */

function adminGetData() {
  setup_(false);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TABS.regs);
  const n = Math.max(sheet.getLastRow() - 1, 0);
  const rows = n ? sheet.getRange(2, 1, n, HEADERS.length).getValues() : [];
  const now = Date.now(), day = 86400000;
  const roles = {};
  let last24 = 0, last7 = 0, optIn = 0;
  rows.forEach(r => {
    const t = new Date(r[0]).getTime();
    if (now - t < day) last24++;
    if (now - t < 7 * day) last7++;
    if (r[7] === 'Yes') optIn++;
    const role = r[4] || 'Not given';
    roles[role] = (roles[role] || 0) + 1;
  });
  const recent = rows.slice(-30).reverse().map(r => ({
    at: new Date(r[0]).toISOString(), name: (r[1] + ' ' + r[2]).trim(), email: r[3], role: r[4]
  }));
  return { total: rows.length, last24, last7, optIn, roles, recent, settings: readSettings_() };
}

function adminSaveSettings(changes) {
  writeSettings_(changes || {});
  return readSettings_();
}
