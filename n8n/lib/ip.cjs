/**
 * Parses a strict dotted IPv4 address into octets, or returns null.
 * @param value Value to validate or store.
 */
function ipv4Parts(value) {
  const parts = value.split('.');
  const valid = parts.length === 4 && parts.every(/** Checks whether this item satisfies the validation. @param part Current callback input. */ (part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255);
  return valid ? parts.map(Number) : null;
}



/**
 * Converts an embedded dotted IPv4 suffix to two IPv6 groups.
 * @param value Value to validate or store.
 */
function expandDottedSuffix(value) {
  if (!value.includes('.')) return value;
  const boundary = value.lastIndexOf(':');
  const parts = ipv4Parts(value.slice(boundary + 1));
  if (boundary < 0 || !parts) return '';
  return value.slice(0, boundary + 1) + ((parts[0] << 8) | parts[1]).toString(16)
    + ':' + ((parts[2] << 8) | parts[3]).toString(16);
}



/**
 * Expands a valid IPv6 address to exactly eight numeric groups.
 * @param value Value to validate or store.
 */
function ipv6Parts(value) {
  const expanded = expandDottedSuffix(value);
  if (!expanded || !/^[\da-f:]+$/i.test(expanded) || expanded.includes(':::')) return null;
  const halves = expanded.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  if ([...left, ...right].some(/** Checks whether this item meets the condition. @param part Current callback input. */ (part) => !/^[\da-f]{1,4}$/i.test(part))) return null;
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 && missing !== 0 || halves.length === 2 && missing < 1) return null;
  return [...left, ...Array(missing).fill('0'), ...right].map(/** Maps the current item to its output value. @param part Current callback input. */ (part) => parseInt(part, 16));
}



/**
 * Returns one canonical quota identity, merging IPv4-mapped IPv6 with IPv4.
 * @param value Value to validate or store.
 */
function normalizeIp(value) {
  if (typeof value !== 'string' || value.length > 45) return null;
  const candidate = value.trim();
  const v4 = ipv4Parts(candidate);
  if (v4) return v4.join('.');
  const v6 = ipv6Parts(candidate);
  if (!v6) return null;
  if (v6.slice(0, 5).every(/** Checks whether this item satisfies the validation. @param part Current callback input. */ (part) => part === 0) && v6[5] === 65535) {
    return [v6[6] >> 8, v6[6] & 255, v6[7] >> 8, v6[7] & 255].join('.');
  }
  return v6.map(/** Maps the current item to its output value. @param part Current callback input. */ (part) => part.toString(16).padStart(4, '0')).join(':');
}



/**
 * Reads only the single client-IP header overwritten by the configured trusted proxy.
 * @param headers Incoming request headers.
 * @param trustedHeader Single client-IP header overwritten by the trusted proxy.
 */
function clientIp(headers, trustedHeader) {
  if (!['cf-connecting-ip', 'x-real-ip'].includes(trustedHeader)) return null;
  const entry = Object.entries(headers).find(/** Checks whether the current item is the requested match. @param [name] Current callback input. */ ([name]) => name.toLowerCase() === trustedHeader);
  return normalizeIp(entry?.[1]);
}



module.exports = { ipv4Parts, ipv6Parts, normalizeIp, clientIp };
