// --Language switching (English / Nepali) --
// Elements opt in with data-en / data-np (plain text), data-en-html / data-np-html
// (for text that needs inline markup, e.g. a line break), or
// data-en-placeholder / data-np-placeholder (form field placeholders).
var NH_LANG_KEY = 'nh-lang';

function nhGetLang() {
  try {
    return localStorage.getItem(NH_LANG_KEY) || 'en';
  } catch (e) {
    return 'en';
  }
}

function nhSetLang(lang) {
  try {
    localStorage.setItem(NH_LANG_KEY, lang);
  } catch (e) { /* ignore if storage is unavailable */ }
}

function nhApplyLanguage(lang) {
  document.documentElement.setAttribute('lang', lang === 'np' ? 'ne' : 'en');

  document.querySelectorAll('[data-en]').forEach(function (el) {
    el.textContent = lang === 'np' ? (el.getAttribute('data-np') || el.getAttribute('data-en')) : el.getAttribute('data-en');
  });

  document.querySelectorAll('[data-en-html]').forEach(function (el) {
    el.innerHTML = lang === 'np' ? (el.getAttribute('data-np-html') || el.getAttribute('data-en-html')) : el.getAttribute('data-en-html');
  });

  document.querySelectorAll('[data-en-placeholder]').forEach(function (el) {
    el.setAttribute('placeholder', lang === 'np' ? (el.getAttribute('data-np-placeholder') || el.getAttribute('data-en-placeholder')) : el.getAttribute('data-en-placeholder'));
  });

  // The switch is a sliding pill (EN | ने); CSS moves its knob from <html lang>.
  // Its label names the language a tap switches TO.
  document.querySelectorAll('.lang-toggle').forEach(function (btn) {
    btn.setAttribute('aria-label', lang === 'np' ? 'Switch to English' : 'नेपाली भाषामा हेर्नुहोस्');
    btn.setAttribute('title', lang === 'np' ? 'English' : 'नेपाली');
  });
}

// --Theme switching (light / dark) --
// js/theme.js sets data-theme on <html> before the page paints. The header
// button flips it and saves the choice; until someone chooses, the site
// follows the device's light/dark setting, even if it changes while open.
var NH_THEME_KEY = 'nh-theme';

function nhGetSavedTheme() {
  try {
    var t = localStorage.getItem(NH_THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch (e) {
    return null;
  }
}

function nhApplyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) { meta.setAttribute('content', theme === 'dark' ? '#0E0E0E' : '#FFFFFF'); }
  // Like the language button, the label names the theme you'd switch TO.
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    btn.setAttribute('title', theme === 'dark' ? 'Light theme' : 'Dark theme');
  });
}

// Links are written without ".html" (connect, about, …) because the live
// server adds it. Opened straight from the computer, or through a simple
// local server, nothing does — so put it back in those cases only.
var NH_IS_LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

