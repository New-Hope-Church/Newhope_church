/**
 * New Hope Church — website forms (Google Apps Script web app).
 *
 * This is the Google side of the Youth Camp registration form
 * (youth-camp-register.html) and of the Bank Transfer / Digital Wallets forms
 * on the Give page (give.html). It is NOT loaded by the website; it has to be
 * pasted into the Apps Script project that the forms post to (the /exec URL in
 * js/script.js).
 *
 * Give page (form = "giving"): saves the person's name and email in the
 *   "Giving requests" tab and emails them the church's bank details (Bank
 *   Transfer) or the giving QR code (Digital Wallets).
 *
 * Youth Camp:
 *   Step 1 (stage = "details"): saves the camper's details as a row with the
 *     status "Waiting for payment", and emails them the payment QR code if
 *     QR_FILE_ID is filled in below. If it is left empty, no email is sent
 *     automatically — send the QR yourself from the church mailbox.
 *   Step 2 (stage = "payment"): saves the payment screenshot to a Drive folder,
 *     and updates the same row with a link to it and the status
 *     "Payment screenshot received".
 *
 * How to install:
 *   1. Open the registrations Google Sheet > Extensions > Apps Script.
 *      (Sign in with the church's official Google account: the QR email is
 *      sent from whichever account owns this script.)
 *   2. Replace the existing code with this whole file and fill in the settings.
 *   3. Deploy > Manage deployments > edit (pencil) > Version: "New version" >
 *      Deploy. Editing the existing deployment keeps the same /exec URL, so the
 *      website does not need to change. Approve the new permissions when asked
 *      (Sheets, Drive, and sending email).
 */

// ---- Settings ---------------------------------------------------------------

// The spreadsheet everything is saved to (the long part of its URL). The
// account that deploys this script needs edit access to it. Leave empty to
// use the sheet this script was opened from (Extensions > Apps Script).
var SPREADSHEET_ID = '1g2fsaEzzjMD-0O7z9SrJSyWFsLPmIgGJeIKc6LZ096Y';

// Registrations are written to this tab. It is created on first use, so rows
// from the earlier version of the form are left untouched in their own tab.
var SHEET_NAME = 'Youth Camp registrations';

// Drive folder (created on first use) where payment screenshots are stored.
var SCREENSHOT_FOLDER = 'Youth Camp payment screenshots';

// Drive file ID of the payment QR image. Upload the QR image to Drive, open it,
// and copy the ID from its link (.../file/d/THIS_PART/view).
// Leave empty to send the QR by hand instead.
var QR_FILE_ID = '1u7ZR7ENomutUv_IUFwrTHTEFMFKIalAw';

// Used in the wording of the email.
var CAMP_NAME = 'New Hope Youth Camp 2026';
var CAMP_DATES = 'Monday to Wednesday, 9-11 November 2026';
var FEE = 'Rs. 1,500';
var REPLY_TO = 'newhopekavre@gmail.com';

// ---- Give page ----

// Requests from the Give page are written to this tab (created on first use).
var GIVING_SHEET_NAME = 'Giving requests';

// The church's bank details, emailed to people who choose Bank Transfer. Fill
// these in; a line left empty is left out of the email. Until the account
// number is filled in, no bank email is sent automatically.
var BANK_DETAILS = {
  'Account name': '',
  'Account number': '',
  'Bank': '',
  'Branch': '',
  'SWIFT / BIC code': ''
};

// Drive file ID of the QR image emailed to people who choose Digital Wallets.
// It starts out as the same QR as the camp payment; paste a different ID here
// if giving uses its own QR.
var GIVING_QR_FILE_ID = QR_FILE_ID;

// -----------------------------------------------------------------------------

var HEADERS = [
  'Registration ID', 'Received', 'Status', 'Name', 'Age', 'Gender', 'Phone',
  'Email', 'Home church', 'Guardian name', 'Guardian phone',
  'Emergency contact name', 'Emergency contact phone', 'T-shirt size', 'Notes',
  'Consent', 'QR emailed', 'Screenshot received', 'Payment screenshot'
];

var GIVING_HEADERS = [
  'Received', 'Name', 'Email', 'Phone', 'Giving option', 'Method', 'Email sent'
];

