/** Altitude bands, score titles, and display formatting. Pure data + functions. */

const PAD_ZONE = {
  id: 'pad',
  meters: 0,
  name: 'Launch pad',
  blurb: 'Still on speaking terms with the neighbours.',
  index: -1,
};

/** HUD bands. `celebrate` ones also throw confetti and a chime. */
export const ZONES = [
  PAD_ZONE,
  {
    id: 'clouds',
    meters: 1_000,
    name: 'Clouds',
    blurb: 'The decorative layer of Earth.',
    index: 0,
    celebrate: true,
  },
  {
    id: 'jets',
    meters: 10_000,
    name: 'Jet lanes',
    blurb: 'A pilot just asked about that noise.',
    index: 1,
    celebrate: true,
  },
  {
    id: 'karman',
    meters: 100_000,
    name: 'Kármán line',
    blurb: 'Officially space. Unofficially hoarse.',
    index: 2,
    celebrate: true,
  },
  {
    id: 'iss',
    meters: 400_000,
    name: 'ISS',
    blurb: 'They turned the cupola around.',
    index: 3,
    celebrate: true,
  },
  {
    id: 'high',
    meters: 2_000_000,
    name: 'High orbit',
    blurb: 'Earth is getting small.',
    index: 4,
    celebrate: true,
  },
  {
    id: 'moon',
    meters: 384_400_000,
    name: 'The Moon',
    blurb: 'One small scream.',
    index: 5,
    celebrate: true,
  },
  {
    id: 'deep',
    meters: 2_000_000_000,
    name: 'Deep space',
    blurb: 'The quiet part, ironically.',
    index: -1,
    celebrate: false,
  },
  {
    id: 'mars',
    meters: 54_600_000_000,
    name: 'Mars',
    blurb: 'Voice-only mission.',
    index: 6,
    celebrate: true,
  },
];

export const MILESTONES = ZONES.filter((zone) => zone.celebrate);

const TITLES = [
  { underKm: 0.08, title: 'Polite cough', tagline: 'The pad pretended not to hear.' },
  { underKm: 0.4, title: 'Neighbour-alarming', tagline: 'Someone three doors down is concerned.' },
  { underKm: 1.2, title: 'Window-rattler', tagline: 'The cat has left the building.' },
  { underKm: 5, title: 'Cloud puncher', tagline: 'You have entered the decorative layer of Earth.' },
  { underKm: 15, title: 'Jet-lane heckler', tagline: 'A pilot just looked up from the coffee.' },
  { underKm: 40, title: 'Thin-air menace', tagline: 'Weather balloons are filing a complaint.' },
  { underKm: 100, title: 'Almost an astronaut', tagline: 'Space checked the guest list. Not quite.' },
  { underKm: 250, title: 'Kármán line conqueror', tagline: 'Officially space. Unofficially hoarse.' },
  { underKm: 400, title: 'Orbital nuisance', tagline: 'Satellites are side-eyeing you.' },
  { underKm: 2_000, title: 'ISS just heard you', tagline: 'They turned the cupola around.' },
  { underKm: 20_000, title: 'High-orbit banshee', tagline: 'Earth is a marble and you are still going.' },
  { underKm: 384_400, title: 'Moonward howl', tagline: 'The Moon is pretending not to listen.' },
  { underKm: 1_000_000, title: 'Lunar loudmouth', tagline: 'One small scream for a very hoarse human.' },
  { underKm: 54_600_000, title: 'Interplanetary menace', tagline: 'Deep space would like a word. Quietly.' },
  { underKm: Infinity, title: 'Mars mission, voice only', tagline: 'Curiosity has a headache.' },
];

export function zoneAt(meters) {
  let current = PAD_ZONE;
  for (const zone of ZONES) {
    if (meters >= zone.meters) current = zone;
  }
  return current;
}

export function nextMilestone(meters) {
  for (const zone of ZONES) {
    if (zone.meters > 0 && meters < zone.meters) return zone;
  }
  return null;
}

export function titleFor(meters) {
  const km = Math.max(0, meters) / 1000;
  for (const band of TITLES) {
    if (km < band.underKm) {
      return { title: band.title, tagline: band.tagline };
    }
  }
  const last = TITLES[TITLES.length - 1];
  return { title: last.title, tagline: last.tagline };
}

function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** Human altitude for the HUD, the score, and the share card. */
export function formatAltitude(meters) {
  const safe = Number.isFinite(meters) ? Math.max(0, meters) : 0;
  if (safe < 1000) {
    const value = String(Math.round(safe));
    return { value, unit: 'm', label: `${value} m` };
  }
  const km = safe / 1000;
  if (km < 10) {
    const value = trimFixed(km, 2);
    return { value, unit: 'km', label: `${value} km` };
  }
  if (km < 100) {
    const value = trimFixed(km, 1);
    return { value, unit: 'km', label: `${value} km` };
  }
  if (km < 1_000_000) {
    const value = Math.round(km).toLocaleString('en-US');
    return { value, unit: 'km', label: `${value} km` };
  }
  const millions = km / 1_000_000;
  const digits = millions >= 100 ? 0 : 1;
  const value = trimFixed(millions, digits);
  return { value, unit: 'million km', label: `${value} million km` };
}

export function remainingLabel(meters) {
  const next = nextMilestone(meters);
  if (!next) return 'Past Mars. The void is impressed.';
  const gap = Math.max(0, next.meters - meters);
  return `${formatAltitude(gap).label} to ${next.name}`;
}
