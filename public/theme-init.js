// Apply the saved theme before first paint (no flash). Reads a preference only — never user text.
(function () {
  try {
    var t = localStorage.getItem('shim:theme');
    var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