// Form field name -> column header.
var FIELDS = {
  name: 'Name', age: 'Age', gender: 'Gender', phone: 'Phone', email: 'Email',
  home_church: 'Home church', guardian_name: 'Guardian name',
  guardian_phone: 'Guardian phone', emergency_name: 'Emergency contact name',
  emergency_phone: 'Emergency contact phone', tshirt_size: 'T-shirt size',
  notes: 'Notes', consent: 'Consent'
};

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = (e && e.parameter) || {};

    // Spam trap: real visitors never fill the hidden "website" field.
    if (p.website) { return reply({ ok: true }); }
    if (p.form === 'giving') { return reply(saveGivingRequest(p)); }
    if (!p.name || !p.phone) { return reply({ ok: false, error: 'missing fields' }); }

    var sheet = getSheet(SHEET_NAME, HEADERS);
    var regId = p.reg_id || ('YC-' + new Date().getTime());
    var rowIndex = findRow(sheet, regId);
    var row = rowIndex
      ? sheet.getRange(rowIndex, 1, 1, HEADERS.length).getDisplayValues()[0]
      : HEADERS.map(function () { return ''; });

    var set = function (header, value) { row[HEADERS.indexOf(header)] = value; };
    var get = function (header) { return row[HEADERS.indexOf(header)]; };

    set('Registration ID', regId);
    if (!get('Received')) { set('Received', now()); }
    Object.keys(FIELDS).forEach(function (key) {
      if (p[key] !== undefined) { set(FIELDS[key], p[key]); }
    });

    if (p.stage === 'payment') {
      if (!p.screenshot) { return reply({ ok: false, error: 'missing screenshot' }); }
      var blob = Utilities.newBlob(
        Utilities.base64Decode(p.screenshot), 'image/jpeg', regId + ' - ' + p.name + '.jpg'
      );
      var file = getFolder().createFile(blob);
      set('Payment screenshot', file.getUrl());
      set('Screenshot received', now());
      set('Status', 'Payment screenshot received - check and confirm');
    } else {
      if (!get('Status')) { set('Status', 'Waiting for payment'); }
      if (get('QR emailed') !== 'Yes') { set('QR emailed', sendQrEmail(p)); }
    }

    // Written as plain text so phone numbers like "+977 98..." stay as typed.
    var range = sheet.getRange(rowIndex || sheet.getLastRow() + 1, 1, 1, HEADERS.length);
    range.setNumberFormat('@');
    range.setValues([row]);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Opening the /exec URL in a browser shows this, as a quick "is it deployed?" check.
function doGet() {
  return ContentService.createTextOutput('New Hope Youth Camp registration is running.');
}

function sendQrEmail(p) {
  if (!QR_FILE_ID) { return 'No - send by hand'; }
  if (!p.email) { return 'No - no email given'; }
  try {
    var qr = DriveApp.getFileById(QR_FILE_ID).getBlob().setName('payment-qr');
    var thanks = 'Thank you for submitting your registration for ' + CAMP_NAME + ' (' +
      CAMP_DATES + '). We have received your details and are glad you plan to join us.';
    var pay = 'To confirm your place, please pay the registration fee of ' + FEE +
      ' using the QR code below.';
    var remarks = p.name + ' - ' + (p.home_church || 'your church name');
    var steps = [
      'Scan the QR code with your banking or wallet app and pay ' + FEE + '.',
      'In the payment remarks, write your full name and your church name' +
        ' (for example: ' + remarks + '), so we can match the payment to you.',
      'Return to the Youth Camp registration page on our website.',
      'Upload a screenshot of your payment confirmation and submit the form.'
    ];
    var after = 'Your place is confirmed once we have received your payment' +
      ' confirmation. If you have any questions, simply reply to this email.';
    var signOff = 'Yours in Christ,';

    MailApp.sendEmail({
      to: p.email,
      replyTo: REPLY_TO,
      name: 'New Hope Church',
      subject: 'Thank you for registering - ' + CAMP_NAME + ' payment details',
      body: 'Dear ' + p.name + ',\n\n' + thanks + '\n\n' + pay +
        ' (The QR code is attached to this email.)\n\n' +
        steps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') +
        '\n\n' + after + '\n\n' + signOff + '\nNew Hope Church\n' + REPLY_TO,
      htmlBody: '<div style="font-family:Arial,sans-serif; font-size:15px; line-height:1.6; color:#000; max-width:560px;">' +
        '<p>Dear ' + escapeHtml(p.name) + ',</p>' +
        '<p>' + thanks + '</p>' +
        '<p>' + pay + '</p>' +
        '<p><img src="cid:qr" alt="Payment QR code" style="max-width:280px; border:1px solid #e5e5e5;"></p>' +
        '<ol>' + steps.map(function (s) { return '<li>' + escapeHtml(s) + '</li>'; }).join('') + '</ol>' +
        '<p>' + after + '</p>' +
        '<p>' + signOff + '<br><strong>New Hope Church</strong><br>' + REPLY_TO + '</p>' +
        '</div>',
      inlineImages: { qr: qr },
      attachments: [qr]
    });
    return 'Yes';
  } catch (err) {
    return 'FAILED - send by hand (' + err + ')';
  }
}

// ---- Give page --------------------------------------------------------------

