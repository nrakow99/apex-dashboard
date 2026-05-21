/** LucidFlex PA: floor trails with peak until lock, then stays fixed (no further upward trailing). */

export interface LucidFlexFloorParams {
  /** Peak balance at or above this locks the floor permanently */
  lockPeakThreshold: number
  /** Fixed floor after lock (does not trail higher afterward) */
  lockedFloor: number
  /** Floor never trails below this before lock */
  minimumFloor: number
}

export function lucidFlexActiveFloor(
  peakBalance: number,
  maxDrawdown: number,
  flex: LucidFlexFloorParams,
): number {
  if (peakBalance >= flex.lockPeakThreshold) return flex.lockedFloor
  const trailing = peakBalance - maxDrawdown
  return Math.max(flex.minimumFloor, trailing)
}

/** LucidFlex funded: lock at starting balance + $100 once peak reaches size + max loss + $100 */
export function lucidFlexFloorForSize(
  accountSize: number,
  maxDrawdown: number,
): LucidFlexFloorParams {
  return {
    lockPeakThreshold: accountSize + maxDrawdown + 100,
    lockedFloor: accountSize + 100,
    minimumFloor: accountSize - maxDrawdown,
  }
}
