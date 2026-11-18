import { OTHER_PLACE } from './config.js';
import { countryByCode, countryByName, searchCountries } from './countries.js';
import { createAudio, MIC_CONSTRAINTS } from './audio.js';
import { createGate, dbToSimPercent, simPercentToDb } from './gate.js';
import { createLeaderboard } from './leaderboard.js';
import { createFlight, resetFlight, stepFlight } from './physics.js';
import { createRenderer } from './render.js';
import { drawShareCard, placeLabel, sanitizePlace, shareIntent, shareLine } from './share.js';
import { formatWhen } from './util.js';
import { formatAltitude, remainingLabel, titleFor, zoneAt } from './zones.js';

const params = new URLSearchParams(location.search);
const simMode = params.get('sim') === '1';
const forceFallback = params.get('fallback') === '1';

const world = document.querySelector('#world');
const hud = document.querySelector('#hud');
const altValue = document.querySelector('#alt-value');
const altUnit = document.querySelector('#alt-unit');
const zoneLabel = document.querySelector('#zone-label');
const nextLabel = document.querySelector('#next-label');
const bestPill = document.querySelector('#best-pill');
const thrustFill = document.querySelector('#thrust-fill');
const thrustWrap = document.querySelector('#thrust-wrap');
const hint = document.querySelector('#hint');
const toast = document.querySelector('#toast');
const holdBtn = document.querySelector('#hold');
const bailBtn = document.querySelector('#bail');
const simBox = document.querySelector('#sim');
const simRange = document.querySelector('#sim-range');
const simOut = document.querySelector('#sim-out');
const meter = document.querySelector('#meter');
const meterFill = document.querySelector('#meter-fill');
const meterLine = document.querySelector('#meter-line');
const meterReadout = document.querySelector('#meter-readout');
const calibrate = document.querySelector('#calibrate');
const calSeconds = document.querySelector('#cal-seconds');
const live = document.querySelector('#live');
const startScreen = document.querySelector('#start');
const resultsScreen = document.querySelector('#results');
const bestsScreen = document.querySelector('#bests');
const startBtn = document.querySelector('#start-btn');
const apexValue = document.querySelector('#apex-value');
const apexUnit = document.querySelector('#apex-unit');
const apexTitle = document.querySelector('#apex-title');
const apexTag = document.querySelector('#apex-tag');
const apexNote = document.querySelector('#apex-note');
const countrySearch = document.querySelector('#country-search');
const countryList = document.querySelector('#country-list');
const otherWrap = document.querySelector('#other-wrap');
const otherInput = document.querySelector('#other-country');
const shareCard = document.querySelector('#share-card');
const shareX = document.querySelector('#share-x');
const downloadBtn = document.querySelector('#download');
const againBtn = document.querySelector('#again');
const bestsList = document.querySelector('#bests-list');
const bestsNote = document.querySelector('#bests-note');

const audio = createAudio();
const gate = createGate();
const leaderboard = createLeaderboard();
const flight = createFlight();
const renderer = createRenderer(world);

let mode = 'ready';
let usingFallback = forceFallback;
let holding = false;
let spaceHeld = false;
let run = null;
let toastTimer = 0;
let liveTimer = 0;
let starting = false;
let celebratedBest = false;
let personalBestMeters = leaderboard.overview().overall?.altitudeM || 0;

if (personalBestMeters > 0) {
  bestPill.hidden = false;
  bestPill.textContent = `Best ${formatAltitude(personalBestMeters).label}`;
}

function show(screen) {
  startScreen.hidden = screen !== 'start';
  resultsScreen.hidden = screen !== 'results';
  bestsScreen.hidden = screen !== 'bests';
  const flying = screen === 'flight';
  const livePad = flying || screen === 'calibrating';
  hud.hidden = !livePad;
  thrustWrap.hidden = !flying;
  bailBtn.hidden = !livePad;
  document.body.classList.toggle('is-flying', flying);
  document.body.classList.toggle('is-calibrating', screen === 'calibrating');
  if (!flying) hint.hidden = true;
  holdBtn.hidden = !(flying && usingFallback);
  const showSim = livePad && simMode && !forceFallback;
  simBox.hidden = !showSim;
  document.body.classList.toggle('has-sim', showSim);
  meter.hidden = !(livePad && !usingFallback);
  calibrate.hidden = screen !== 'calibrating';
}

let pickedCountry = null;
let countryHighlight = 0;

