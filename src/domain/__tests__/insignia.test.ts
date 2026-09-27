import {
  BOARD,
  clothColor,
  DEFAULT_INSIGNIA,
  parseInsignia,
  sameInsignia,
  serializeInsignia,
  stripeBands,
} from '../insignia';

describe('insignia', () => {
  it('follows the merchant-navy ladder', () => {
    expect(DEFAULT_INSIGNIA.rank_captain).toEqual({ stripes: 4, cloth: 'none', diamond: true });
    expect(DEFAULT_INSIGNIA.rank_3rd_officer.stripes).toBe(1);
    expect(DEFAULT_INSIGNIA.rank_chief_engineer).toEqual({ stripes: 4, cloth: 'purple', diamond: true });
    expect(DEFAULT_INSIGNIA.rank_4th_engineer).toEqual({ stripes: 1, cloth: 'purple', diamond: true });
    expect(DEFAULT_INSIGNIA.rank_chief_eto.stripes).toBe(3);
    expect(DEFAULT_INSIGNIA.rank_eto_1).toEqual({ stripes: 2, cloth: 'green', diamond: true });
    expect(DEFAULT_INSIGNIA.rank_eto_2).toEqual({ stripes: 1, cloth: 'green', diamond: true });
    expect(DEFAULT_INSIGNIA.rank_deck_cadet.stripes).toBe(0.5);
    expect(DEFAULT_INSIGNIA.rank_etr).toBeUndefined();
  });

  it('round-trips and rejects bad values', () => {
    const v = { stripes: 3, cloth: 'green' as const, diamond: false };
    expect(parseInsignia(serializeInsignia(v))).toEqual(v);
    expect(parseInsignia(serializeInsignia(null))).toBeNull();
    expect(parseInsignia(null)).toBeNull();
    expect(parseInsignia('{oops')).toBeNull();
    expect(parseInsignia('{"stripes":7,"cloth":"pink"}')).toEqual({ stripes: 0, cloth: 'none', diamond: true });
    expect(sameInsignia(v, { ...v })).toBe(true);
    expect(sameInsignia(v, null)).toBe(false);
  });

  it('keeps custom colours and the circle emblem', () => {
    const v = { stripes: 2, cloth: '#A1B2C3' as const, diamond: true, emblem: 'circle' as const };
    expect(parseInsignia(serializeInsignia(v))).toEqual(v);
    expect(parseInsignia('{"stripes":1,"cloth":"blue"}')!.cloth).toBe('#1D4F91');
    expect(parseInsignia('{"stripes":1,"cloth":"#12"}')!.cloth).toBe('none');
    expect(clothColor('#A1B2C3')).toBe('#A1B2C3');
    expect(clothColor('purple')).toBe('#5E2A84');
    expect(clothColor('none')).toBeNull();
    expect(sameInsignia({ ...v, emblem: undefined }, { ...v, emblem: 'diamond' })).toBe(true);
  });

  it('puts cloth between stripes, or above a single one', () => {
    const four = stripeBands({ stripes: 4, cloth: 'purple', diamond: true });
    expect(four.map((b) => b.kind)).toEqual(['gold', 'cloth', 'gold', 'cloth', 'gold', 'cloth', 'gold']);
    expect(four.at(-1)!.y + four.at(-1)!.h).toBe(BOARD.bottom);
    expect(stripeBands({ stripes: 4, cloth: 'none', diamond: true }).map((b) => b.kind)).toEqual([
      'gold',
      'gold',
      'gold',
      'gold',
    ]);
    expect(stripeBands({ stripes: 1, cloth: 'green', diamond: true }).map((b) => b.kind)).toEqual(['gold', 'cloth']);
    const cadet = stripeBands({ stripes: 0.5, cloth: 'none', diamond: true });
    expect(cadet).toEqual([{ kind: 'gold', y: BOARD.bottom - BOARD.narrow, h: BOARD.narrow }]);
    expect(stripeBands({ stripes: 0, cloth: 'green', diamond: true })).toEqual([]);
  });
});
