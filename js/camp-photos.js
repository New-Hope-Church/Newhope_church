// Youth Camp photos. One script for its three pages, chosen by the
// data-photos attribute on <body>:
//   camper  camp-photos.html         take photos and send them; today's
//                                    challenge; browse and like the approved
//                                    photos (all, by team, by challenge)
//   live    camp-photos-live.html    projector slideshow of the camp album
//   poster  camp-photos-poster.html  printable QR poster
// There are no logins. Photos go to an inbox folder in the church's Google
// Drive, and leaders move the ones they choose into the camp album folder.
// The Google side is apps-script/camp-photos.gs. Paste its web app URL (ends
// in /exec) between the quotes below.
var NH_PHOTOS_ENDPOINT = '';

(function () {
  var ME_KEY = 'nhCampMe';
  var MAX_FILES = 10;

  // ---- Shared helpers ------------------------------------------------------

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }

  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore if storage is unavailable */ }
  }

  function t(en, np) {
    return typeof nhGetLang === 'function' && nhGetLang() === 'np' && np ? np : en;
  }

  function npDigits(n) {
    return String(n).replace(/[0-9]/g, function (d) { return '०१२३४५६७८९'.charAt(d); });
  }

  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) { e.className = className; }
    if (text != null) { e.textContent = text; }
    return e;
  }

  function $(id) { return document.getElementById(id); }

  function hide(e, hidden) { if (e) { e.classList.toggle('cp-hidden', !!hidden); } }

  function api(action, data) {
    if (!NH_PHOTOS_ENDPOINT) { return Promise.reject(new Error('not set up')); }
    var body = new URLSearchParams();
    body.append('action', action);
    Object.keys(data || {}).forEach(function (k) { body.append(k, data[k] == null ? '' : data[k]); });
    return fetch(NH_PHOTOS_ENDPOINT, { method: 'POST', body: body })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (!json || !json.ok) { throw new Error((json && json.error) || 'failed'); }
        return json;
      });
  }

  // Photos in the camp album can be opened by anyone with the link.
  function photoUrl(fileId, width) {
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w' + width;
  }

  function fallbackPhotoUrl(fileId, width) {
    return 'https://lh3.googleusercontent.com/d/' + encodeURIComponent(fileId) + '=w' + width;
  }

  function downloadUrl(fileId) {
    return 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
  }

  function setPhoto(img, fileId, width) {
    img.onerror = function () {
      img.onerror = null;
      img.src = fallbackPhotoUrl(fileId, width);
    };
    img.src = photoUrl(fileId, width);
  }

  function teamColour(teams, name) {
    var team = (teams || []).filter(function (x) { return x.name === name; })[0];
    return team ? team.colour : '#000';
  }

  // Link to the camper page next to this one (what the QR codes open).
  function camperUrl() {
    var local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    var dir = location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '');
    return dir + 'camp-photos' + (local ? '.html' : '');
  }

  function drawQr(box, text) {
    if (!box || typeof QRCode === 'undefined') { return; }
    box.innerHTML = '';
    new QRCode(box, { text: text, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
  }

  // Shrinks a photo so it uploads quickly; resolves with base64 JPEG data.
  // Drawing it on a canvas also drops the location and other hidden details.
  function shrink(file, max) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('not an image')); };
      img.onload = function () {
        var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1]);
      };
      img.src = url;
    });
  }

  function confetti(colours) {
    var box = el('div', 'cp-confetti');
    box.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 90; i++) {
      var bit = el('i');
      bit.style.left = (Math.random() * 100) + 'vw';
      bit.style.background = colours[i % colours.length];
      bit.style.animationDuration = (1.8 + Math.random() * 1.8) + 's';
      bit.style.animationDelay = (Math.random() * 0.4) + 's';
      bit.style.transform = 'rotate(' + Math.round(Math.random() * 360) + 'deg)';
      box.appendChild(bit);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.parentNode.removeChild(box); }, 4500);
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var x = list[i]; list[i] = list[j]; list[j] = x;
    }
    return list;
  }

  // Calls fn every `ms` while the page is on screen.
  function every(ms, fn) {
    setInterval(function () { if (document.visibilityState === 'visible') { fn(); } }, ms);
  }

  // ---- Camper page ---------------------------------------------------------
  // Home (#): slideshow of approved photos, camera, today's challenge.
  // Memories (#memories, #memories/teams[/name], #memories/challenges[/title]):
  // the approved photos, all together or as one album per team / challenge.

  function camper() {
    var LIKED_KEY = 'nhCampLiked';
    var info = null;
    var album = null;
    var byId = {};
    var me = load(ME_KEY) || { name: '', team: '' };
    var liked = load(LIKED_KEY) || {};
    var pending = {};        // file id -> { base, delta }: likes not yet in the server's count
    var challenge = '';
    var sending = false;

    var cameraBtn = $('cp-camera-btn'), galleryBtn = $('cp-gallery-btn');
    var camera = $('cp-camera'), gallery = $('cp-file');
    var msg = $('cp-msg');
    var viewer = $('cp-viewer');

    function say(text, kind) {
      msg.textContent = text;
      msg.className = 'cp-msg' + (kind ? ' ' + kind : '');
    }

    function photosText(n) {
      return n === 1 ? t('1 photo', '१ फोटो') : t(n + ' photos', npDigits(n) + ' फोटो');
    }

    // -- Loading

    function loadInfo() {
      return api('info').then(function (i) {
        info = i;
        renderHome();
      }, function (err) {
        if (err.message === 'not set up') {
          cameraBtn.disabled = true;
          galleryBtn.disabled = true;
          say(t('Photo sending is not switched on yet. Please check again soon.', 'फोटो पठाउने सुविधा अझै सुरु भएको छैन। कृपया केही समयपछि फेरि हेर्नुहोस्।'), 'err');
        }
        // Otherwise the camera still works; the upload will try again.
      });
    }

    function loadAlbum() {
      return api('album').then(function (a) {
        album = a;
        byId = {};
        a.photos.forEach(function (p) { byId[p.f] = p; });
        renderHome();
        renderMemories();
        if (viewer.open) { renderViewer(); }
        renderReel();
      }, function () {
        if (!album) { renderMemories(); }
      });
    }

    // -- Likes

    function likeCount(photo) {
      var p = pending[photo.f];
      if (p && photo.l === p.base) { return Math.max(0, p.base + p.delta); }
      delete pending[photo.f];
      return photo.l;
    }

    function toggleLike(photo, onlyLike) {
      var on = !!liked[photo.f];
      if (on && onlyLike) { return; }
      var delta = on ? -1 : 1;
      var now = likeCount(photo);
      pending[photo.f] = { base: photo.l, delta: now - photo.l + delta };
      if (on) { delete liked[photo.f]; } else { liked[photo.f] = true; }
      save(LIKED_KEY, liked);
      api('like', { id: photo.f, delta: delta }).catch(function () { /* the like still shows here */ });
      renderViewer();
      var thumb = document.querySelector('.cp-thumb[data-f="' + photo.f + '"] .cp-thumb-likes');
      if (thumb) { thumb.textContent = likeLabel(photo); }
      if (!on) {
        var b = $('cp-like');
        b.classList.remove('pop');
        void b.offsetWidth;
        b.classList.add('pop');
      }
    }

    function likeLabel(photo) {
      var n = likeCount(photo);
      return n ? '♥︎ ' + n : '';
    }

    // -- Home

    function renderHome() {
      renderMe();
      if (info) {
        var day = info.day;
        $('cp-meta').textContent = (day >= 1 && day <= info.days ? t('Day ' + day, 'दिन ' + npDigits(day)) + ' · ' : '') +
          t('9–11 November · Colossians 2:7', '९–११ नोभेम्बर · कलस्सी २:७');

        var list = $('cp-challenges');
        list.innerHTML = '';
        info.challenges.forEach(function (title) {
          var b = el('button', 'cp-challenge', title);
          b.type = 'button';
          b.setAttribute('aria-pressed', String(title === challenge));
          b.addEventListener('click', function () {
            if (sending) { return; }
            challenge = title;
            renderHome();
            camera.click();
          });
          list.appendChild(b);
        });
        hide($('cp-today'), !info.challenges.length);
      }
      var badge = $('cp-mem-badge');
      var count = album ? album.photos.length : 0;
      badge.textContent = typeof nhGetLang === 'function' && nhGetLang() === 'np' ? npDigits(count) : String(count);
      hide(badge, !count);
    }

    function renderMe() {
      var box = $('cp-team-picker');
      box.innerHTML = '';
      ((info && info.teams) || []).forEach(function (team) {
        var b = el('button', 'cp-team-btn');
        b.type = 'button';
        b.style.setProperty('--team', team.colour);
        b.setAttribute('aria-pressed', String(team.name === me.team));
        b.appendChild(el('span', 'cp-team-dot'));
        b.appendChild(document.createTextNode(team.name));
        b.addEventListener('click', function () {
          me.team = me.team === team.name ? '' : team.name;
          save(ME_KEY, me);
          renderHome();
        });
        box.appendChild(b);
      });
      $('cp-me-summary').textContent = [me.name, me.team && t('Team ', 'टिम ') + me.team].filter(Boolean).join(' · ');
    }

    // Approved photos slide by on the home screen as tall cards, newest
    // first. Only rebuilt when the photos change, so the motion doesn't jump.
    var reelKey = '';
    var reel = $('cp-reel');

    function renderReel() {
      var list = album ? album.photos.slice(0, 24) : [];
      var key = list.map(function (p) { return p.f + ':' + likeCount(p); }).join() + '|' +
        (typeof nhGetLang === 'function' ? nhGetLang() : '');
      if (key === reelKey) { return; }
      reelKey = key;

      var track = $('cp-reel-track');
      track.innerHTML = '';
      $('cp-show').classList.toggle('has-photos', list.length > 0);
      hide($('cp-show-empty'), list.length > 0);
      hide(reel, !list.length);
      if (!list.length) { return; }

      // Enough cards to fill the row even with only a few photos.
      var set = list;
      while (set.length < 6) { set = set.concat(list); }
      var ids = list.map(function (p) { return p.f; });
      [false, true].forEach(function (copy) {
        set.forEach(function (photo) {
          var card = el('button', 'cp-card');
          card.type = 'button';
          if (copy) { card.setAttribute('aria-hidden', 'true'); card.tabIndex = -1; }
          var img = el('img');
          img.alt = '';
          setPhoto(img, photo.f, 800);
          card.appendChild(img);
          var title = photo.c || (photo.t ? t('Team ', 'टिम ') + photo.t : '') || photo.n || t('Youth Camp 2026', 'Youth Camp २०२६');
          card.appendChild(el('span', 'cp-card-title', title));
          var pill = el('span', 'cp-card-pill');
          var likes = likeCount(photo);
          if (likes) {
            pill.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8 2.9c0 6.1-8 11-8 11z"/></svg>';
            pill.appendChild(document.createTextNode(likes + ' · '));
          }
          pill.appendChild(document.createTextNode(t('See photo', 'फोटो हेर्नुहोस्')));
          card.appendChild(pill);
          card.setAttribute('aria-label', [title, photo.n].filter(Boolean).join(' · '));
          card.addEventListener('click', function () { openViewer(ids, photo.f); });
          track.appendChild(card);
        });
      });
      // About 4 seconds per card, whatever the number of photos.
      track.style.setProperty('--dur', (set.length * 4) + 's');
    }

    // On a phone, a finger on the reel holds it still for a moment.
    var holdTimer = null;
    reel.addEventListener('touchstart', function () {
      clearTimeout(holdTimer);
      reel.classList.add('held');
    }, { passive: true });
    reel.addEventListener('touchend', function () {
      holdTimer = setTimeout(function () { reel.classList.remove('held'); }, 2500);
    });

    // -- Memories

    function route() {
      var parts = location.hash.replace(/^#/, '').split('/').map(function (s) {
        try { return decodeURIComponent(s); } catch (e) { return s; }
      });
      return {
        memories: parts[0] === 'memories',
        tab: parts[1] === 'teams' || parts[1] === 'challenges' ? parts[1] : 'all',
        key: parts[2] || ''
      };
    }

    function link(tab, key) {
      return '#memories' + (tab !== 'all' ? '/' + tab : '') + (key ? '/' + encodeURIComponent(key) : '');
    }

    function show() {
      var r = route();
      hide($('cp-home'), r.memories);
      hide($('cp-memories'), !r.memories);
      if (viewer.open) { viewer.close(); }
      window.scrollTo(0, 0);
      renderMemories();
    }

    function renderMemories() {
      var r = route();
      if (!r.memories) { return; }

      document.querySelectorAll('#cp-mem-tabs a').forEach(function (a) {
        a.classList.toggle('on', a.getAttribute('data-tab') === r.tab);
      });
      $('cp-back').href = r.key ? link(r.tab) : '#';

      var title = $('cp-mem-title');
      title.innerHTML = '';
      if (r.key && r.tab === 'teams' && album) {
        var dot = el('span', 'cp-team-dot');
        dot.style.setProperty('--team', teamColour(album.teams, r.key));
        dot.style.width = dot.style.height = '18px';
        title.appendChild(dot);
      }
      title.appendChild(document.createTextNode(r.key
        ? (r.tab === 'teams' ? t('Team ', 'टिम ') + r.key : r.key)
        : t('Memories', 'सम्झनाहरू')));

      var empty = $('cp-empty');
      if (!album) {
        $('cp-mem-count').textContent = '';
        hide($('cp-albums'), true);
        $('cp-grid').innerHTML = '';
        empty.textContent = NH_PHOTOS_ENDPOINT
          ? t('Loading photos…', 'फोटोहरू लोड हुँदैछन्…')
          : t('Photos are not switched on yet.', 'फोटोहरू अझै सुरु भएका छैनन्।');
        hide(empty, false);
        return;
      }
      $('cp-drive-link').href = album.albumUrl;
      hide($('cp-drive-link'), false);

      if (r.tab === 'all' || r.key) {
        var list = album.photos.filter(function (p) {
          return r.tab === 'all' || (r.tab === 'teams' ? p.t : p.c) === r.key;
        });
        $('cp-mem-count').textContent = photosText(list.length);
        hide($('cp-albums'), true);
        renderGrid(list);
        empty.textContent = t('No photos here yet. Take one and send it in!', 'यहाँ अहिलेसम्म कुनै फोटो छैन। एउटा खिचेर पठाउनुहोस्!');
        hide(empty, list.length > 0);
      } else {
        $('cp-grid').innerHTML = '';
        var groups = albumGroups(r.tab);
        $('cp-mem-count').textContent = r.tab === 'teams'
          ? t('One album for each team', 'हरेक टिमको एउटा एल्बम')
          : t('One album for each challenge', 'हरेक चुनौतीको एउटा एल्बम');
        renderAlbums(r.tab, groups);
        empty.textContent = t('No challenge photos yet.', 'अहिलेसम्म चुनौतीका फोटो छैनन्।');
        hide(empty, groups.length > 0);
      }
    }

    // [{ name, photos, colour }] for the Teams or Challenges tab.
    function albumGroups(tab) {
      var groups = {};
      var order = [];
      if (tab === 'teams') {
        album.teams.forEach(function (team) { groups[team.name] = { name: team.name, colour: team.colour, photos: [] }; order.push(team.name); });
      }
      album.photos.forEach(function (p) {
        var key = tab === 'teams' ? p.t : p.c;
        if (!key) { return; }
        if (!groups[key]) { groups[key] = { name: key, colour: tab === 'teams' ? teamColour(album.teams, key) : '', photos: [] }; order.push(key); }
        groups[key].photos.push(p);
      });
      var list = order.map(function (k) { return groups[k]; });
      if (tab === 'challenges') { list.sort(function (a, b) { return b.photos.length - a.photos.length; }); }
      return list;
    }

    function renderAlbums(tab, groups) {
      var box = $('cp-albums');
      box.innerHTML = '';
      groups.forEach(function (g) {
        var a = el('a', 'cp-album');
        a.href = link(tab, g.name);
        if (g.colour) { a.style.setProperty('--team', g.colour); }
        // the most liked photo makes the cover
        var cover = g.photos.slice().sort(function (x, y) { return likeCount(y) - likeCount(x); })[0];
        if (cover) {
          var img = el('img');
          img.alt = '';
          img.loading = 'lazy';
          setPhoto(img, cover.f, 600);
          a.appendChild(img);
        }
        a.appendChild(el('span', 'cp-album-title', tab === 'teams' ? t('Team ', 'टिम ') + g.name : g.name));
        var foot = el('span', 'cp-album-foot');
        foot.appendChild(el('span', '', g.photos.length ? photosText(g.photos.length) : t('No photos yet', 'अहिलेसम्म फोटो छैन')));
        if (tab === 'teams') { foot.appendChild(el('span', 'cp-team-dot')); }
        a.appendChild(foot);
        box.appendChild(a);
      });
      hide(box, false);
    }

    // Updates the grid in place, so photos already loaded don't flicker.
    function renderGrid(list) {
      var grid = $('cp-grid');
      var ids = list.map(function (p) { return p.f; });
      var existing = {};
      Array.prototype.forEach.call(grid.children, function (c) { existing[c.getAttribute('data-f')] = c; });
      list.forEach(function (photo) {
        var card = existing[photo.f];
        delete existing[photo.f];
        if (!card) {
          card = el('button', 'cp-thumb');
          card.type = 'button';
          card.setAttribute('data-f', photo.f);
          var img = el('img');
          img.loading = 'lazy';
          img.alt = [photo.n, photo.c].filter(Boolean).join(' · ') || 'Camp photo';
          setPhoto(img, photo.f, 400);
          card.appendChild(img);
          card.appendChild(el('span', 'cp-thumb-likes'));
        }
        card.onclick = function () { openViewer(ids, photo.f); };
        card.querySelector('.cp-thumb-likes').textContent = likeLabel(photo);
        grid.appendChild(card);
      });
      Object.keys(existing).forEach(function (id) { grid.removeChild(existing[id]); });
    }

    // -- Photo viewer

    var viewIds = [], viewIndex = 0;

    function openViewer(ids, id) {
      viewIds = ids;
      viewIndex = Math.max(0, ids.indexOf(id));
      renderViewer();
      if (!viewer.open) { viewer.showModal(); }
    }

    function viewing() { return byId[viewIds[viewIndex]]; }

    function renderViewer() {
      var photo = viewing();
      if (!photo) { if (viewer.open) { viewer.close(); } return; }
      var img = $('cp-viewer-img');
      if (img.getAttribute('data-f') !== photo.f) {
        img.setAttribute('data-f', photo.f);
        img.removeAttribute('src');
        setPhoto(img, photo.f, 1600);
      }
      img.alt = [photo.n, photo.c].filter(Boolean).join(' · ') || 'Camp photo';

      var meta = $('cp-viewer-meta');
      meta.innerHTML = '';
      if (photo.t) {
        var pill = el('span', 'cp-team-pill', photo.t);
        pill.style.setProperty('--team', teamColour(album.teams, photo.t));
        meta.appendChild(pill);
      }
      if (photo.n) { meta.appendChild(el('strong', '', photo.n)); }
      if (photo.d >= 1 && photo.d <= album.days) { meta.appendChild(el('span', '', t('Day ' + photo.d, 'दिन ' + npDigits(photo.d)))); }

      $('cp-viewer-cap').textContent = photo.c ? '★︎ ' + photo.c : '';
      var likeBtn = $('cp-like');
      likeBtn.setAttribute('aria-pressed', String(!!liked[photo.f]));
      likeBtn.setAttribute('aria-label', liked[photo.f] ? t('Unlike', 'लाइक हटाउनुहोस्') : t('Like', 'लाइक गर्नुहोस्'));
      $('cp-like-count').textContent = String(likeCount(photo));
      $('cp-viewer-download').href = downloadUrl(photo.f);
      $('cp-viewer-prev').style.visibility = viewIndex > 0 ? 'visible' : 'hidden';
      $('cp-viewer-next').style.visibility = viewIndex < viewIds.length - 1 ? 'visible' : 'hidden';
    }

    function step(by) {
      var next = viewIndex + by;
      if (next >= 0 && next < viewIds.length) { viewIndex = next; renderViewer(); }
    }

    function burst() {
      var b = $('cp-heart-burst');
      b.classList.remove('go');
      void b.offsetWidth;
      b.classList.add('go');
    }

    $('cp-like').addEventListener('click', function () { var p = viewing(); if (p) { toggleLike(p); } });
    $('cp-viewer-close').addEventListener('click', function () { viewer.close(); });
    $('cp-viewer-prev').addEventListener('click', function () { step(-1); });
    $('cp-viewer-next').addEventListener('click', function () { step(1); });
    viewer.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { step(-1); }
      if (e.key === 'ArrowRight') { step(1); }
    });

    // Double-tap (or double-click) the photo to like it; swipe for the next one.
    var stage = $('cp-viewer-stage');
    var touchX = null, lastTap = 0;
    stage.addEventListener('dblclick', function () { var p = viewing(); if (p) { toggleLike(p, true); burst(); } });
    stage.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (touchX == null) { return; }
      var dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 50) { step(dx < 0 ? 1 : -1); return; }
      var now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        var p = viewing();
        if (p) { toggleLike(p, true); burst(); }
        lastTap = 0;
      } else {
        lastTap = now;
      }
    });

    // -- Sending photos

    var nameInput = $('cp-name');
    nameInput.value = me.name || '';
    nameInput.addEventListener('input', function () {
      me.name = nameInput.value.trim();
      save(ME_KEY, me);
      renderMe();
    });

    cameraBtn.addEventListener('click', function () { challenge = ''; renderHome(); camera.click(); });
    galleryBtn.addEventListener('click', function () { challenge = ''; renderHome(); gallery.click(); });
    // Closing the camera without a photo: forget the challenge it was opened for.
    camera.addEventListener('cancel', function () { challenge = ''; renderHome(); });
    [camera, gallery].forEach(function (input) {
      input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        input.value = '';
        if (files.length) { send(files); } else { challenge = ''; renderHome(); }
      });
    });

    function send(all) {
      if (sending) { return; }
      var files = all.slice(0, MAX_FILES);
      var forChallenge = challenge;
      var sent = 0, failed = 0;
      sending = true;
      cameraBtn.disabled = true;
      galleryBtn.disabled = true;

      var previews = $('cp-previews');
      previews.innerHTML = '';
      var thumbs = files.map(function (file) {
        var img = el('img', 'waiting');
        img.alt = '';
        img.src = URL.createObjectURL(file);
        img.onload = function () { URL.revokeObjectURL(img.src); };
        previews.appendChild(img);
        return img;
      });
      var bar = $('cp-sending').querySelector('.cp-progress span');
      bar.style.width = '4%';
      hide($('cp-sending'), false);

      var progress = function () {
        var done = sent + failed;
        bar.style.width = Math.max(4, Math.round(100 * done / files.length)) + '%';
        if (done < files.length) {
          say(files.length === 1
            ? t('Sending your photo…', 'तपाईंको फोटो पठाउँदै…')
            : t('Sending ' + (done + 1) + ' of ' + files.length + '…', npDigits(files.length) + ' मध्ये ' + npDigits(done + 1) + ' पठाउँदै…'));
        }
      };
      progress();

      // One at a time, so a weak connection at camp is not overloaded.
      files.reduce(function (chain, file, i) {
        return chain.then(function () {
          return shrink(file, 1600)
            .then(function (photo) {
              return api('upload', { photo: photo, name: me.name, team: me.team, challenge: forChallenge });
            })
            .then(function () { sent++; thumbs[i].classList.remove('waiting'); }, function () { failed++; })
            .then(progress);
        });
      }, Promise.resolve()).then(function () {
        sending = false;
        cameraBtn.disabled = false;
        galleryBtn.disabled = false;
        if (!sent) {
          say(t('Sorry, that could not be sent. Check your internet and try again.', 'माफ गर्नुहोस्, पठाउन सकिएन। आफ्नो इन्टरनेट जाँचेर फेरि प्रयास गर्नुहोस्।'), 'err');
          return;
        }
        confetti(['#000', '#444', '#888', '#ccc']);
        var text = sent === 1
          ? t('Sent! Leaders will pick the best photos for Memories.', 'पठाइयो! लिडरहरूले राम्रा फोटोहरू सम्झनाहरूका लागि छान्नुहुनेछ।')
          : t(sent + ' photos sent! Leaders will pick the best ones for Memories.', npDigits(sent) + ' वटा फोटो पठाइयो! लिडरहरूले राम्रा फोटोहरू सम्झनाहरूका लागि छान्नुहुनेछ।');
        if (failed) {
          text += ' ' + t(failed + ' could not be sent — please try those again.', npDigits(failed) + ' वटा पठाउन सकिएन — कृपया फेरि प्रयास गर्नुहोस्।');
        }
        if (all.length > MAX_FILES) {
          text += ' ' + t('(Up to ' + MAX_FILES + ' at a time — send the rest next.)', '(एक पटकमा बढीमा ' + npDigits(MAX_FILES) + ' वटा — बाँकी फेरि पठाउनुहोस्।)');
        }
        if (forChallenge) { text = '★︎ ' + forChallenge + ' — ' + text; }
        say(text, failed ? 'err' : 'ok');
        if (challenge === forChallenge) { challenge = ''; renderHome(); }
        setTimeout(function () { if (!sending) { hide($('cp-sending'), true); } }, 4000);
        if (!info) { loadInfo(); }
      });
    }

    // -- Start

    document.querySelectorAll('.lang-toggle').forEach(function (b) {
      b.addEventListener('click', function () {
        setTimeout(function () { renderHome(); renderReel(); renderMemories(); if (viewer.open) { renderViewer(); } }, 0);
      });
    });
    window.addEventListener('hashchange', show);

    renderHome();
    show();
    loadInfo();
    loadAlbum();
    // New photos chosen by leaders (and new likes) show up within a minute.
    every(30000, function () { if (!sending) { loadAlbum(); } });
    // Today's challenge changes at midnight; pick it up if the page stays open.
    every(10 * 60 * 1000, function () { if (!sending) { loadInfo(); } });
  }

  // ---- Projector slideshow -------------------------------------------------

  function live() {
    var SLIDE_MS = 8000;
    var CARD_MS = 10000;
    var album = null;
    var challenges = [];
    var byId = {};
    var known = null;        // ids already seen, so new ones can jump the queue
    var fresh = [];
    var deck = [];
    var count = 0;
    var timer = null;
    var started = false;
    var slides = document.querySelectorAll('.cp-live-slide');
    var current = 0;
    var cardEl = $('cp-card');

    function loadAlbum() {
      return api('album').then(function (a) {
        album = a;
        byId = {};
        a.photos.forEach(function (p) { byId[p.f] = p; });
        if (known) {
          // newest first; queue the new ones oldest first
          a.photos.slice().reverse().forEach(function (p) { if (!known[p.f]) { fresh.push(p.f); } });
        }
        known = {};
        a.photos.forEach(function (p) { known[p.f] = true; });
        hide($('cp-error'), true);
        hide($('cp-empty'), a.photos.length > 0);
        if (!started) { started = true; next(); }
      }, function (err) {
        // Keep showing what we have; the next check may work.
        $('cp-error').textContent = err.message === 'not set up'
          ? 'The photo backend is not set up yet (NH_PHOTOS_ENDPOINT).'
          : 'Can\'t reach Google Drive right now — trying again…';
        hide($('cp-error'), false);
      });
    }

    function loadChallenges() {
      return api('info').then(function (i) { challenges = i.challenges; }, function () { /* try again later */ });
    }

    function pick() {
      while (fresh.length) {
        var id = fresh.shift();
        if (byId[id]) { return { photo: byId[id], isNew: true }; }
      }
      for (var tries = 0; tries < 2; tries++) {
        while (deck.length) {
          var p = byId[deck.pop()];
          if (p) { return { photo: p, isNew: false }; }
        }
        deck = shuffle(Object.keys(byId));
      }
      return null;
    }

    function schedule(ms) {
      clearTimeout(timer);
      timer = setTimeout(next, ms);
    }

    function next() {
      if (!album) { return; }
      count++;
      if (count % 12 === 0 && showChallengeCard()) { return; }
      hideCard();
      var choice = pick();
      if (!choice) { schedule(SLIDE_MS); return; }
      showPhoto(choice.photo, choice.isNew);
    }

    function showPhoto(photo, isNew) {
      var img = new Image();
      img.onload = function () {
        current = 1 - current;
        var slide = slides[current];
        slide.querySelector('.bg').style.backgroundImage = 'url("' + img.src + '")';
        var shownImg = slide.querySelector('img');
        shownImg.src = img.src;
        shownImg.alt = photo.c || photo.n || 'Camp photo';
        // restart the slow zoom
        slide.classList.remove('on');
        void slide.offsetWidth;
        slide.classList.add('on');
        slides[1 - current].classList.remove('on');
        renderCaption(photo, isNew);
        schedule(isNew ? SLIDE_MS + 3000 : SLIDE_MS);
      };
      img.onerror = function () {
        if (img.src.indexOf('lh3.') === -1) {
          img.src = fallbackPhotoUrl(photo.f, 1920);
        } else {
          schedule(500);
        }
      };
      img.src = photoUrl(photo.f, 1920);
    }

    function renderCaption(photo, isNew) {
      var box = $('cp-caption');
      box.innerHTML = '';
      if (isNew) { box.appendChild(el('span', 'cp-live-new', 'JUST IN')); }
      if (photo.t || photo.n) {
        var who = el('div', 'cp-live-who');
        if (photo.t) {
          var pill = el('span', 'cp-team-pill', photo.t);
          pill.style.setProperty('--team', teamColour(album.teams, photo.t));
          who.appendChild(pill);
        }
        if (photo.n) { who.appendChild(document.createTextNode(photo.n)); }
        box.appendChild(who);
      }
      if (photo.c) { box.appendChild(el('div', 'cp-live-challenge', '★︎ ' + photo.c)); }
      if (photo.l) { box.appendChild(el('div', 'cp-live-likes', '♥︎ ' + photo.l)); }
    }

    function showChallengeCard() {
      if (!challenges.length) { return false; }
      cardEl.innerHTML = '';
      cardEl.appendChild(el('span', 'label', 'Today\'s challenge'));
      cardEl.appendChild(el('h2', '', challenges[0]));
      if (challenges.length > 1) {
        var more = el('div', 'more');
        challenges.slice(1, 4).forEach(function (c) { more.appendChild(el('span', '', '+ ' + c)); });
        cardEl.appendChild(more);
      }
      cardEl.appendChild(el('span', 'label', 'Scan the code and send your photo →'));
      cardEl.classList.add('on');
      hide($('cp-caption'), true);
      schedule(CARD_MS);
      return true;
    }

    function hideCard() {
      cardEl.classList.remove('on');
      hide($('cp-caption'), false);
    }

    function toggleFullscreen() {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () { /* not allowed */ });
      }
    }

    // Keep the projector laptop from going to sleep while the show is on.
    var wakeLock = null;
    function stayAwake() {
      if (navigator.wakeLock && document.visibilityState === 'visible' && !wakeLock) {
        navigator.wakeLock.request('screen').then(function (lock) {
          wakeLock = lock;
          lock.addEventListener('release', function () { wakeLock = null; });
        }).catch(function () { /* not supported */ });
      }
    }
    document.addEventListener('visibilitychange', stayAwake);
    document.addEventListener('click', stayAwake);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'c' || e.key === 'C') { showChallengeCard(); }
    });
    document.addEventListener('dblclick', toggleFullscreen);

    var cursorTimer = null;
    document.addEventListener('mousemove', function () {
      document.body.classList.add('show-cursor');
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(function () { document.body.classList.remove('show-cursor'); }, 2500);
    });

    drawQr($('cp-join-qr'), camperUrl());
    stayAwake();
    loadChallenges();
    loadAlbum();
    // Photos moved into the album show up within about 15 seconds.
    every(15000, loadAlbum);
    every(10 * 60 * 1000, loadChallenges);
  }

  // ---- Poster --------------------------------------------------------------

  function poster() {
    drawQr($('cp-poster-qr'), camperUrl());
    $('cp-print').addEventListener('click', function () { window.print(); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-photos');
    if (page === 'camper') { camper(); }
    if (page === 'live') { live(); }
    if (page === 'poster') { poster(); }
  });
})();
