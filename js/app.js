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
  qc: renderQC,
  clock: renderClock,
  sources: renderSources,
};

function navigate(route, arg) {
  location.hash = arg ? `#${route}/${arg}` : `#${route}`;
}
function handleHash() {
  const raw = location.hash.replace(/^#/, '') || 'pedals';
  const [route, arg] = raw.split('/');
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
  const row = el('div', { class: 'control' });
  const top = el('div', { class: 'control-top' });
  const nameWrap = el('span', { class: 'control-name' }, [c.name]);
  if (c.verify) nameWrap.appendChild(el('span', { class: 'verify-badge', text: 'verify' }));
  top.appendChild(nameWrap);

  // header CC label (channel + CC number)
  top.appendChild(el('span', { class: 'control-cc', html: `Ch ${channels[p.id]} · CC <b>${c.cc}</b>` }));
  row.appendChild(top);

  if (c.usage) row.appendChild(el('div', { class: 'control-usage', text: c.usage }));

  if (c.type === 'knob') {
    const knob = el('div', { class: 'knob-row' });
    const input = el('input', { type: 'range', min: 0, max: 127, value: 64 });
    const readout = el('div', { class: 'knob-readout', html:
      `<span class="ccval">64</span> <span class="pct">(${ccPct(64)}%)</span>` });
    input.addEventListener('input', () => {
      const v = parseInt(input.value, 10);
      readout.innerHTML = `<span class="ccval">${v}</span> <span class="pct">(${ccPct(v)}%)</span>`;
    });
    knob.appendChild(input);
    knob.appendChild(readout);
    row.appendChild(knob);
  } else if (c.type === 'select' || c.type === 'toggle') {
    const optRow = el('div', { class: 'opt-row' });
    c.options.forEach((o, i) => {
      const span = o.min === o.max ? `${o.min}` : `${o.min}–${o.max}`;
      const btn = el('div', { class: 'opt' + (i === 0 ? ' active' : ''), html:
        `${o.label}<span class="opt-cc">${span}</span>` });
      btn.addEventListener('click', () => {
        optRow.querySelectorAll('.opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      optRow.appendChild(btn);
    });
    row.appendChild(optRow);
  } else if (c.type === 'switch') {
    const sw = el('div', { class: 'switch-row' });
    [['Off', 0], ['On', 127]].forEach(([label, val], i) => {
      const btn = el('div', { class: 'opt' + (i === 0 ? ' active' : ''), html:
        `${label}<span class="opt-cc">${val === 0 ? '0' : '1–127'}</span>` });
      btn.addEventListener('click', () => {
        sw.querySelectorAll('.opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
      sw.appendChild(btn);
    });
    row.appendChild(sw);
  } else if (c.type === 'momentary') {
    row.appendChild(el('div', { class: 'switch-row' }, [
      el('div', { class: 'opt active', html: 'Command<span class="opt-cc">any value</span>' }),
    ]));
  }
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

/* --------------------------------------------------------------- boot ---- */
window.addEventListener('hashchange', handleHash);
document.addEventListener('DOMContentLoaded', handleHash);
