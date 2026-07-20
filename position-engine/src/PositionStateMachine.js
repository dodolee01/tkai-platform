/**
 * @file Position lifecycle state machine.
 * Primary path: NEW -> OPENING -> OPEN -> PARTIALLY_CLOSED -> TRAILING
 * -> CLOSING -> CLOSED -> ARCHIVED. Realistic branches are also
 * permitted (e.g. a position can close fully without ever being
 * partially closed or trailed), all enumerated explicitly below —
 * nothing is reachable that isn't a deliberate, documented transition.
 * @module position-engine/PositionStateMachine
 */

/**
 * @enum {string}
 */
export const PositionState = Object.freeze({
  NEW: 'NEW',
  OPENING: 'OPENING',
  OPEN: 'OPEN',
  PARTIALLY_CLOSED: 'PARTIALLY_CLOSED',
  TRAILING: 'TRAILING',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
});

/**
 * Valid next states from each state. The primary documented path is
 * always included; additional edges cover realistic variations
 * (skipping partial-close/trailing, liquidation fast-path, closing
 * directly from any "live" state).
 * @type {Object.<string, string[]>}
 */
const VALID_TRANSITIONS = Object.freeze({
  [PositionState.NEW]: [PositionState.OPENING],
  [PositionState.OPENING]: [PositionState.OPEN],
  [PositionState.OPEN]: [PositionState.PARTIALLY_CLOSED, PositionState.TRAILING, PositionState.CLOSING],
  [PositionState.PARTIALLY_CLOSED]: [PositionState.TRAILING, PositionState.PARTIALLY_CLOSED, PositionState.CLOSING],
  [PositionState.TRAILING]: [PositionState.PARTIALLY_CLOSED, PositionState.CLOSING],
  [PositionState.CLOSING]: [PositionState.CLOSED],
  [PositionState.CLOSED]: [PositionState.ARCHIVED],
  [PositionState.ARCHIVED]: [],
});

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function canTransition(from, to) {
  return (VALID_TRANSITIONS[from] || []).includes(to);
}

/**
 * @param {string} from
 * @param {string} to
 * @returns {void}
 * @throws {Error} If the transition is not valid.
 */
export function assertValidTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`PositionStateMachine: invalid transition "${from}" -> "${to}"`);
  }
}

/**
 * @param {string} state
 * @returns {boolean}
 */
export function isTerminal(state) {
  return state === PositionState.ARCHIVED;
}

/**
 * @param {string} state
 * @returns {boolean} Whether the position is "live" (has open exposure requiring active management).
 */
export function isLive(state) {
  return [PositionState.OPEN, PositionState.PARTIALLY_CLOSED, PositionState.TRAILING, PositionState.CLOSING].includes(state);
}

export default { PositionState, canTransition, assertValidTransition, isTerminal, isLive };
