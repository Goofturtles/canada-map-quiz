// Canada map check-in: Study, Practice, Place and Mock test on one map.
(() => {
'use strict';

const W = 1200, H = 930;
// The corners the map has to fit: Russia, the Pacific, the bottom of the Great Lakes, the Atlantic, Iceland, Ellesmere.
const FRAME = { type: 'MultiPoint', coordinates: [[-178, 66], [-136, 47], [-87, 41.3], [-81, 41.3], [-52, 43], [-13.5, 65], [-75, 83.6]] };
const SHAPE_KIND = { province: 'p', country: 'c', lake: 'l', river: 'r' };
// Where a name can sit beside its point, in order of preference: right, left, above, below, then the four corners.
// [dx, dy, text-anchor]
const SIDES = [[12, 4, 'start'], [-12, 4, 'end'], [0, -13, 'middle'], [0, 22, 'middle'],
  [8, -8, 'start'], [8, 17, 'start'], [-8, -8, 'end'], [-8, 17, 'end']];
const KEY = 'canada-map:v1';

const $ = s => document.querySelector(s);
const panel = $('#panel');
if (!window.d3 || typeof MAP === 'undefined') {
  panel.innerHTML = '<p class="tip">Part of the app is missing: it needs vendor/d3.min.js and map.js next to index.html.</p>';
  return;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = list => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const catOf = it => CATS.find(c => c.id === it.cat);
const byId = id => ITEMS.find(it => it.id === id);

// ── Checking a typed answer ──────────────────────────────────────────────────

// Capitals, accents, full stops and apostrophes never matter.
const norm = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/&/g, ' and ').replace(/['\u2018\u2019\u02bc\u00b4\u2032`.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
  .replace(/\bsaint\b/g, 'st').replace(/^the /, '')
  .replace(/\b([a-z]) (?=[a-z]\b)/g, '$1');   // "B. C." and "P. E. I." read as bc and pei

// Words that say what kind of thing it is. Leaving one out is fine ("Superior", "Fraser"), and so is leaving out
// "Great" ("Bear Lake"). Writing the WRONG kind is not: "Hudson Strait" is not Hudson Bay.
const KINDS = ['lake', 'river', 'island', 'bay', 'sea', 'ocean', 'strait', 'gulf', 'city'];
const FILLER = ['great', 'of', 'the', ...KINDS];
// Common ways of writing a kind word short, or wrong. ("st" is not here: that is Saint.)
const KIND_FOR = { l: 'lake', lk: 'lake', r: 'river', riv: 'river', i: 'island', is: 'island', isl: 'island', islands: 'island',
  b: 'bay', g: 'gulf', oc: 'ocean', str: 'strait', straight: 'strait', straits: 'strait' };
const words = s => norm(s).split(' ').filter(Boolean).map(w => KIND_FOR[w] || w);
const core = s => words(s).filter(w => !FILLER.includes(w)).join(' ');
const kindsIn = s => words(s).filter(w => KINDS.includes(w));

// For each point: its exact name, the stripped-down forms that count (its name and every `also`), and its kind words.
ITEMS.forEach(it => {
  const forms = [it.name, ...(it.also || [])];
  it.key = norm(it.name);
  it.cores = [...new Set(forms.map(core).filter(Boolean))];
  it.kinds = new Set(forms.flatMap(kindsIn));
});

// Edits needed to turn a into b. Two neighbouring letters swapped ("Hailfax") count as one.
function editDistance(a, b) {
  let before, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j], before[j - 2] + 1);
    }
    before = prev;
    prev = row;
  }
  return prev[b.length];
}

// How many letters off a typed answer is from the nearest form of a point, or Infinity if it is too far to be it.
// Longer names get more slack; abbreviations of three letters or fewer have to be exact.
const slack = n => n < 4 ? 0 : n < 6 ? 1 : n < 10 ? 2 : 3;
function lettersOff(it, typedCore) {
  return Math.min(...it.cores.map(c => {
    const d = editDistance(typedCore, c);
    return d <= slack(c.length) ? d : Infinity;
  }));
}

// 'right' (the full name), 'short' (a shorter form or abbreviation), 'close' (spelling a bit off) or 'wrong'.
// Everything but 'wrong' gets the mark: it only has to be clear which thing is meant.
function judge(it, typed) {
  if (norm(typed) === it.key) return 'right';
  if (kindsIn(typed).some(k => !it.kinds.has(k))) return 'wrong';
  const c = core(typed);
  if (!c) return 'wrong';
  const off = lettersOff(it, c);
  if (off === Infinity) return 'wrong';
  // It must be clearly this one: nothing else in the same group may fit as well or better...
  if (ITEMS.some(o => o.cat === it.cat && o.name !== it.name && lettersOff(o, c) <= off)) return 'wrong';
  // ...and a name that is exactly some other point's ("Huron" for Hudson Bay) is a wrong answer, not a spelling slip.
  if (off && ITEMS.some(o => o.name !== it.name && o.cores.includes(c))) return 'wrong';
  return off ? 'close' : 'short';
}
const earns = verdict => verdict !== 'wrong';

// ── Saved progress ───────────────────────────────────────────────────────────

const store = Object.assign({ streak: {}, cats: CATS.map(c => c.id), typing: false, names: true, mode: 'study' }, readStore());
if (!store.streak || typeof store.streak !== 'object') store.streak = {};
store.cats = Array.isArray(store.cats) ? store.cats.filter(id => CATS.some(c => c.id === id)) : CATS.map(c => c.id);

