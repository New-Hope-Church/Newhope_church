// Light / dark theme, picked before the page paints so it never flashes white.
// Loaded in <head>. Uses the visitor's saved choice (set by the header button
// in script.js), otherwise their device setting.
(function () {
  var t = null;
  try { t = localStorage.getItem('nh-theme'); } catch (e) { /* storage blocked */ }
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
  // the phone's browser bar matches the navbar
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) { meta.setAttribute('content', t === 'dark' ? '#0E0E0E' : '#FFFFFF'); }
})();