function resolveSavedCountry(value) {
  if (!value) return null;
  if (value.startsWith('other:')) {
    return { other: true, code: '', name: value.slice(6), flag: '' };
  }
  return countryByCode(value) || countryByName(value) || { other: true, code: '', name: value, flag: '' };
}

function currentCountry() {
  if (!pickedCountry) return null;
  if (pickedCountry.other) {
    const name = sanitizePlace(otherInput.value);
    if (!name) return null;
    return { code: '', name, flag: '', other: true };
  }
  return pickedCountry;
}

function renderCard() {
  if (!run) return;
  const formatted = formatAltitude(run.altitudeM);
  const choice = currentCountry();
  drawShareCard(shareCard, {
    value: formatted.value,
    unit: formatted.unit,
    title: run.title,
    tagline: run.tagline,
    country: choice?.name || '',
    flag: choice?.flag || '',
  });
  const ready = Boolean(choice?.name);
  downloadBtn.disabled = !ready;
  shareX.classList.toggle('is-disabled', !ready);
  if (ready) {
    shareX.href = shareIntent(shareLine({
      altitudeLabel: formatted.label,
      country: choice.name,
      flag: choice.flag,
    }));
    shareX.setAttribute('aria-disabled', 'false');
  } else {
    shareX.href = '#';
    shareX.setAttribute('aria-disabled', 'true');
  }
}

function setListOpen(isOpen) {
  countryList.hidden = !isOpen;
  countrySearch.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

function paintCountryList() {
  const query = countrySearch.value.trim();
  const searching = query && query !== displayOf(pickedCountry);
  const matches = searchCountries(searching ? query : '');
  countryList.replaceChildren();
  const rows = matches.map((country) => ({ ...country, other: false }));
  rows.push({ code: '', name: OTHER_PLACE, flag: '', other: true });
  if (!rows.length) {
    countryList.append(text('li', 'country-empty', 'No countries match. Choose Other.'));
    countryHighlight = 0;
    return;
  }
  if (countryHighlight >= rows.length) countryHighlight = 0;
  rows.forEach((country, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', index === countryHighlight ? 'true' : 'false');
    button.textContent = country.other ? 'Other' : `${country.flag} ${country.name}`;
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => chooseCountry(country));
    item.append(button);
    countryList.append(item);
  });
}

function displayOf(country) {
  if (!country) return '';
  if (country.other) return 'Other';
  return `${country.flag} ${country.name}`;
}

function chooseCountry(country) {
  pickedCountry = country.other
    ? { other: true, code: '', name: OTHER_PLACE, flag: '' }
    : country;
  countrySearch.value = displayOf(pickedCountry);
  otherWrap.hidden = !pickedCountry.other;
  setListOpen(false);
  if (pickedCountry.other) otherInput.focus();
  commitCountry();
}

function commitCountry() {
  const choice = currentCountry();
  renderCard();
  if (!run || !choice || choice.name === run.country) return;
  const result = leaderboard.submitRun({
    ...run,
    country: choice.name,
    countryCode: choice.code,
    flag: choice.flag,
    other: Boolean(choice.other),
    previousCountry: run.country,
  });
  run.country = choice.name;
  run.countryCode = choice.code;
  run.flag = choice.flag;
  const line = result.countryBest ? `New best for ${placeLabel(choice)}.` : `Logged for ${placeLabel(choice)}.`;
  apexNote.textContent = `${run.scoreNote || ''} ${line} Saved on this device.`.trim();
}

function restoreCountry() {
  const saved = resolveSavedCountry(leaderboard.lastCountry());
  if (!saved) {
    pickedCountry = null;
    countrySearch.value = '';
    otherInput.value = '';
    otherWrap.hidden = true;
    return;
  }
  if (saved.other) {
    pickedCountry = { other: true, code: '', name: OTHER_PLACE, flag: '' };
    countrySearch.value = 'Other';
    otherInput.value = saved.name === OTHER_PLACE ? '' : saved.name;
    otherWrap.hidden = false;
  } else {
    pickedCountry = saved;
    countrySearch.value = displayOf(saved);
    otherInput.value = '';
    otherWrap.hidden = true;
  }
}

function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 1700);
}

