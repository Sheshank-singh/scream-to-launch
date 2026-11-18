import { STORAGE_KEY } from './config.js';

function emptyState() {
  return { version: 1, overall: null, cities: {}, lastCity: '' };
}

export function createStore(backend) {
  const storage = backend || globalThis.localStorage;

  function read() {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return emptyState();
      return {
        version: 1,
        overall: parsed.overall || null,
        cities: parsed.cities && typeof parsed.cities === 'object' ? parsed.cities : {},
        lastCity: typeof parsed.lastCity === 'string' ? parsed.lastCity : '',
      };
    } catch {
      return emptyState();
    }
  }

  function write(state) {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  return {
    read,
    overall() {
      return read().overall;
    },
    lastCity() {
      return read().lastCity || '';
    },
    setLastCity(city) {
      const state = read();
      state.lastCity = city || '';
      write(state);
    },
    setOverall(entry) {
      const state = read();
      state.overall = entry;
      write(state);
    },
    cityBest(city) {
      return read().cities[city] || null;
    },
    setCityBest(city, entry) {
      const state = read();
      const previous = state.cities[city];
      if (!previous || entry.altitudeM > previous.altitudeM) {
        state.cities[city] = entry;
        write(state);
        return true;
      }
      return false;
    },
    clearCityIfRun(city, id) {
      if (!city) return;
      const state = read();
      if (state.cities[city]?.id === id) {
        delete state.cities[city];
        write(state);
      }
    },
    allCities() {
      return read().cities;
    },
  };
}
