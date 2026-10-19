import type { Insignia } from '@/domain/insignia';

export type Department = 'deck' | 'engine' | 'electro' | 'deck_rating' | 'engine_rating' | 'catering';

export type SeaFarerStatus = 'on_board' | 'on_leave' | 'available' | 'training' | 'unknown';

export type SeaTimeSource = 'contract' | 'manual' | 'imported' | 'verified';

export type ContractStatus = 'active' | 'completed' | 'planned';

export type DocumentStatusType = 'valid' | 'expiring_soon' | 'not_valid' | 'expired' | 'no_expiry';

export type LeaveMode = 'ratio' | 'manual';

export type DurationMode = 'days' | 'months' | 'custom_date';

export interface SeaTimeAmount {
  days: number;
  hours: number;
}

export interface Rank {
  id: string;
  department: Department;
  name: string;
  level: number;
  /** Sea time (in months) required for promotion from this rank to the next one. */
  promotionMonths: number | null;
  isDefault: boolean;
  /** Shoulder insignia (epaulette); null when the rank has none. */
  insignia: Insignia | null;
}

export interface RankRequirement {
  id: string;
  fromRankId: string | null;
  toRankId: string;
  requiredSeaTimeDays: number;
}

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  seamanBookNumber: string | null;
  passportNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zipCode: string | null;
  landline: string | null;
  department: Department | null;
  currentRankId: string | null;
  nextRankId: string | null;
  photoPath: string | null;
  updatedAt: string;
}

export interface Vessel {
  id: string;
  name: string;
  imo: string | null;
  type: string | null;
  flag: string | null;
  grossTonnage: number | null;
  netTonnage: number | null;
  owner: string | null;
  managementCompany: string | null;
  notes: string | null;
  /** Local path of the vessel's (landscape) photo. */
  photoPath: string | null;
  /** Tracking pages (generated from the IMO; the user may change them). */
  vesselFinderUrl?: string | null;
  marineTrafficUrl?: string | null;
  createdAt: string;
}

