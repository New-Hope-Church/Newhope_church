/**
 * New Hope Church — Youth Camp photos (Google Apps Script web app).
 *
 * This is the Google side of the camp photo pages:
 *   camp-photos.html         campers scan the QR code, take photos and send
 *                            them, and browse and like the approved ones
 *                            (all photos, by team, by challenge)
 *   camp-photos-live.html    the projector slideshow of the camp album
 *   camp-photos-poster.html  printable QR poster
 * It is NOT loaded by the website; it is pasted into its own Apps Script
 * project, and the pages post to its /exec URL (NH_PHOTOS_ENDPOINT in
 * js/camp-photos.js). It is kept apart from the registration script on
 * purpose, so a problem here can never stop camp registrations.
 *
 * How it works (no logins anywhere):
 *   - Every photo a camper sends goes into the INBOX folder in the church's
 *     Google Drive. Only the church account (and leaders it is shared with)
 *     can see it.
 *   - Leaders open the Inbox in Google Drive and MOVE the good photos into the
 *     ALBUM folder. That is the approval.
 *   - The camper page shows what is in the album (and links to it in Drive,
 *     view only, for downloads), and so does the projector.
 *   - Likes are counted in the "Likes" tab (one row per photo).
 *   - Every photo is also listed in the "Uploads" tab of the sheet, with who
 *     sent it and when.
 *   - Today's challenge comes from the "Challenges" tab, and the team list
 *     from the "Teams" tab. Leaders can edit both at any time.
 *
 * How to install:
 *   1. Signed in as the church account, create a new Google Sheet (for
 *      example "Youth Camp 2026 photos") and open Extensions > Apps Script.
 *   2. Replace the code there with this whole file. Check the settings below.
 *   3. Deploy > New deployment > type "Web app". Execute as: Me. Who has
 *      access: Anyone. Deploy, approve the permissions (Sheets and Drive),
 *      and copy the web app URL (ends in /exec).
 *   4. Paste that URL into NH_PHOTOS_ENDPOINT at the top of js/camp-photos.js.
 *   5. Open the camper page once (or the /exec URL) so the two Drive folders
 *      and the sheet tabs are created.
 *   6. For leaders who use their own Gmail: in Google Drive, share BOTH
 *      folders with them as "Editor", so they can move photos between them.
 *   To change this code later: Deploy > Manage deployments > edit (pencil) >
 *   Version: "New version" > Deploy. That keeps the same /exec URL.
 */

// ---- Settings ---------------------------------------------------------------

// The spreadsheet the upload list, challenges and teams are kept in (the long
// part of its URL). Leave empty to use the sheet this script was opened from.
var SPREADSHEET_ID = '';

var CAMP_NAME = 'New Hope Youth Camp 2026';

// The date of Day 1 (yyyy-mm-dd) and how many days the camp lasts.
var CAMP_START = '2026-11-09';
var CAMP_DAYS = 3;

// Drive folders, created on first use. Campers' photos arrive in the inbox
// (private); leaders move the chosen ones into the album (view-only link).
var INBOX_FOLDER = 'Youth Camp 2026 - Inbox (leaders only)';
var ALBUM_FOLDER = 'Youth Camp 2026 Photos';

var TIME_ZONE = 'Asia/Kathmandu';

// Written into the "Teams" and "Challenges" tabs the first time they are
// created. After that, edit the tabs in the sheet instead.
var DEFAULT_TEAMS = [
  ['Red', '#E53935'], ['Blue', '#1E88E5'], ['Green', '#43A047'], ['Yellow', '#F9A825']
];
// [day (empty = every day), challenge]
var DEFAULT_CHALLENGES = [
  [1, 'Photo with your team leader'],
  [1, 'Best team pose'],
  [2, 'Photo with the camp youth leaders'],
  [2, 'Make a new friend — take a photo together'],
  [3, 'Caught someone serving'],
  [3, 'Your whole team in one photo']
];

// -----------------------------------------------------------------------------

var UPLOADS_SHEET = 'Uploads';
var TEAMS_SHEET = 'Teams';
var CHALLENGES_SHEET = 'Challenges';
var LIKES_SHEET = 'Likes';

var UPLOAD_HEADERS = ['Received', 'Day', 'Name', 'Team', 'Challenge', 'File', 'File ID'];
var TEAM_HEADERS = ['Team', 'Colour'];
var CHALLENGE_HEADERS = ['Day', 'Challenge'];
var LIKE_HEADERS = ['File ID', 'Likes'];

// Photo file names are "Day 2 · Red · Asha · Best team pose · k3x9.jpg"; the
// projector reads the team, name and challenge back from them.
var SEP = ' · ';

