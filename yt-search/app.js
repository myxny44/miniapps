'use strict';
const PAGE_SIZE = 20, SHORTS_MAX_SEC = 60;
const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const LS = { key: 'yts_key', q: 'yts_q', kind: 'yts_kind', from: 'yts_from' };
const $ = id => document.getElementById(id);
const tg = window.Telegram && window.Telegram.WebApp;
const inTelegram = !!(tg && tg.initData && tg.platform && tg.platform !== 'unknown');
if (!inTelegram) { document.getElementById('gate').hidden = false; throw new Error('Not in Telegram'); }
try { tg.ready(); tg.expand(); } catch (e) {}
document.getElementById('app').hidden = false; document.getElementById('hdr').hidden = false;
const openLink = url => tg.openLink(url);

let pageTokens = [''], pageIndex = 0, nextPageToken = '';
const pad = n => String(n).padStart(2, '0');
const toLocalInput = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toRfc3339 = v => { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toISOString().replace(/\.\d{3}Z$/, 'Z'); };

function relativeTime(iso) {
  const t = Date.parse(iso); if (isNaN(t)) return iso || '';
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec} s ago`;
  const m = Math.floor(sec / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d} d ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo} mo ago`;
  return `${Math.floor(d / 365)} y ago`;
}
function parseDuration(v) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(v || '');
  if (!m) return 0;
  return (+m[1]||0)*86400 + (+m[2]||0)*3600 + (+m[3]||0)*60 + (+m[4]||0);
}
async function getJson(url) {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data.error && data.error.message) || `HTTP ${r.status}`);
  return data;
}
async function searchNewest(key, q, kind, from, to, pageToken) {
  const p = new URLSearchParams({ part: 'snippet', q, type: 'video', order: 'date',
    maxResults: String(kind === 'all' ? PAGE_SIZE : 50), safeSearch: 'none', key });
  if (pageToken) p.set('pageToken', pageToken);
  let after = toRfc3339(from), before = toRfc3339(to);
  if (after && before && after > before) [after, before] = [before, after];
  if (after) p.set('publishedAfter', after);
  if (before) p.set('publishedBefore', before);
  const data = await getJson(`${SEARCH_URL}?${p}`);
  const raw = (data.items || []).filter(it => it.id && it.id.videoId).map(it => {
    const sn = it.snippet || {}, th = sn.thumbnails || {};
    return { id: it.id.videoId, title: sn.title || '', channel: sn.channelTitle || '', publishedAt: sn.publishedAt || '',
      thumb: (th.medium || th.high || th.default || {}).url || '' };
  });
  const dur = {};
  if (raw.length) {
    const v = await getJson(`${VIDEOS_URL}?${new URLSearchParams({ part: 'contentDetails', id: raw.map(x => x.id).join(','), key })}`);
    for (const it of v.items || []) dur[it.id] = parseDuration((it.contentDetails || {}).duration);
  }
  const items = [];
  for (const it of raw) {
    const sec = dur[it.id] || 0, isShort = sec > 0 && sec <= SHORTS_MAX_SEC;
    if (kind === 'shorts' && !isShort) continue;
    if (kind === 'video' && isShort) continue;
    items.push({ ...it, isShort, url: isShort ? `https://www.youtube.com/shorts/${it.id}` : `https://www.youtube.com/watch?v=${it.id}` });
    if (items.length >= PAGE_SIZE) break;
  }
  return { items, nextPageToken: data.nextPageToken || '' };
}
// Titles from the API come HTML-escaped (&amp; etc.)
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };

function render(items) {
  const list = $('list'); list.innerHTML = '';
  for (const it of items) {
    const a = document.createElement('a'); a.className = 'item'; a.href = it.url;
    a.addEventListener('click', e => { e.preventDefault(); openLink(it.url); });
    if (it.thumb) { const img = document.createElement('img'); img.src = it.thumb; img.alt = ''; img.loading = 'lazy'; a.appendChild(img); }
    const body = document.createElement('div');
    const title = document.createElement('div'); title.className = 'title'; title.textContent = decode(it.title);
    const meta = document.createElement('div'); meta.className = 'meta';
    const badge = document.createElement('span'); badge.className = 'badge' + (it.isShort ? ' shorts' : ''); badge.textContent = it.isShort ? 'Shorts' : 'Video';
    meta.append(badge, `${relativeTime(it.publishedAt)} · ${decode(it.channel)}`);
    body.append(title, meta); a.appendChild(body); list.appendChild(a);
  }
}
function setStatus(t, err) { $('status').textContent = t; $('status').className = err ? 'err' : ''; }

async function run(reset) {
  const key = localStorage.getItem(LS.key) || '';
  const q = $('q').value.trim(), kind = $('kind').value, from = $('from').value, to = $('to').value;
  if (!key) { $('settings').hidden = false; setStatus('Enter your API key first', true); return; }
  if (!q) { setStatus('Enter a query', true); return; }
  localStorage.setItem(LS.q, q); localStorage.setItem(LS.kind, kind); localStorage.setItem(LS.from, from);
  if (reset) { pageTokens = ['']; pageIndex = 0; nextPageToken = ''; }
  $('go').disabled = $('prev').disabled = $('next').disabled = true;
  setStatus('Searching…');
  try {
    const r = await searchNewest(key, q, kind, from, to, pageTokens[pageIndex] || '');
    nextPageToken = r.nextPageToken; render(r.items);
    setStatus(r.items.length ? `On this page: ${r.items.length}` : 'No results');
    $('pager').hidden = false; $('prev').disabled = pageIndex <= 0; $('next').disabled = !nextPageToken;
    $('pageInfo').textContent = `Page ${pageIndex + 1}`;
    window.scrollTo({ top: 0 });
  } catch (e) { setStatus(String(e.message || e), true); $('pager').hidden = true; }
  finally { $('go').disabled = false; }
}

$('q').value = localStorage.getItem(LS.q) || '';
$('kind').value = localStorage.getItem(LS.kind) || 'all';
$('from').value = localStorage.getItem(LS.from) || '';
$('to').value = toLocalInput(new Date());
$('key').value = localStorage.getItem(LS.key) || '';
if (!$('key').value) $('settings').hidden = false;
$('gear').addEventListener('click', () => { $('settings').hidden = !$('settings').hidden; });
$('saveKey').addEventListener('click', () => {
  const k = $('key').value.trim(); if (k) localStorage.setItem(LS.key, k); else localStorage.removeItem(LS.key);
  $('settings').hidden = !!k; setStatus(k ? 'Key saved' : 'Key removed');
});
$('go').addEventListener('click', () => run(true));
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.target.blur(); run(true); } });
$('toNow').addEventListener('click', () => { $('to').value = toLocalInput(new Date()); });
$('prev').addEventListener('click', () => { if (pageIndex > 0) { pageIndex--; run(false); } });
$('next').addEventListener('click', () => { if (!nextPageToken) return; pageIndex++; pageTokens[pageIndex] = nextPageToken; run(false); });
