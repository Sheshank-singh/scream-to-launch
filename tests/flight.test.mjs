import { createLeaderboard } from '../js/leaderboard.js';
import { altitudeCurve, ALTITUDE_KEYS, createFlight, resetFlight, stepFlight } from '../js/physics.js';
import { createStore } from '../js/storage.js';
import { sanitizeCity, shareIntent, shareLine } from '../js/share.js';
import { formatAltitude, titleFor } from '../js/zones.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function simulate(segments) {
  const state = createFlight();
  resetFlight(state);
  const dt = 1 / 60;
  for (const segment of segments) {
    const steps = Math.round(segment.seconds / dt);
    for (let i = 0; i < steps; i += 1) stepFlight(state, segment.demand, dt);
  }
  return state;
}

function memory() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

let previous = 0;
for (let t = 0; t <= 30; t += 0.05) {
  const alt = altitudeCurve(t);
  assert(alt >= previous - 1e-6, `curve dipped at t=${t}: ${alt} < ${previous}`);
  previous = alt;
}
assert(altitudeCurve(0) === 0, 'curve starts at the pad');
assert(Math.abs(altitudeCurve(ALTITUDE_KEYS[4].t) - 10_000) < 1, `jets key ${altitudeCurve(5.5)}`);
assert(Math.abs(altitudeCurve(10.5) - 100_000) / 100_000 < 0.02, 'karman key');

const hop = simulate([{ seconds: 0.45, demand: 1 }]);
assert(hop.launched, `short yell should leave the pad, alt ${hop.altitude}`);
assert(hop.maxAltitude > 28, 'launch threshold');

const landed = simulate([
  { seconds: 1.2, demand: 1 },
  { seconds: 8, demand: 0 },
]);
assert(landed.ended, `flight should end after the fall, alt ${landed.altitude} clock ${landed.screamClock}`);
assert(landed.maxAltitude > 400, `expected a cloud-ish hop, got ${landed.maxAltitude}`);

const jets = simulate([{ seconds: 5.6, demand: 1 }]);
assert(jets.maxAltitude > 8_000, `jets run too low: ${jets.maxAltitude}`);

const karman = simulate([{ seconds: 10.6, demand: 1 }]);
assert(karman.maxAltitude > 90_000, `karman run too low: ${karman.maxAltitude}`);

const iss = simulate([{ seconds: 14.2, demand: 1 }]);
assert(iss.maxAltitude > 300_000, `ISS run too low: ${iss.maxAltitude}`);

const moon = simulate([{ seconds: 21.8, demand: 1 }]);
assert(moon.maxAltitude > 300_000_000, `moon run too low: ${moon.maxAltitude}`);

const mars = simulate([{ seconds: 28.4, demand: 1 }]);
assert(mars.maxAltitude > 40_000_000_000, `mars run too low: ${mars.maxAltitude}`);

const quiet = simulate([{ seconds: 10.6, demand: 0.45 }]);
assert(quiet.maxAltitude < karman.maxAltitude, 'a softer scream should climb less');
assert(quiet.maxAltitude > 1_000, `soft scream still climbs, got ${quiet.maxAltitude}`);

const silent = simulate([{ seconds: 3, demand: 0 }]);
assert(!silent.launched && silent.altitude === 0, 'silence stays on the pad');

const crossed = simulate([
  { seconds: 2, demand: 1 },
  { seconds: 6, demand: 0 },
  { seconds: 2, demand: 1 },
]);
assert(crossed.milestones.clouds, 'clouds milestone sticks');

assert(titleFor(200).title === 'Neighbour-alarming', titleFor(200).title);
assert(titleFor(100_000).title === 'Kármán line conqueror', titleFor(100_000).title);
assert(titleFor(400_000).title === 'ISS just heard you', titleFor(400_000).title);
assert(titleFor(54_600_000_000).title === 'Mars mission, voice only', titleFor(54_600_000_000).title);
assert(titleFor(99_000).title === 'Almost an astronaut', titleFor(99_000).title);

assert(formatAltitude(842).label === '842 m', formatAltitude(842).label);
assert(formatAltitude(12_400).label === '12.4 km', formatAltitude(12_400).label);
assert(formatAltitude(384_400_000).label === '384,400 km', formatAltitude(384_400_000).label);
assert(formatAltitude(54_600_000_000).label === '54.6 million km', formatAltitude(54_600_000_000).label);

const line = shareLine({ altitudeLabel: '128 km', city: 'Mumbai' });
assert(
  line === 'I screamed my rocket to 128 km from Mumbai 🚀 Can you beat me? 👇\nhttps://sheshank-singh.github.io/scream-to-launch/',
  line,
);
assert(shareIntent(line).startsWith('https://x.com/intent/post?text='), 'intent url');
assert(decodeURIComponent(shareIntent(line).split('text=')[1]) === line, 'intent text');
assert(sanitizeCity('  Pune \n west  ').length <= 24, 'city length');
assert(!sanitizeCity('  Pune \n west  ').includes('\n'), 'city newline');

const board = createLeaderboard(createStore(memory()));
const first = {
  id: 'a',
  altitudeM: 1000,
  title: 'Window-rattler',
  tagline: 'cat',
  at: '2026-11-18T00:00:00.000Z',
};
assert(board.noteApex(first).isBest, 'first is best');
assert(!board.noteApex({ ...first, id: 'b', altitudeM: 500 }).isBest, 'lower is not best');
const mumbai = board.submitRun({ ...first, city: 'Mumbai' });
assert(mumbai.ok && mumbai.cityBest, 'city best');
const delhi = board.submitRun({ ...first, city: 'Delhi', previousCity: 'Mumbai' });
assert(delhi.ok, 'moved city');
assert(board.cityBoard('Mumbai').entries.length === 0, 'previous city cleared when it was this run');
assert(board.cityBoard('Delhi').entries.length === 1, 'new city kept');
assert(board.overview().overall.city === 'Delhi', 'overall city follows the run');
assert(board.overview().source === 'local', 'local source');

const older = {
  id: 'old',
  altitudeM: 5000,
  title: 'Cloud puncher',
  tagline: 'clouds',
  at: '2026-11-01T00:00:00.000Z',
};
board.submitRun({ ...older, city: 'Mumbai' });
board.submitRun({ ...first, id: 'c', altitudeM: 800, city: 'Mumbai', previousCity: 'Delhi' });
assert(board.cityBoard('Mumbai').entries[0].altitudeM === 5000, 'older higher city best remains');

console.log('flight tests passed');
console.log('sample', {
  hop: Math.round(hop.maxAltitude),
  landed: Math.round(landed.maxAltitude),
  jets: Math.round(jets.maxAltitude),
  karman: Math.round(karman.maxAltitude),
  iss: Math.round(iss.maxAltitude),
  moon: Math.round(moon.maxAltitude),
  mars: Math.round(mars.maxAltitude),
  quiet: Math.round(quiet.maxAltitude),
});