function readStore() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* private window: just don't remember */ }
}
// "Nailed" means typed right twice in a row. Multiple choice never earns it, though a wrong pick still loses it.
const nailed = it => store.streak[it.id] >= 2;
function record(it, right) {
  store.streak[it.id] = right ? (store.streak[it.id] || 0) + 1 : 0;
  save();
  drawProgress();
}
function drawProgress() {
  $('#progress').innerHTML = `<b>${ITEMS.filter(nailed).length}</b> of ${ITEMS.length} nailed`;
}
const selected = () => ITEMS.filter(it => store.cats.includes(it.cat));

// Buttons that throw work away need a second click. True on the second one.
function confirmed(b, question) {
  if (b.dataset.sure) {
    b.textContent = b.dataset.sure;
    delete b.dataset.sure;
    return true;
  }
  b.dataset.sure = b.textContent;
  b.textContent = question;
  // Back to normal when you move on, or after a few seconds (a tap on an iPhone never focuses the button, so
  // there would be no blur to wait for).
  const disarm = () => {
    if (b.dataset.sure) { b.textContent = b.dataset.sure; delete b.dataset.sure; }
  };
  b.addEventListener('blur', disarm, { once: true });
  setTimeout(disarm, 4000);
  return false;
}

// ── The map ──────────────────────────────────────────────────────────────────

const svg = d3.select('#map');
const root = svg.append('g');
const layer = name => root.append('g').attr('class', name);
const gForeign = layer('foreign'), gProvinces = layer('provinces'), gLakes = layer('lakes'), gRivers = layer('rivers'), gMarkers = layer('markers');
const projection = d3.geoConicConformal().parallels([49, 77]).rotate([96, 0]).fitExtent([[24, 24], [W - 24, H - 24]], FRAME);
projection.clipExtent([[-900, -700], [W + 900, H + 700]]);
const path = d3.geoPath(projection);
// clickDistance: a click that wobbles a few pixels is still a click on a point, not a drag of the map.
const zoom = d3.zoom().clickDistance(5).scaleExtent([1, 14]).translateExtent([[-200, -160], [W + 200, H + 160]])
  .on('zoom', e => {
    if (e.sourceEvent) watching = null;   // he moved the map himself, so stop steering it back to the point
    root.attr('transform', e.transform);
    placeMarkers();
  });
// The pin marks the spot he chooses in Place mode. pin = { xy (drawing units), lonlat, slackKm } or null.
const pinMark = root.append('g').attr('class', 'pin');
pinMark.append('circle').attr('r', 9);
pinMark.append('path').attr('d', 'M-4,0H4M0,-4V4');
let pin = null;
let markers = gMarkers.selectAll('g');
let watching = null;   // the point a 'near' view is following, so it can be re-centred when the screen changes size
// Map moves are animated, unless the device is set to reduce motion.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
const glide = ms => svg.transition().duration(calm.matches ? 0 : ms);
const wholeMap = () => glide(300).call(zoom.transform, d3.zoomIdentity);

function drawMap() {
  const shapes = (g, list, kind, key) => g.selectAll('path').data(list).join('path').attr('d', d => path(d.geometry)).attr('data-shape', d => kind + ':' + d[key]);
  shapes(gForeign, MAP.countries, 'c', 'id');
  shapes(gProvinces, MAP.provinces, 'p', 'code');
  shapes(gLakes, MAP.lakes, 'l', 'name');

  // The other rivers in map.js are plain lines; the six on the list come from rivers.js so they can light up.
  gRivers.selectAll('path').data(MAP.rivers).join('path').attr('d', path);
  gRivers.selectAll('path.listed').data(Object.entries(RIVERS)).join('path').attr('class', 'listed')
    .attr('d', d => path({ type: 'MultiLineString', coordinates: d[1] })).attr('data-shape', d => 'r:' + d[0]);

  ITEMS.forEach(it => {
    const pt = it.snap
      ? RIVERS[it.shape].flat().reduce((best, p) => d3.geoDistance(p, it.pt) < d3.geoDistance(best, it.pt) ? p : best)
      : it.pt;
    it.xy = projection(pt);
  });

  markers = gMarkers.selectAll('g').data(ITEMS).join('g').attr('role', 'button')
    .on('click', e => pickOnMap(nearest(e)))
    .on('keydown', (e, d) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      pickOnMap(d);
    });
  markers.append('circle').attr('class', 'hit').attr('r', 16);   // invisible, so a fingertip doesn't have to land on the dot
  markers.append('circle').attr('class', 'ring').attr('r', 8);
  markers.append('circle').attr('class', 'dot').attr('r', 5);
  markers.append('text').attr('class', 'num').attr('dy', '0.36em');
  markers.append('text').attr('class', d => 'label label-' + d.cat).text(d => d.label || d.name);

  svg.call(zoom).on('dblclick.zoom', null);
  placeMarkers();
}

// Where points crowd together their touch areas overlap, so a click goes to whichever shown point is closest to it,
// not to whichever happens to be drawn on top.
function nearest(e) {
  const [x, y] = d3.pointer(e, root.node());
  return markers.filter('.show').data().reduce((a, b) => Math.hypot(a.xy[0] - x, a.xy[1] - y) <= Math.hypot(b.xy[0] - x, b.xy[1] - y) ? a : b);
}

// Points and names keep the same size on screen however far the map is zoomed or the window is resized.
function placeMarkers() {
  const node = svg.node();
  const fit = Math.min(node.clientWidth / W, node.clientHeight / H) || 1;
  const k = 1 / (d3.zoomTransform(node).k * fit);
  markers.attr('transform', d => `translate(${d.xy[0]},${d.xy[1]}) scale(${k})`);
  if (pin) pinMark.attr('transform', `translate(${pin.xy[0]},${pin.xy[1]}) scale(${k})`);
  placeLabels();
}

