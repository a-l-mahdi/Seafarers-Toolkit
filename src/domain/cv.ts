import type { CvBankAccount, CvNextOfKin, CvProfile, CvSection } from '@/types/domain';
import { newId } from '@/utils/id';

/** How many next of kin / bank accounts a CV can list. */
export const CV_MAX_ENTRIES = 3;

export const CV_SECTIONS: CvSection[] = [
  'application',
  'personal',
  'ids',
  'documents',
  'education',
  'nok',
  'bank',
  'health',
];

export function emptyNextOfKin(): CvNextOfKin {
  return { id: newId(), name: '', relationship: '', phone: '', address: '' };
}

export function emptyBankAccount(): CvBankAccount {
  return {
    id: newId(),
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    branchCode: '',
    swift: '',
    iban: '',
    bankAddress: '',
  };
}

/** True when every text field of an entry is blank (such entries stay out of the CV). */
export function isBlankEntry(entry: CvNextOfKin | CvBankAccount): boolean {
  return Object.entries(entry).every(([key, value]) => key === 'id' || !String(value ?? '').trim());
}

/** A blank CV profile — every field present so the form and export are stable. */
export function emptyCvProfile(): CvProfile {
  return {
    middleName: '',
    gender: '',
    placeOfBirth: '',
    maritalStatus: '',
    children: '',
    heightCm: '',
    weightKg: '',
    bloodGroup: '',
    nationalSeafarerId: '',
    sidNumber: '',
    nearestAirport: '',
    languages: '',
    nextOfKin: [emptyNextOfKin()],
    unionMembership: '',
    bankAccounts: [emptyBankAccount()],
    healthMarineAccident: false,
    healthDisability: false,
    healthMedication: false,
    healthDisease: false,
    healthPsychiatric: false,
    healthAddiction: false,
    healthDetails: '',
    positionAppliedFor: '',
    dateOfAvailability: null,
    addressedTo: '',
    education: [],
    excludedDocumentIds: [],
    hiddenSections: [],
  };
}

/** The single next of kin / bank account that CVs saved before lists existed kept as flat fields. */
type LegacyCv = {
  nokName?: string;
  nokRelationship?: string;
  nokPhone?: string;
  nokAddress?: string;
  bankName?: string;
  bankAccountHolder?: string;
  bankAccountNumber?: string;
  bankAddress?: string;
  bankBranchCode?: string;
  bankSwift?: string;
  bankIban?: string;
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Merge a stored (possibly partial / older) CV over the defaults. */
export function normalizeCvProfile(stored: (Partial<CvProfile> & LegacyCv) | null | undefined): CvProfile {
  const base = emptyCvProfile();
  if (!stored) return base;
  const {
    nokName,
    nokRelationship,
    nokPhone,
    nokAddress,
    bankName,
    bankAccountHolder,
    bankAccountNumber,
    bankAddress,
    bankBranchCode,
    bankSwift,
    bankIban,
    ...rest
  } = stored;

  const legacyKin: CvNextOfKin = {
    ...emptyNextOfKin(),
    name: str(nokName),
    relationship: str(nokRelationship),
    phone: str(nokPhone),
    address: str(nokAddress),
  };
  const legacyBank: CvBankAccount = {
    ...emptyBankAccount(),
    bankName: str(bankName),
    accountHolder: str(bankAccountHolder),
    accountNumber: str(bankAccountNumber),
    branchCode: str(bankBranchCode),
    swift: str(bankSwift),
    iban: str(bankIban),
    bankAddress: str(bankAddress),
  };

  const nextOfKin = Array.isArray(rest.nextOfKin)
    ? rest.nextOfKin.slice(0, CV_MAX_ENTRIES).map((k) => ({ ...emptyNextOfKin(), ...k }))
    : [legacyKin];
  const bankAccounts = Array.isArray(rest.bankAccounts)
    ? rest.bankAccounts.slice(0, CV_MAX_ENTRIES).map((b) => ({ ...emptyBankAccount(), ...b }))
    : [legacyBank];

  return {
    ...base,
    ...rest,
    // The form always shows at least one (blank) entry to fill in.
    nextOfKin: nextOfKin.length ? nextOfKin : [emptyNextOfKin()],
    bankAccounts: bankAccounts.length ? bankAccounts : [emptyBankAccount()],
    hiddenSections: Array.isArray(rest.hiddenSections)
      ? rest.hiddenSections.filter((s) => CV_SECTIONS.includes(s))
      : [],
  };
}
