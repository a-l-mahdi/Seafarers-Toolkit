import type { CvProfile } from '@/types/domain';

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
    nokName: '',
    nokRelationship: '',
    nokPhone: '',
    nokAddress: '',
    unionMembership: '',
    bankName: '',
    bankAccountHolder: '',
    bankAccountNumber: '',
    bankAddress: '',
    bankBranchCode: '',
    bankSwift: '',
    bankIban: '',
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
  };
}

/** Merge a stored (possibly partial / older) CV over the defaults. */
export function normalizeCvProfile(stored: Partial<CvProfile> | null | undefined): CvProfile {
  return { ...emptyCvProfile(), ...(stored ?? {}) };
}