// Each visible name takes the first free spot beside its point. A name with no free spot is left off
// until the map is zoomed in far enough to make room for it.
function placeLabels() {
  const node = svg.node(), t = d3.zoomTransform(node), cw = node.clientWidth, ch = node.clientHeight;
  const fit = Math.min(cw / W, ch / H) || 1, ox = (cw - W * fit) / 2, oy = (ch - H * fit) / 2;
  const at = d => [t.applyX(d.xy[0]) * fit + ox, t.applyY(d.xy[1]) * fit + oy];
  const shown = markers.filter('.show');
  // Boxes already in use: [left, top, right, bottom, owner]. Every point's dot first, then names as they are placed.
  const taken = shown.data().map(d => { const [x, y] = at(d); return [x - 10, y - 10, x + 10, y + 10, d]; });
  const free = (b, d) => b[0] >= 0 && b[1] >= 0 && b[2] <= cw && b[3] <= ch
    && !taken.some(o => o[4] !== d && b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
  shown.filter('.named').each(function (d) {
    const label = d3.select(this).select('.label'), w = label.node().getComputedTextLength(), [x, y] = at(d);
    const box = ([dx, dy, anchor]) => {
      const x0 = x + dx - (anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0);
      return [x0 - 2, y + dy - 10, x0 + w + 2, y + dy + 3];
    };
    // The point in focus always gets its name, even if it has to overlap.
    const side = SIDES.find(s => free(box(s), d)) || (this.classList.contains('active') ? SIDES[0] : null);
    label.classed('crowded', !side);
    if (!side) return;
    label.attr('x', side[0]).attr('y', side[1]).attr('text-anchor', side[2]);
    taken.push(box(side));
  });
}

// entries: [{ it, cls, num, say }]. Anything not listed is hidden. say = what a screen reader calls the point.
function paint(entries) {
  const by = new Map(entries.map(e => [e.it.id, e]));
  markers.attr('class', d => 'marker ' + catOf(d).section.toLowerCase() + (by.has(d.id) ? ' show ' + (by.get(d.id).cls || '') : ''))
    .attr('tabindex', d => by.has(d.id) ? 0 : null)
    .attr('aria-label', d => by.has(d.id) ? by.get(d.id).say : null);
  markers.select('.num').text(d => (by.has(d.id) && by.get(d.id).num) || '');
}

// Pulse one point. withShape also lights up its province, country, lake or river.
// view says what the map may do to show it: 'keep' (nothing), 'whole' or 'near' (see lookAt).
function spotlight(it, withShape = true, view = 'whole') {
  markers.classed('active', d => d === it);
  const key = it && withShape && SHAPE_KIND[it.cat] ? SHAPE_KIND[it.cat] + ':' + it.shape : null;
  root.selectAll('[data-shape]').classed('hl', function () { return this.dataset.shape === key; });
  if (it) {
    // Bring it to the front so it isn't hidden under a neighbour. Moving a node drops keyboard focus, so hand it back.
    markers.filter(d => d === it).each(function () {
      const focused = document.activeElement === this;
      if (this.nextSibling) this.parentNode.appendChild(this);
      if (focused) this.focus();
    });
  }
  if (view !== 'keep') {
    watching = it && view === 'near' ? it : null;
    if (it) lookAt(it, view === 'near');
  }
  placeLabels();
}

// Keep a point on screen. On a big screen that only means zooming back out to the whole map when the point has
// drifted out of view. On a phone the whole map is too small to tell neighbours apart, so `near` moves in on it.
function lookAt(it, near) {
  const node = svg.node(), t = d3.zoomTransform(node);
  const fit = Math.min(node.clientWidth / W, node.clientHeight / H) || 1;
  // The pane usually shows more than the 1200 x 930 drawing on two sides; mx and my are that extra margin.
  const mx = (node.clientWidth / fit - W) / 2, my = (node.clientHeight / fit - H) / 2;
  const [x, y] = t.apply(it.xy);
  const closeUp = Math.min(4, 0.8 / fit);   // the zoom at which points are about as far apart as on a laptop
  let to = null;
  if (near && closeUp > 2) {   // only on a phone-sized map; a laptop never needs it
    const central = Math.abs(x - W / 2) < (W / 2 + mx) * 0.7 && Math.abs(y - H / 2) < (H / 2 + my) * 0.7;
    const k = Math.max(t.k, closeUp);
    if (t.k < closeUp || !central) to = d3.zoomIdentity.translate(W / 2 - it.xy[0] * k, H / 2 - it.xy[1] * k).scale(k);
  } else {
    const edge = 10 / fit;   // about a dot's width, in map units
    if (x < edge - mx || x > W - edge + mx || y < edge - my || y > H - edge + my) to = d3.zoomIdentity;
  }
  if (to) glide(350).call(zoom.transform, zoom.constrain()(to, [[0, 0], [W, H]], zoom.translateExtent()));
}

function pickOnMap(it) {
  if (mode === 'study') studyPick(it, true);
  else if (mode === 'test' && test) {
    const i = test.items.indexOf(it);
    const el = test.marks ? panel.querySelector(`li[data-i="${i}"]`) : $('#a' + i);
    if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }); }
  }
}

// ── Shared panel pieces ──────────────────────────────────────────────────────

// The groups fold away so they don't push the question off a phone screen. Open by default where there is room.
let catsOpen = window.matchMedia('(min-width: 861px) and (min-height: 501px)').matches;

