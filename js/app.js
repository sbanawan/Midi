/* MIDI Pedal Control — UI (vanilla JS, no build step) */
'use strict';

/* ----------------------------------------------------- channel storage --- */
const LS_KEY = 'pedalChannels.v1';

function loadChannels() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { saved = {}; }
  const out = {};
  PEDALS.forEach(p => { out[p.id] = saved[p.id] || DEFAULT_CHANNELS[p.id]; });
  return out;
}
function saveChannels(ch) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(ch)); } catch (e) { /* ignore */ }
}
let channels = loadChannels();

function channelConflicts() {
  const seen = {}; const dupes = new Set();
  Object.entries(channels).forEach(([id, ch]) => {
    if (seen[ch]) { dupes.add(ch); } seen[ch] = (seen[ch] || []); seen[ch].push(id);
  });
  return dupes;
}

/* -------------------------------------------------- shared selections ----
 * Single source of truth shared by the Pedals tab and the Cheat sheet.
 * Backed by the same localStorage the cheat sheet uses. Adjusting a control
 * anywhere writes here; the cheat sheet reads here. */
let selections; // initialised at boot (after loadSheet is available)
function saveSelections() { saveSheet(selections); }
function selVal(pid, cc) { const e = selections.entries[pid]; return e ? e[cc] : undefined; }
function selSet(pid, cc, v) {
  (selections.entries[pid] || (selections.entries[pid] = {}))[cc] = v;
  saveSelections();
  if (MIDI.live) MIDI.sendCC(channels[pid], cc, v);
}
function selClear(pid, cc) {
  const e = selections.entries[pid];
  if (e) { delete e[cc]; if (!Object.keys(e).length) delete selections.entries[pid]; saveSelections(); }
}
function selCount(pid) { const e = selections.entries[pid]; return e ? Object.keys(e).length : 0; }
function selectionTotal() { return PEDALS.reduce((n, p) => n + selCount(p.id), 0); }

/* -------------------------------------------------------- Web MIDI out ----
 * Sends the selections as MIDI CC to a chosen output port. Routing is the
 * user's choice (e.g. the Quad Cortex over USB, or a direct USB-MIDI
 * interface to the pedals) — the code just sends to whichever port is picked.
 * Requires Chrome/Edge (desktop or Android). Safari/iOS has no Web MIDI. */
