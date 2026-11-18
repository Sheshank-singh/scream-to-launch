import { MILESTONES } from './zones.js';

/**
 * Arcade flight model.
 *
 * `demand` is already a 0–1 thrust from the decibel gate (0 means the gate
 * is shut — the rocket must not creep). A full scream (demand = 1) is the
 * only thing that tracks this curve. Partial thrust is linear, so a shout
 * that is merely "loud enough" crawls, and the gaps between planets widen
 * on purpose: Kármán is seconds, Pluto is many minutes.
 *
 * Full-scream clock (demand = 1), roughly:
 *   12s Kármán, 27s ISS, 60s Moon, 120s Mars, 340s Pluto.
 * Quieter thrust is slower. Silence does not end the run: the rocket
 * coasts, then loses height slowly so a breath can resume the climb.
 * The run ends on the pad, after ~9s of quiet once airborne, or via Finish.
 */

export const ALTITUDE_KEYS = [
  { t: 0, alt: 0 },
  { t: 0.7, alt: 90 },
  { t: 2.4, alt: 1_000 },
  { t: 6, alt: 10_000 },
  { t: 12, alt: 100_000 },
  { t: 27, alt: 400_000 },
  { t: 42, alt: 36_000_000 },
  { t: 60, alt: 384_400_000 },
  { t: 120, alt: 225_000_000_000 },
  { t: 160, alt: 330_000_000_000 },
  { t: 205, alt: 630_000_000_000 },
  { t: 250, alt: 1_270_000_000_000 },
  { t: 290, alt: 2_720_000_000_000 },
  { t: 320, alt: 4_350_000_000_000 },
  { t: 340, alt: 5_900_000_000_000 },
];

const MAX_CLOCK = 420;
const LAUNCH_METERS = 28;
const LAND_METERS = 40;
const THRUST_DEADZONE = 0.045;
const SILENCE_LIMIT = 9;
const FALL_PER_SECOND = 1.15;

export function altitudeCurve(t) {
  const keys = ALTITUDE_KEYS;
  if (t <= 0) return 0;
  const last = keys[keys.length - 1];
  if (t >= last.t) {
    return last.alt * Math.exp(Math.min(0.35, (t - last.t) * 0.004));
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
    silence: 0,
    falling: false,
    endReason: '',
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
  state.silence = 0;
  state.falling = false;
  state.endReason = '';
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

  const raw = Math.max(0, Math.min(1, demand || 0));
  const input = raw < THRUST_DEADZONE ? 0 : raw;
  state.demand = input;
  const thrustRate = input > state.thrust ? 8 : 4.5;
  state.thrust += (input - state.thrust) * (1 - Math.exp(-thrustRate * step));

  const thrusting = input > 0;
  if (thrusting) {
    state.silence = 0;
    state.falling = false;
    state.screamClock += input * step;
    if (state.screamClock > MAX_CLOCK) state.screamClock = MAX_CLOCK;
    state.hang = 0.4;
  } else if (state.launched) {
    state.silence += step;
    if (state.hang > 0) {
      state.hang -= step;
      state.falling = false;
    } else {
      state.falling = true;
      state.screamClock = Math.max(0, state.screamClock - FALL_PER_SECOND * step);
    }
  } else {
    state.falling = false;
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

  const quiet = input === 0 && state.thrust < 0.05;
  if (state.launched && quiet && state.silence >= SILENCE_LIMIT) {
    state.ended = true;
    state.endReason = 'silence';
  } else if (
    state.launched &&
    quiet &&
    state.hang <= 0 &&
    state.altitude < LAND_METERS &&
    state.velocity <= 0
  ) {
    state.ended = true;
    state.endReason = 'pad';
    state.altitude = 0;
    state.velocity = 0;
  }

  return state;
}