function catsHtml(locked) {
  const off = locked ? ' disabled' : '';
  const group = section => `<div class="cat-group"><span class="cat-head">${section}</span>` + CATS.filter(c => c.section === section).map(c =>
    `<label class="chip"><input type="checkbox" name="cat" value="${c.id}"${store.cats.includes(c.id) ? ' checked' : ''}${off}><span>${esc(c.label)}</span></label>`).join('') + '</div>';
  const count = store.cats.length === CATS.length ? 'everything' : `${store.cats.length} of ${CATS.length} groups`;
  return `<details class="cats-box"${catsOpen ? ' open' : ''}><summary>On the map <span>${count}</span></summary>
    <fieldset class="cats" aria-label="What is on the map">${group('Places')}${group('Water')}
    <div class="cat-actions"><button type="button" class="link" data-cats="all"${off}>All</button><button type="button" class="link" data-cats="none"${off}>None</button></div></fieldset></details>`;
}

const answerHtml = it => `<p class="answer">${esc(it.name)}</p><p class="hint">${esc(it.hint)}</p>`;
const NOTHING = '<p class="tip">Tick at least one group above.</p>';

// ── Study ────────────────────────────────────────────────────────────────────

function renderStudy() {
  const items = selected();
  const list = () => CATS.filter(c => store.cats.includes(c.id)).map(c => `<h2 class="list-head">${esc(c.label)}</h2><ul class="list">` +
    items.filter(it => it.cat === c.id).map(it =>
      `<li><button type="button" class="row" data-id="${it.id}"><span class="row-name">${esc(it.label || it.name)}</span><span class="row-hint">${esc(it.hint)}</span></button></li>`).join('') + '</ul>').join('');
  panel.innerHTML = catsHtml() +
    `<label class="switch"><input type="checkbox" id="names"${store.names ? ' checked' : ''}><span>Show names</span></label>` +
    (!items.length ? NOTHING
      : store.names ? '<p class="tip">Pick a name below to find it on the map. Zoom in where it gets crowded.</p>' + list()
      : '<p class="tip">Names are hidden. Say what a point is, then press it to check.</p><div id="card" role="status"></div>');
  paint(items.map(it => ({ it, cls: store.names ? 'named' : '', say: store.names ? it.name : 'Point, ' + catOf(it).noun + '. Press Enter to see its name' })));
  spotlight(null);
}

function studyPick(it, fromMap) {
  spotlight(it, true, 'near');
  if (!store.names) {
    $('#card').innerHTML = `<p class="kind">${esc(catOf(it).noun)}</p>` + answerHtml(it);
    markers.classed('named', d => d === it);
    placeLabels();
    return;
  }
  panel.querySelectorAll('.row').forEach(r => r.classList.toggle('on', r.dataset.id === it.id));
  if (fromMap) panel.querySelector(`.row[data-id="${it.id}"]`).scrollIntoView({ block: 'nearest' });
}

// ── Practice ─────────────────────────────────────────────────────────────────

let round = null, queue = [], cur = null, answered = true, weakOnly = false;

function renderPractice() {
  const pool = selected(), weak = pool.filter(it => !nailed(it));
  if (!weak.length) weakOnly = false;
  panel.innerHTML = catsHtml() +
    `<div class="seg" role="group" aria-label="How to answer"><span class="pill"></span>
       <button type="button" data-typing="0" aria-pressed="${!store.typing}">Multiple choice</button>
       <button type="button" data-typing="1" aria-pressed="${store.typing}">Type it</button>
     </div>
     <label class="switch"><input type="checkbox" id="weak"${weakOnly ? ' checked' : ''}${weak.length ? '' : ' disabled'}><span>Only the ones I haven't nailed yet (${weak.length})</span></label>
     <div id="card"></div>`;
  movePill($('.seg'));
  startRound(weakOnly ? weak : pool);
}

function startRound(items) {
  queue = shuffle(items);
  round = { total: items.length, firstTry: 0, missed: new Set() };
  nextQuestion();
}

function nextQuestion() {
  if (!queue.length) return roundDone();
  cur = queue.shift();
  showQuestion();
}

// Three wrong answers, taken from the nearest things of the same kind so they are worth thinking about.
function options(it) {
  const pool = catOf(it).pool;
  const rivals = ITEMS.filter(o => o.name !== it.name && catOf(o).pool === pool)
    .sort((a, b) => (a.cat !== it.cat) - (b.cat !== it.cat) || d3.geoDistance(a.pt, it.pt) - d3.geoDistance(b.pt, it.pt));
  const names = [...new Set(rivals.map(o => o.name))];
  return shuffle([it.name, ...shuffle(names.slice(0, 5)).slice(0, 3)]);
}

function showQuestion() {
  if (mode === 'place') return showPlace();
  answered = false;
  const body = store.typing
    ? `<form id="answer"><input id="typed" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Type the name" aria-label="Your answer"><button class="primary">Check</button></form>
       <button type="button" class="link" id="skip">I don't know</button>`
    : '<div class="options">' + options(cur).map((name, i) => `<button type="button" class="opt" data-name="${esc(name)}"><kbd>${i + 1}</kbd><span>${esc(name)}</span></button>`).join('') + '</div>';
  $('#card').innerHTML = `<p class="meta">${queue.length + 1} to go</p><h2 class="ask">${esc(catOf(cur).ask)}</h2>${body}<div id="feedback" aria-live="polite"></div>`;
  paint([{ it: cur, say: 'The point to name' }]);
  spotlight(cur, true, 'near');
  if (store.typing) $('#typed').focus();
}

// Count an answer for the round, and bring a missed point back in a few questions.
function settle(right) {
  answered = true;
  if (!right) {
    round.missed.add(cur);
    queue.splice(Math.min(queue.length, 3), 0, cur);
  } else if (!round.missed.has(cur)) round.firstTry++;
}