function updateHud() {
  const formatted = formatAltitude(flight.altitude);
  altValue.textContent = formatted.value;
  altUnit.textContent = formatted.unit;
  const zone = zoneAt(flight.altitude);
  zoneLabel.textContent = zone.name;
  nextLabel.textContent = remainingLabel(flight.altitude);
  thrustFill.style.height = `${Math.round(flight.thrust * 100)}%`;
  liveTimer += 1;
  if (liveTimer % 40 === 0) {
    live.textContent = `${formatted.label}, ${zone.name}`;
  }
  if (flight.falling) {
    hint.textContent = 'Falling...';
    hint.classList.add('is-falling');
    hint.hidden = false;
  } else if (flight.thrust > 0.08) {
    hint.hidden = true;
  } else {
    hint.textContent = usingFallback ? 'Hold to climb!' : 'Scream to climb!';
    hint.classList.remove('is-falling');
    hint.hidden = false;
  }
}

function meterPosition(db) {
  return Math.max(0, Math.min(1, (db - (-70)) / 70));
}

function paintMeter(status) {
  const shown = Number.isFinite(status.db) ? status.db : -70;
  meterFill.style.width = `${meterPosition(shown) * 100}%`;
  meterLine.style.left = `${meterPosition(status.openAt) * 100}%`;
  meter.classList.toggle('is-hot', status.open && status.thrust > 0);
  const rounded = Math.round(shown);
  const gateAt = Math.round(status.openAt);
  meterReadout.textContent = status.calibrating
    ? `${rounded} dB · listening`
    : status.open
      ? `${rounded} dB · loud`
      : `${rounded} dB · need ${gateAt}`;
}

function readDb() {
  if (simMode && !forceFallback) {
    const percent = spaceHeld ? dbToSimPercent(-2) : Number(simRange.value);
    const db = simPercentToDb(percent);
    simOut.textContent = `${Math.round(db)} dB`;
    return db;
  }
  return audio.dbfs();
}

function demandFor(dt) {
  if (usingFallback) return holding || spaceHeld ? 0.85 : 0;
  const status = gate.update(readDb(), dt);
  paintMeter(status);
  return status.thrust;
}

function finish(reason) {
  if (mode === 'results') return;
  const altitude = flight.maxAltitude;
  const info = titleFor(altitude);
  run = {
    id: globalThis.crypto?.randomUUID?.() || `run-${Date.now()}`,
    altitudeM: altitude,
    title: info.title,
    tagline: info.tagline,
    country: null,
    countryCode: '',
    flag: '',
    at: new Date().toISOString(),
  };
  const formatted = formatAltitude(altitude);
  apexValue.textContent = formatted.value;
  apexUnit.textContent = formatted.unit;
  apexTitle.textContent = info.title;
  apexTag.textContent = info.tagline;
  let note = reason === 'finish'
    ? 'You finished. The score is the highest point you reached.'
    : flight.endReason === 'silence'
      ? 'A long pause ended the run. The score is your highest point.'
      : flight.endReason === 'pad'
        ? 'Back on the pad. The score is your highest point.'
        : 'The score is your highest point.';
  if (flight.launched) {
    const result = leaderboard.noteApex(run);
    if (result.isBest) {
      personalBestMeters = altitude;
      note = result.previous
        ? `New personal best. Previous was ${formatAltitude(result.previous.altitudeM).label}.`
        : 'First flight logged on this device. That is the best, by default.';
      if (flight.endReason === 'silence') note += ' A long pause ended the run.';
      else if (flight.endReason === 'pad') note += ' You came back to the pad.';
      bestPill.hidden = false;
      bestPill.textContent = `Best ${formatted.label}`;
      renderer.burst(1.15);
    } else if (result.previous) {
      note = `Personal best is still ${formatAltitude(result.previous.altitudeM).label}.`;
    }
  } else {
    note = 'The pad would like a proper scream next time.';
  }
  run.scoreNote = note;
  apexNote.textContent = note;

  restoreCountry();

  audio.setThrust(0, 0);
  if (flight.launched) audio.land();
  flight.ended = true;
  renderer.snapTo(altitude);
  mode = 'results';
  show('results');
  renderCard();
  if (currentCountry()) commitCountry();
}

function beginFlight() {
  resetFlight(flight);
  celebratedBest = false;
  renderer.snapTo(0);
  mode = 'flight';
  show('flight');
  hint.hidden = false;
  hint.classList.add('is-cue');
  hint.classList.remove('is-falling');
  hint.textContent = usingFallback ? 'Hold to climb!' : 'Scream to climb!';
  updateHud();
}

function beginCalibration() {
  resetFlight(flight);
  flight.live = false;
  celebratedBest = false;
  renderer.snapTo(0);
  gate.startCalibration();
  mode = 'calibrating';
  show('calibrating');
  updateHud();
  calSeconds.textContent = '1.5';
}

