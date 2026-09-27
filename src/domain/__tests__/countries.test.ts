import { COUNTRIES, countryLabel, matchesCountry, resolveCountry, sortedCountries } from '../countries';

describe('countries', () => {
  it('lists every ISO country with short names', () => {
    expect(COUNTRIES.length).toBeGreaterThan(240);
    expect(resolveCountry('IR')).toMatchObject({ en: 'Iran', fa: 'ایران' });
  });

  it('sorts alphabetically in each language', () => {
    expect(sortedCountries('en')[0].en).toBe('Afghanistan');
    expect(sortedCountries('fa')[0].fa.startsWith('آ')).toBe(true);
  });

  it('searches Persian (either letter form), English and code', () => {
    const iran = resolveCountry('IR')!;
    expect(matchesCountry(iran, 'اير')).toBe(true);
    expect(matchesCountry(iran, 'ira')).toBe(true);
    expect(matchesCountry(iran, 'ir')).toBe(true);
    expect(matchesCountry(iran, 'pan')).toBe(false);
  });

  it('maps names typed before the list to a country, keeps unknown text', () => {
    expect(resolveCountry('Panama')?.code).toBe('PA');
    expect(resolveCountry('پاناما')?.code).toBe('PA');
    expect(resolveCountry('Islamic Republic of Iran')?.code).toBe('IR');
    expect(countryLabel('MH', 'en')).toBe('Marshall Islands');
    expect(countryLabel('Atlantis', 'fa')).toBe('Atlantis');
  });
});
