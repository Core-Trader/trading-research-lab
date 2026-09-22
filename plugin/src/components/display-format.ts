/**
 * Presentation formatting only. These helpers change how a Core-supplied string
 * is shown, never the value itself; callers keep the full Core string available
 * (for example in a tooltip). Rounding operates on the decimal string, not on a
 * binary float, so it cannot introduce float artefacts.
 */

/** Round a decimal string half away from zero to `places` decimals, for display. */
export function roundDecimalString(value: string, places: number): string {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (match === null) return value;
  const [, sign, integerPart = "", fractionPart = ""] = match;
  const integer = integerPart === "" ? "0" : integerPart;
  if (fractionPart.length <= places) return `${sign === "+" ? "" : sign}${integer}${places > 0 ? "." + fractionPart.padEnd(places, "0") : ""}`;
  const kept = integer + fractionPart.slice(0, places);
  const roundUp = Number(fractionPart[places]) >= 5;
  const digits = roundUp ? incrementDigits(kept) : kept;
  const whole = digits.slice(0, digits.length - places) || "0";
  const fraction = places > 0 ? "." + digits.slice(digits.length - places) : "";
  const isZero = /^0*$/.test(digits);
  return `${sign === "-" && !isZero ? "-" : ""}${whole.replace(/^0+(?=\d)/, "")}${fraction}`;
}

/** Display a Core percentage string with a fixed number of decimals. */
export function formatPercent(value: string | null | undefined, places = 2): string | null {
  return value === null || value === undefined ? null : `${roundDecimalString(value, places)}%`;
}

/** Show an ISO report timestamp as "YYYY-MM-DD HH:MM:SS" without any timezone change. */
export function formatTimestamp(value: string): string {
  return value.replace("T", " ");
}

function incrementDigits(digits: string): string {
  const characters = digits.split("");
  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (characters[index] === "9") {
      characters[index] = "0";
      continue;
    }
    characters[index] = String(Number(characters[index]) + 1);
    return characters.join("");
  }
  return "1" + characters.join("");
}
