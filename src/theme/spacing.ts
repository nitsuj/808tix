/**
 * 808Tix spacing scale — 8px base unit (see docs/DESIGN_SYSTEM_v2.md).
 */

export const spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Layout constants shared across mobile and web. */
export const layout = {
  maxContentWidth: 800,
  bottomTabInset: 50,
  bottomTabInsetAndroid: 80,
} as const;