var FALLBACK_COLOURS = ['#E53935', '#1E88E5', '#43A047', '#F9A825', '#8E24AA', '#FB8C00', '#00897B', '#D81B60'];

function doPost(e) {
  var p = (e && e.parameter) || {};
  try {
    switch (p.action) {
      case 'info': return reply(info());
      case 'upload': return reply(upload(p));
      case 'album': return reply(album());
      case 'like': return reply(like(p));
      default: return reply({ ok: false, error: 'unknown action' });
    }
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

// Opening the /exec URL in a browser shows this, as a quick "is it deployed?"
// check. It also creates the folders and sheet tabs if they don't exist yet.
function doGet() {
  getInbox();
  CacheService.getScriptCache().remove('albumUrl');
  info();
  return ContentService.createTextOutput(CAMP_NAME + ' photos are running.');
}

// What the camper page shows: today's challenges, the teams, and the album link.
function info() {
  var day = campDay(new Date());
  var today = Math.max(1, Math.min(day, CAMP_DAYS));
  var cache = CacheService.getScriptCache();
  var albumUrl = cache.get('albumUrl');
  if (!albumUrl) {
    albumUrl = getAlbum().getUrl();
    cache.put('albumUrl', albumUrl, 6 * 60 * 60);
  }
  return {
    ok: true,
    camp: CAMP_NAME,
    day: day,
    days: CAMP_DAYS,
    challenges: readChallenges()
      .filter(function (c) { return !c.day || c.day === today; })
      .map(function (c) { return c.title; }),
    teams: readTeams(),
    albumUrl: albumUrl
  };
}

function upload(p) {
  if (!p.photo) { return { ok: false, error: 'missing photo' }; }
  if (p.photo.length > 8000000) { return { ok: false, error: 'photo too large' }; }

  var day = campDay(new Date());
  var name = clean(p.name, 30);
  var team = clean(p.team, 30);
  if (team && !readTeams().some(function (t) { return t.name === team; })) { team = ''; }
  var challenge = clean(p.challenge, 80);

  var tag = Math.random().toString(36).slice(2, 6);
  var parts = [dayLabel(day), team, name, challenge, tag].map(function (s) { return s || '-'; });
  var blob = Utilities.newBlob(Utilities.base64Decode(p.photo), 'image/jpeg', parts.join(SEP) + '.jpg');
  var file = getInbox().createFile(blob);

  withLock(function () {
    var sheet = getSheet(UPLOADS_SHEET, UPLOAD_HEADERS);
    // Written as plain text so a name can never turn into a formula.
    var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, UPLOAD_HEADERS.length);
    range.setNumberFormat('@');
    range.setValues([[now(), String(day), name, team, challenge, file.getUrl(), file.getId()]]);
  });
  return { ok: true };
}

// The photos in the album (newest first) with their likes, for the camper
// page and the projector. Cached for a few seconds, because every open page
// asks for it regularly.
function album() {
  var cache = CacheService.getScriptCache();
  var cached = cacheGetBig('album');
  if (cached) { return JSON.parse(cached); }

  var folder = getAlbum();
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (!/^image\//.test(f.getMimeType())) { continue; }
    files.push({ file: f, time: f.getDateCreated().getTime() });
  }
  files.sort(function (a, b) { return b.time - a.time; });

  var likes = readLikes();
  var photos = files.map(function (x) {
    var id = x.file.getId();
    makeViewable(x.file, cache);
    var parts = x.file.getName().replace(/\.[a-z]+$/i, '').split(SEP);
    var clear = function (s) { return s && s !== '-' ? s : ''; };
    var day = parts.length === 5 ? Number((/^Day (\d+)$/.exec(parts[0]) || [])[1]) || 0 : 0;
    return parts.length === 5
      ? { f: id, d: day, t: clear(parts[1]), n: clear(parts[2]), c: clear(parts[3]), l: likes[id] || 0 }
      : { f: id, d: 0, t: '', n: '', c: '', l: likes[id] || 0 };
  });

  var result = { ok: true, camp: CAMP_NAME, days: CAMP_DAYS, teams: readTeams(), photos: photos,
    albumUrl: folder.getUrl() };
  cachePutBig('album', JSON.stringify(result), 20);
  return result;
}

// A like (delta 1) or an unlike (delta -1). Each phone remembers what it has
// liked, so each person counts once.
function like(p) {
  var delta = Number(p.delta) === -1 ? -1 : 1;
  if (!p.id) { return { ok: false, error: 'missing id' }; }
  return withLock(function () {
    var sheet = getSheet(LIKES_SHEET, LIKE_HEADERS);
    var cell = sheet.getRange('A:A').createTextFinder(String(p.id)).matchEntireCell(true).findNext();
    if (cell && cell.getRow() > 1) {
      var count = sheet.getRange(cell.getRow(), 2);
      count.setValue(Math.max(0, (Number(count.getValue()) || 0) + delta));
    } else if (delta > 0) {
      var range = sheet.getRange(sheet.getLastRow() + 1, 1, 1, 2);
      range.setNumberFormat('@');
      range.setValues([[String(p.id), '1']]);
    }
    return { ok: true };
  });
}

function readLikes() {
  var sheet = getSheet(LIKES_SHEET, LIKE_HEADERS);
  var last = sheet.getLastRow();
  var likes = {};
  if (last < 2) { return likes; }
  sheet.getRange(2, 1, last - 1, 2).getDisplayValues().forEach(function (v) {
    likes[v[0]] = Number(v[1]) || 0;
  });
  return likes;
}

// Photos moved into the album normally take on its "anyone with the link"
// sharing. Set it on the file too, to be sure the projector can show it.
function makeViewable(file, cache) {
  var key = 'shared-' + file.getId();
  if (cache.get(key)) { return; }
  try {
    if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }
    cache.put(key, '1', 6 * 60 * 60);
  } catch (err) { /* leave it; the projector skips photos it can't load */ }
}

