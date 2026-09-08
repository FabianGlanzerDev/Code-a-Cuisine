/**
 * Reads browser storage without failing when access is blocked or data is corrupted.
 * @param key Storage key or preference property.
 * @param fallback Value returned when storage cannot be read.
 * @returns {T} The result of this operation.
 */
export function readBrowserValue<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}



/**
 * Writes browser storage and reports whether the value will survive a reload.
 * @param key Storage key or preference property.
 * @param value Value to validate or store.
 * @returns {boolean} The result of this operation.
 */
export function writeBrowserValue(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
