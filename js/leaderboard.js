import { createStore } from './storage.js';

/**
 * City leaderboard adapter.
 *
 * The game records scores only through this module. Today every method is
 * local: personal bests live in localStorage on this browser, and city
 * boards contain at most that player's own best.
 *
 * To plug in a shared leaderboard later, replace the bodies of `noteApex`,
 * `submitRun`, `cityBoard`, and `overview` with network calls. Keep these
 * shapes stable so the UI does not have to change:
 *
 *   entry = { id, altitudeM, title, tagline, city|null, at }
 *   noteApex(entry) -> { isBest, previous|null, source }
 *   submitRun(entry) -> { ok, source, entry, cityBest }
 *   cityBoard(city) -> { source, city, entries: entry[] }
 *   overview() -> { source, overall|null, cities: Array<entry & { city }> }
 *
 * `source` is 'local' until a remote implementation returns 'remote'.
 */
export function createLeaderboard(store = createStore()) {
  return {
    source: 'local',

    noteApex(entry) {
      const previous = store.overall();
      const isBest = !previous || entry.altitudeM > previous.altitudeM;
      if (isBest) {
        store.setOverall({
          id: entry.id,
          altitudeM: entry.altitudeM,
          title: entry.title,
          tagline: entry.tagline,
          city: null,
          at: entry.at,
        });
      }
      return { isBest, previous, source: 'local' };
    },

    submitRun(entry) {
      const city = (entry.city || '').trim();
      if (!city) return { ok: false, source: 'local', entry, cityBest: false };
      const previousCity = entry.previousCity;
      if (previousCity && previousCity !== city) store.clearCityIfRun(previousCity, entry.id);
      const saved = {
        id: entry.id,
        altitudeM: entry.altitudeM,
        title: entry.title,
        tagline: entry.tagline,
        city,
        at: entry.at,
      };
      const cityBest = store.setCityBest(city, saved);
      store.setLastCity(city);
      const overall = store.overall();
      if (overall && overall.id === entry.id) {
        store.setOverall({ ...overall, city });
      }
      return { ok: true, source: 'local', entry: saved, cityBest };
    },

    cityBoard(city) {
      const best = store.cityBest(city);
      return {
        source: 'local',
        city,
        entries: best ? [best] : [],
      };
    },

    overview() {
      const cities = Object.entries(store.allCities())
        .map(([city, entry]) => ({ ...entry, city }))
        .sort((a, b) => b.altitudeM - a.altitudeM);
      return {
        source: 'local',
        overall: store.overall(),
        cities,
      };
    },

    lastCity() {
      return store.lastCity();
    },
  };
}