async function onStart() {
  if (starting || mode === 'flight') return;
  starting = true;
  startBtn.disabled = true;
  let micPromise = null;
  try {
    audio.arm();
    if (!simMode && !forceFallback && navigator.mediaDevices?.getUserMedia) {
      micPromise = navigator.mediaDevices.getUserMedia({
        audio: MIC_CONSTRAINTS,
        video: false,
      });
    }
    await audio.resume();
    audio.ui();
    if (simMode && !forceFallback) {
      usingFallback = false;
      if (gate.calibrated) beginFlight();
      else beginCalibration();
      return;
    }
    if (forceFallback || !micPromise) {
      usingFallback = true;
      beginFlight();
      showToast('Mic off — hold the button or spacebar');
      return;
    }
    const stream = await micPromise;
    await audio.attachMic(stream);
    usingFallback = false;
    const track = stream.getAudioTracks()[0];
    if (track) {
      track.addEventListener('ended', () => {
        if (mode !== 'flight') return;
        usingFallback = true;
        holdBtn.hidden = false;
        hint.hidden = false;
        hint.textContent = 'Hold to climb!';
        showToast('Mic ended — hold to thrust');
      });
    }
    if (gate.calibrated) beginFlight();
    else beginCalibration();
  } catch {
    usingFallback = !(simMode && !forceFallback);
    try { await micPromise?.catch?.(() => {}); } catch { /* already failed */ }
    if (usingFallback) {
      beginFlight();
      showToast('Mic blocked — hold the button or spacebar');
    } else if (gate.calibrated) beginFlight();
    else beginCalibration();
  } finally {
    starting = false;
    startBtn.disabled = false;
  }
}

function text(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function openBests() {
  const board = leaderboard.overview();
  bestsList.replaceChildren();
  if (!board.overall && board.countries.length === 0) {
    bestsList.append(text('p', 'empty', 'No flights yet. Scream one into orbit and it will land here.'));
  } else {
    if (board.overall) {
      const hero = document.createElement('article');
      hero.className = 'best-hero';
      const formatted = formatAltitude(board.overall.altitudeM);
      const place = board.overall.country ? `from ${placeLabel(board.overall)}` : 'Country not picked';
      hero.append(
        text('p', 'eyebrow', 'Personal best'),
        text('p', 'best-alt', formatted.label),
        text('p', '', board.overall.title),
        text('p', 'fine', `${place} · ${formatWhen(board.overall.at)}`),
      );
      bestsList.append(hero);
    }
    for (const entry of board.countries) {
      const row = document.createElement('article');
      row.className = 'best-row';
      const formatted = formatAltitude(entry.altitudeM);
      const who = document.createElement('div');
      who.append(text('strong', '', placeLabel(entry)), text('span', '', entry.title));
      const score = document.createElement('div');
      score.className = 'best-row-alt';
      score.append(text('span', '', formatted.label), text('small', '', formatWhen(entry.at)));
      row.append(who, score);
      bestsList.append(row);
    }
  }
  bestsNote.textContent = board.source === 'local'
    ? 'Saved on this device. A shared country leaderboard can plug in later.'
    : 'Shared country board.';
  mode = 'bests';
  show('bests');
}

startBtn.addEventListener('click', onStart);
document.querySelector('#open-bests').addEventListener('click', openBests);
document.querySelector('#results-bests').addEventListener('click', openBests);
document.querySelector('#bests-back').addEventListener('click', () => {
  mode = run ? 'results' : 'ready';
  show(run ? 'results' : 'start');
});
againBtn.addEventListener('click', () => {
  beginFlight();
});
bailBtn.addEventListener('click', () => {
  if (mode === 'calibrating') {
    mode = 'ready';
    show('start');
    return;
  }
  finish('finish');
});
downloadBtn.addEventListener('click', () => {
  if (downloadBtn.disabled) return;
  shareCard.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const label = formatAltitude(run.altitudeM).label.replace(/\s+/g, '-');
    link.href = url;
    link.download = `scream-to-launch-${label}.png`;
    link.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
});
shareX.addEventListener('click', (event) => {
  if (shareX.getAttribute('aria-disabled') === 'true') event.preventDefault();
});
countrySearch.addEventListener('focus', () => {
  countryHighlight = 0;
  paintCountryList();
  setListOpen(true);
  countrySearch.select();
});
countrySearch.addEventListener('input', () => {
  countryHighlight = 0;
  if (pickedCountry && countrySearch.value !== displayOf(pickedCountry)) pickedCountry = null;
  paintCountryList();
  setListOpen(true);
  commitCountry();
});
countrySearch.addEventListener('keydown', (event) => {
  const options = [...countryList.querySelectorAll('[role="option"]')];
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (!options.length) return;
    setListOpen(true);
    countryHighlight = event.key === 'ArrowDown'
      ? (countryHighlight + 1) % options.length
      : (countryHighlight - 1 + options.length) % options.length;
    paintCountryList();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const selected = countryList.querySelector('[aria-selected="true"]');
    selected?.click();
  } else if (event.key === 'Escape') {
    setListOpen(false);
  }
});
countrySearch.addEventListener('blur', () => {
  window.setTimeout(() => setListOpen(false), 120);
});
otherInput.addEventListener('input', commitCountry);
function setSimDb(db) {
  simRange.value = String(dbToSimPercent(db));
  simOut.textContent = `${Math.round(db)} dB`;
}
simRange.addEventListener('input', () => {
  simOut.textContent = `${Math.round(simPercentToDb(simRange.value))} dB`;
});
document.querySelector('#sim-yell').addEventListener('click', () => setSimDb(-8));
document.querySelector('#sim-quiet').addEventListener('click', () => setSimDb(-50));
simOut.textContent = `${Math.round(simPercentToDb(simRange.value))} dB`;

