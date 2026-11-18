import { STORAGE_KEY } from './config.js';

function normalizeEntry(entry, fallbackName) {
  if (!entry || typeof entry !== 'object') return null;
  const country = entry.country || entry.city || fallbackName || '';
  return {
    ...entry,
    country,
    countryCode: entry.countryCode || '',
    flag: entry.flag || '',
  };
}

function emptyState() {
  return { version: 2, overall: null, countries: {}, lastCountry: '' };
}

/**
 * Reads v1 city boards and rewrites them as countries.
 * An old `city` string is kept as the country name so a saved best is not dropped.
 */
export function migrateState(parsed) {
  if (!parsed || typeof parsed !== 'object') return emptyState();
  const countries = {};
  const source = parsed.countries && typeof parsed.countries === 'object' ? parsed.countries : {};
  const legacy = parsed.cities && typeof parsed.cities === 'object' ? parsed.cities : {};
  for (const [name, entry] of Object.entries(legacy)) {
    const normalized = normalizeEntry(entry, name);
    if (normalized) countries[normalized.country || name] = normalized;
  }
  for (const [name, entry] of Object.entries(source)) {
    const normalized = normalizeEntry(entry, name);
    if (normalized) countries[normalized.country || name] = normalized;
  }
  const lastCountry = typeof parsed.lastCountry === 'string' && parsed.lastCountry
    ? parsed.lastCountry
    : (typeof parsed.lastCity === 'string' ? parsed.lastCity : '');
  return {
    version: 2,
    overall: normalizeEntry(parsed.overall, ''),
    countries,
    lastCountry,
  };
}

export function createStore(backend) {
  const storage = backend || globalThis.localStorage;

  function read() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      return migrateState(JSON.parse(raw));
    } catch {
      return emptyState();
    }
  }

  function write(state) {
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...state, version: 2 }));
  }

  return {
    read,
    overall() {
      return read().overall;
    },
    lastCountry() {
      return read().lastCountry || '';
    },
    setLastCountry(value) {
      const state = read();
      state.lastCountry = value || '';
      write(state);
    },
    setOverall(entry) {
      const state = read();
      state.overall = entry;
      write(state);
    },
    countryBest(country) {
      return read().countries[country] || null;
    },
    setCountryBest(country, entry) {
      const state = read();
      const previous = state.countries[country];
      if (!previous || entry.altitudeM > previous.altitudeM) {
        state.countries[country] = entry;
        write(state);
        return true;
      }
      return false;
    },
    clearCountryIfRun(country, id) {
      if (!country) return;
      const state = read();
      if (state.countries[country]?.id === id) {
        delete state.countries[country];
        write(state);
      }
    },
    allCountries() {
      return read().countries;
    },
  };
}
