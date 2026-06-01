/**
 * PassKit icons embedded for Supabase Edge deploy.
 * Edge bundles do not preserve sibling ./assets/ paths at runtime (sb-compile-edge-runtime).
 */

function decodeBase64Png(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** 29×29 placeholder icon */
const ICON_PNG_1X_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAB0AAAAdCAIAAADZ8fBYAAAAJklEQVR42mNocDhBC8Qwau6ouaPmjpo7au6ouaPmjpo7au6gMhcAXm0IFP9m0QgAAAAASUVORK5CYII=';

/** 58×58 placeholder icon */
const ICON_PNG_2X_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAADoAAAA6CAIAAABu2d1/AAAARUlEQVR42u3OAQkAAAgDsEczmvGMZY7DYAGWnSsSXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXd0eD91uIE19aybQAAAAAElFTkSuQmCC';

/** 87×87 placeholder icon */
const ICON_PNG_3X_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAFcAAABXCAIAAAD+qk47AAAAgElEQVR42u3QMQ0AAAgDsElDGvImCxV8Taqg2SlRYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLFiwYMGCBQsWLLw46i5IrPSZJE0AAAAASUVORK5CYII=';

export const walletIcon1x = decodeBase64Png(ICON_PNG_1X_B64);
export const walletIcon2x = decodeBase64Png(ICON_PNG_2X_B64);
export const walletIcon3x = decodeBase64Png(ICON_PNG_3X_B64);
