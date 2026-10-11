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

document.addEventListener('DOMContentLoaded', function () {
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

  // Contact form: opens the visitor's email app with the message pre-filled,
  // since the site has no backend to receive submissions directly.
  var form = document.getElementById('contact-form');
  var status = document.getElementById('form-status');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lang = nhGetLang();
      var name = document.getElementById('name').value.trim();
      var email = document.getElementById('email').value.trim();
      var message = document.getElementById('message').value.trim();

      if (!name || !email || !message) {
        if (status) {
          status.textContent = lang === 'np'
            ? 'कृपया पठाउनुअघि हरेक फिल्ड भर्नुहोस्।'
            : 'Please fill in every field before sending.';
          status.style.display = 'block';
        }
        return;
      }

      var subject = encodeURIComponent('Message from ' + name + ' via New Hope website');
      var body = encodeURIComponent(message + '\n\n— ' + name + ' (' + email + ')');
      window.location.href = 'mailto:hello@newhope.org.np?subject=' + subject + '&body=' + body;

      if (status) {
        status.textContent = lang === 'np'
          ? 'hello@newhope.org.np मा यो पठाउन तपाईंको इमेल एप खोल्दै…'
          : 'Opening your email app to send this to hello@newhope.org.np…';
        status.style.display = 'block';
      }
    });
  }

  // Youth Camp registration form: validates required fields (including
  // guardian info for campers under 18), then saves the registration to the
  // church's Google Sheet through its Apps Script web app.
  // Paste the web app URL (ends in /exec) between the quotes below.
  var NH_YC_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw0-zw4dSA3fVR7WygajqG7IHfbB2vgzrmm9P33I7RVx2kRVfH-P9tswiUEuBps2830Eg/exec';
  var ycForm = document.getElementById('youth-camp-form');
  var ycStatus = document.getElementById('yc-status');
  var ycGuardianHint = document.getElementById('yc-guardian-hint');
  if (ycForm) {
    var ycVal = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    ycForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var lang = nhGetLang();

      var name = ycVal('yc-name');
      var age = ycVal('yc-age');
      var gender = ycVal('yc-gender');
      var phone = ycVal('yc-phone');
      var email = ycVal('yc-email');
      var group = ycVal('yc-group');
      var guardianName = ycVal('yc-guardian-name');
      var guardianPhone = ycVal('yc-guardian-phone');
      var emName = ycVal('yc-emergency-name');
      var emPhone = ycVal('yc-emergency-phone');
      var tshirt = ycVal('yc-tshirt');
      var notes = ycVal('yc-notes');
      var consent = document.getElementById('yc-consent');

      var ageNum = parseInt(age, 10);
      var isMinor = age !== '' && !isNaN(ageNum) && ageNum < 18;

      var missingCore = !name || !age || !phone || !emName || !emPhone;
      var missingGuardian = isMinor && (!guardianName || !guardianPhone);
      var missingConsent = consent && !consent.checked;

      if (missingCore || missingGuardian || missingConsent) {
        if (ycStatus) {
          if (missingGuardian) {
            ycStatus.textContent = lang === 'np'
              ? 'कृपया १८ वर्षमुनिका सहभागीहरूका लागि अभिभावकको नाम र फोन नम्बर भर्नुहोस्।'
              : 'Please add a parent/guardian name and phone number for campers under 18.';
          } else if (missingConsent) {
            ycStatus.textContent = lang === 'np'
              ? 'कृपया पठाउनुअघि सहमति बक्समा चेक गर्नुहोस्।'
              : 'Please check the consent box before sending.';
          } else {
            ycStatus.textContent = lang === 'np'
              ? 'कृपया पठाउनुअघि सबै आवश्यक फिल्डहरू भर्नुहोस्।'
              : 'Please fill in every required field before sending.';
          }
          ycStatus.style.display = 'block';
        }
        return;
      }

      var showStatus = function (en, np) {
        if (!ycStatus) { return; }
        ycStatus.textContent = nhGetLang() === 'np' ? np : en;
        ycStatus.style.display = 'block';
      };

      // No sheet connected yet: fall back to opening the visitor's email app.
      if (!NH_YC_ENDPOINT) {
        var lines = [
          'Camper name: ' + name,
          'Age: ' + age,
          'Gender: ' + (gender || '-'),
          'Phone: ' + phone,
          'Email: ' + (email || '-'),
          'Home church: ' + (group || '-'),
          'Parent/Guardian name: ' + (guardianName || '-'),
          'Parent/Guardian phone: ' + (guardianPhone || '-'),
          'Emergency contact name: ' + emName,
          'Emergency contact phone: ' + emPhone,
          'T-shirt size: ' + (tshirt || '-'),
          'Allergies / medical / dietary notes: ' + (notes || '-')
        ];
        var subject = encodeURIComponent('Youth Camp Registration - ' + name);
        var body = encodeURIComponent(lines.join('\n'));
        window.location.href = 'mailto:hello@newhope.org.np?subject=' + subject + '&body=' + body;
        showStatus(
          'Opening your email app to send your registration to hello@newhope.org.np…',
          'तपाईंको दर्ता hello@newhope.org.np मा पठाउन इमेल एप खोल्दै…'
        );
        return;
      }

      // Save the registration as a new row in the church's Google Sheet.
      var data = new URLSearchParams();
      data.append('name', name);
      data.append('age', age);
      data.append('gender', gender);
      data.append('phone', phone);
      data.append('email', email);
      data.append('home_church', group);
      data.append('guardian_name', guardianName);
      data.append('guardian_phone', guardianPhone);
      data.append('emergency_name', emName);
      data.append('emergency_phone', emPhone);
      data.append('tshirt_size', tshirt);
      data.append('notes', notes);
      data.append('consent', 'yes');
      data.append('website', ycVal('yc-website'));

      var submitBtn = ycForm.querySelector('button[type="submit"]');
      if (submitBtn) { submitBtn.disabled = true; }
      showStatus('Sending your registration…', 'तपाईंको दर्ता पठाउँदै…');

      fetch(NH_YC_ENDPOINT, { method: 'POST', body: data })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (!json || !json.ok) { throw new Error('not saved'); }
          ycForm.reset();
          if (ycGuardianHint) { ycGuardianHint.style.display = 'none'; }
          showStatus(
            'Registration received — thank you! Your place is confirmed once the Rs. 1,500 fee is paid: pay in person at your New Hope church, or we will phone you to arrange it.',
            'दर्ता प्राप्त भयो — धन्यवाद! रु. १,५०० शुल्क बुझाएपछि तपाईंको स्थान पक्का हुनेछ: आफ्नो New Hope चर्चमा प्रत्यक्ष बुझाउनुहोस्, वा हामी तपाईंलाई फोन गर्नेछौं।'
          );
        })
        .catch(function () {
          showStatus(
            'Sorry, your registration could not be sent. Please try again, or email hello@newhope.org.np.',
            'माफ गर्नुहोस्, तपाईंको दर्ता पठाउन सकिएन। कृपया फेरि प्रयास गर्नुहोस्, वा hello@newhope.org.np मा इमेल गर्नुहोस्।'
          );
        })
        .then(function () { if (submitBtn) { submitBtn.disabled = false; } });
    });

    // Show a hint (and expect guardian details) once the entered age is under 18.
    var ycAge = document.getElementById('yc-age');
    if (ycAge && ycGuardianHint) {
      var ycUpdateHint = function () {
        var a = parseInt(ycAge.value, 10);
        ycGuardianHint.style.display = (!isNaN(a) && a < 18) ? 'block' : 'none';
      };
      ycAge.addEventListener('input', ycUpdateHint);
      ycUpdateHint();
    }
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

  // Give page: fund tabs, method tabs, wallet chips, copy buttons.
  var giving = document.querySelector('.giving');
  if (giving) {
    function selectGroup(selector, active) {
      giving.querySelectorAll(selector).forEach(function (b) {
        var on = b === active;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    }

    giving.querySelectorAll('.fund-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        giving.setAttribute('data-fund', btn.getAttribute('data-fund'));
        selectGroup('.fund-btn', btn);
      });
    });

    giving.querySelectorAll('.method-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var m = btn.getAttribute('data-method');
        giving.querySelectorAll('.giving-panel').forEach(function (p) {
          p.hidden = p.id !== 'panel-' + m;
        });
        selectGroup('.method-btn', btn);
      });
    });

    giving.querySelectorAll('.wallet-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var w = btn.getAttribute('data-wallet');
        giving.querySelectorAll('.wallet-body').forEach(function (p) {
          p.hidden = p.id !== 'wallet-' + w;
        });
        giving.querySelectorAll('.wallet-btn').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
      });
    });

    giving.querySelectorAll('.copy-btn').forEach(function (btn) {
      var valueEl = btn.parentNode.querySelector('.detail-value');
      if (!valueEl || valueEl.hasAttribute('data-placeholder')) {
        btn.disabled = true; 
        return;
      }
      btn.addEventListener('click', function () {
        var text = valueEl.textContent.trim();
        var done = function () {
          btn.textContent = nhGetLang() === 'np' ? 'कपी भयो ✓' : 'Copied ✓';
          setTimeout(function () {
            btn.textContent = nhGetLang() === 'np' ? btn.getAttribute('data-np') : btn.getAttribute('data-en');
          }, 1600);
        };
        // Only show "Copied" if the copy actually worked.
        var legacyCopy = function () {
          var ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
          document.body.removeChild(ta);
          if (ok) { done(); }
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, legacyCopy);
        } else {
          legacyCopy();
        }
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
      if (sec.querySelector('.hero-in, .marquee')) { return; }
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