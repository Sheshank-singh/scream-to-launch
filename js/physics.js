import { MILESTONES } from './zones.js';

/**
 * Arcade flight model.
 *
 * A real rocket cannot reach Mars on lung power, so scream-time maps through
 * a curve that hits the scenic altitudes on purpose:
 *   ~1.6s clouds, ~5.5s jets, ~10.5s Kármán, ~14s ISS, ~21.5s Moon, ~28s Mars
 * at a full-throated scream (demand = 1). Partial volume advances the clock
 * more slowly. When the scream stops, the clock hangs (coast), then rewinds
 * so the rocket falls back through the same zones and lands.
 */

export const ALTITUDE_KEYS = [
  { t: 0, alt: 0 },
  { t: 0.4, alt: 100 },
  { t: 1.6, alt: 900 },
  { t: 3.2, alt: 2_800 },
  { t: 5.5, alt: 10_000 },
  { t: 8.0, alt: 35_000 },
  { t: 10.5, alt: 100_000 },
  { t: 14.0, alt: 400_000 },
  { t: 17.5, alt: 3_500_000 },
  { t: 21.5, alt: 384_400_000 },
  { t: 28.0, alt: 54_600_000_000 },
];

const FALL_RATE = 1.65;
const MAX_CLOCK = 48;
const LAUNCH_METERS = 28;
const LAND_METERS = 36;

export function altitudeCurve(t) {
  const keys = ALTITUDE_KEYS;
  if (t <= 0) return 0;
  const last = keys[keys.length - 1];
  if (t >= last.t) {
    return last.alt * Math.exp(Math.min(2.4, (t - last.t) * 0.05));
  }
  let index = 1;
  while (index < keys.length - 1 && keys[index].t < t) index += 1;
  const a = keys[index - 1];
  const b = keys[index];
  const span = b.t - a.t || 1;
  const u = Math.max(0, Math.min(1, (t - a.t) / span));
  const s = u * u * (3 - 2 * u);
  if (a.alt <= 0) return b.alt * Math.sqrt(u);
  const logA = Math.log(a.alt);
  const logB = Math.log(b.alt);
  return Math.exp(logA + (logB - logA) * s);
}

export function createFlight() {
  return {
    screamClock: 0,
    altitude: 0,
    velocity: 0,
    maxAltitude: 0,
    thrust: 0,
    demand: 0,
    hang: 0,
    launched: false,
    ended: false,
    time: 0,
    live: false,
    milestones: {},
    justCrossed: [],
    justLiftoff: false,
    justApogee: false,
    apogeeNoted: false,
  };
}

export function resetFlight(state) {
  state.screamClock = 0;
  state.altitude = 0;
  state.velocity = 0;
  state.maxAltitude = 0;
  state.thrust = 0;
  state.demand = 0;
  state.hang = 0;
  state.launched = false;
  state.ended = false;
  state.time = 0;
  state.live = true;
  state.milestones = {};
  state.justCrossed = [];
  state.justLiftoff = false;
  state.justApogee = false;
  state.apogeeNoted = false;
}

export function stepFlight(state, demand, dt) {
  state.justCrossed = [];
  state.justLiftoff = false;
  state.justApogee = false;
  if (state.ended || !state.live) return state;

  const step = Math.max(0, Math.min(0.05, dt || 0));
  if (step === 0) return state;

  const input = Math.max(0, Math.min(1, demand || 0));
  state.demand = input;
  const thrustRate = input > state.thrust ? 10 : 3.4;
  state.thrust += (input - state.thrust) * (1 - Math.exp(-thrustRate * step));

  const thrusting = input > 0.07;
  if (thrusting) {
    if (state.apogeeNoted && state.hang <= 0) state.apogeeNoted = false;
    state.screamClock += Math.pow(input, 0.9) * step;
    if (state.screamClock > MAX_CLOCK) state.screamClock = MAX_CLOCK;
    state.hang = 0.55;
  } else if (state.launched && state.hang > 0) {
    state.hang -= step;
    if (state.hang <= 0) {
      state.hang = 0;
      if (!state.apogeeNoted && state.maxAltitude > 40) {
        state.apogeeNoted = true;
        state.justApogee = true;
      }
    }
  } else {
    state.screamClock = Math.max(0, state.screamClock - FALL_RATE * step);
  }

  const target = altitudeCurve(state.screamClock);
  const previous = state.altitude;
  const follow = thrusting ? 7.5 : 2.5;
  state.altitude += (target - state.altitude) * (1 - Math.exp(-follow * step));
  if (state.altitude < 0.45) state.altitude = 0;
  state.velocity = (state.altitude - previous) / step;
  if (state.altitude > state.maxAltitude) state.maxAltitude = state.altitude;

  if (!state.launched && state.maxAltitude > LAUNCH_METERS) {
    state.launched = true;
    state.justLiftoff = true;
  }

  if (state.velocity >= -1) {
    for (const milestone of MILESTONES) {
      if (!state.milestones[milestone.id] && state.altitude >= milestone.meters) {
        state.milestones[milestone.id] = true;
        state.justCrossed.push(milestone);
      }
    }
  }

  state.time += step;

  const quiet = input < 0.05 && state.thrust < 0.08;
  if (
    state.launched &&
    quiet &&
    state.hang <= 0 &&
    state.screamClock < 0.18 &&
    state.altitude < LAND_METERS &&
    state.velocity <= 0
  ) {
    state.ended = true;
    state.altitude = 0;
    state.velocity = 0;
    state.thrust = 0;
  }

  return state;
}