const MIDI = {
  supported: typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function',
  access: null,
  output: null,
  notify: null,                         // single render callback (set by the MIDI view)
  PORT_KEY: 'midiPort.v1',
  LIVE_KEY: 'midiLiveSend.v1',
  emit() { if (typeof this.notify === 'function') this.notify(); },
  async connect() {
    if (!this.supported) throw new Error('Web MIDI not supported in this browser');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => { this.autopick(); this.emit(); };
    this.autopick();
    this.emit();
  },
  outputs() { return this.access ? Array.from(this.access.outputs.values()) : []; },
  autopick() {
    const saved = (() => { try { return localStorage.getItem(this.PORT_KEY); } catch (e) { return null; } })();
    const outs = this.outputs();
    this.output = outs.find(o => o.id === saved)
      || outs.find(o => /cortex|quad/i.test(o.name || ''))
      || outs[0] || null;
  },
  selectPort(id) {
    const o = this.outputs().find(o => o.id === id) || null;
    this.output = o;
    if (o) { try { localStorage.setItem(this.PORT_KEY, o.id); } catch (e) { /* ignore */ } }
    this.emit();
  },
  get live() { try { return localStorage.getItem(this.LIVE_KEY) === '1'; } catch (e) { return false; } },
  set live(v) { try { localStorage.setItem(this.LIVE_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ } this.emit(); },
  sendCC(channel, cc, value) {
    if (!this.output) return false;
    const status = 0xB0 | ((channel - 1) & 0x0F);   // Control Change on (channel-1)
    this.output.send([status, cc & 0x7F, Math.max(0, Math.min(127, value)) & 0x7F]);
    return true;
  },
  sendSelections(sel) {
    let n = 0;
    PEDALS.forEach(p => {
      const e = sel.entries[p.id];
      if (!e) return;
      Object.keys(e).forEach(cc => { if (this.sendCC(channels[p.id], parseInt(cc, 10), e[cc])) n++; });
    });
    return n;
  },
};

/* ------------------------------------------------------------ helpers ---- */
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  });
  (Array.isArray(kids) ? kids : [kids]).forEach(c => {
    if (c == null) return;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return n;
};
const pedalById = id => PEDALS.find(p => p.id === id);
const ccPct = v => Math.round((v / 127) * 100);

/* --------------------------------------------------------------- views --- */
const app = () => document.getElementById('app');

function setActiveTab(name) {
  document.querySelectorAll('nav.tabs button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
}

const ROUTES = {
  pedals: renderPedals,
  cheatsheet: renderCheatsheet,
  recipes: renderRecipes,
  qc: renderQC,
  clock: renderClock,
  midi: renderMidi,
  sources: renderSources,
};

function navigate(route, arg) {
  location.hash = arg ? `#${route}/${arg}` : `#${route}`;
}
function handleHash() {
  const raw = location.hash.replace(/^#/, '') || 'pedals';
  const idx = raw.indexOf('/');
  const route = idx < 0 ? raw : raw.slice(0, idx);
  const arg = idx < 0 ? undefined : raw.slice(idx + 1);
  const fn = ROUTES[route] || renderPedals;
  setActiveTab(route in ROUTES ? route : 'pedals');
  app().innerHTML = '';
  app().appendChild(fn(arg));
  window.scrollTo(0, 0);
}

/* ----------------------------------------------------------- PEDALS list - */
function renderPedals(arg) {
  if (arg) return renderPedalDetail(arg);
  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('h2', { class: 'section-title', text: 'Your pedals' }));
  wrap.appendChild(el('p', { class: 'lead',
    text: 'Each pedal is on its own MIDI channel. Tap a pedal to see every controllable parameter, its CC number, and the exact value to send (or dial in) — along with the QC channel to use.' }));

  const dupes = channelConflicts();
  if (dupes.size) {
    wrap.appendChild(el('div', { class: 'banner',
      text: `Heads up: more than one pedal is set to the same MIDI channel (${[...dupes].join(', ')}). They will respond together. Give each pedal a unique channel.` }));
  }

  const grid = el('div', { class: 'pedal-grid' });
  PEDALS.forEach(p => {
    const card = el('div', { class: 'pedal-card', onclick: () => navigate('pedals', p.id) });
    card.style.borderLeftColor = p.accent;
    card.appendChild(el('h3', { text: p.name }));
    card.appendChild(el('div', { class: 'brand', text: `${p.brand} · ${p.type}` }));
    const meta = el('div', { class: 'meta' });
    meta.appendChild(el('span', { class: 'chip ch', text: `MIDI ch ${channels[p.id]}` }));
    if (p.clock && p.clock.supported) meta.appendChild(el('span', { class: 'chip clock', text: '◷ clock sync' }));
    meta.appendChild(el('span', { class: 'chip', text: `${p.controls.length} controls` }));
    const n = selCount(p.id);
    if (n) meta.appendChild(el('span', { class: 'chip sheet', text: `${n} on cheat sheet` }));
    card.appendChild(meta);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

/* --------------------------------------------------------- PEDAL detail -- */
function renderPedalDetail(id) {
  const p = pedalById(id);
  const wrap = el('section', { class: 'view active' });
  if (!p) { wrap.appendChild(el('p', { text: 'Unknown pedal.' })); return wrap; }

  wrap.appendChild(el('button', { class: 'back-btn', text: '← All pedals', onclick: () => navigate('pedals') }));

  const head = el('div', { class: 'detail-head' });
  const titleBox = el('div', {}, [
    el('h2', { text: p.name }),
    el('div', { class: 'brand', text: `${p.brand} · ${p.type}` }),
  ]);
  head.appendChild(titleBox);
  wrap.appendChild(head);

  // channel selector
  const chBox = el('div', { class: 'channel-box' });
  chBox.appendChild(el('label', { text: 'MIDI channel for this pedal:' }));
  const sel = el('select');
  for (let i = 1; i <= 16; i++) {
    const o = el('option', { value: i, text: String(i) });
    if (channels[p.id] === i) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    channels[p.id] = parseInt(sel.value, 10);
    saveChannels(channels);
    handleHash(); // re-render to refresh readouts + conflict banner
  });
  chBox.appendChild(sel);
  if (p.channelDefaultNote) chBox.appendChild(el('span', { class: 'note', text: p.channelDefaultNote }));
  wrap.appendChild(chBox);

  // tip: changes here feed the cheat sheet
  wrap.appendChild(el('div', { class: 'note', html:
    'Adjust any control below and it’s added to your <b>Cheat sheet</b> automatically (use “remove” to drop it).' }));

  // connection + clock notes
  wrap.appendChild(el('div', { class: 'note', html: `<b>MIDI connection:</b> ${p.midiInput}` }));
  if (p.clock && p.clock.supported)
    wrap.appendChild(el('div', { class: 'note', html: `<b>Clock sync:</b> ${p.clock.detail} ${p.clock.enableNote || ''}` }));
  if (p.extras && p.extras.presets)
    wrap.appendChild(el('div', { class: 'note', html: `<b>Presets:</b> ${p.extras.presets}` }));
  if (p.extras && p.extras.globalSettings)
    wrap.appendChild(el('div', { class: 'note', html: `<b>Global settings:</b> ${p.extras.globalSettings}` }));
  if (p.extras && p.extras.modules)
    wrap.appendChild(el('div', { class: 'note', html: `<b>Modules:</b> ${p.extras.modules}` }));
  if (p.extras && p.extras.dipNote)
    wrap.appendChild(el('div', { class: 'note', text: p.extras.dipNote }));

  // controls grouped by section
  const order = [];
  const groups = {};
  p.controls.forEach(c => {
    if (!groups[c.section]) { groups[c.section] = []; order.push(c.section); }
    groups[c.section].push(c);
  });
  order.forEach(section => {
    const g = el('div', { class: 'section-group' });
    g.appendChild(el('h4', { text: section }));
    groups[section].forEach(c => g.appendChild(renderControl(p, c)));
    wrap.appendChild(g);
  });
  return wrap;
}

function ccTag(p, value) {
  // The line that tells you exactly what to send from the QC.
  return el('span', { class: 'control-cc', html:
    `Ch ${channels[p.id]} · CC <b>${value === null ? '—' : value}</b>` });
}

function renderControl(p, c) {
  const stored = selVal(p.id, c.cc);
  let included = stored !== undefined;
  const dispVal = included ? stored : defaultValueFor(c);

  const row = el('div', { class: 'control' + (included ? ' in-sheet' : '') });
  const top = el('div', { class: 'control-top' });
  const nameWrap = el('span', { class: 'control-name' }, [c.name]);
  if (c.verify) nameWrap.appendChild(el('span', { class: 'verify-badge', text: 'verify' }));
  top.appendChild(nameWrap);
  top.appendChild(el('span', { class: 'control-cc', html: `Ch ${channels[p.id]} · CC <b>${c.cc}</b>` }));
  row.appendChild(top);
  if (c.usage) row.appendChild(el('div', { class: 'control-usage', text: c.usage }));

  // status line: shows whether this control is on the cheat sheet + a remove link
  const status = el('div', { class: 'control-status' });
  const renderStatus = () => {
    status.innerHTML = '';
    if (!included) return;
    status.appendChild(el('span', { class: 'in-sheet-tag', text: '● on cheat sheet' }));
    status.appendChild(el('button', { class: 'clear-link', text: 'remove', onclick: () => {
      selClear(p.id, c.cc); included = false; row.classList.remove('in-sheet'); renderStatus();
    } }));
  };
  const include = (v) => { selSet(p.id, c.cc, v); included = true; row.classList.add('in-sheet'); renderStatus(); };

  if (c.type === 'knob') {
    const knob = el('div', { class: 'knob-row' });
    const input = el('input', { type: 'range', min: 0, max: 127, value: dispVal });
    const readout = el('div', { class: 'knob-readout', html:
      `<span class="ccval">${dispVal}</span> <span class="pct">(${ccPct(dispVal)}%)</span>` });
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      readout.innerHTML = `<span class="ccval">${v}</span> <span class="pct">(${ccPct(v)}%)</span>`;
      include(v);
    });
    knob.appendChild(input); knob.appendChild(readout);
    row.appendChild(knob);
  } else if (c.type === 'select' || c.type === 'toggle') {
    const optRow = el('div', { class: 'opt-row' });
    c.options.forEach(o => {
      const active = included && dispVal >= o.min && dispVal <= o.max;
      const span = o.min === o.max ? `${o.min}` : `${o.min}–${o.max}`;
      const btn = el('div', { class: 'opt' + (active ? ' active' : ''), html:
        `${o.label}<span class="opt-cc">${span}</span>` });
      btn.addEventListener('click', () => {
        optRow.querySelectorAll('.opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); include(o.min);
      });
      optRow.appendChild(btn);
    });
    row.appendChild(optRow);
  } else if (c.type === 'switch') {
    const sw = el('div', { class: 'switch-row' });
    [['Off', 0], ['On', 127]].forEach(([label, val]) => {
      const active = included && (val === 0 ? dispVal < 1 : dispVal >= 1);
      const btn = el('div', { class: 'opt' + (active ? ' active' : ''), html:
        `${label}<span class="opt-cc">${val === 0 ? '0' : '1–127'}</span>` });
      btn.addEventListener('click', () => {
        sw.querySelectorAll('.opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); include(val);
      });
      sw.appendChild(btn);
    });
    row.appendChild(sw);
  } else if (c.type === 'momentary') {
    // a command, not a stored setting — never added to the cheat sheet
    row.appendChild(el('div', { class: 'switch-row' }, [
      el('div', { class: 'opt active', html: 'Command<span class="opt-cc">any value</span>' }),
    ]));
  }

  row.appendChild(status);
  renderStatus();
  return row;
}

/* ------------------------------------------------------------- QC view --- */
function renderQC() {
  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('h2', { class: 'section-title', text: 'Quad Cortex — settings to adjust' }));
  wrap.appendChild(el('p', { class: 'lead',
    text: 'The QC is the brain. Use this channel map when adding MIDI Out messages to a preset, and the device settings below to get MIDI flowing.' }));

  // channel map
  const mapCard = el('div', { class: 'card' });
  mapCard.appendChild(el('h3', { text: 'Channel map' }));
  const tw = el('div', { class: 'table-wrap' });
  const t = el('table');
  t.appendChild(el('thead', {}, el('tr', {}, [
    el('th', { text: 'MIDI ch' }), el('th', { text: 'Pedal' }),
    el('th', { text: 'Connection' }), el('th', { text: 'Clock' }),
  ])));
  const tb = el('tbody');
  [...PEDALS].sort((a, b) => channels[a.id] - channels[b.id]).forEach(p => {
    const sw = el('span', { class: 'swatch' }); sw.style.background = p.accent;
    tb.appendChild(el('tr', {}, [
      el('td', { class: 'ch-num', text: String(channels[p.id]) }),
      el('td', {}, [sw, document.createTextNode(p.name)]),
      el('td', { text: p.brand === 'Hologram Electronics' ? 'DIN MIDI / USB-C' : 'TRS (via Chase Bliss MIDIBox)' }),
      el('td', { text: p.clock && p.clock.supported ? 'yes' : '—' }),
    ]));
  });
  t.appendChild(tb);
  tw.appendChild(t);
  mapCard.appendChild(tw);
  const dupes = channelConflicts();
  if (dupes.size) mapCard.appendChild(el('div', { class: 'note warn',
    text: `Two pedals share a channel (${[...dupes].join(', ')}). Change one in its pedal screen.` }));
  wrap.appendChild(mapCard);

  // sending
  const sendCard = el('div', { class: 'card' });
  sendCard.appendChild(el('h3', { text: 'Sending control to the pedals' }));
  sendCard.appendChild(el('p', { class: 'lead', text: QC.presetMidiOut }));
  sendCard.appendChild(el('p', { class: 'note',
    text: 'Open any pedal screen to read off the exact "Ch N · CC X = value" for each parameter you want to set.' }));
  wrap.appendChild(sendCard);

  // device settings
  const setCard = el('div', { class: 'card' });
  setCard.appendChild(el('h3', { text: 'QC MIDI device settings' }));
  const kv = el('dl', { class: 'kv' });
  QC.deviceSettings.forEach(s => {
    kv.appendChild(el('dt', { text: s.name }));
    kv.appendChild(el('dd', { text: s.detail }));
  });
  setCard.appendChild(kv);
  setCard.appendChild(el('div', { class: 'note', html: `<b>MIDI out:</b> ${QC.midiOut}` }));
  wrap.appendChild(setCard);
  return wrap;
}

/* ---------------------------------------------------------- Clock view --- */
function renderClock() {
  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('h2', { class: 'section-title', text: 'MIDI clock sync from the QC' }));
  wrap.appendChild(el('p', { class: 'lead', text: CLOCK_SYNC.intro }));

  const qcCard = el('div', { class: 'card' });
  qcCard.appendChild(el('h3', { text: 'On the Quad Cortex (clock master)' }));
  const ol = el('ol', { class: 'steps' });
  CLOCK_SYNC.qcSteps.forEach(s => ol.appendChild(el('li', { text: s })));
  qcCard.appendChild(ol);
  wrap.appendChild(qcCard);

  const pedCard = el('div', { class: 'card' });
  pedCard.appendChild(el('h3', { text: 'On each pedal (tell it to follow clock)' }));
  const kv = el('dl', { class: 'kv' });
  CLOCK_SYNC.pedalSteps.forEach(s => {
    kv.appendChild(el('dt', { text: s.pedal }));
    kv.appendChild(el('dd', { text: s.step }));
  });
  pedCard.appendChild(kv);
  wrap.appendChild(pedCard);

  wrap.appendChild(el('div', { class: 'banner', text: CLOCK_SYNC.wiringNote }));
  return wrap;
}

/* --------------------------------------------------------- Sources view -- */
function renderSources() {
  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('h2', { class: 'section-title', text: 'Sources & verification' }));
  wrap.appendChild(el('p', { class: 'lead',
    text: 'All CC numbers and ranges are taken from official documentation. The Chase Bliss and Chroma Console MIDI charts were verified against the manufacturers’ own MIDI manuals.' }));
  const card = el('div', { class: 'card' });
  const ul = el('ul', { class: 'src-list' });
  Object.values(SOURCES).forEach(s => {
    ul.appendChild(el('li', {}, [
      el('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.label }),
    ]));
  });
  card.appendChild(ul);
  wrap.appendChild(card);
  wrap.appendChild(el('p', { class: 'note',
    text: 'Reference-only app: it shows the settings to dial in. The CC/value data is structured so live Web MIDI sending can be added later without changing the content.' }));
  return wrap;
}

/* ============================================================ RECIPES ==== */
/* A recipe is a named, saved setup: favourite settings for "various effects",
 * spanning one or more pedals, plus an optional tempo. Stored in localStorage.
 *   { id, name, bpm, notes, entries: { pedalId: { cc: value, ... } } }     */

const RECIPES_KEY = 'recipes.v1';

function loadRecipes() {
  try { return JSON.parse(localStorage.getItem(RECIPES_KEY)) || []; }
  catch (e) { return []; }
}
function saveRecipes(list) {
  try { localStorage.setItem(RECIPES_KEY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}
function getRecipe(id) { return loadRecipes().find(r => r.id === id); }
function upsertRecipe(rec) {
  const list = loadRecipes();
  const i = list.findIndex(r => r.id === rec.id);
  if (i >= 0) list[i] = rec; else list.push(rec);
  saveRecipes(list);
}
function deleteRecipe(id) { saveRecipes(loadRecipes().filter(r => r.id !== id)); }
const newId = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Only settings (not momentary commands) belong in a recipe.
const settingControls = p => p.controls.filter(c => c.type !== 'momentary');

function labelForValue(c, v) {
  if (c.options) {
    const o = c.options.find(o => v >= o.min && v <= o.max);
    return o ? o.label : String(v);
  }
  if (c.type === 'switch') return v >= 1 ? 'On' : 'Off';
  if (c.type === 'knob') return `${v} (${ccPct(v)}%)`;
  return String(v);
}
function defaultValueFor(c) {
  if (c.type === 'knob') return 64;
  if (c.type === 'switch') return 0;
  if (c.options) return c.options[0].min;
  return 0;
}

/* ---- recipes: dispatch ------------------------------------------------- */
function renderRecipes(arg) {
  const parts = (arg || '').split('/').filter(Boolean);
  if (parts[0] === 'new') return renderRecipeEditor(null);
  if (parts[0] === 'edit' && parts[1]) return renderRecipeEditor(parts[1]);
  if (parts[0] === 'view' && parts[1]) return renderRecipeView(parts[1]);
  return renderRecipeList();
}

/* ---- recipes: list ----------------------------------------------------- */
function renderRecipeList() {
  const wrap = el('section', { class: 'view active' });
  const headRow = el('div', { class: 'detail-head' });
  headRow.appendChild(el('h2', { class: 'section-title', text: 'Recipes' }));
  headRow.appendChild(el('button', { class: 'primary-btn', text: '+ New recipe',
    onclick: () => navigate('recipes', 'new') }));
  wrap.appendChild(headRow);
  wrap.appendChild(el('p', { class: 'lead',
    text: 'Saved settings for the effects you like. A recipe captures knob/switch values across any of the pedals (plus an optional tempo) so you can recall exactly what to dial in.' }));

  const list = loadRecipes();
  if (!list.length) {
    wrap.appendChild(el('div', { class: 'card', html:
      '<p style="margin:0;color:var(--text-dim)">No recipes yet. Tap <b>+ New recipe</b> to capture your first one — e.g. "Ambient wash", "Slapback + shimmer", "Lo-fi tape".</p>' }));
    return wrap;
  }
  const grid = el('div', { class: 'pedal-grid' });
  list.forEach(r => {
    const involved = Object.keys(r.entries || {}).filter(pid => Object.keys(r.entries[pid]).length);
    const card = el('div', { class: 'pedal-card', onclick: () => navigate('recipes', 'view/' + r.id) });
    card.style.borderLeftColor = involved.length ? (pedalById(involved[0]).accent) : 'var(--accent)';
    card.appendChild(el('h3', { text: r.name || 'Untitled recipe' }));
    const meta = el('div', { class: 'meta' });
    if (r.bpm) meta.appendChild(el('span', { class: 'chip ch', text: r.bpm + ' BPM' }));
    involved.forEach(pid => meta.appendChild(el('span', { class: 'chip', text: pedalById(pid).name })));
    if (!involved.length) meta.appendChild(el('span', { class: 'chip', text: 'no settings yet' }));
    card.appendChild(meta);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  return wrap;
}

/* ---- recipes: editor --------------------------------------------------- */
function renderRecipeEditor(id) {
  const existing = id ? getRecipe(id) : null;
  // working draft (deep-ish copy)
  const draft = existing
    ? { id: existing.id, name: existing.name, bpm: existing.bpm || '', notes: existing.notes || '',
        entries: JSON.parse(JSON.stringify(existing.entries || {})) }
    : { id: newId(), name: '', bpm: '', notes: '', entries: {} };

  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('button', { class: 'back-btn', text: '← Recipes', onclick: () => navigate('recipes') }));
  wrap.appendChild(el('h2', { class: 'section-title', text: existing ? 'Edit recipe' : 'New recipe' }));

  // top fields
  const fields = el('div', { class: 'card' });
  const nameIn = el('input', { class: 'text-input', type: 'text', placeholder: 'Recipe name (e.g. Ambient wash)', value: draft.name });
  nameIn.addEventListener('input', () => { draft.name = nameIn.value; });
  const bpmIn = el('input', { class: 'text-input small', type: 'number', min: 20, max: 400, placeholder: 'BPM (optional)', value: draft.bpm });
  bpmIn.addEventListener('input', () => { draft.bpm = bpmIn.value; });
  const notesIn = el('textarea', { class: 'text-input', rows: 2, placeholder: 'Notes (optional)' });
  notesIn.value = draft.notes;
  notesIn.addEventListener('input', () => { draft.notes = notesIn.value; });
  fields.appendChild(el('label', { class: 'field-label', text: 'Name' }));
  fields.appendChild(nameIn);
  fields.appendChild(el('label', { class: 'field-label', text: 'Tempo' }));
  fields.appendChild(bpmIn);
  fields.appendChild(el('label', { class: 'field-label', text: 'Notes' }));
  fields.appendChild(notesIn);
  wrap.appendChild(fields);

  wrap.appendChild(el('p', { class: 'note',
    text: 'Tick the controls you want this recipe to set, then choose their values. Only ticked controls are saved.' }));

  // per-pedal editors
  PEDALS.forEach(p => wrap.appendChild(recipePedalEditor(p, draft)));

  // actions
  const actions = el('div', { class: 'action-row' });
  actions.appendChild(el('button', { class: 'primary-btn', text: existing ? 'Save changes' : 'Save recipe',
    onclick: () => {
      if (!draft.name.trim()) draft.name = 'Untitled recipe';
      // prune empty pedal maps
      Object.keys(draft.entries).forEach(pid => { if (!Object.keys(draft.entries[pid]).length) delete draft.entries[pid]; });
      upsertRecipe(draft);
      navigate('recipes', 'view/' + draft.id);
    } }));
  actions.appendChild(el('button', { class: 'ghost-btn', text: 'Cancel', onclick: () => navigate('recipes') }));
  if (existing) actions.appendChild(el('button', { class: 'danger-btn', text: 'Delete',
    onclick: () => { if (confirm('Delete this recipe?')) { deleteRecipe(existing.id); navigate('recipes'); } } }));
  wrap.appendChild(actions);
  return wrap;
}

function recipePedalEditor(p, draft, onChange) {
  const entry = draft.entries[p.id] || (draft.entries[p.id] = {});
  const card = el('div', { class: 'card' });
  const h = el('h3', {}, [p.name]);
  h.appendChild(el('span', { class: 'control-cc', html: ` &nbsp;Ch <b>${channels[p.id]}</b>` }));
  card.appendChild(h);

  settingControls(p).forEach(c => {
    const included = Object.prototype.hasOwnProperty.call(entry, c.cc);
    const row = el('div', { class: 'control recipe-row' + (included ? '' : ' off') });

    const top = el('div', { class: 'control-top' });
    const left = el('label', { class: 'include' });
    const cb = el('input', { type: 'checkbox' });
    cb.checked = included;
    left.appendChild(cb);
    left.appendChild(el('span', { class: 'control-name', text: c.name }));
    top.appendChild(left);
    top.appendChild(el('span', { class: 'control-cc', html: `CC <b>${c.cc}</b>` }));
    row.appendChild(top);
    if (c.usage) row.appendChild(el('div', { class: 'control-usage', text: c.usage }));

    const editorHost = el('div', { class: 'editor-host' });
    row.appendChild(editorHost);

    const buildEditor = () => {
      editorHost.innerHTML = '';
      editorHost.appendChild(recipeValueEditor(c, entry[c.cc], v => { entry[c.cc] = v; if (onChange) onChange(); }));
    };
    cb.addEventListener('change', () => {
      if (cb.checked) { entry[c.cc] = defaultValueFor(c); row.classList.remove('off'); buildEditor(); }
      else { delete entry[c.cc]; row.classList.add('off'); editorHost.innerHTML = ''; }
      if (onChange) onChange();
    });
    if (included) buildEditor();
    card.appendChild(row);
  });
  return card;
}

function recipeValueEditor(c, value, onChange) {
  if (c.type === 'knob') {
    const knob = el('div', { class: 'knob-row' });
    const input = el('input', { type: 'range', min: 0, max: 127, value: value });
    const readout = el('div', { class: 'knob-readout', html:
      `<span class="ccval">${value}</span> <span class="pct">(${ccPct(value)}%)</span>` });
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      readout.innerHTML = `<span class="ccval">${v}</span> <span class="pct">(${ccPct(v)}%)</span>`;
      onChange(v);
    });
    knob.appendChild(input); knob.appendChild(readout);
    return knob;
  }
  if (c.type === 'select' || c.type === 'toggle') {
    const optRow = el('div', { class: 'opt-row' });
    c.options.forEach(o => {
      const active = value >= o.min && value <= o.max;
      const span = o.min === o.max ? `${o.min}` : `${o.min}–${o.max}`;
      const btn = el('div', { class: 'opt' + (active ? ' active' : ''), html: `${o.label}<span class="opt-cc">${span}</span>` });
      btn.addEventListener('click', () => {
        optRow.querySelectorAll('.opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active'); onChange(o.min);
      });
      optRow.appendChild(btn);
    });
    return optRow;
  }
  // switch
  const sw = el('div', { class: 'switch-row' });
  [['Off', 0], ['On', 127]].forEach(([label, val]) => {
    const btn = el('div', { class: 'opt' + ((val === 0 ? value < 1 : value >= 1) ? ' active' : ''), html:
      `${label}<span class="opt-cc">${val === 0 ? '0' : '1–127'}</span>` });
    btn.addEventListener('click', () => {
      sw.querySelectorAll('.opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); onChange(val);
    });
    sw.appendChild(btn);
  });
  return sw;
}

/* ---- recipes: view ----------------------------------------------------- */
function renderRecipeView(id) {
  const r = getRecipe(id);
  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('button', { class: 'back-btn', text: '← Recipes', onclick: () => navigate('recipes') }));
  if (!r) { wrap.appendChild(el('p', { text: 'Recipe not found.' })); return wrap; }

  const head = el('div', { class: 'detail-head' });
  head.appendChild(el('div', {}, [
    el('h2', { text: r.name || 'Untitled recipe' }),
    r.bpm ? el('div', { class: 'brand', text: r.bpm + ' BPM' }) : null,
  ]));
  const btns = el('div', { class: 'action-row tight' });
  btns.appendChild(el('button', { class: 'ghost-btn', text: 'Edit', onclick: () => navigate('recipes', 'edit/' + r.id) }));
  btns.appendChild(el('button', { class: 'danger-btn', text: 'Delete',
    onclick: () => { if (confirm('Delete this recipe?')) { deleteRecipe(r.id); navigate('recipes'); } } }));
  head.appendChild(btns);
  wrap.appendChild(head);

  if (r.notes) wrap.appendChild(el('div', { class: 'note', text: r.notes }));
  if (r.bpm) wrap.appendChild(el('div', { class: 'note',
    text: `Set the Quad Cortex tempo to ${r.bpm} BPM and enable MIDI Clock Out so clock-synced effects follow it (see the Clock sync tab).` }));

  const involved = PEDALS.filter(p => r.entries[p.id] && Object.keys(r.entries[p.id]).length);
  if (!involved.length) {
    wrap.appendChild(el('div', { class: 'card', html: '<p style="margin:0;color:var(--text-dim)">This recipe has no settings yet.</p>' }));
    return wrap;
  }

  involved.forEach(p => {
    const card = el('div', { class: 'card' });
    card.style.borderLeft = `4px solid ${p.accent}`;
    const h = el('h3', {}, [p.name]);
    h.appendChild(el('span', { class: 'control-cc', html: ` &nbsp;Ch <b>${channels[p.id]}</b>` }));
    card.appendChild(h);
    const tw = el('div', { class: 'table-wrap' });
    const t = el('table');
    t.appendChild(el('thead', {}, el('tr', {}, [
      el('th', { text: 'Control' }), el('th', { text: 'Setting' }), el('th', { text: 'Send from QC' }),
    ])));
    const tb = el('tbody');
    settingControls(p).forEach(c => {
      if (!Object.prototype.hasOwnProperty.call(r.entries[p.id], c.cc)) return;
      const v = r.entries[p.id][c.cc];
      tb.appendChild(el('tr', {}, [
        el('td', { text: c.name }),
        el('td', { text: labelForValue(c, v) }),
        el('td', { class: 'mono', html: `Ch ${channels[p.id]} · CC ${c.cc} = <b>${v}</b>` }),
      ]));
    });
    t.appendChild(tb); tw.appendChild(t); card.appendChild(tw);
    wrap.appendChild(card);
  });
  return wrap;
}

/* ========================================================== CHEAT SHEET == */
/* One live reference page. Pick controls across all pedals and it compiles
 * every "Ch · CC = value" to send from the Quad Cortex. Persisted per device. */

const SHEET_KEY = 'cheatsheet.v1';
function loadSheet() {
  try { const v = JSON.parse(localStorage.getItem(SHEET_KEY)); return v && v.entries ? v : { entries: {} }; }
  catch (e) { return { entries: {} }; }
}
function saveSheet(s) { try { localStorage.setItem(SHEET_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

function cheatSheetText(sheet) {
  const lines = ['MIDI cheat sheet — send these from the Quad Cortex', ''];
  let any = false;
  PEDALS.forEach(p => {
    const e = sheet.entries[p.id];
    if (!e || !Object.keys(e).length) return;
    any = true;
    lines.push(`${p.name} — MIDI channel ${channels[p.id]}`);
    settingControls(p).forEach(c => {
      if (!Object.prototype.hasOwnProperty.call(e, c.cc)) return;
      const v = e[c.cc];
      lines.push(`  CC ${String(c.cc).padEnd(3)} = ${String(v).padEnd(3)}  ${c.name}: ${labelForValue(c, v)}`);
    });
    lines.push('');
  });
  return any ? lines.join('\n') : 'No selections yet.';
}

function buildCheatSummary(sheet, refresh) {
  const host = el('div');
  const involved = PEDALS.filter(p => sheet.entries[p.id] && Object.keys(sheet.entries[p.id]).length);
  const count = involved.reduce((n, p) => n + Object.keys(sheet.entries[p.id]).length, 0);

  if (!involved.length) {
    host.appendChild(el('div', { class: 'card', html:
      '<p style="margin:0;color:var(--text-dim)">No selections yet. Pick controls below — your CC reference builds here automatically.</p>' }));
    return host;
  }

  const bar = el('div', { class: 'action-row tight' });
  const copyBtn = el('button', { class: 'primary-btn', text: `Copy all (${count})` });
  copyBtn.addEventListener('click', () => {
    const txt = cheatSheetText(sheet);
    const done = () => { copyBtn.textContent = 'Copied ✓'; setTimeout(() => { copyBtn.textContent = `Copy all (${count})`; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  });
  bar.appendChild(copyBtn);
  if (MIDI.access && MIDI.output) {
    const sendBtn = el('button', { class: 'ghost-btn', text: `Send (${count})` });
    sendBtn.addEventListener('click', () => {
      const n = MIDI.sendSelections(sheet);
      sendBtn.textContent = `Sent ${n} ✓`;
      setTimeout(() => { sendBtn.textContent = `Send (${count})`; }, 1500);
    });
    bar.appendChild(sendBtn);
  }
  bar.appendChild(el('button', { class: 'danger-btn', text: 'Clear all',
    onclick: () => { if (confirm('Clear all cheat-sheet selections?')) { sheet.entries = {}; saveSheet(sheet); if (refresh) refresh(true); } } }));
  host.appendChild(bar);
  if (MIDI.access && MIDI.output && MIDI.live)
    host.appendChild(el('div', { class: 'note', html: `Live send is on → <b>${MIDI.output.name}</b>. Changes are sent as you make them.` }));

  involved.forEach(p => {
    const card = el('div', { class: 'card' });
    card.style.borderLeft = `4px solid ${p.accent}`;
    const h = el('h3', {}, [p.name]);
    h.appendChild(el('span', { class: 'control-cc', html: ` &nbsp;Ch <b>${channels[p.id]}</b>` }));
    card.appendChild(h);
    const tw = el('div', { class: 'table-wrap' });
    const t = el('table');
    t.appendChild(el('thead', {}, el('tr', {}, [
      el('th', { text: 'Control' }), el('th', { text: 'Setting' }), el('th', { text: 'Send from QC' }),
    ])));
    const tb = el('tbody');
    settingControls(p).forEach(c => {
      if (!Object.prototype.hasOwnProperty.call(sheet.entries[p.id], c.cc)) return;
      const v = sheet.entries[p.id][c.cc];
      tb.appendChild(el('tr', {}, [
        el('td', { text: c.name }),
        el('td', { text: labelForValue(c, v) }),
        el('td', { class: 'mono', html: `Ch ${channels[p.id]} · CC ${c.cc} = <b>${v}</b>` }),
      ]));
    });
    t.appendChild(tb); tw.appendChild(t); card.appendChild(tw);
    host.appendChild(card);
  });
  return host;
}

function fallbackCopy(text, done) {
  const ta = el('textarea'); ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); if (done) done(); } catch (e) { /* ignore */ }
  document.body.removeChild(ta);
}

function renderCheatsheet() {
  const sheet = selections;
  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('h2', { class: 'section-title', text: 'CC cheat sheet' }));
  wrap.appendChild(el('p', { class: 'lead',
    text: 'Your live reference. Anything you adjust on the Pedals tab shows up here automatically — and you can also tick controls below. It compiles every Ch · CC = value to enter on the Quad Cortex. Saved on this device; channels follow each pedal’s setting.' }));

  const summaryHost = el('div', { id: 'cheat-summary' });
  const editorHost = el('div', { id: 'cheat-editor' });
  const refresh = (rebuildEditor) => {
    saveSheet(sheet);
    summaryHost.innerHTML = '';
    summaryHost.appendChild(buildCheatSummary(sheet, refresh));
    if (rebuildEditor) {
      editorHost.innerHTML = '';
      PEDALS.forEach(p => editorHost.appendChild(recipePedalEditor(p, sheet, refresh)));
    }
  };

  summaryHost.appendChild(buildCheatSummary(sheet, refresh));
  wrap.appendChild(summaryHost);

  wrap.appendChild(el('h2', { class: 'section-title', text: 'Make your selections', style: 'margin-top:26px' }));
  PEDALS.forEach(p => editorHost.appendChild(recipePedalEditor(p, sheet, refresh)));
  wrap.appendChild(editorHost);
  return wrap;
}

/* ------------------------------------------------------------ MIDI view -- */
function renderMidi() {
  const wrap = el('section', { class: 'view active' });
  wrap.appendChild(el('h2', { class: 'section-title', text: 'MIDI out — live send' }));
  wrap.appendChild(el('p', { class: 'lead',
    text: 'Send the settings you choose straight to your rig. Your routing: computer → Quad Cortex (USB) → QC MIDI Out → pedals. Pick the Quad Cortex as the output port below.' }));

  if (!MIDI.supported) {
    wrap.appendChild(el('div', { class: 'banner',
      text: 'This browser can’t send MIDI (no Web MIDI API). Use Chrome or Edge on a computer or Android. On iPhone/Safari, use this app as a reference and send from a laptop.' }));
  }

  const card = el('div', { class: 'card' });
  const statusLine = el('div', { class: 'note' });
  const portWrap = el('div', { class: 'channel-box' });
  const liveWrap = el('label', { class: 'live-toggle' });
  const actions = el('div', { class: 'action-row' });
  card.appendChild(statusLine);
  card.appendChild(portWrap);
  card.appendChild(liveWrap);
  card.appendChild(actions);
  wrap.appendChild(card);

  const refresh = () => {
    // status
    statusLine.innerHTML = '';
    if (!MIDI.access) statusLine.appendChild(el('span', { text: MIDI.supported ? 'Not connected yet.' : 'Web MIDI unavailable in this browser.' }));
    else if (!MIDI.output) statusLine.appendChild(el('span', { class: 'warn', text: 'Connected, but no MIDI output found — plug in the Quad Cortex (USB) and enable MIDI Over USB.' }));
    else statusLine.appendChild(el('span', { html: `<b>Connected →</b> ${MIDI.output.name}` }));

    // port picker
    portWrap.style.display = MIDI.access ? 'flex' : 'none';
    portWrap.innerHTML = '';
    if (MIDI.access) {
      portWrap.appendChild(el('label', { text: 'Output port:' }));
      const sel = el('select');
      const outs = MIDI.outputs();
      if (!outs.length) sel.appendChild(el('option', { text: '(no outputs detected)' }));
      outs.forEach(o => {
        const opt = el('option', { value: o.id, text: o.name });
        if (MIDI.output && o.id === MIDI.output.id) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => MIDI.selectPort(sel.value));
      portWrap.appendChild(sel);
    }

    // live toggle
    liveWrap.style.display = MIDI.access ? 'flex' : 'none';
    liveWrap.innerHTML = '';
    const cb = el('input', { type: 'checkbox' });
    cb.checked = MIDI.live;
    cb.addEventListener('change', () => { MIDI.live = cb.checked; });
    liveWrap.appendChild(cb);
    liveWrap.appendChild(el('span', { text: 'Live send — push each control change as I make it (on the Pedals tab or here)' }));

    // actions
    actions.innerHTML = '';
    if (!MIDI.access) {
      const b = el('button', { class: 'primary-btn' + (MIDI.supported ? '' : ' disabled'), text: 'Connect MIDI' });
      b.addEventListener('click', () => {
        MIDI.connect().catch(e => {
          statusLine.innerHTML = '';
          statusLine.appendChild(el('span', { class: 'warn', text: 'Could not start MIDI: ' + e.message }));
        });
      });
      actions.appendChild(b);
    } else {
      const total = selectionTotal();
      const sendBtn = el('button', { class: 'primary-btn' + (MIDI.output && total ? '' : ' disabled'), text: `Send all selections (${total})` });
      sendBtn.addEventListener('click', () => {
        const n = MIDI.sendSelections(selections);
        sendBtn.textContent = `Sent ${n} ✓`;
        setTimeout(() => { sendBtn.textContent = `Send all selections (${selectionTotal()})`; }, 1500);
      });
      actions.appendChild(sendBtn);
    }
  };
  MIDI.notify = refresh;
  refresh();

  // QC-through setup
  const steps = el('div', { class: 'card' });
  steps.appendChild(el('h3', { text: 'Setup: routing through the Quad Cortex (USB)' }));
  const ol = el('ol', { class: 'steps' });
  [
    'Connect the Quad Cortex to this computer with USB-C.',
    'On the QC: Settings → MIDI → enable “MIDI Over USB”.',
    'Enable “MIDI Thru” so MIDI arriving over USB is forwarded to the QC’s MIDI Out (TRS). Note: MIDI Thru disables the QC’s own preset MIDI-out.',
    'Wire the QC MIDI Out (TRS) to your pedals — Chroma Console’s DIN in, and each Chase Bliss pedal via its MIDIBox.',
    'Here: click Connect MIDI, choose the Quad Cortex as the output port, then turn on Live send (or use “Send all”).',
  ].forEach(s => ol.appendChild(el('li', { text: s })));
  steps.appendChild(ol);
  steps.appendChild(el('div', { class: 'note warn',
    text: 'Reality check: this relies on the QC forwarding USB MIDI to its TRS MIDI Out. If your pedals don’t respond, the QC may only pass its physical MIDI In to MIDI Out — in that case use a direct USB-MIDI interface to the pedals (the port picker above works the same way).' }));
  wrap.appendChild(steps);

  return wrap;
}

/* --------------------------------------------------------------- boot ---- */
window.addEventListener('hashchange', handleHash);
document.addEventListener('DOMContentLoaded', () => { selections = loadSheet(); handleHash(); });
