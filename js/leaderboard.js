import { createStore } from './storage.js';

/**
 * Country leaderboard adapter.
 *
 * The game records scores only through this module. Today every method is
 * local: personal bests live in localStorage on this browser, and each
 * country board contains at most that player's own best.
 *
 * Older saves used `city`. `storage.js` copies those onto `country` when
 * they are read, so a best recorded before the country picker still shows.
 *
 * To plug in a shared leaderboard later, replace the bodies of `noteApex`,
 * `submitRun`, `countryBoard`, and `overview` with network calls. Keep these
 * shapes stable so the UI does not have to change:
 *
 *   entry = { id, altitudeM, title, tagline, country|null, countryCode, flag, at }
 *   noteApex(entry) -> { isBest, previous|null, source }
 *   submitRun(entry) -> { ok, source, entry, countryBest }
 *   countryBoard(country) -> { source, country, entries: entry[] }
 *   overview() -> { source, overall|null, countries: entry[] }
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
          country: null,
          countryCode: '',
          flag: '',
          at: entry.at,
        });
      }
      return { isBest, previous, source: 'local' };
    },

    submitRun(entry) {
      const country = (entry.country || '').trim();
      if (!country) return { ok: false, source: 'local', entry, countryBest: false };
      const previousCountry = entry.previousCountry;
      if (previousCountry && previousCountry !== country) {
        store.clearCountryIfRun(previousCountry, entry.id);
      }
      const saved = {
        id: entry.id,
        altitudeM: entry.altitudeM,
        title: entry.title,
        tagline: entry.tagline,
        country,
        countryCode: entry.countryCode || '',
        flag: entry.flag || '',
        at: entry.at,
      };
      const countryBest = store.setCountryBest(country, saved);
      const remembered = saved.countryCode || (entry.other ? `other:${country}` : country);
      store.setLastCountry(remembered);
      const overall = store.overall();
      if (overall && overall.id === entry.id) {
        store.setOverall({ ...overall, country, countryCode: saved.countryCode, flag: saved.flag });
      }
      return { ok: true, source: 'local', entry: saved, countryBest };
    },

    countryBoard(country) {
      const best = store.countryBest(country);
      return {
        source: 'local',
        country,
        entries: best ? [best] : [],
      };
    },

    overview() {
      const countries = Object.entries(store.allCountries())
        .map(([name, entry]) => ({ ...entry, country: entry.country || name }))
        .sort((a, b) => b.altitudeM - a.altitudeM);
      return {
        source: 'local',
        overall: store.overall(),
        countries,
      };
    },

    lastCountry() {
      return store.lastCountry();
    },
  };
}