// ---- Sheet tabs -------------------------------------------------------------

function readTeams() {
  var sheet = getSheet(TEAMS_SHEET, TEAM_HEADERS, DEFAULT_TEAMS);
  var last = sheet.getLastRow();
  if (last < 2) { return []; }
  return sheet.getRange(2, 1, last - 1, 2).getDisplayValues()
    .filter(function (v) { return String(v[0]).trim(); })
    .map(function (v, i) {
      var colour = String(v[1]).trim();
      return {
        name: String(v[0]).trim().replace(/·/g, ''),
        colour: /^#[0-9a-f]{3,8}$/i.test(colour) ? colour : FALLBACK_COLOURS[i % FALLBACK_COLOURS.length]
      };
    });
}

function readChallenges() {
  var sheet = getSheet(CHALLENGES_SHEET, CHALLENGE_HEADERS, DEFAULT_CHALLENGES);
  var last = sheet.getLastRow();
  if (last < 2) { return []; }
  return sheet.getRange(2, 1, last - 1, 2).getDisplayValues()
    .filter(function (v) { return String(v[1]).trim(); })
    .map(function (v) { return { day: Number(v[0]) || 0, title: String(v[1]).trim() }; });
}

// ---- Helpers ----------------------------------------------------------------

function book() {
  return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
}

// The tab with this name, created with its header row (and starting rows) on first use.
function getSheet(name, headers, startRows) {
  var b = book();
  var sheet = b.getSheetByName(name);
  if (!sheet) {
    sheet = b.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    if (startRows && startRows.length) {
      sheet.getRange(2, 1, startRows.length, headers.length).setValues(startRows);
    }
  }
  return sheet;
}

function getFolder(name) {
  var found = DriveApp.getFoldersByName(name);
  return found.hasNext() ? found.next() : DriveApp.createFolder(name);
}

function getInbox() {
  return getFolder(INBOX_FOLDER);
}

// The album can be opened by anyone with its link, view only.
function getAlbum() {
  var folder = getFolder(ALBUM_FOLDER);
  if (folder.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  return folder;
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// 1 on the first camp day; 0 or less before the camp, more than CAMP_DAYS after.
function campDay(date) {
  var today = Utilities.formatDate(date, TIME_ZONE, 'yyyy-MM-dd');
  return Math.round((Date.parse(today) - Date.parse(CAMP_START)) / 86400000) + 1;
}

function dayLabel(day) {
  if (day < 1) { return 'Before camp'; }
  if (day > CAMP_DAYS) { return 'After camp'; }
  return 'Day ' + day;
}

// Trims the text, and removes line breaks and the "·" used in file names.
function clean(text, max) {
  return String(text || '').replace(/[\u0000-\u001f·\/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function now() {
  return Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm');
}

// CacheService keeps at most 100 KB per entry, so long text is split up.
var CACHE_PART = 20000;

function cachePutBig(key, text, seconds) {
  var parts = {};
  var n = 0;
  for (var i = 0; i < text.length; i += CACHE_PART) { parts[key + ':' + n++] = text.slice(i, i + CACHE_PART); }
  parts[key + ':n'] = String(n);
  CacheService.getScriptCache().putAll(parts, seconds);
}

function cacheGetBig(key) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key + ':n'));
  if (!n) { return null; }
  var keys = [];
  for (var i = 0; i < n; i++) { keys.push(key + ':' + i); }
  var got = cache.getAll(keys);
  var text = '';
  for (var j = 0; j < n; j++) {
    if (got[keys[j]] == null) { return null; }
    text += got[keys[j]];
  }
  return text;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
