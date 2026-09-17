export type Department =
  | 'deck'
  | 'engine'
  | 'electro'
  | 'deck_rating'
  | 'engine_rating'
  | 'catering';

export type SeaFarerStatus = 'on_board' | 'on_leave' | 'available' | 'training' | 'unknown';

export type SeaTimeSource = 'contract' | 'manual' | 'imported' | 'verified';

export type ContractStatus = 'active' | 'completed' | 'planned';

export type DocumentStatusType =
  | 'valid'
  | 'expiring_soon'
  | 'not_valid'
  | 'expired'
  | 'no_expiry';

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
  createdAt: string;
}

export interface Contract {
  id: string;
  vesselId: string;
  rankId: string;
  joinDate: string;
  expectedSignOff: string;
  actualSignOff: string | null;
  durationDays: number | null;
  /** Serialized duration input (mode/days/months/custom date) so edits preserve the duration. */
  durationJson?: string | null;
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
  // Next of kin
  nokName: string;
  nokRelationship: string;
  nokPhone: string;
  nokAddress: string;
  // Union membership
  unionMembership: string;
  // Bank
  bankName: string;
  bankAccountHolder: string;
  bankAccountNumber: string;
  bankAddress: string;
  bankBranchCode: string;
  bankSwift: string;
  bankIban: string;
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
