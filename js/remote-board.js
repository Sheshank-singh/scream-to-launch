import { BOARD_URL } from './board-config.js';
import { sanitizeNickname } from './nicknames.js';
import { maxHonestAltitude } from './physics.js';
import { sanitizePlace } from './share.js';

const TOP_RUNS = 20;
const STORED_RUNS = 80;

function cleanEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nick = sanitizeNickname(raw.nickname);
  if (!nick.ok) return null;
  const country = sanitizePlace(raw.country);
  if (!country) return null;
  const altitudeM = Number(raw.altitudeM);
  const elapsedSec = Number(raw.elapsedSec);
  if (!Number.isFinite(altitudeM) || altitudeM <= 0) return null;
  if (!Number.isFinite(elapsedSec) || elapsedSec < 0 || elapsedSec > 600) return null;
  const cap = maxHonestAltitude(elapsedSec);
  if (altitudeM > cap * 1.02) return null;
  const id = String(raw.id || '');
  if (!/^[\w-]{8,80}$/.test(id)) return null;
  return {
    id,
    nickname: nick.nickname,
    country,
    countryCode: String(raw.countryCode || '').slice(0, 2),
    flag: String(raw.flag || '').slice(0, 8),
    altitudeM,
    title: sanitizePlace(raw.title).slice(0, 48),
    elapsedSec,
    at: String(raw.at || ''),
  };
}

/** Clamp a just-finished run before it is allowed onto the shared board. */
export function prepareSubmission(raw) {
  const nick = sanitizeNickname(raw.nickname);
  if (!nick.ok) return nick;
  const country = sanitizePlace(raw.country);
  if (!country) return { ok: false, error: 'Pick a country first.' };
  const elapsedSec = Number(raw.elapsedSec);
  const claimed = Number(raw.altitudeM);
  if (!Number.isFinite(claimed) || claimed <= 0) return { ok: false, error: 'Fly first, then submit.' };
  const cap = maxHonestAltitude(elapsedSec);
  const altitudeM = Math.min(claimed, cap);
  const id = String(raw.id || '');
  if (!/^[\w-]{8,80}$/.test(id)) return { ok: false, error: 'This run cannot be submitted.' };
  return {
    ok: true,
    clamped: altitudeM + 1 < claimed,
    entry: {
      id,
      nickname: nick.nickname,
      country,
      countryCode: String(raw.countryCode || '').slice(0, 2),
      flag: String(raw.flag || '').slice(0, 8),
      altitudeM,
      title: sanitizePlace(raw.title).slice(0, 48),
      elapsedSec: Number.isFinite(elapsedSec) ? elapsedSec : 0,
      at: raw.at || new Date().toISOString(),
    },
  };
}

export function summarizeBoard(rawRuns, ownId) {
  const runs = [];
  const seen = new Set();
  for (const raw of rawRuns || []) {
    const entry = cleanEntry(raw);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    runs.push(entry);
  }
  runs.sort((a, b) => b.altitudeM - a.altitudeM || a.at.localeCompare(b.at));
  const rank = ownId ? runs.findIndex((entry) => entry.id === ownId) + 1 : 0;
  const byCountry = new Map();
  for (const entry of runs) {
    const prev = byCountry.get(entry.country);
    if (!prev || entry.altitudeM > prev.altitudeM) byCountry.set(entry.country, entry);
  }
  const countries = [...byCountry.values()].sort((a, b) => b.altitudeM - a.altitudeM);
  const own = rank ? runs[rank - 1] : null;
  const countryRank = own
    ? countries.findIndex((entry) => entry.country === own.country) + 1
    : 0;
  return {
    source: 'remote',
    runs: runs.slice(0, TOP_RUNS),
    countries: countries.slice(0, TOP_RUNS),
    rank,
    countryRank,
    total: runs.length,
  };
}

async function readRuns() {
  const response = await fetch(`${BOARD_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('The board did not answer.');
  const data = await response.json();
  return Array.isArray(data?.runs) ? data.runs : [];
}

async function writeRuns(runs) {
  const response = await fetch(BOARD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runs }),
  });
  if (!response.ok) throw new Error('The board did not save.');
}

export async function loadGlobalBoard(ownId) {
  const runs = await readRuns();
  return summarizeBoard(runs, ownId);
}

export async function submitGlobalRun(raw) {
  const prepared = prepareSubmission(raw);
  if (!prepared.ok) return prepared;
  const entry = prepared.entry;
  let saved = false;
  for (let attempt = 0; attempt < 4 && !saved; attempt += 1) {
    const existing = await readRuns();
    if (existing.some((item) => item && item.id === entry.id)) {
      saved = true;
      break;
    }
    const runs = [...existing, entry]
      .sort((a, b) => (Number(b.altitudeM) || 0) - (Number(a.altitudeM) || 0))
      .slice(0, STORED_RUNS);
    await writeRuns(runs);
    const check = await readRuns();
    saved = check.some((item) => item && item.id === entry.id);
  }
  if (!saved) return { ok: false, error: 'Someone else posted at the same moment. Try again.' };
  const board = await loadGlobalBoard(entry.id);
  return { ok: true, entry, clamped: prepared.clamped, board };
}
