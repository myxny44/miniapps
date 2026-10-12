# miniapps
Test Telegram Mini Apps on GitHub Pages.

- `yt-search/` — YouTube search, newest first (API key entered in-app, stored in localStorage). Works only inside Telegram.

## Required in every mini app
Include the shared Telegram safe-area code (fullscreen mode: status bar + Telegram's Close/⋯ buttons), after telegram-web-app.js:
```html
<link rel="stylesheet" href="../shared/tg-safe-area.css?v=N">
<script src="../shared/tg-safe-area.js?v=N"></script>
```
Don't set `padding` on `body` in the app's own CSS (it would override the safe-area padding); pad inner containers instead.