// verdict: what judge() said for a typed answer; 'right' or 'wrong' for a multiple-choice pick.
function answer(given, verdict) {
  if (answered) return;
  const right = earns(verdict);
  settle(right);
  if (store.typing || !right) record(cur, right);

  const onward = queue.length ? 'Next' : 'Finish';
  panel.querySelectorAll('.opt, #skip').forEach(el => { el.disabled = true; });
  // When typing, the box stays live so a phone keeps its keyboard up, and its button turns into Next: Enter in the
  // box then goes on. (A disabled button would stop Enter from doing anything at all.)
  if (store.typing) $('#answer button').textContent = onward;
  panel.querySelectorAll('.opt').forEach(b => {
    if (b.dataset.name === cur.name) b.classList.add('right');
    else if (b.dataset.name === given) b.classList.add('wrong');
  });
  const wrote = given && store.typing ? ` You wrote “${esc(given)}”` : '';
  const verdictText = verdict === 'right' ? 'Correct'
    : verdict === 'short' ? 'Right. The full name:'
    : verdict === 'close' ? 'Right. The exact spelling:'
    : given ? 'Not quite.' + wrote : 'Here it is';
  $('#feedback').innerHTML = `<p class="verdict ${right ? 'right' : 'wrong'}">${verdictText}</p>${answerHtml(cur)}` +
    (store.typing ? '' : `<button type="button" class="primary" id="next">${onward}</button>`);
  markers.filter(d => d === cur).classed('named', true).classed(right ? 'right' : 'wrong', true);
  placeLabels();
  (store.typing ? $('#typed') : $('#next')).focus();
  if (store.typing) $('#feedback').scrollIntoView({ block: 'nearest' });   // with a phone keyboard up it starts out of view
}

function roundDone() {
  cur = null;
  answered = true;
  setPin(null);
  const missed = [...round.missed];
  $('#card').innerHTML = !round.total ? NOTHING
    : `<h2 class="ask">Round done</h2><p class="score"><b>${round.firstTry}</b> of ${round.total} right first time</p>` +
      (missed.length
        ? `<p class="tip">Go over these again:</p><ul class="missed">${missed.map(it => `<li>${esc(it.label || it.name)}</li>`).join('')}</ul>
           <div class="actions"><button type="button" class="primary" data-round="missed">Practise those ${missed.length}</button><button type="button" class="plain" data-round="new">New round</button></div>`
        : '<p class="tip">Clean round. Try the mock test next.</p><div class="actions"><button type="button" class="primary" data-round="new">New round</button></div>');
  paint(missed.map(it => ({ it, cls: 'named wrong', say: it.name })));
  spotlight(null);
  wholeMap();
}

// ── Place ────────────────────────────────────────────────────────────────────
// The other way round from Practice: a question in words, and he names the thing and puts it on the map himself.
// It runs on the same round as Practice (startRound, nextQuestion, roundDone); only the question card differs.

const kmBetween = (a, b) => d3.geoDistance(a, b) * 6371;
// One unit of the drawing in km, measured across the middle of the map. The projection keeps it nearly constant.
const KM_PER_UNIT = kmBetween(projection.invert([W / 2 - 50, H / 2]), projection.invert([W / 2 + 50, H / 2])) / 100;
// How far off (km) a spot may be and still count, where being inside an outline doesn't settle it.
const NEAR_KM = { province: 40, country: 60, lake: 40, island: 60, capital: 120, city: 120, river: 70 };
// Oceans, seas, bays, gulfs and straits have no outline at all: each has a `reach` in data.js instead.
const SALT = ITEMS.filter(it => catOf(it).pool === 'salt');

function renderPlace() {
  panel.innerHTML = catsHtml() + '<div id="card"></div>';
  startRound(selected());
}

function setPin(xy) {
  const node = svg.node(), fit = Math.min(node.clientWidth / W, node.clientHeight / H) || 1;
  // slackKm: nobody can point more exactly than about 14 px, so that much error is forgiven at the current zoom,
  // up to 100 km (beyond that, zooming in is the answer).
  pin = xy && { xy, lonlat: projection.invert(xy), slackKm: Math.min(100, 14 / (d3.zoomTransform(node).k * fit) * KM_PER_UNIT) };
  pinMark.attr('class', pin ? 'pin show' : 'pin');
  placeMarkers();
}

function showPlace() {
  answered = false;
  setPin(null);
  $('#card').innerHTML = `<p class="meta">${queue.length + 1} to go</p><h2 class="ask">${esc(cur.q)}</h2>
    <form id="answer"><input id="typed" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="Type its name" aria-label="Its name"><button class="primary">Check</button></form>
    <p class="tip" id="where">Then click the map where it is.</p>
    <button type="button" class="link" id="skip">I don't know</button>
    <div id="feedback" aria-live="polite"></div>`;
  paint([]);
  spotlight(null);
  svg.classed('placing', true);
  $('#typed').focus();
}

// The outline that counts as "on it": the province, country or lake itself, or for an island the piece of land
// under its point (and under each of its `more` points, where the map draws it as several pieces).
// Cities, rivers and open water have none.
function outline(it) {
  if (it.cat === 'province') return MAP.provinces.find(p => p.code === it.shape).geometry;
  if (it.cat === 'country') return MAP.countries.find(c => c.id === it.shape).geometry;
  if (it.cat === 'lake') return MAP.lakes.find(l => l.name === it.shape).geometry;
  if (it.cat !== 'island') return null;
  const pieces = [];
  for (const p of MAP.provinces) {
    const mainland = ITEMS.find(o => o.shape === p.code).pt;
    for (const coordinates of p.geometry.type === 'MultiPolygon' ? p.geometry.coordinates : [p.geometry.coordinates]) {
      const piece = { type: 'Polygon', coordinates };
      // Manitoulin is not a separate piece in the map data (it is a gap in the lake), so the piece under its point
      // is all of mainland Ontario. That is no use as an outline, so it is left out and its reach decides.
      if ([it.pt, ...(it.more || [])].some(pt => d3.geoContains(piece, pt)) && !d3.geoContains(piece, mainland)) pieces.push(coordinates);
    }
  }
  return pieces.length ? { type: 'MultiPolygon', coordinates: pieces } : null;
}

