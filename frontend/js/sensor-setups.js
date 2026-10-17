// The sensor setups the app knows about, and which are implemented.

/** Where a sensor can be worn. Used for the clickable spots on the 3D arm. */
export const POSITIONS = {
  upper: { label: 'Upper arm' },
  forearm: { label: 'Forearm' },
  wrist: { label: 'Wrist' },
};

const POSE_STEPS = [
  'Arm hanging straight down at your side, elbow fully extended.',
  'Upper arm vertical and still, shoulders relaxed.',
  'Palm facing your thigh, thumb pointing forward (no forearm twist).',
];

/**
 * @typedef {object} Setup
 * @property {string} id
 * @property {string} label
 * @property {string[]} positions  keys of POSITIONS
 * @property {boolean} implemented false setups can be chosen but not continued with
 * @property {string} [summary]    one line shown once selected
 * @property {string[]} [calibrationSteps]
 */

/** @type {Setup[]} */
export const SETUPS = [
  { id: 'upper+forearm', label: 'Upper arm + forearm', positions: ['upper', 'forearm'], implemented: false },
  { id: 'upper+wrist', label: 'Upper arm + wrist', positions: ['upper', 'wrist'], implemented: false },
  {
    id: 'wrist', label: 'Wrist only', positions: ['wrist'], implemented: true,
    summary: 'One sensor worn like a watch. Gives elbow angle and forearm twist, not wrist curl.',
    calibrationSteps: [...POSE_STEPS, 'Board worn like a watch just above the wrist bone, one edge pointing toward your hand.'],
  },
  {
    id: 'forearm', label: 'Forearm only', positions: ['forearm'], implemented: true,
    summary: 'One sensor on the outer forearm. Gives elbow angle and forearm twist.',
    calibrationSteps: [...POSE_STEPS, 'Board strapped to the outer forearm, midway between elbow and wrist, one edge pointing toward your hand.'],
  },
];

export const setupById = id => SETUPS.find(s => s.id === id) || null;

/** The setup that uses exactly these positions, or null when the combination is not one of the four. */
export function setupFromPositions(positions) {
  return SETUPS.find(s => s.positions.length === positions.size && s.positions.every(p => positions.has(p))) || null;
}

/** Toggles a position. A forearm sensor and a wrist sensor are alternatives, so choosing one drops the other. */
export function togglePosition(positions, id) {
  const next = new Set(positions);
  if (next.has(id)) { next.delete(id); return next; }
  next.add(id);
  if (id === 'forearm') next.delete('wrist');
  if (id === 'wrist') next.delete('forearm');
  return next;
}
