import { CITIES, OTHER_CITY } from './config.js';
import { createAudio, createLoudness } from './audio.js';
import { createLeaderboard } from './leaderboard.js';
import { createFlight, resetFlight, stepFlight } from './physics.js';
import { createRenderer } from './render.js';
import { drawShareCard, sanitizeCity, shareIntent, shareLine } from './share.js';
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
const cityChips = document.querySelector('#city-chips');
const otherWrap = document.querySelector('#other-wrap');
const otherInput = document.querySelector('#other-city');
const shareCard = document.querySelector('#share-card');
const shareX = document.querySelector('#share-x');
const downloadBtn = document.querySelector('#download');
const againBtn = document.querySelector('#again');
const bestsList = document.querySelector('#bests-list');
const bestsNote = document.querySelector('#bests-note');

const audio = createAudio();
const loudness = createLoudness();
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
  hud.hidden = !flying;
  thrustWrap.hidden = !flying;
  bailBtn.hidden = !flying;
  document.body.classList.toggle('is-flying', flying);
  if (!flying) hint.hidden = true;
  holdBtn.hidden = !(flying && usingFallback);
  simBox.hidden = !(flying && simMode && !forceFallback);
}

function selectedCity() {
  const pressed = cityChips.querySelector('[aria-pressed="true"]');
  if (!pressed) return '';
  if (pressed.dataset.city === OTHER_CITY) return sanitizeCity(otherInput.value);
  return pressed.dataset.city;
}

function renderCard() {
  if (!run) return;
  const formatted = formatAltitude(run.altitudeM);
  const city = selectedCity();
  drawShareCard(shareCard, {
    value: formatted.value,
    unit: formatted.unit,
    title: run.title,
    tagline: run.tagline,
    city,
  });
  const ready = Boolean(city);
  downloadBtn.disabled = !ready;
  shareX.classList.toggle('is-disabled', !ready);
  if (ready) {
    shareX.href = shareIntent(shareLine({ altitudeLabel: formatted.label, city }));
    shareX.setAttribute('aria-disabled', 'false');
  } else {
    shareX.href = '#';
    shareX.setAttribute('aria-disabled', 'true');
  }
}

function paintCities(preselect) {
  cityChips.replaceChildren();
  const choices = [...CITIES, OTHER_CITY];
  for (const city of choices) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.city = city;
    button.textContent = city;
    button.setAttribute('aria-pressed', city === preselect ? 'true' : 'false');
    button.addEventListener('click', () => {
      for (const chip of cityChips.querySelectorAll('.chip')) {
        chip.setAttribute('aria-pressed', chip === button ? 'true' : 'false');
      }
      const other = city === OTHER_CITY;
      otherWrap.hidden = !other;
      if (other) otherInput.focus();
      commitCity();
    });
    cityChips.append(button);
  }
  otherWrap.hidden = preselect !== OTHER_CITY;
}

function commitCity() {
  const city = selectedCity();
  renderCard();
  if (!run || !city || city === run.city) return;
  const result = leaderboard.submitRun({ ...run, city, previousCity: run.city });
  run.city = city;
  const cityLine = result.cityBest ? `New best for ${city}.` : `Logged for ${city}.`;
  apexNote.textContent = `${run.scoreNote || ''} ${cityLine} Saved on this device.`.trim();
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
  if (flight.thrust > 0.22) hint.hidden = true;
}

