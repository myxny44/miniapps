/* Shared Telegram safe-area helper: sets --sa-top/bottom/left/right on <html>
   from Telegram.WebApp.safeAreaInset + contentSafeAreaInset (Bot API 8.0). */
(function () {
  var tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;
  function apply() {
    var s = tg.safeAreaInset || {}, c = tg.contentSafeAreaInset || {};
    if (!tg.safeAreaInset && !tg.contentSafeAreaInset) return; // keep CSS/env() fallback
    var st = document.documentElement.style;
    ['top', 'bottom', 'left', 'right'].forEach(function (k) {
      st.setProperty('--sa-' + k, ((+s[k] || 0) + (+c[k] || 0)) + 'px');
    });
  }
  apply();
  try {
    ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged'].forEach(function (ev) {
      tg.onEvent(ev, apply);
    });
  } catch (e) {}
})();