// km from a spot on the drawing to the nearest stretch of a listed river.
function riverKm(it, [x, y]) {
  let best = Infinity;
  for (const line of RIVERS[it.shape]) {
    const pts = line.map(projection);
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], dx = pts[i][0] - ax, dy = pts[i][1] - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
  }
  return best * KM_PER_UNIT;
}

// Is the spot on water, or within pointing error of it? A lake counts as water: Georgian Bay is part of one.
function onWater(spot) {
  const land = lonlat => [...MAP.provinces, ...MAP.countries].some(s => d3.geoContains(s.geometry, lonlat))
    && !MAP.lakes.some(l => d3.geoContains(l.geometry, lonlat));
  const r = spot.slackKm / KM_PER_UNIT;
  const around = d3.range(8).map(i => [spot.xy[0] + r * Math.cos(i * Math.PI / 4), spot.xy[1] + r * Math.sin(i * Math.PI / 4)]);
  return [spot.xy, ...around].some(xy => !land(projection.invert(xy)));
}

// Did he put it in the right place?
function placedRight(it, spot) {
  if (SALT.includes(it)) {
    // Open water: within its reach, on water, and no other sea, bay or strait is a better fit for that spot.
    // An ocean is so big that it would beat the gulfs and seas inside it, so it only competes with other oceans.
    const share = o => Math.max(0, kmBetween(spot.lonlat, o.pt) - (o === it ? spot.slackKm : 0)) / o.reach;
    const rival = o => o !== it && !(o.cat === 'ocean' && it.cat !== 'ocean');
    return share(it) <= 1 && SALT.every(o => !rival(o) || share(o) >= share(it)) && onWater(spot);
  }
  const far = it.cat === 'river' ? riverKm(it, spot.xy) : kmBetween(spot.lonlat, it.pt);
  const shape = outline(it);
  if (it.part) return d3.geoContains(shape, spot.lonlat) && far <= it.part;
  return (shape && d3.geoContains(shape, spot.lonlat)) || far <= Math.max(spot.slackKm, it.reach || NEAR_KM[it.cat]);
}

function checkPlace(typed) {
  if (typed && pin) return answerPlace(typed, earns(judge(cur, typed)), placedRight(cur, pin));
  $('#feedback').innerHTML = `<p class="tip">${typed ? 'Now click the map where it is.' : pin ? 'Now type its name.' : 'Type its name, and click the map where it is.'}</p>`;
}

// typed is empty when he gave up ("I don't know").
function answerPlace(typed, nameRight, placeRight) {
  if (answered) return;
  const right = nameRight && placeRight;
  settle(right);
  record(cur, right);
  svg.classed('placing', false);
  $('#skip').disabled = true;
  $('#where').remove();
  $('#answer button').textContent = queue.length ? 'Next' : 'Finish';
  const wrote = ` You wrote “${esc(typed)}”`;
  const verdict = !typed ? 'Here it is' : right ? 'Correct: right name, right place'
    : nameRight ? 'Right name, wrong place.' : placeRight ? 'Right place, wrong name.' + wrote : 'Not quite.' + wrote;
  $('#feedback').innerHTML = `<p class="verdict ${right ? 'right' : 'wrong'}">${verdict}</p>${answerHtml(cur)}`;
  if (pin) pinMark.classed(placeRight ? 'ok' : 'off', true);
  paint([{ it: cur, cls: 'named ' + (right ? 'right' : 'wrong'), say: cur.name }]);
  spotlight(cur);
  $('#typed').focus();
  $('#feedback').scrollIntoView({ block: 'nearest' });
}

// ── Mock test ────────────────────────────────────────────────────────────────

let test = null;   // { items, answers, marks }   marks stays null until the test is handed in

// A phone can drop a page that is in the background, so a test being written is saved as it is typed.
function keepTest() {
  store.test = test && !test.marks ? { ids: test.items.map(it => it.id), answers: test.answers } : null;
  save();
}
(saved => {
  if (!saved || !Array.isArray(saved.ids) || !Array.isArray(saved.answers)) return;
  const items = saved.ids.map(byId);
  if (items.length && items.every(Boolean) && saved.answers.length === items.length) test = { items, answers: saved.answers.map(String), marks: null };
})(store.test);

const testUnderWay = () => !!test && !test.marks && test.answers.some(a => a.trim());