export interface Contract {
  id: string;
  vesselId: string;
  rankId: string;
  joinDate: string;
  /** Planned sign-off: the contract's end, or the date the sailor was told when
   *  it was moved. Drives progress, charts and reminders until signed off. */
  expectedSignOff: string;
  /** Real sign-off; set automatically to the planned one once that day passes. */
  actualSignOff: string | null;
  durationDays: number | null;
  /** Serialized duration input (mode/days/months/custom date) so edits preserve the duration. */
  durationJson?: string | null;
  /** Agreed monthly wage for this contract (per calendar month). */
  monthlyWage: number | null;
  /** Currency code shown alongside amounts (e.g. USD). */
  wageCurrency: string | null;
  /** Extra paid days on top of the contract (repatriation / travel allowance). */
  travelDays: number | null;
  /** One-off bonus paid for this trip, in the wage currency. */
  bonus: number | null;
  /** The company the contract is signed with (shown in the CV's sea service). */
  company?: string | null;
  status: ContractStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractWithVessel extends Contract {
  vesselName: string | null;
  rankName: string | null;
}

export interface SeaTimeRecord {
  id: string;
  contractId: string | null;
  rankId: string | null;
  source: SeaTimeSource;
  fromDate: string | null;
  toDate: string | null;
  days: number;
  hours: number;
  verified: boolean;
  notes: string | null;
  createdAt: string;
}

export interface SeaTimeByRank {
  rankId: string | null;
  rankName: string;
  days: number;
  hours: number;
}

export interface SeaTimeSummary {
  total: SeaTimeAmount;
  byRank: SeaTimeByRank[];
}

export interface DocumentType {
  id: string;
  name: string;
  isDefault: boolean;
  /** MaterialCommunityIcons glyph; null = the built-in default. */
  icon: string | null;
  /** Icon tint (hex); null = the built-in default. */
  color: string | null;
}

export interface DocumentFile {
  id: string;
  documentId: string;
  localPath: string;
  fileName: string;
  mimeType: string | null;
  size: number | null;
  createdAt: string;
}

export interface Document {
  id: string;
  typeId: string | null;
  name: string;
  number: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuingAuthority: string | null;
  issuingCountry: string | null;
  /** Place of issue — shown for the key documents (passport, seaman's book, CoC). */
  placeOfIssue: string | null;
  /** Days before expiry to warn the user to renew (e.g. 210 = warn 1 month before the 6-month rule). */
  warningThresholdDays: number | null;
  /** Minimum remaining validity (days) required to join a vessel (e.g. 180 = 6 months). */
  validThresholdDays: number | null;
  notes: string | null;
  createdAt: string;
}

export interface DocumentWithMeta extends Document {
  typeName: string | null;
  status: DocumentStatusType;
  daysUntilExpiry: number | null;
}

export interface CvEducation {
  id: string;
  institution: string;
  from: string | null;
  to: string | null;
  qualification: string;
  location: string | null;
}

/**
 * CV / résumé data that isn't already captured elsewhere in the app. The rest
 * of the CV (name, contact, certificates, sea service) is pulled at export time
 * from the profile, documents and contracts, so nothing is entered twice.
 */
export interface CvNextOfKin {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  address: string;
}

export interface CvBankAccount {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  branchCode: string;
  swift: string;
  iban: string;
  bankAddress: string;
}

/** The CV's form cards; each can be left out of the CV. */
export type CvSection = 'application' | 'personal' | 'ids' | 'documents' | 'education' | 'nok' | 'bank' | 'health';

export interface CvProfile {
  // Personal / physical
  middleName: string;
  gender: string; // 'male' | 'female' | ''
  placeOfBirth: string;
  maritalStatus: string; // 'single' | 'married' | 'other' | ''
  children: string;
  heightCm: string;
  weightKg: string;
  bloodGroup: string;
  nationalSeafarerId: string; // e.g. INDOS / national seafarer ID
  sidNumber: string; // Seafarer Identity Document
  // Passport / seaman's book / CoC (number, dates, place of issue) live on the
  // Documents (passport, seaman's book, CoC) — not duplicated here.
  nearestAirport: string;
  languages: string;
  // Next of kin (up to three)
  nextOfKin: CvNextOfKin[];
  // Union membership
  unionMembership: string;
  // Bank accounts (up to three)
  bankAccounts: CvBankAccount[];
  // Health declarations
  healthMarineAccident: boolean;
  healthDisability: boolean;
  healthMedication: boolean;
  healthDisease: boolean;
  healthPsychiatric: boolean;
  healthAddiction: boolean;
  healthDetails: string;
  // Application header (tweaked per application before export)
  positionAppliedFor: string;
  dateOfAvailability: string | null;
  addressedTo: string; // agency / company name
  // Education (incl. pre-sea training)
  education: CvEducation[];
  // Documents the seafarer chose to EXCLUDE from the CV (empty = include all).
  excludedDocumentIds: string[];
  // Sections the seafarer left out of the CV (empty = all shown).
  hiddenSections: CvSection[];
}

export interface LeaveSettings {
  mode: LeaveMode;
  onboardDays: number;
  leaveDays: number;
  manualLeaveStartDate: string | null;
  manualLeaveEndDate: string | null;
}

export interface CareerGoal {
  id: string;
  currentRankId: string | null;
  nextRankId: string | null;
  requiredSeaTimeDays: number;
}

export interface CareerProgress {
  completed: number;
  required: number;
  remaining: number;
  progress: number;
  complete: boolean;
}

export interface AppNotification {
  id: string;
  eventType: string;
  eventId: string;
  notificationType: string;
  title: string;
  body: string;
  scheduledAt: string | null;
  sentAt: string | null;
  readAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  documentExpiry: boolean;
  contractEnding: boolean;
  leaveEnding: boolean;
  rankProgress: boolean;
  thresholds: number[];
}

/** Packing checklist template row: a group (has children) or an item. */
export interface ChecklistItem {
  id: string;
  parentId: string | null;
  /** Built-in entry key (label is translated); null for user-added rows. */
  preset: string | null;
  /** User-given name; null keeps the preset's translated label. */
  name: string | null;
  quantity: number;
  sortOrder: number;
}

/** A trip's tick for one checklist entry (template item id or `doc:<documentId>`). */
export interface TripChecklistMark {
  itemKey: string;
  packedOut: boolean;
  packedBack: boolean;
}

/** A note on a calendar day; with `remind` a notification fires at date + time. */
export interface CalendarNote {
  id: string;
  /** ISO day (yyyy-mm-dd). */
  date: string;
  /** Local time HH:MM; required when `remind` is on. */
  time: string | null;
  text: string;
  remind: boolean;
  createdAt: string;
  updatedAt: string;
}
