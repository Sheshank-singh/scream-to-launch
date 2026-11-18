/**
 * Decibel noise gate.
 *
 * Levels are dBFS from the microphone RMS (0 is full scale, room noise
 * lives far below that). Start holds a short quiet calibration, then the
 * rocket stays put until the level is clearly above that floor and above
 * an absolute minimum. Hysteresis keeps fans and ordinary talking shut out.
 */

export const ABSOLUTE_OPEN_DB = -36;
export const ABSOLUTE_CLOSE_DB = -42;
export const MARGIN_OPEN_DB = 9;
export const MARGIN_CLOSE_DB = 5;
export const CALIBRATION_SECONDS = 1.5;
export const FULL_SCREAM_OVER_DB = 14;

const OPEN_HOLD = 0.09;
const CLOSE_HOLD = 0.16;

export function rmsToDbfs(rms) {
  return 20 * Math.log10(Math.max(Number(rms) || 0, 1e-8));
}

export function gateLines(floorDb) {
  const openAt = Math.max(floorDb + MARGIN_OPEN_DB, ABSOLUTE_OPEN_DB);
  let closeAt = Math.max(floorDb + MARGIN_CLOSE_DB, ABSOLUTE_CLOSE_DB);
  closeAt = Math.min(closeAt, openAt - 4);
  return { openAt, closeAt };
}

/** 0 at the open line, 1 once the scream is FULL_SCREAM_OVER_DB louder. */
export function thrustFromDb(db, openAt) {
  const over = db - openAt;
  if (over <= 0) return 0;
  const amount = Math.min(1, over / FULL_SCREAM_OVER_DB);
  return amount ** 1.25;
}

export function createGate() {
  let floorDb = -50;
  let calibrated = false;
  let calibrating = false;
  let remaining = 0;
  let elapsed = 0;
  const samples = [];
  let smoothed = -90;
  let open = false;
  let pendingOpen = 0;
  let pendingClose = 0;

  function finishCalibration() {
    calibrating = false;
    calibrated = true;
    remaining = 0;
    if (samples.length) {
      const sorted = [...samples].sort((a, b) => a - b);
      const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.6));
      floorDb = sorted[index];
    }
    floorDb = Math.max(-78, Math.min(-32, floorDb));
    open = false;
    pendingOpen = 0;
    pendingClose = 0;
  }

  function snapshot(instant) {
    const lines = gateLines(floorDb);
    const thrust = !calibrated || calibrating || !open ? 0 : thrustFromDb(smoothed, lines.openAt);
    return {
      calibrating,
      calibrated,
      remaining: Math.max(0, remaining),
      db: smoothed,
      instant,
      floorDb,
      openAt: lines.openAt,
      closeAt: lines.closeAt,
      open: calibrated && !calibrating && open,
      thrust,
    };
  }

  return {
    get calibrated() {
      return calibrated;
    },
    startCalibration(seconds = CALIBRATION_SECONDS) {
      calibrating = true;
      calibrated = false;
      remaining = seconds;
      elapsed = 0;
      samples.length = 0;
      smoothed = -90;
      open = false;
      pendingOpen = 0;
      pendingClose = 0;
    },
    update(db, dt) {
      const instant = Number.isFinite(db) ? db : -90;
      const step = Math.max(0, Math.min(0.05, dt || 0));
      const tau = instant > smoothed ? 0.05 : 0.18;
      smoothed += (instant - smoothed) * (1 - Math.exp(-step / tau));

      if (calibrating) {
        elapsed += step;
        remaining -= step;
        if (elapsed > 0.2) samples.push(instant);
        if (remaining <= 0.001) finishCalibration();
        return snapshot(instant);
      }

      if (!calibrated) return snapshot(instant);

      const { openAt, closeAt } = gateLines(floorDb);
      if (!open) {
        pendingClose = 0;
        if (smoothed >= openAt) pendingOpen += step;
        else pendingOpen = 0;
        if (pendingOpen >= OPEN_HOLD) {
          open = true;
          pendingOpen = 0;
        }
      } else if (smoothed <= closeAt) {
        pendingOpen = 0;
        pendingClose += step;
        if (pendingClose >= CLOSE_HOLD) {
          open = false;
          pendingClose = 0;
        }
      } else {
        pendingOpen = 0;
        pendingClose = 0;
      }

      return snapshot(instant);
    },
  };
}

/** Map the test slider (0–100) onto a dBFS range. 0 is a dead-quiet room. */
export const SIM_DB_MIN = -72;
export const SIM_DB_MAX = 0;

export function simPercentToDb(percent) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
  return SIM_DB_MIN + p * (SIM_DB_MAX - SIM_DB_MIN);
}

export function dbToSimPercent(db) {
  const p = (db - SIM_DB_MIN) / (SIM_DB_MAX - SIM_DB_MIN);
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}
