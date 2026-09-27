import { autoLink, followImo, marineTrafficUrl, vesselFinderUrl } from '../vessel-links';

describe('vessel links', () => {
  it('builds both sites from an IMO', () => {
    expect(vesselFinderUrl('9569700')).toBe('https://www.vesselfinder.com/vessels/details/9569700');
    expect(marineTrafficUrl('9569700')).toBe('https://www.marinetraffic.com/en/ais/details/ships/imo:9569700');
  });

  it('only builds for a 7-digit IMO', () => {
    expect(autoLink('95697', vesselFinderUrl)).toBeNull();
    expect(autoLink(' 9569700 ', vesselFinderUrl)).toBe(vesselFinderUrl('9569700'));
  });

  it('fills an empty field and follows the IMO while untouched', () => {
    expect(followImo('', '956970', '9569700', vesselFinderUrl)).toBe(vesselFinderUrl('9569700'));
    expect(followImo(vesselFinderUrl('9569700'), '9569700', '9569701', vesselFinderUrl)).toBe(
      vesselFinderUrl('9569701'),
    );
    expect(followImo(vesselFinderUrl('9569700'), '9569700', '95697', vesselFinderUrl)).toBe('');
  });

  it('keeps a link the user edited', () => {
    const custom = 'https://www.marinetraffic.com/en/ais/details/ships/shipid:768201/mmsi:422208100/imo:9569700';
    expect(followImo(custom, '9569700', '9569701', marineTrafficUrl)).toBe(custom);
  });
});