function nhFixLocalLinks(root) {
  if (!NH_IS_LOCAL) { return; }
  root.querySelectorAll('a[href]').forEach(function (a) {
    var m = /^(\.\/|[a-z][a-z-]*)?(#.*)?$/.exec(a.getAttribute('href'));
    if (!m || !m[1]) { return; }
    a.setAttribute('href', (m[1] === './' ? 'index' : m[1]) + '.html' + (m[2] || ''));
  });
}

// The menu is shared by every page (partials/header.html), so the link to the
// page you are on is marked here. A page that belongs under another menu item
// names it on <body>, e.g. <body data-nav="events">.
function nhMarkActiveLink(root) {
  var here = document.body.getAttribute('data-nav') ||
    location.pathname.split('/').pop().replace(/\.html$/, '');
  root.querySelectorAll('.nav-links a').forEach(function (a) {
    var target = a.getAttribute('href').split('#')[0].replace(/\.html$/, '');
    if (here && target === here) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
}

document.addEventListener('DOMContentLoaded', function () {
  nhFixLocalLinks(document);
  nhMarkActiveLink(document);

  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // Apply whichever language was last chosen (defaults to English).
  nhApplyLanguage(nhGetLang());

  // Turn on the knob's slide animation only after the first paint, so a saved
  // Nepali choice doesn't visibly slide across when the page opens.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      document.querySelectorAll('.lang-toggle').forEach(function (btn) { btn.classList.add('ready'); });
    });
  });

  document.querySelectorAll('.lang-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = nhGetLang() === 'np' ? 'en' : 'np';
      nhSetLang(next);
      nhApplyLanguage(next);
    });
  });

  nhApplyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(NH_THEME_KEY, next); } catch (e) { /* ignore if storage is unavailable */ }
      nhApplyTheme(next);
    });
  });

  if (window.matchMedia) {
    var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemTheme = function (e) {
      if (!nhGetSavedTheme()) { nhApplyTheme(e.matches ? 'dark' : 'light'); }
    };
    if (darkQuery.addEventListener) { darkQuery.addEventListener('change', onSystemTheme); }
    else if (darkQuery.addListener) { darkQuery.addListener(onSystemTheme); }
  }

  // Church map picker (Connect page): swap the embedded map when a campus is chosen.
  var mapFrame = document.getElementById('church-map');
  var churchItems = document.querySelectorAll('.church-item');
  if (mapFrame && churchItems.length) {
    churchItems.forEach(function (btn) {
      btn.addEventListener('click', function () {
        mapFrame.src = btn.dataset.src;
        churchItems.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }

  // Scroll reveal: content below the hero fades and rises into place the first
  // time it scrolls into view; items in the same row follow one another.
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealSel = '.card, .group-card, .section-head, .about-section, .church-item, .wrap > h2, .wrap > h3, .wrap > p, .wrap > div, .wrap > form';
    var revealEls = [];
    document.querySelectorAll('main > section').forEach(function (sec) {
      if (sec.querySelector('.hero-in, .marquee') || sec.hasAttribute('data-no-reveal')) { return; }
      sec.querySelectorAll(revealSel).forEach(function (el) {
        // animate the innermost pieces, not the containers around them
        if (!el.querySelector(revealSel)) { revealEls.push(el); }
      });
    });

    var revealIo = new IntersectionObserver(function (entries) {
      var shown = entries.filter(function (en) { return en.isIntersecting; });
      shown.forEach(function (en, i) {
        var el = en.target;
        var delay = Math.min(i, 5) * 80;
        revealIo.unobserve(el);
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('in');
        // hand the element back to its normal styles (hover effects etc.) afterwards
        setTimeout(function () {
          el.classList.remove('reveal', 'in');
          el.style.transitionDelay = '';
        }, delay + 1000);
      });
    }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });

    revealEls.forEach(function (el) {
      el.classList.add('reveal');
      revealIo.observe(el);
    });
  }

  // Keep the page from jumping when the language changes. Each translated text
  // is a different length in English and Nepali, so headings and paragraphs
  // wrapped onto more or fewer lines and everything below them moved (and the
  // photos behind the home hero resized). After the fonts load, lay out an
  // invisible copy of the page in the other language, then give every
  // translated block the taller of its two heights. Inline texts (links,
  // buttons) lock their container instead, e.g. a row of buttons that wraps.
  var nhLocked = [];
  var nhLockOne = function (root) {
    var other = nhGetLang() === 'np' ? 'en' : 'np';
    var targets = [];
    var add = function (t) { if (t && root.contains(t) && targets.indexOf(t) < 0) { targets.push(t); } };
    root.querySelectorAll('[data-en], [data-en-html]').forEach(function (el) {
      if (el.tagName === 'OPTION') { add(el.closest('select')); return; } // the dropdown sizes to its options
      var d = getComputedStyle(el).display;
      var pr = el.parentElement && getComputedStyle(el.parentElement);
      var inRow = pr && pr.display.indexOf('flex') >= 0 && pr.flexWrap === 'wrap';
      if (inRow) { add(el.parentElement); } // buttons in a row: lock the row, not each button
      else if (d === 'inline') { add(el.parentElement); }
      else if (d.indexOf('inline') === 0) { add(el); add(el.parentElement); } // a button and its line
      else { add(el); }
      // a wrapping row (buttons or links side by side) can drop onto another line
      for (var p = el.parentElement; p && p !== root; p = p.parentElement) {
        var ps = getComputedStyle(p);
        if (ps.flexWrap === 'wrap' && ps.display.indexOf('flex') >= 0) { add(p); }
      }
    });
    if (!targets.length) { return; }
    targets.forEach(function (t, i) { t.setAttribute('data-nhk', i); });
    // A box's height depends on the locked heights of the texts inside it, so
    // measure again with the previous pass's locks in place until it settles.
    for (var pass = 0; pass < 3; pass++) {
      var copy = root.cloneNode(true);
      copy.querySelectorAll('[data-en]').forEach(function (c) {
        c.textContent = c.getAttribute('data-' + other) || c.getAttribute('data-en');
      });
      copy.querySelectorAll('[data-en-html]').forEach(function (c) {
        c.innerHTML = c.getAttribute('data-' + other + '-html') || c.getAttribute('data-en-html');
      });
      copy.setAttribute('lang', other === 'np' ? 'ne' : 'en'); // so :lang() styles match
      copy.setAttribute('aria-hidden', 'true');
      copy.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;margin:0;width:' + root.offsetWidth + 'px;';
      root.parentNode.appendChild(copy);
      var heights = targets.map(function (t, i) {
        var c = copy.querySelector('[data-nhk="' + i + '"]');
        return Math.max(t.getBoundingClientRect().height, c ? c.getBoundingClientRect().height : 0);
      });
      root.parentNode.removeChild(copy);
      var changed = false;
      targets.forEach(function (t, i) {
        var cur = parseFloat(t.style.minHeight) || 0;
        if (heights[i] > cur + 0.01) {
          t.style.minHeight = heights[i] + 'px';
          // keep a row's items their own size instead of stretching them to fill the extra room
          var ts = getComputedStyle(t);
          if ((ts.display.indexOf('flex') >= 0 && ts.flexWrap === 'wrap') || ts.display.indexOf('grid') >= 0) {
            if (ts.alignContent === 'normal' || ts.alignContent === 'stretch') { t.style.alignContent = 'flex-start'; }
          }
          changed = true;
          if (nhLocked.indexOf(t) < 0) { nhLocked.push(t); }
        }
      });
      if (!changed) { break; }
    }
    targets.forEach(function (t) { t.removeAttribute('data-nhk'); });
  };
  var nhLockHeroes = function () {
    nhLocked.forEach(function (t) { t.style.minHeight = ''; t.style.alignContent = ''; });
    nhLocked = [];
    document.querySelectorAll('main, .site-footer .wrap').forEach(nhLockOne);
  };
  // web fonts change the text height, so measure once they're in
  var nhFontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  var nhHeroesLocked = nhFontsReady.then(nhLockHeroes);
  // The page only downloads the fonts of the language it shows, so the hidden
  // copy in the other language was measured with a stand-in font of a
  // different size. Once the page has loaded, fetch the other language's fonts
  // in the background and measure again with the real ones.
  if (document.fonts && document.fonts.load) {
    window.addEventListener('load', function () {
      var sample = nhGetLang() === 'np' ? 'Aa' : 'क';
      var faces = nhGetLang() === 'np'
        ? ['400 16px "Work Sans"', '500 16px "Work Sans"', '600 16px "Work Sans"', '700 16px "Work Sans"', '500 16px Fraunces', '600 16px Fraunces']
        : ['400 16px "NH Deva Sans"', '500 16px "NH Deva Sans"', '600 16px "NH Deva Sans"', '700 16px "NH Deva Sans"', '500 16px "NH Deva Serif"'];
      Promise.all(faces.map(function (f) { return document.fonts.load(f, sample).catch(function () {}); }))
        .then(function () { return nhHeroesLocked; })
        .then(nhLockHeroes);
    });
  }
  var nhLastHeroW = window.innerWidth, nhHeroT = null;
  window.addEventListener('resize', function () {
    clearTimeout(nhHeroT);
    nhHeroT = setTimeout(function () {
      if (window.innerWidth !== nhLastHeroW) { nhLastHeroW = window.innerWidth; nhLockHeroes(); }
    }, 200);
  });

  // Home page hero background: faded photos drift in an endless, seamless loop.
  var strips = document.querySelectorAll('.marquee');
  var mainStrip = document.querySelector('.marquee');
  if (strips.length && mainStrip) {
    var EXTS = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG'];

    // Load a photo to learn its size; resolves null if it can't be loaded.
    var probe = function (src) {
      return new Promise(function (resolve) {
        var im = new Image();
        im.decoding = 'async';
        im.onload = function () {
          var done = function () { resolve({ src: src, w: im.naturalWidth, h: im.naturalHeight }); };
          // decode now so the photo doesn't stutter the first time it scrolls into view
          if (im.decode) { im.decode().then(done, done); } else { done(); }
        };
        im.onerror = function () { resolve(null); };
        im.src = src;
      });
    };

    // Try the given file name, then other common extensions.
    var resolveSrc = function (src) {
      var m = src.match(/^(.*)\.([A-Za-z0-9]+)$/);
      if (!m) { return probe(src); }
      var list = [m[2]].concat(EXTS.filter(function (e) { return e !== m[2]; }));
      return list.reduce(function (p, ext) {
        return p.then(function (found) { return found || probe(m[1] + '.' + ext); });
      }, Promise.resolve(null));
    };

    var makeItem = function (it, isClone, boxH) {
      var fig = document.createElement('figure');
      fig.className = 'marquee-item';
      fig.style.width = Math.round(boxH * it.w / it.h) + 'px';
      var img = document.createElement('img');
      img.src = it.src;
      img.alt = isClone ? '' : it.alt;
      img.draggable = false;
      img.decoding = 'async';
      if (isClone) { fig.setAttribute('aria-hidden', 'true'); }
      fig.appendChild(img);
      return fig;
    };

    // Fill a strip with one set of photos, then enough copies to cover the
    // width. The animation moves exactly one set-width, then repeats, so the
    // loop point is invisible (no rewind, no flicker).
    var build = function (root, items) {
      var track = root.querySelector('.marquee-track');
      var speed = parseFloat(root.getAttribute('data-speed')) || 60;

      var boxH = root.clientHeight;
      var isBg = root.classList.contains('marquee-bg');

      // Build off-screen in a fragment and swap it in once (no empty frame).
      var frag = document.createDocumentFragment();
      var setW = 0;
      items.forEach(function (it) {
        var f = makeItem(it, false, boxH);
        setW += parseFloat(f.style.width);
        frag.appendChild(f);
      });
      if (!setW) { return; }

      // Add just enough repeats to cover the strip while it scrolls one set-width.
      var total = setW, i = 0;
      while (total < setW + root.clientWidth) {
        var extra = makeItem(items[i % items.length], true, boxH);
        total += parseFloat(extra.style.width);
        frag.appendChild(extra);
        i++;
      }
      track.innerHTML = '';
      track.appendChild(frag);

      track.style.setProperty('--shift', (-setW) + 'px');
      track.style.setProperty('--dur', (setW / speed) + 's');
      track.style.animationDelay = '0s'; 

      root.classList.remove('loading');
      root.classList.add('ready');
    };

    var figures = Array.prototype.slice.call(mainStrip.querySelectorAll('.marquee-item'));
    strips.forEach(function (r) { r.classList.add('loading'); });

    // build after the hero height is settled, so the photos are sized to it
    Promise.all([nhHeroesLocked].concat(figures.map(function (fig) {
      var img = fig.querySelector('img');
      var alt = img.getAttribute('alt') || '';
      return resolveSrc(img.getAttribute('src')).then(function (res) {
        return res ? { src: res.src, w: res.w, h: res.h, alt: alt } : null;
      });
    }))).then(function (list) {
      var items = list.slice(1).filter(Boolean);
      if (!items.length) {
        strips.forEach(function (r) { r.classList.remove('loading'); });
        return;
      }
      var buildAll = function () { strips.forEach(function (r) { build(r, items); }); };
      buildAll();

      // Rebuild only when the WIDTH changes. On phones the address bar sliding
      // in/out changes only the height, and rebuilding then made the photos jump.
      var t = null;
      var lastW = window.innerWidth;
      window.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(function () {
          if (window.innerWidth !== lastW) { lastW = window.innerWidth; buildAll(); }
        }, 250);
      });

      // Stop animating strips that are off-screen (less work = smoother scrolling).
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { en.target.classList.toggle('offscreen', !en.isIntersecting); });
        }, { rootMargin: '100px' });
        strips.forEach(function (r) { io.observe(r); });
      }
    });
  }
});