function renderTest() {
  const pool = selected();
  if (!test) {
    const counts = [pool.length, 40, 20, 10].filter((n, i) => i === 0 || n < pool.length);
    panel.innerHTML = catsHtml() + (!pool.length ? NOTHING
      : `<p class="tip">Like the real check-in: numbered points on the map, and you write what each one is. Nothing is marked until you hand it in. Short forms and small spelling slips still count.</p>
         <label class="field"><span>How many points</span><select id="count">${counts.map((n, i) => `<option value="${n}">${i ? n : 'All ' + n}</option>`).join('')}</select></label>
         <div class="actions"><button type="button" class="primary" id="start">Start the test</button></div>`);
    paint([]);
    spotlight(null);
    return;
  }

  const { items, answers, marks } = test;
  if (!marks) {
    panel.innerHTML = catsHtml(true) +
      `<div class="test-head"><span id="filled"></span><button type="button" class="primary" id="handin">Hand in</button></div>
       <ol class="sheet">${items.map((it, i) =>
         `<li><label class="num" for="a${i}">${i + 1}</label><input id="a${i}" data-i="${i}" value="${esc(answers[i])}" placeholder="${esc(catOf(it).noun)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></li>`).join('')}</ol>
       <button type="button" class="link" id="quit">Quit this test</button>`;
    paint(items.map((it, i) => ({ it, cls: 'numbered', num: i + 1, say: 'Point ' + (i + 1) })));
    spotlight(null);
    drawFilled();
    return;
  }

  const missed = items.filter((it, i) => !earns(marks[i]));
  const yours = i => {
    const typed = answers[i].trim();
    if (!typed) return '<p class="yours">Left blank</p>';
    if (marks[i] === 'right') return '';
    const note = marks[i] === 'close' ? ' (exact spelling above)' : marks[i] === 'short' ? ' (full name above)' : '';
    return `<p class="yours">You wrote: ${esc(typed)}${note}</p>`;
  };
  panel.innerHTML = catsHtml(true) +
    `<p class="score"><b>${items.length - missed.length}</b> of ${items.length} right</p>
     <div class="actions">${missed.length ? `<button type="button" class="primary" id="retest">Retest the ${missed.length} I missed</button>` : ''}<button type="button" class="${missed.length ? 'plain' : 'primary'}" id="newtest">New test</button></div>
     <ol class="sheet marked">${items.map((it, i) =>
       `<li class="${earns(marks[i]) ? 'right' : 'wrong'}" data-i="${i}" tabindex="0"><span class="num">${i + 1}</span><div>
          <p class="answer">${esc(it.name)}</p>` + yours(i) +
          (earns(marks[i]) ? '' : `<p class="hint">${esc(it.hint)}</p>`) + '</div></li>').join('')}</ol>`;
  paint(items.map((it, i) => ({ it, num: i + 1, say: 'Point ' + (i + 1) + ', ' + it.name, cls: 'numbered ' + (earns(marks[i]) ? 'right' : 'wrong named') })));
  spotlight(null);
}

function startTest(items) {
  test = { items: shuffle(items), answers: items.map(() => ''), marks: null };
  keepTest();
  renderTest();
  $('#a0').focus();
  spotlight(test.items[0], false, 'near');
}

function drawFilled() {
  $('#filled').textContent = `${test.answers.filter(a => a.trim()).length} of ${test.items.length} answered`;
}

function handIn() {
  test.marks = test.items.map((it, i) => judge(it, test.answers[i]));
  test.items.forEach((it, i) => record(it, earns(test.marks[i])));
  keepTest();
  renderTest();
  wholeMap();
  panel.scrollTop = 0;
  $('#newtest').focus();
}

// ── Wiring ───────────────────────────────────────────────────────────────────

const RENDER = { study: renderStudy, practice: renderPractice, place: renderPlace, test: renderTest };
let mode = store.mode in RENDER ? store.mode : 'study';
const modes = $('.modes'), modeButtons = modes.querySelectorAll('button');

// Put the dark pill under whichever button of a segmented control is pressed. A press makes it glide there
// (the .slide class turns the transition on); first placement and re-fitting after a resize are instant.
function movePill(group, slide) {
  if (!group) return;
  const on = group.querySelector('[aria-pressed="true"]'), pill = group.querySelector('.pill');
  if (!on) return;
  const width = on.offsetWidth + 'px', transform = `translateX(${on.offsetLeft}px)`;
  if (pill.style.width === width && pill.style.transform === transform) return;   // already there, or on its way
  pill.classList.toggle('slide', !!slide);
  pill.style.width = width;
  pill.style.transform = transform;
  pill.getBoundingClientRect();   // settle the position before the transition can be switched back on
}

// A mock test stays in memory when you look at another mode, so a stray click can't lose it.
function setMode(m, slide = true) {
  mode = store.mode = m;
  save();
  modeButtons.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  movePill(modes, slide);
  setPin(null);
  svg.classed('placing', false);
  RENDER[m]();
}

panel.addEventListener('change', e => {
  const t = e.target;
  if (t.name === 'cat') {
    store.cats = [...panel.querySelectorAll('input[name=cat]:checked')].map(i => i.value);
    save();
    RENDER[mode]();
    panel.querySelector(`input[name=cat][value="${t.value}"]`).focus();
  } else if (t.id === 'names') {
    store.names = t.checked;
    save();
    renderStudy();
    $('#names').focus();
  } else if (t.id === 'weak') {
    weakOnly = t.checked;
    renderPractice();
    $('#weak').focus();
  }
});

panel.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.cats) {
    store.cats = b.dataset.cats === 'all' ? CATS.map(c => c.id) : [];
    save();
    RENDER[mode]();
    panel.querySelector(`[data-cats="${b.dataset.cats}"]`).focus();
  } else if (b.dataset.typing) {
    store.typing = b.dataset.typing === '1';
    save();
    panel.querySelectorAll('.seg button').forEach(s => s.setAttribute('aria-pressed', s === b));
    movePill($('.seg'), true);
    if (cur && !answered) showQuestion();
  } else if (b.classList.contains('opt')) answer(b.dataset.name, b.dataset.name === cur.name ? 'right' : 'wrong');
  else if (b.id === 'skip') mode === 'place' ? answerPlace('', false, false) : answer('', 'wrong');
  else if (b.id === 'next') nextQuestion();
  else if (b.dataset.round === 'missed') startRound([...round.missed]);
  else if (b.dataset.round === 'new') RENDER[mode]();
  else if (b.classList.contains('row')) studyPick(byId(b.dataset.id));
  else if (b.id === 'start') startTest(shuffle(selected()).slice(0, +$('#count').value));
  else if (b.id === 'retest') startTest(test.items.filter((it, i) => !earns(test.marks[i])));
  else if (b.id === 'newtest' || (b.id === 'quit' && (!testUnderWay() || confirmed(b, 'Lose your answers?')))) { test = null; keepTest(); renderTest(); }
  else if (b.id === 'handin') {
    const blank = test.answers.filter(a => !a.trim()).length;
    if (!blank || confirmed(b, `Hand in with ${blank} blank?`)) handIn();
  }
});

panel.addEventListener('submit', e => {
  e.preventDefault();
  if (answered) return nextQuestion();
  const typed = $('#typed').value.trim();
  if (mode === 'place') return checkPlace(typed);
  if (typed) answer(typed, judge(cur, typed));
});

panel.addEventListener('input', e => {
  if (test && e.target.dataset.i != null) { test.answers[e.target.dataset.i] = e.target.value; drawFilled(); keepTest(); }
});

// Point at a study row, or step onto an answer line, and its point lights up.
// Hovering never moves the map, and while a test is being written only the line being typed in drives the map.
// (A touch has no hover, so on a phone it is always the focus that moves it.)
const follow = e => {
  const row = e.target.closest('.row'), line = e.target.closest('[data-i]'), focus = e.type === 'focusin';
  const view = focus ? 'near' : 'keep';
  if (row && mode === 'study') spotlight(byId(row.dataset.id), true, view);
  else if (line && test && mode === 'test' && (focus || test.marks)) spotlight(test.items[line.dataset.i], !!test.marks, view);
};
panel.addEventListener('mouseover', follow);
panel.addEventListener('focusin', follow);

panel.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.repeat) { e.preventDefault(); return; }   // a held key is one press
  if (e.key !== 'Enter' || !test || test.marks || e.target.dataset.i == null) return;
  e.preventDefault();
  const next = $('#a' + (+e.target.dataset.i + 1));
  if (next) next.focus();
});

// Clicking the map takes the cursor out of the answer box, so in Place mode Enter still checks (or goes on) from there.
document.addEventListener('keydown', e => {
  if (mode !== 'place' || e.key !== 'Enter' || e.repeat || e.target !== document.body || !$('#answer')) return;
  e.preventDefault();
  $('#answer').requestSubmit();
});

// 1 to 4 pick a multiple-choice answer.
document.addEventListener('keydown', e => {
  if (mode !== 'practice' || answered || store.typing || e.ctrlKey || e.metaKey || e.altKey) return;
  const opt = panel.querySelectorAll('.opt')[+e.key - 1];
  if (opt) opt.click();
});

panel.addEventListener('toggle', e => {
  if (e.target.classList.contains('cats-box')) catsOpen = e.target.open;
}, true);   // toggle doesn't bubble, so catch it on the way down

// In Place mode a click on the map puts the pin there (a drag still moves the map: d3 swallows that click).
svg.on('click.place', e => {
  if (mode !== 'place' || answered || !cur) return;
  setPin(d3.pointer(e, root.node()));
  $('#where').textContent = 'Placed. Click the map again to move it.';
});

modes.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (b && b.dataset.mode !== mode) setMode(b.dataset.mode);
});

$('#reset').addEventListener('click', e => {
  if (!confirmed(e.currentTarget, 'Wipe progress?')) return;
  store.streak = {};
  save();
  drawProgress();
  if (mode === 'practice') renderPractice();
});

$('#reset').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.repeat) e.preventDefault();
});

$('#zin').addEventListener('click', () => glide(200).call(zoom.scaleBy, 1.7));
$('#zout').addEventListener('click', () => glide(200).call(zoom.scaleBy, 1 / 1.7));
$('#zreset').addEventListener('click', wholeMap);

// On a phone the on-screen keyboard covers the bottom of the page without resizing it. Size the app to what is
// actually visible (style.css uses these on small screens only), so the map and the line being typed stay in view.
const viewport = window.visualViewport;
function fitScreen() {
  // Pinching the page to zoom also shrinks the visible area; that is not the keyboard, so leave the layout alone.
  if (viewport && viewport.scale < 1.01) {
    const html = document.documentElement;
    html.style.setProperty('--app-h', viewport.height + 'px');
    html.style.setProperty('--app-top', viewport.offsetTop + 'px');
    html.classList.toggle('typing', viewport.height < window.innerHeight - 150);
  }
  placeMarkers();
  movePill(modes);
  movePill($('.seg'));
  if (watching) lookAt(watching, true);
  const typingIn = document.activeElement;
  if (typingIn && typingIn.tagName === 'INPUT' && panel.contains(typingIn)) typingIn.scrollIntoView({ block: 'nearest' });
}
$('.zoom').addEventListener('click', () => { watching = null; });   // his own zooming: stop steering the map back
window.addEventListener('resize', fitScreen);
if (viewport) { viewport.addEventListener('resize', fitScreen); viewport.addEventListener('scroll', fitScreen); }
// Button and label widths change when Inter arrives (the italic only loads once a water name is first shown).
document.fonts.ready.then(fitScreen);
document.fonts.addEventListener('loadingdone', fitScreen);

drawProgress();
drawMap();
setMode(mode, false);
fitScreen();

// On the web, keep a copy for when there is no signal (see sw.js). Opened from disk it is already all local.
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