function demandFor(dt) {
  if (simMode && !forceFallback) {
    const slider = Number(simRange.value) / 100;
    simOut.textContent = `${simRange.value}%`;
    return spaceHeld ? 1 : slider;
  }
  if (usingFallback) return holding || spaceHeld ? 1 : 0;
  return loudness.volume(audio.level(), dt);
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
    city: null,
    at: new Date().toISOString(),
  };
  const formatted = formatAltitude(altitude);
  apexValue.textContent = formatted.value;
  apexUnit.textContent = formatted.unit;
  apexTitle.textContent = info.title;
  apexTag.textContent = info.tagline;
  let note = reason === 'bail'
    ? 'You bailed. The altitude is whatever you had already screamed for.'
    : 'The scream is over.';
  if (flight.launched) {
    const result = leaderboard.noteApex(run);
    if (result.isBest) {
      personalBestMeters = altitude;
      note = result.previous
        ? `New personal best. Previous was ${formatAltitude(result.previous.altitudeM).label}.`
        : 'First flight logged on this device. That is the best, by default.';
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

  const last = leaderboard.lastCity();
  const known = CITIES.includes(last);
  paintCities(known ? last : last ? OTHER_CITY : '');
  if (!known && last) otherInput.value = last;
  else otherInput.value = '';

  audio.setThrust(0, 0);
  if (flight.launched) audio.land();
  flight.ended = true;
  renderer.snapTo(altitude);
  mode = 'results';
  show('results');
  renderCard();
  if (known || last) commitCity();
}

function beginFlight() {
  resetFlight(flight);
  celebratedBest = false;
  renderer.snapTo(0);
  simRange.value = '0';
  simOut.textContent = '0%';
  mode = 'flight';
  show('flight');
  hint.hidden = false;
  hint.textContent = usingFallback ? 'HOLD' : 'SCREAM';
  updateHud();
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
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
        video: false,
      });
    }
    await audio.resume();
    audio.ui();
    if (simMode && !forceFallback) {
      usingFallback = false;
      beginFlight();
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
        hint.textContent = 'HOLD';
        showToast('Mic ended — hold to thrust');
      });
    }
    beginFlight();
  } catch {
    usingFallback = !(simMode && !forceFallback);
    try { await micPromise?.catch?.(() => {}); } catch { /* already failed */ }
    beginFlight();
    if (usingFallback) showToast('Mic blocked — hold the button or spacebar');
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
  if (!board.overall && board.cities.length === 0) {
    bestsList.append(text('p', 'empty', 'No flights yet. Scream one into orbit and it will land here.'));
  } else {
    if (board.overall) {
      const hero = document.createElement('article');
      hero.className = 'best-hero';
      const formatted = formatAltitude(board.overall.altitudeM);
      const place = board.overall.city ? `from ${board.overall.city}` : 'City not picked';
      hero.append(
        text('p', 'eyebrow', 'Personal best'),
        text('p', 'best-alt', formatted.label),
        text('p', '', board.overall.title),
        text('p', 'fine', `${place} · ${formatWhen(board.overall.at)}`),
      );
      bestsList.append(hero);
    }
    for (const entry of board.cities) {
      const row = document.createElement('article');
      row.className = 'best-row';
      const formatted = formatAltitude(entry.altitudeM);
      const who = document.createElement('div');
      who.append(text('strong', '', entry.city), text('span', '', entry.title));
      const score = document.createElement('div');
      score.className = 'best-row-alt';
      score.append(text('span', '', formatted.label), text('small', '', formatWhen(entry.at)));
      row.append(who, score);
      bestsList.append(row);
    }
  }
  bestsNote.textContent = board.source === 'local'
    ? 'Saved on this device. A shared city leaderboard can plug in later.'
    : 'Shared city board.';
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
bailBtn.addEventListener('click', () => finish('bail'));
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
otherInput.addEventListener('input', commitCity);
simRange.addEventListener('input', () => {
  simOut.textContent = `${simRange.value}%`;
});
document.querySelector('#sim-yell').addEventListener('click', () => {
  simRange.value = '100';
  simOut.textContent = '100%';
});
document.querySelector('#sim-quiet').addEventListener('click', () => {
  simRange.value = '0';
  simOut.textContent = '0%';
});

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
  if (mode === 'flight') {
    stepFlight(flight, demandFor(dt), dt);
    audio.setThrust(flight.thrust, flight.altitude);
    if (flight.justLiftoff) {
      audio.liftoff();
      if (navigator.vibrate) navigator.vibrate(18);
    }
    if (flight.justApogee) audio.apogee();
    for (const milestone of flight.justCrossed) {
      audio.milestone(milestone.index);
      renderer.burst(milestone.id === 'mars' || milestone.id === 'moon' ? 1.3 : 1);
      showToast(`${milestone.name} · ${milestone.blurb}`);
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
