import { isBlankEntry, normalizeCvProfile } from '../cv';
import { buildCvSheet } from '@/services/cv-layout';
import type { CvProfile } from '@/types/domain';

// newId uses expo-crypto, which has no native side under Jest.
jest.mock('@/utils/id', () => {
  let n = 0;
  return { newId: () => `id${++n}` };
});

const sheetText = (cv: CvProfile) =>
  buildCvSheet({
    profile: null,
    cv,
    documents: [],
    contracts: [],
    vesselsByName: new Map(),
    currentRankName: null,
    hasPhoto: false,
  })
    .rows.flatMap((r) => r.cells.map((c) => c.text))
    .filter(Boolean);

describe('normalizeCvProfile', () => {
  it('turns the old single next of kin / bank fields into the first entry', () => {
    const cv = normalizeCvProfile({ nokName: 'Sara', nokPhone: '0912', bankName: 'Mellat', bankIban: 'IR01' } as never);
    expect(cv.nextOfKin).toHaveLength(1);
    expect(cv.nextOfKin[0]).toMatchObject({ name: 'Sara', phone: '0912' });
    expect(cv.bankAccounts[0]).toMatchObject({ bankName: 'Mellat', iban: 'IR01' });
    expect(cv).not.toHaveProperty('nokName');
  });

  it('keeps at most three entries and always one to fill in', () => {
    const four = [1, 2, 3, 4].map((n) => ({ id: `k${n}`, name: `K${n}`, relationship: '', phone: '', address: '' }));
    expect(normalizeCvProfile({ nextOfKin: four }).nextOfKin).toHaveLength(3);
    expect(normalizeCvProfile({ nextOfKin: [], bankAccounts: [] }).bankAccounts).toHaveLength(1);
  });

  it('drops unknown hidden sections', () => {
    expect(normalizeCvProfile({ hiddenSections: ['bank', 'nope' as never] }).hiddenSections).toEqual(['bank']);
  });
});

describe('isBlankEntry', () => {
  it('ignores the id', () => {
    expect(isBlankEntry({ id: 'x', name: ' ', relationship: '', phone: '', address: '' })).toBe(true);
    expect(isBlankEntry({ id: 'x', name: 'A', relationship: '', phone: '', address: '' })).toBe(false);
  });
});

describe('CV sections', () => {
  const base = normalizeCvProfile({
    nationalSeafarerId: 'NS-1',
    nextOfKin: [
      { id: 'a', name: 'Sara', relationship: 'Wife', phone: '1', address: '' },
      { id: 'b', name: 'Ali', relationship: 'Brother', phone: '2', address: '' },
    ],
    bankAccounts: [
      {
        id: 'c',
        bankName: 'Mellat',
        accountHolder: '',
        accountNumber: '11',
        branchCode: '',
        swift: '',
        iban: '',
        bankAddress: '',
      },
      {
        id: 'd',
        bankName: 'Melli',
        accountHolder: '',
        accountNumber: '22',
        branchCode: '',
        swift: '',
        iban: '',
        bankAddress: '',
      },
    ],
  });

  it('lists every next of kin and bank account', () => {
    const text = sheetText(base);
    expect(text).toEqual(expect.arrayContaining(['Sara', 'Ali', 'Mellat', 'Melli', 'Account 1', 'Account 2']));
  });

  it('leaves hidden sections out entirely', () => {
    const text = sheetText({ ...base, hiddenSections: ['ids', 'nok', 'bank', 'health'] });
    for (const gone of [
      'Identification',
      'NS-1',
      'Next of kin',
      'Sara',
      'Bank details',
      'Mellat',
      'Health declaration',
    ]) {
      expect(text).not.toContain(gone);
    }
    expect(text).toContain('Personal details');
  });

  it('skips blank next of kin and bank entries', () => {
    const text = sheetText(normalizeCvProfile(null));
    expect(text).not.toContain('Next of kin');
    expect(text).not.toContain('Bank details');
  });
});
