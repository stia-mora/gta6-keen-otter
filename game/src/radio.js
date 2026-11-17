// Solano Heat radio: three synthesized stations on the dial. Each
// station has a name, a tag line, tracks that rotate, and a 16-step
// pattern the music scheduler plays — bass, chords and hats, all
// oscillators, no audio files. R switches station while playing.

export const RADIO_STATIONS = [
  {
    name: 'SOLANO FM 87.9',
    tag: 'Sunset Drive',
    tracks: ['Neon Palms', 'Coastline Glow', 'Midnight Boardwalk'],
    stepMs: 240,
    hat: false,
    // A soft synth arpeggio: A minor, drifting up and back down.
    steps: [
      [220, 'triangle', 0.08], 0, [277.2, 'triangle', 0.07], 0,
      [329.6, 'triangle', 0.08], 0, [440, 'triangle', 0.06], 0,
      [329.6, 'triangle', 0.07], 0, [277.2, 'triangle', 0.07], 0,
      [220, 'triangle', 0.08], 0, [164.8, 'triangle', 0.07], 0,
    ],
  },
  {
    name: 'HEAT 102.4',
    tag: 'Street Beats',
    tracks: ['Midnight Run', 'Hot Asphalt', 'Getaway Groove'],
    stepMs: 190,
    hat: true,
    // A funky bassline with hats on every other step.
    steps: [
      [55, 'triangle', 0.09], 0, [55, 'triangle', 0.09], [65.4, 'triangle', 0.08],
      [55, 'triangle', 0.09], 0, [49, 'triangle', 0.09], [58.3, 'triangle', 0.08],
      [55, 'triangle', 0.09], 0, [55, 'triangle', 0.09], [65.4, 'triangle', 0.08],
      [73.4, 'triangle', 0.09], 0, [49, 'triangle', 0.09], [58.3, 'triangle', 0.08],
    ],
  },
  {
    name: 'BAY 94.1',
    tag: 'Coastal Jazz',
    tracks: ['Harbor Lights', 'Slow Tide', 'Brass & Salt'],
    stepMs: 260,
    hat: false,
    // Smooth seventh chords, swinging slow by the water.
    steps: [
      [233.1, 'sine', 0.08], 0, [311.1, 'sine', 0.06], [369.9, 'sine', 0.06],
      [233.1, 'sine', 0.08], 0, [311.1, 'sine', 0.06], 0,
      [207.7, 'sine', 0.08], 0, [277.2, 'sine', 0.06], [349.2, 'sine', 0.06],
      [207.7, 'sine', 0.08], 0, [246.9, 'sine', 0.06], 0,
    ],
  },
];

/** Fresh radio state: station 0, track 0. */
export function makeRadio() {
  return { station: 0, track: 0, trackTimer: 0 };
}

/** The station playing right now. */
export function currentStation(radio) {
  return RADIO_STATIONS[radio.station];
}

/** The track name playing right now. */
export function currentTrack(radio) {
  const st = currentStation(radio);
  return st.tracks[radio.track % st.tracks.length];
}

/** Next station on the dial, track back to the top of its list. */
export function nextStation(radio) {
  radio.station = (radio.station + 1) % RADIO_STATIONS.length;
  radio.track = 0;
  radio.trackTimer = 0;
  return currentStation(radio);
}

/** Tracks rotate every 24 seconds of play. */
export function updateRadio(radio, dt) {
  radio.trackTimer += dt;
  if (radio.trackTimer >= 24) {
    radio.trackTimer = 0;
    radio.track = (radio.track + 1) % currentStation(radio).tracks.length;
  }
}
