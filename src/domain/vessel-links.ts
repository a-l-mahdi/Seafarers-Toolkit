/**
 * Public vessel-tracking pages for an IMO number. Both sites resolve a vessel
 * from its IMO alone (MarineTraffic's full links also carry its own ship id and
 * the MMSI, which the app does not know — the `imo:` form redirects there).
 */
export function vesselFinderUrl(imo: string): string {
  return `https://www.vesselfinder.com/vessels/details/${imo}`;
}

export function marineTrafficUrl(imo: string): string {
  return `https://www.marinetraffic.com/en/ais/details/ships/imo:${imo}`;
}

/** The IMO's generated link, or null when the IMO is not a 7-digit number. */
export function autoLink(imo: string | null | undefined, build: (imo: string) => string): string | null {
  const clean = (imo ?? '').trim();
  return /^\d{7}$/.test(clean) ? build(clean) : null;
}

/**
 * The link a field should hold once the IMO changes: follows the IMO while the
 * field is empty or still the generated link for the previous IMO; a link the
 * user typed in (e.g. a full MarineTraffic address) is kept.
 */
export function followImo(
  current: string,
  previousImo: string,
  nextImo: string,
  build: (imo: string) => string,
): string {
  const previous = autoLink(previousImo, build);
  const trimmed = current.trim();
  if (trimmed && trimmed !== previous) return current;
  return autoLink(nextImo, build) ?? '';
}
