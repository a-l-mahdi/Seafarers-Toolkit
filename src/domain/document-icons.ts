/**
 * Document-type icons: Material Design Icons (pictogrammers.com, Apache 2.0,
 * bundled with @expo/vector-icons as MaterialCommunityIcons) plus a tint.
 * A type stores its own icon/colour; NULL falls back to the built-in default.
 */

export interface DocIcon {
  icon: string;
  color: string;
}

export const DOC_ICON_FALLBACK: DocIcon = { icon: 'file-document-outline', color: '#0E5AA7' };

/** Icons of the built-in document types (ids from the seed in db.ts). */
export const DEFAULT_DOC_ICONS: Record<string, DocIcon> = {
  doctype_passport: { icon: 'passport', color: '#1565C0' },
  doctype_seaman_s_book: { icon: 'book-account', color: '#00897B' },
  doctype_stcw: { icon: 'certificate', color: '#6A1B9A' },
  doctype_certificate_of_competency: { icon: 'card-account-details-star', color: '#EF6C00' },
  doctype_medical_certificate: { icon: 'medical-bag', color: '#D32F2F' },
  doctype_gmdss: { icon: 'radio-tower', color: '#0277BD' },
  doctype_basic_safety_training: { icon: 'lifebuoy', color: '#F4511E' },
  doctype_advanced_fire_fighting: { icon: 'fire-extinguisher', color: '#C62828' },
  doctype_proficiency_in_survival_craft: { icon: 'rowing', color: '#00838F' },
  doctype_visa: { icon: 'stamper', color: '#5E35B1' },
  doctype_basic_training_for_liquid_gas_tanker: { icon: 'gas-cylinder', color: '#2E7D32' },
  doctype_basic_training_for_oil_and_chemical_tanker: { icon: 'barrel', color: '#6D4C41' },
};

/** Icons offered in the picker. */
export const DOC_ICON_CHOICES = [
  'passport',
  'passport-biometric',
  'book-account',
  'card-account-details',
  'card-account-details-star',
  'id-card',
  'certificate',
  'file-certificate',
  'license',
  'seal',
  'stamper',
  'file-sign',
  'file-document-outline',
  'medical-bag',
  'heart-pulse',
  'needle',
  'pill',
  'eye',
  'hospital-box',
  'radio-tower',
  'radio-handheld',
  'lifebuoy',
  'rowing',
  'swim',
  'diving-scuba',
  'fire-extinguisher',
  'fire',
  'smoke-detector',
  'shield-check',
  'security',
  'anchor',
  'ship-wheel',
  'compass',
  'ferry',
  'sail-boat',
  'crane',
  'gas-cylinder',
  'barrel',
  'oil',
  'flask',
  'tanker-truck',
  'lightning-bolt',
  'cog',
  'wrench',
  'hard-hat',
  'account-hard-hat',
  'school',
  'account-tie',
  'airplane',
  'earth',
  'briefcase',
  'bank',
  'wallet',
  'medal',
  'star',
  'key',
];

export const DOC_COLOR_CHOICES = [
  '#1565C0',
  '#0277BD',
  '#00838F',
  '#00897B',
  '#2E7D32',
  '#7CB342',
  '#F9A825',
  '#EF6C00',
  '#F4511E',
  '#C62828',
  '#D81B60',
  '#6A1B9A',
  '#5E35B1',
  '#6D4C41',
  '#546E7A',
];

/** The icon to draw for a document type (its own, else the built-in default). */
export function resolveDocIcon(typeId: string | null, icon: string | null, color: string | null): DocIcon {
  const base = (typeId && DEFAULT_DOC_ICONS[typeId]) || DOC_ICON_FALLBACK;
  return { icon: icon || base.icon, color: color || base.color };
}