holdBtn.addEventListener('pointerdown', (event) => {
  if (!usingFallback || mode !== 'flight') return;
  event.preventDefault();
  holding = true;
  holdBtn.classList.add('is-down');
  holdBtn.setPointerCapture(event.pointerId);
});
function releaseHold() {
  holding = false;
  holdBtn.classList.remove('is-down');
}
holdBtn.addEventListener('pointerup', releaseHold);
holdBtn.addEventListener('pointercancel', releaseHold);
holdBtn.addEventListener('lostpointercapture', releaseHold);
holdBtn.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  if (event.code === 'Space' && !typing) {
    event.preventDefault();
    if (mode === 'ready') {
      onStart();
      return;
    }
    spaceHeld = true;
    if (usingFallback) holding = true;
  }
  if (event.code === 'Enter' && mode === 'ready' && !typing) onStart();
});
window.addEventListener('keyup', (event) => {
  if (event.code === 'Space') {
    spaceHeld = false;
    holding = false;
    holdBtn.classList.remove('is-down');
  }
});
window.addEventListener('blur', () => {
  spaceHeld = false;
  holding = false;
  holdBtn.classList.remove('is-down');
});

show('start');
renderer.snapTo(0);

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (mode === 'calibrating') {
    const status = gate.update(readDb(), dt);
    paintMeter(status);
    calSeconds.textContent = status.remaining.toFixed(1);
    audio.setThrust(0, 0);
    if (!status.calibrating) {
      beginFlight();
      showToast(`Room ${Math.round(status.floorDb)} dB · scream past ${Math.round(status.openAt)} dB`);
    }
  } else if (mode === 'flight') {
    stepFlight(flight, demandFor(dt), dt);
    audio.setThrust(flight.thrust, flight.altitude);
    if (flight.justLiftoff) {
      audio.liftoff();
      if (navigator.vibrate) navigator.vibrate(18);
    }
    if (flight.justApogee) audio.apogee();
    for (const milestone of flight.justCrossed) {
      audio.milestone(milestone.index);
      const big = milestone.id === 'pluto' || milestone.id === 'mars' || milestone.id === 'moon';
      renderer.burst(big ? 1.35 : 1);
      showToast(milestone.id === 'pluto' ? 'Reached Pluto' : `${milestone.name} · ${milestone.blurb}`);
      if (navigator.vibrate) navigator.vibrate(12);
    }
    if (
      personalBestMeters > 0 &&
      flight.altitude > personalBestMeters &&
      flight.thrust > 0.2 &&
      !celebratedBest
    ) {
      celebratedBest = true;
      showToast('Personal best, and still climbing');
    }
    updateHud();
    if (flight.ended) finish('landed');
  } else {
    audio.setThrust(0, 0);
  }
  const backdropAlt = (mode === 'results' || mode === 'bests') && run ? run.altitudeM : 0;
  const ghost = mode === 'flight'
    ? flight
    : { altitude: backdropAlt, velocity: 0, thrust: 0 };
  renderer.frame(ghost, dt, { markers: mode === 'flight' });
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
