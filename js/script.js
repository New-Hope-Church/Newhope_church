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

// The footer is kept in one place: index.html. Other pages only have an empty
// <footer class="site-footer"></footer>, which is filled with the home page's
// footer here, so editing the footer in index.html updates the whole site.
// (Opened straight from the computer, the browser blocks this fetch, so those
// pages show no footer until viewed on the live site or a local server.)
function nhLoadSharedFooter() {
  var footer = document.querySelector('footer.site-footer');
  if (!footer || !window.fetch || !window.DOMParser) { return; }
  if (/(^|\/)(index(\.html)?)?$/.test(location.pathname)) { return; }

  fetch(NH_IS_LOCAL ? 'index.html' : './')
    .then(function (res) { return res.ok ? res.text() : Promise.reject(res.status); })
    .then(function (html) {
      var shared = new DOMParser().parseFromString(html, 'text/html').querySelector('footer.site-footer');
      if (!shared) { return; }
      var fresh = document.importNode(shared, true);
      footer.replaceWith(fresh);
      nhFixLocalLinks(fresh);
      nhApplyLanguage(nhGetLang());
    })
    .catch(function () { /* keep this page's own footer */ });
}

document.addEventListener('DOMContentLoaded', function () {
  nhFixLocalLinks(document);
  nhLoadSharedFooter();

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

  // Phone fields: every phone input gets a country-code dropdown in front of
  // it (Nepal by default). nhPhoneVal(id) returns the code and number together.
  var NH_DIAL_CODES = "Afghanistan:93|Albania:355|Algeria:213|American Samoa:1684|Andorra:376|Angola:244|Anguilla:1264|Antigua and Barbuda:1268|Argentina:54|Armenia:374|Aruba:297|Australia:61|Austria:43|Azerbaijan:994|Bahamas:1242|Bahrain:973|Bangladesh:880|Barbados:1246|Belarus:375|Belgium:32|Belize:501|Benin:229|Bermuda:1441|Bhutan:975|Bolivia:591|Bosnia and Herzegovina:387|Botswana:267|Brazil:55|British Virgin Islands:1284|Brunei:673|Bulgaria:359|Burkina Faso:226|Burundi:257|Cambodia:855|Cameroon:237|Canada:1|Cape Verde:238|Cayman Islands:1345|Central African Republic:236|Chad:235|Chile:56|China:86|Colombia:57|Comoros:269|Congo (DRC):243|Congo (Republic):242|Cook Islands:682|Costa Rica:506|Côte d'Ivoire:225|Croatia:385|Cuba:53|Curaçao:599|Cyprus:357|Czechia:420|Denmark:45|Djibouti:253|Dominica:1767|Dominican Republic:1809|Ecuador:593|Egypt:20|El Salvador:503|Equatorial Guinea:240|Eritrea:291|Estonia:372|Eswatini:268|Ethiopia:251|Falkland Islands:500|Faroe Islands:298|Fiji:679|Finland:358|France:33|French Guiana:594|French Polynesia:689|Gabon:241|Gambia:220|Georgia:995|Germany:49|Ghana:233|Gibraltar:350|Greece:30|Greenland:299|Grenada:1473|Guadeloupe:590|Guam:1671|Guatemala:502|Guinea:224|Guinea-Bissau:245|Guyana:592|Haiti:509|Honduras:504|Hong Kong:852|Hungary:36|Iceland:354|India:91|Indonesia:62|Iran:98|Iraq:964|Ireland:353|Israel:972|Italy:39|Jamaica:1876|Japan:81|Jordan:962|Kazakhstan:7|Kenya:254|Kiribati:686|Kosovo:383|Kuwait:965|Kyrgyzstan:996|Laos:856|Latvia:371|Lebanon:961|Lesotho:266|Liberia:231|Libya:218|Liechtenstein:423|Lithuania:370|Luxembourg:352|Macau:853|Madagascar:261|Malawi:265|Malaysia:60|Maldives:960|Mali:223|Malta:356|Marshall Islands:692|Martinique:596|Mauritania:222|Mauritius:230|Mayotte:262|Mexico:52|Micronesia:691|Moldova:373|Monaco:377|Mongolia:976|Montenegro:382|Montserrat:1664|Morocco:212|Mozambique:258|Myanmar:95|Namibia:264|Nauru:674|Nepal:977|Netherlands:31|New Caledonia:687|New Zealand:64|Nicaragua:505|Niger:227|Nigeria:234|Niue:683|North Korea:850|North Macedonia:389|Northern Mariana Islands:1670|Norway:47|Oman:968|Pakistan:92|Palau:680|Palestine:970|Panama:507|Papua New Guinea:675|Paraguay:595|Peru:51|Philippines:63|Poland:48|Portugal:351|Puerto Rico:1787|Qatar:974|Réunion:262|Romania:40|Russia:7|Rwanda:250|Saint Helena:290|Saint Kitts and Nevis:1869|Saint Lucia:1758|Saint Pierre and Miquelon:508|Saint Vincent and the Grenadines:1784|Samoa:685|San Marino:378|São Tomé and Príncipe:239|Saudi Arabia:966|Senegal:221|Serbia:381|Seychelles:248|Sierra Leone:232|Singapore:65|Sint Maarten:1721|Slovakia:421|Slovenia:386|Solomon Islands:677|Somalia:252|South Africa:27|South Korea:82|South Sudan:211|Spain:34|Sri Lanka:94|Sudan:249|Suriname:597|Sweden:46|Switzerland:41|Syria:963|Taiwan:886|Tajikistan:992|Tanzania:255|Thailand:66|Timor-Leste:670|Togo:228|Tokelau:690|Tonga:676|Trinidad and Tobago:1868|Tunisia:216|Turkey:90|Turkmenistan:993|Turks and Caicos Islands:1649|Tuvalu:688|Uganda:256|Ukraine:380|United Arab Emirates:971|United Kingdom:44|United States:1|Uruguay:598|US Virgin Islands:1340|Uzbekistan:998|Vanuatu:678|Vatican City:39|Venezuela:58|Vietnam:84|Wallis and Futuna:681|Yemen:967|Zambia:260|Zimbabwe:263";
  document.querySelectorAll('input[type="tel"]').forEach(function (input) {
    var select = document.createElement('select');
    select.className = 'phone-code';
    select.setAttribute('aria-label', 'Country code');
    NH_DIAL_CODES.split('|').forEach(function (entry) {
      var parts = entry.split(':');
      var opt = document.createElement('option');
      opt.value = parts[1];
      opt.setAttribute('data-full', parts[0] + ' (+' + parts[1] + ')');
      opt.textContent = opt.getAttribute('data-full');
      if (parts[0] === 'Nepal') { opt.selected = true; opt.defaultSelected = true; }
      select.appendChild(opt);
    });

    // Closed, the dropdown shows just the code (+977); open, the full country names.
    var showFull = function () {
      Array.prototype.forEach.call(select.options, function (o) { o.textContent = o.getAttribute('data-full'); });
    };
    var showShort = function () {
      showFull();
      var cur = select.options[select.selectedIndex];
      if (cur) { cur.textContent = '+' + cur.value; }
    };
    select.addEventListener('mousedown', showFull);
    select.addEventListener('focus', showFull);
    select.addEventListener('change', showShort);
    select.addEventListener('blur', showShort);
    if (input.form) {
      input.form.addEventListener('reset', function () { setTimeout(showShort, 0); });
    }
    showShort();

    var wrap = document.createElement('div');
    wrap.className = 'phone-field';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(select);
    wrap.appendChild(input);
  });

  function nhPhoneVal(id) {
    var input = document.getElementById(id);
    var number = input ? input.value.trim() : '';
    if (!number || number.charAt(0) === '+') { return number; }
    var select = input.parentNode.querySelector('.phone-code');
    return select ? '+' + select.value + ' ' + number : number;
  }

  // Pop-up message in the site's style (used in place of the browser's alert).
  // steps is an optional list of numbered lines; onClose runs once it is dismissed.
  function nhPopup(title, lead, steps, buttonLabel, onClose) {
    var dialog = document.createElement('dialog');
    if (!dialog.showModal) {
      window.alert([title, lead].concat(steps || []).join('\n\n'));
      if (onClose) { onClose(); }
      return;
    }
    dialog.className = 'nh-popup';
    dialog.setAttribute('aria-labelledby', 'nh-popup-title');

    var icon = document.createElement('div');
    icon.className = 'nh-popup-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
    dialog.appendChild(icon);

    var h = document.createElement('h2');
    h.id = 'nh-popup-title';
    h.textContent = title;
    dialog.appendChild(h);

    var p = document.createElement('p');
    p.className = 'nh-popup-lead';
    p.textContent = lead;
    dialog.appendChild(p);

    if (steps && steps.length) {
      var ol = document.createElement('ol');
      ol.className = 'nh-popup-steps';
      steps.forEach(function (text) {
        var li = document.createElement('li');
        li.textContent = text;
        ol.appendChild(li);
      });
      dialog.appendChild(ol);
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary';
    btn.textContent = buttonLabel;
    btn.addEventListener('click', function () { dialog.close(); });
    dialog.appendChild(btn);

    // a click on the dimmed area outside the box also closes it
    dialog.addEventListener('click', function (e) { if (e.target === dialog) { dialog.close(); } });
    dialog.addEventListener('close', function () {
      dialog.parentNode.removeChild(dialog);
      if (onClose) { onClose(); }
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    btn.focus();
  }

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
      window.location.href = 'mailto:info@newhopenepal.org?subject=' + subject + '&body=' + body;

      if (status) {
        status.textContent = lang === 'np'
          ? 'info@newhopenepal.org मा यो पठाउन तपाईंको इमेल एप खोल्दै…'
          : 'Opening your email app to send this to info@newhopenepal.org…';
        status.style.display = 'block';
      }
    });
  }

  // Youth Camp registration form, in two steps:
  //   1. The camper fills in the form and presses "Send me the payment details".
  //      The details are saved to the church's Google Sheet (through its Apps
  //      Script web app) and the payment QR is emailed to them.
  //   2. After paying they come back, upload a screenshot of the payment
  //      confirmation, and submit. The form is kept in this browser meanwhile.
  // The matching Apps Script is in apps-script/youth-camp-registration.gs.
  // Paste the web app URL (ends in /exec) between the quotes below. The Give
  // page's forms post to the same address.
  var NH_FORMS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyl0BKUZz51uL5LpYmp-CnjN9zsqAX1nzhUzOD8lQJRDD_rSSCfLtHQMlKZUBLJ7ppX/exec';
  var NH_YC_DRAFT_KEY = 'nhYouthCampDraft';
  var ycForm = document.getElementById('youth-camp-form');
  var ycStatus = document.getElementById('yc-status');
  var ycGuardianHint = document.getElementById('yc-guardian-hint');
  if (ycForm) {
    var ycRequestBtn = document.getElementById('yc-request-btn');
    var ycPaymentStep = document.getElementById('yc-payment-step');
    var ycScreenshot = document.getElementById('yc-screenshot');
    var ycSubmitBtn = ycForm.querySelector('button[type="submit"]');
    var ycFieldIds = ['yc-name', 'yc-age', 'yc-gender', 'yc-phone', 'yc-email', 'yc-group',
      'yc-guardian-name', 'yc-guardian-phone', 'yc-emergency-name', 'yc-emergency-phone',
      'yc-tshirt', 'yc-notes'];
    var ycRegId = '';

    var ycVal = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    var showStatus = function (en, np) {
      if (!ycStatus) { return; }
      ycStatus.textContent = nhGetLang() === 'np' ? np : en;
      ycStatus.style.display = 'block';
    };

    var ycUpdateHint = function () {
      var a = parseInt(ycVal('yc-age'), 10);
      if (ycGuardianHint) { ycGuardianHint.style.display = (!isNaN(a) && a < 18) ? 'block' : 'none'; }
    };

    var ycShowPaymentStep = function (on) {
      if (ycPaymentStep) { ycPaymentStep.hidden = !on; }
      if (ycRequestBtn) { ycRequestBtn.style.display = on ? 'none' : ''; }
    };

    // Keep the half-finished registration in this browser so the camper can
    // leave to pay and pick up where they left off.
    var ycSaveDraft = function () {
      var draft = { regId: ycRegId, fields: {}, codes: {}, consent: document.getElementById('yc-consent').checked };
      ycFieldIds.forEach(function (id) {
        var el = document.getElementById(id);
        draft.fields[id] = el.value;
        var code = el.parentNode.querySelector('.phone-code');
        if (code) { draft.codes[id] = code.selectedIndex; }
      });
      try { localStorage.setItem(NH_YC_DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* ignore */ }
    };

    var ycClearDraft = function () {
      ycRegId = '';
      try { localStorage.removeItem(NH_YC_DRAFT_KEY); } catch (e) { /* ignore */ }
    };

    var ycRestoreDraft = function () {
      var draft = null;
      try { draft = JSON.parse(localStorage.getItem(NH_YC_DRAFT_KEY)); } catch (e) { /* ignore */ }
      if (!draft || !draft.regId || !draft.fields) { return; }
      ycRegId = draft.regId;
      ycFieldIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (draft.fields[id] != null) { el.value = draft.fields[id]; }
        var code = el.parentNode.querySelector('.phone-code');
        if (code && draft.codes && draft.codes[id] != null) {
          code.selectedIndex = draft.codes[id];
          code.dispatchEvent(new Event('change'));
        }
      });
      document.getElementById('yc-consent').checked = !!draft.consent;
      ycShowPaymentStep(true);
    };

    // Reads the form, shows a message and returns null if something is missing.
    var ycCollect = function () {
      var lang = nhGetLang();
      var f = {
        name: ycVal('yc-name'),
        age: ycVal('yc-age'),
        gender: ycVal('yc-gender'),
        phone: nhPhoneVal('yc-phone'),
        email: ycVal('yc-email'),
        home_church: ycVal('yc-group'),
        guardian_name: ycVal('yc-guardian-name'),
        guardian_phone: nhPhoneVal('yc-guardian-phone'),
        emergency_name: ycVal('yc-emergency-name'),
        emergency_phone: nhPhoneVal('yc-emergency-phone'),
        tshirt_size: ycVal('yc-tshirt'),
        notes: ycVal('yc-notes')
      };
      var consent = document.getElementById('yc-consent');

      var ageNum = parseInt(f.age, 10);
      var isMinor = f.age !== '' && !isNaN(ageNum) && ageNum < 18;

      var emailOk = /^\S+@\S+\.\S+$/.test(f.email);
      var missingCore = !f.name || !f.age || !f.phone || !f.emergency_name || !f.emergency_phone;
      var missingGuardian = isMinor && (!f.guardian_name || !f.guardian_phone);
      var missingConsent = consent && !consent.checked;

      if (missingCore || !emailOk || missingGuardian || missingConsent) {
        if (ycStatus) {
          if (missingCore) {
            ycStatus.textContent = lang === 'np'
              ? 'कृपया पठाउनुअघि सबै आवश्यक फिल्डहरू भर्नुहोस्।'
              : 'Please fill in every required field before sending.';
          } else if (!emailOk) {
            ycStatus.textContent = lang === 'np'
              ? 'कृपया सही इमेल ठेगाना लेख्नुहोस् — भुक्तानी विवरण त्यहीँ पठाइनेछ।'
              : 'Please enter a valid email address — the payment details are sent there.';
          } else if (missingGuardian) {
            ycStatus.textContent = lang === 'np'
              ? 'कृपया १८ वर्षमुनिका सहभागीहरूका लागि अभिभावकको नाम र फोन नम्बर भर्नुहोस्।'
              : 'Please add a parent/guardian name and phone number for campers under 18.';
          } else {
            ycStatus.textContent = lang === 'np'
              ? 'कृपया पठाउनुअघि सहमति बक्समा चेक गर्नुहोस्।'
              : 'Please check the consent box before sending.';
          }
          ycStatus.style.display = 'block';
        }
        return null;
      }
      return f;
    };

    var ycPost = function (stage, f, screenshot) {
      var data = new URLSearchParams();
      Object.keys(f).forEach(function (k) { data.append(k, f[k]); });
      data.append('consent', 'yes');
      data.append('stage', stage);
      data.append('reg_id', ycRegId);
      data.append('website', ycVal('yc-website'));
      if (screenshot) { data.append('screenshot', screenshot); }
      return fetch(NH_FORMS_ENDPOINT, { method: 'POST', body: data })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (!json || !json.ok) { throw new Error('not saved'); }
        });
    };

    // Shrinks the screenshot so it uploads quickly; resolves with base64 JPEG data.
    var ycReadScreenshot = function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = reject;
        reader.onload = function () {
          var img = new Image();
          img.onerror = reject;
          img.onload = function () {
            var scale = Math.min(1, 1600 / Math.max(img.width, img.height));
            var canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    };

    var ycSendFailed = function () {
      showStatus(
        'Sorry, that could not be sent. Please try again, or email info@newhopenepal.org.',
        'माफ गर्नुहोस्, पठाउन सकिएन। कृपया फेरि प्रयास गर्नुहोस्, वा info@newhopenepal.org मा इमेल गर्नुहोस्।'
      );
    };

    // Step 1: save the details and ask for the payment QR by email.
    var ycRequestPayment = function () {
      var f = ycCollect();
      if (!f) { return; }
      if (!ycRegId) { ycRegId = 'YC-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

      if (ycRequestBtn) { ycRequestBtn.disabled = true; }
      showStatus('Sending your details…', 'तपाईंको विवरण पठाउँदै…');

      ycPost('details', f)
        .then(function () {
          ycSaveDraft();
          ycShowPaymentStep(true);
          var np = nhGetLang() === 'np';
          showStatus(
            'Check your email for the payment QR code. After paying, upload the payment screenshot below and submit.',
            'भुक्तानीको QR कोडका लागि आफ्नो इमेल हेर्नुहोस्। भुक्तानी गरेपछि तल भुक्तानीको स्क्रिनसट अपलोड गरी पेस गर्नुहोस्।'
          );
          nhPopup(
            np ? 'आफ्नो इमेल हेर्नुहोस्' : 'Check your email',
            np
              ? 'धन्यवाद! भुक्तानीको QR कोड चर्चको आधिकारिक इमेलबाट ' + f.email + ' मा पठाइनेछ।'
              : 'Thank you! The payment QR code will be sent to ' + f.email + ' from the church\'s official email.',
            np
              ? ['QR कोड प्रयोग गरी दर्ता शुल्क बुझाउनुहोस्।',
                 'यही पृष्ठमा फर्केर भुक्तानी पुष्टिको स्क्रिनसट अपलोड गर्नुहोस्।',
                 'दर्ता पूरा गर्न फारम पेस गर्नुहोस्।']
              : ['Pay the registration fee using the QR code.',
                 'Come back to this page and upload a screenshot of the payment confirmation.',
                 'Submit the form to complete your registration.'],
            np ? 'ठिक छ' : 'Got it',
            function () {
              if (ycPaymentStep) { ycPaymentStep.scrollIntoView({ block: 'center' }); }
            }
          );
        })
        .catch(function () {
          if (!ycPaymentStep || ycPaymentStep.hidden) { ycRegId = ''; }
          ycSendFailed();
        })
        .then(function () { if (ycRequestBtn) { ycRequestBtn.disabled = false; } });
    };

    if (ycRequestBtn) { ycRequestBtn.addEventListener('click', ycRequestPayment); }

    // Step 2: upload the payment screenshot and finish the registration.
    ycForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!ycPaymentStep || ycPaymentStep.hidden) { ycRequestPayment(); return; }

      var f = ycCollect();
      if (!f) { return; }
      var file = ycScreenshot && ycScreenshot.files[0];
      if (!file) {
        showStatus(
          'Please upload a screenshot of your payment confirmation before submitting.',
          'कृपया पेस गर्नुअघि भुक्तानी पुष्टिको स्क्रिनसट अपलोड गर्नुहोस्।'
        );
        return;
      }

      if (ycSubmitBtn) { ycSubmitBtn.disabled = true; }
      showStatus('Sending your registration…', 'तपाईंको दर्ता पठाउँदै…');

      ycReadScreenshot(file)
        .then(function (screenshot) { return ycPost('payment', f, screenshot); })
        .then(function () {
          ycClearDraft();
          ycForm.reset();
          ycShowPaymentStep(false);
          ycUpdateHint();
          showStatus(
            'Registration complete — thank you! We have received your payment screenshot and will confirm your place by email.',
            'दर्ता पूरा भयो — धन्यवाद! हामीले तपाईंको भुक्तानीको स्क्रिनसट प्राप्त गरेका छौं र इमेलमार्फत तपाईंको स्थान पक्का गर्नेछौं।'
          );
        })
        .catch(ycSendFailed)
        .then(function () { if (ycSubmitBtn) { ycSubmitBtn.disabled = false; } });
    });

    // Changes made while waiting to pay are kept too.
    ycForm.addEventListener('change', function () { if (ycRegId) { ycSaveDraft(); } });

    // Show a hint (and expect guardian details) once the entered age is under 18.
    var ycAge = document.getElementById('yc-age');
    if (ycAge) { ycAge.addEventListener('input', ycUpdateHint); }

    ycRestoreDraft();
    ycUpdateHint();
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

    // Bank transfer / digital wallet forms: the visitor leaves their details and
    // the church's Apps Script emails them the bank details or the payment QR.
    giving.querySelectorAll('.give-form').forEach(function (giveForm) {
      var method = giveForm.getAttribute('data-method');
      var giveStatus = giveForm.querySelector('.give-status');
      var giveBtn = giveForm.querySelector('button[type="submit"]');
      var say = function (en, np) {
        giveStatus.textContent = nhGetLang() === 'np' ? np : en;
        giveStatus.style.display = 'block';
      };

      giveForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('give-' + method + '-name').value.trim();
        var email = document.getElementById('give-' + method + '-email').value.trim();

        if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
          say('Please add your name and a valid email address before sending.',
            'कृपया पठाउनुअघि आफ्नो नाम र सही इमेल ठेगाना भर्नुहोस्।');
          return;
        }

        var data = new URLSearchParams();
        data.append('form', 'giving');
        data.append('method', method);
        data.append('fund', giving.getAttribute('data-fund'));
        data.append('name', name);
        data.append('email', email);
        data.append('phone', nhPhoneVal('give-' + method + '-phone'));
        data.append('website', giveForm.querySelector('.give-website').value);

        giveBtn.disabled = true;
        say('Sending your details…', 'तपाईंको विवरण पठाउँदै…');

        fetch(NH_FORMS_ENDPOINT, { method: 'POST', body: data })
          .then(function (res) { return res.json(); })
          .then(function (json) {
            if (!json || !json.ok) { throw new Error('not saved'); }
            giveForm.reset();
            giveStatus.style.display = 'none';
            var np = nhGetLang() === 'np';
            if (method === 'bank') {
              nhPopup(
                np ? 'आफ्नो इमेल हेर्नुहोस्' : 'Check your email',
                np
                  ? 'धन्यवाद! चर्चको बैंक विवरण चर्चको आधिकारिक इमेलबाट ' + email + ' मा पठाइनेछ।'
                  : 'Thank you! The church\'s bank details will be sent to ' + email + ' from our official email.',
                np
                  ? ['इमेलमा दिइएको बैंक विवरण प्रयोग गरी रकम पठाउनुहोस्।',
                     'भुक्तानी रिमार्क्समा आफ्नो नाम र भेटीको प्रकार लेख्नुहोस्।']
                  : ['Use the bank details in the email to make your transfer.',
                     'In the payment remarks, write your name and the type of giving.'],
                np ? 'ठिक छ' : 'Got it'
              );
            } else {
              nhPopup(
                np ? 'आफ्नो इमेल हेर्नुहोस्' : 'Check your email',
                np
                  ? 'धन्यवाद! QR कोड चर्चको आधिकारिक इमेलबाट ' + email + ' मा पठाइनेछ।'
                  : 'Thank you! A QR code will be sent to ' + email + ' from our official email.',
                np
                  ? ['आफ्नो वालेट वा बैंकिङ एपले QR कोड स्क्यान गरी भेटी दिनुहोस्।',
                     'भुक्तानी रिमार्क्समा आफ्नो नाम र भेटीको प्रकार लेख्नुहोस्।']
                  : ['Scan the QR code with your wallet or banking app to give.',
                     'In the payment remarks, write your name and the type of giving.'],
                np ? 'ठिक छ' : 'Got it'
              );
            }
          })
          .catch(function () {
            say('Sorry, that could not be sent. Please try again, or email info@newhopenepal.org.',
              'माफ गर्नुहोस्, पठाउन सकिएन। कृपया फेरि प्रयास गर्नुहोस्, वा info@newhopenepal.org मा इमेल गर्नुहोस्।');
          })
          .then(function () { giveBtn.disabled = false; });
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