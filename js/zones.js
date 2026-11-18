/** Altitude bands, score titles, and display formatting. Pure data + functions. */

export const AU_M = 149_597_870_700;
export const AU_KM = AU_M / 1000;

/** Distances from Earth, in meters. Outer planets use a typical journey distance. */
export const DISTANCE = {
  clouds: 1_000,
  jets: 10_000,
  karman: 100_000,
  iss: 400_000,
  high: 36_000_000,
  moon: 384_400_000,
  mars: 225_000_000_000,
  belt: 330_000_000_000,
  jupiter: 630_000_000_000,
  saturn: 1_270_000_000_000,
  uranus: 2_720_000_000_000,
  neptune: 4_350_000_000_000,
  pluto: 5_900_000_000_000,
};

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
    meters: DISTANCE.clouds,
    name: 'Clouds',
    blurb: 'The decorative layer of Earth.',
    index: 0,
    celebrate: true,
  },
  {
    id: 'jets',
    meters: DISTANCE.jets,
    name: 'Jet lanes',
    blurb: 'A pilot just asked about that noise.',
    index: 1,
    celebrate: true,
  },
  {
    id: 'karman',
    meters: DISTANCE.karman,
    name: 'Kármán line',
    blurb: 'Officially space. Unofficially hoarse.',
    index: 2,
    celebrate: true,
  },
  {
    id: 'iss',
    meters: DISTANCE.iss,
    name: 'ISS',
    blurb: 'They turned the cupola around.',
    index: 3,
    celebrate: true,
  },
  {
    id: 'high',
    meters: DISTANCE.high,
    name: 'High orbit',
    blurb: 'Geostationary, and still going.',
    index: 4,
    celebrate: true,
  },
  {
    id: 'moon',
    meters: DISTANCE.moon,
    name: 'The Moon',
    blurb: 'One small scream.',
    index: 5,
    celebrate: true,
  },
  {
    id: 'translunar',
    meters: 1_000_000_000,
    name: 'Translunar',
    blurb: 'The Moon is already behind you.',
    index: -1,
    celebrate: false,
  },
  {
    id: 'mars',
    meters: DISTANCE.mars,
    name: 'Mars',
    blurb: 'Voice-only mission.',
    index: 6,
    celebrate: true,
  },
  {
    id: 'belt',
    meters: DISTANCE.belt,
    name: 'Asteroid belt',
    blurb: 'Please do not scream at the rocks.',
    index: 7,
    celebrate: true,
  },
  {
    id: 'jupiter',
    meters: DISTANCE.jupiter,
    name: 'Jupiter',
    blurb: 'The storm heard that.',
    index: 8,
    celebrate: true,
  },
  {
    id: 'saturn',
    meters: DISTANCE.saturn,
    name: 'Saturn',
    blurb: 'The rings are vibrating.',
    index: 9,
    celebrate: true,
  },
  {
    id: 'uranus',
    meters: DISTANCE.uranus,
    name: 'Uranus',
    blurb: 'An ice giant would like the quiet back.',
    index: 10,
    celebrate: true,
  },
  {
    id: 'neptune',
    meters: DISTANCE.neptune,
    name: 'Neptune',
    blurb: 'Last giant. Pluto is still a hike.',
    index: 11,
    celebrate: true,
  },
  {
    id: 'pluto',
    meters: DISTANCE.pluto,
    name: 'Pluto',
    blurb: 'Reached Pluto.',
    index: 12,
    celebrate: true,
  },
];

export const MILESTONES = ZONES.filter((zone) => zone.celebrate);

const TITLES = [
  { underKm: 0.08, title: 'Polite cough', tagline: 'The pad pretended not to hear.' },
  { underKm: 0.4, title: 'Neighbour-alarming', tagline: 'Someone three doors down is concerned.' },
  { underKm: 1.2, title: 'Window-rattler', tagline: 'The cat has left the building.' },
  { underKm: 8, title: 'Cloud puncher', tagline: 'You have entered the decorative layer of Earth.' },
  { underKm: 30, title: 'Jet-lane heckler', tagline: 'A pilot just looked up from the coffee.' },
  { underKm: 100, title: 'Almost an astronaut', tagline: 'Space checked the guest list. Not quite.' },
  { underKm: 400, title: 'Kármán line conqueror', tagline: 'Officially space. Unofficially hoarse.' },
  { underKm: 2_000, title: 'ISS just heard you', tagline: 'They turned the cupola around.' },
  { underKm: 36_000, title: 'High-orbit banshee', tagline: 'Geostationary orbit is making room.' },
  { underKm: 384_400, title: 'Moonward howl', tagline: 'The Moon is pretending not to listen.' },
  { underKm: 1_000_000, title: 'Lunar loudmouth', tagline: 'One small scream for a very hoarse human.' },
  { underKm: 225_000_000, title: 'Translunar menace', tagline: 'Deep space would like a word. Quietly.' },
  { underKm: 330_000_000, title: 'Mars mission, voice only', tagline: 'Curiosity has a headache.' },
  { underKm: 630_000_000, title: 'Belt botherer', tagline: 'The rocks are filing a noise complaint.' },
  { underKm: 1_270_000_000, title: 'Jovian howl', tagline: 'The Great Red Spot flinched.' },
  { underKm: 2_720_000_000, title: 'Ring rattler', tagline: 'Saturn heard you through the rings.' },
  { underKm: 4_350_000_000, title: 'Ice-giant irritant', tagline: 'Uranus has asked you to use your inside voice.' },
  { underKm: 5_900_000_000, title: 'Neptune nuisance', tagline: 'One planet left, and it is not close.' },
  { underKm: Infinity, title: 'Reached Pluto', tagline: 'The dwarf planet has filed a noise complaint.' },
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
  if (km >= AU_KM * 0.4) {
    const au = km / AU_KM;
    const value = trimFixed(au, au >= 10 ? 1 : 2);
    return { value, unit: 'AU', label: `${value} AU` };
  }
  if (km >= 1_000_000) {
    const millions = km / 1_000_000;
    const value = trimFixed(millions, millions >= 100 ? 0 : millions >= 10 ? 1 : 2);
    return { value, unit: 'million km', label: `${value} million km` };
  }
  if (km < 10) {
    const value = trimFixed(km, 2);
    return { value, unit: 'km', label: `${value} km` };
  }
  if (km < 100) {
    const value = trimFixed(km, 1);
    return { value, unit: 'km', label: `${value} km` };
  }
  const value = Math.round(km).toLocaleString('en-US');
  return { value, unit: 'km', label: `${value} km` };
}

export function remainingLabel(meters) {
  const next = nextMilestone(meters);
  if (!next) return 'Reached Pluto. The solar system is hoarse.';
  const gap = Math.max(0, next.meters - meters);
  return `${formatAltitude(gap).label} to ${next.name}`;
}