function saveGivingRequest(p) {
  if (!p.name || !p.email) { return { ok: false, error: 'missing fields' }; }
  var bank = p.method === 'bank';
  var fund = p.fund === 'special' ? 'Special Offering' : 'Tithes & Offerings';
  var sent = bank ? sendBankEmail(p, fund) : sendGivingQrEmail(p, fund);

  var sheet = getSheet(GIVING_SHEET_NAME, GIVING_HEADERS);
  var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, GIVING_HEADERS.length);
  range.setNumberFormat('@');
  range.setValues([[
    now(), p.name, p.email, p.phone || '', fund,
    bank ? 'Bank transfer' : 'Digital wallet', sent
  ]]);
  return { ok: true };
}

// Shared wording and layout of the two giving emails. `middle` is the part that
// differs: { text: plain-text version, html: HTML version }.
function sendGivingEmail(p, fund, subject, intro, middle, options) {
  var remarks = p.name + ' - ' + fund;
  var remark = 'In the payment remarks, please write your name and the type of' +
    ' giving (for example: ' + remarks + '), so we can record your gift correctly.';
  var after = 'Thank you for your generosity. If you have any questions, simply' +
    ' reply to this email.';
  var mail = {
    to: p.email,
    replyTo: REPLY_TO,
    name: 'New Hope Church',
    subject: subject,
    body: 'Dear ' + p.name + ',\n\n' + intro + '\n\n' + middle.text + '\n\n' + remark +
      '\n\n' + after + '\n\nYours in Christ,\nNew Hope Church\n' + REPLY_TO,
    htmlBody: '<div style="font-family:Arial,sans-serif; font-size:15px; line-height:1.6; color:#000; max-width:560px;">' +
      '<p>Dear ' + escapeHtml(p.name) + ',</p>' +
      '<p>' + escapeHtml(intro) + '</p>' + middle.html +
      '<p>' + escapeHtml(remark) + '</p>' +
      '<p>' + after + '</p>' +
      '<p>Yours in Christ,<br><strong>New Hope Church</strong><br>' + REPLY_TO + '</p>' +
      '</div>'
  };
  Object.keys(options || {}).forEach(function (k) { mail[k] = options[k]; });
  MailApp.sendEmail(mail);
}

function sendBankEmail(p, fund) {
  if (!BANK_DETAILS['Account number']) { return 'No - bank details not filled in, send by hand'; }
  try {
    var lines = Object.keys(BANK_DETAILS).filter(function (k) { return BANK_DETAILS[k]; });
    sendGivingEmail(p, fund,
      'New Hope Church - bank details for your giving',
      'Thank you for your desire to give to New Hope Church (' + fund +
        '). You can give by bank transfer using the details below.',
      {
        text: lines.map(function (k) { return k + ': ' + BANK_DETAILS[k]; }).join('\n'),
        html: '<table style="border-collapse:collapse; margin:8px 0 16px;">' +
          lines.map(function (k) {
            return '<tr><td style="padding:6px 16px 6px 0; color:#666;">' + k + '</td>' +
              '<td style="padding:6px 0;"><strong>' + escapeHtml(BANK_DETAILS[k]) + '</strong></td></tr>';
          }).join('') + '</table>'
      });
    return 'Yes';
  } catch (err) {
    return 'FAILED - send by hand (' + err + ')';
  }
}

function sendGivingQrEmail(p, fund) {
  if (!GIVING_QR_FILE_ID) { return 'No - QR not set, send by hand'; }
  try {
    var qr = DriveApp.getFileById(GIVING_QR_FILE_ID).getBlob().setName('giving-qr');
    sendGivingEmail(p, fund,
      'New Hope Church - QR code for your giving',
      'Thank you for your desire to give to New Hope Church (' + fund +
        '). You can scan the QR code below with your wallet or banking app to give.',
      {
        text: '(The QR code is attached to this email.)',
        html: '<p><img src="cid:qr" alt="Giving QR code" style="max-width:280px; border:1px solid #e5e5e5;"></p>'
      },
      { inlineImages: { qr: qr }, attachments: [qr] });
    return 'Yes';
  } catch (err) {
    return 'FAILED - send by hand (' + err + ')';
  }
}

// ---- Shared helpers ---------------------------------------------------------

// The tab with this name, created with its header row on first use.
function getSheet(name, headers) {
  var book = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getFolder() {
  var found = DriveApp.getFoldersByName(SCREENSHOT_FOLDER);
  return found.hasNext() ? found.next() : DriveApp.createFolder(SCREENSHOT_FOLDER);
}

// Row number of the registration with this ID, or 0 if there is none yet.
function findRow(sheet, regId) {
  var last = sheet.getLastRow();
  if (last < 2) { return 0; }
  var ids = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === regId) { return i + 2; }
  }
  return 0;
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy-MM-dd HH:mm');
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
