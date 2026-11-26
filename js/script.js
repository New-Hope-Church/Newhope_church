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

  // The toggle button always shows the language you'd switch TO, not the
  // language you're currently reading — tap it to flip.
  document.querySelectorAll('.lang-toggle').forEach(function (btn) {
    btn.textContent = lang === 'np' ? 'English' : 'नेपाली';
    btn.setAttribute('aria-label', lang === 'np' ? 'Switch to English' : 'नेपाली भाषामा हेर्नुहोस्');
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

  document.querySelectorAll('.lang-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = nhGetLang() === 'np' ? 'en' : 'np';
      nhSetLang(next);
      nhApplyLanguage(next);
    });
  });

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

    Promise.all(figures.map(function (fig) {
      var img = fig.querySelector('img');
      var alt = img.getAttribute('alt') || '';
      return resolveSrc(img.getAttribute('src')).then(function (res) {
        return res ? { src: res.src, w: res.w, h: res.h, alt: alt } : null;
      });
    })).then(function (list) {
      var items = list.filter(Boolean);
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
