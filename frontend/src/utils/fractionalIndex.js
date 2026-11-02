export const DEFAULT_STEP = 1000.0;
export const MIN_EPSILON = 0.000001;

/**
 * Calculates a fractional index position between two neighboring positions.
 * @param {number|null} prevPos - The position of the previous item (or null if inserting at start)
 * @param {number|null} nextPos - The position of the next item (or null if appending at end)
 * @returns {number} The calculated midpoint position
 */
export function calculatePosition(prevPos, nextPos) {
  // Case 1: Inserting into empty list
  if (prevPos == null && nextPos == null) {
    return DEFAULT_STEP;
  }

  // Case 2: Inserting at the beginning of the column
  if (prevPos == null && nextPos != null) {
    if (nextPos <= 1.0) {
      return nextPos / 2.0;
    }
    return nextPos - DEFAULT_STEP > 0 ? nextPos - DEFAULT_STEP : nextPos / 2.0;
  }

  // Case 3: Appending to the end of the column
  if (prevPos != null && nextPos == null) {
    return prevPos + DEFAULT_STEP;
  }

  // Case 4: Inserting between two items
  const mid = (prevPos + nextPos) / 2.0;
  return mid;
}

