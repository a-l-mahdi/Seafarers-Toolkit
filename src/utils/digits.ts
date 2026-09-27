const FA = '۰۱۲۳۴۵۶۷۸۹';
const AR = '٠١٢٣٤٥٦٧٨٩';

/**
 * Western digits → Persian digits, except inside words that contain Latin
 * letters (emails, "v1.3.5", "2nd", IDs like "SB-99"), which stay as typed.
 */
export function toPersianDigits(text: string): string {
  return text.replace(/[A-Za-z0-9@._%+#/:-]*\d[A-Za-z0-9@._%+#/:-]*/g, (token) =>
    /[A-Za-z]/.test(token) ? token : token.replace(/\d/g, (d) => FA[Number(d)]),
  );
}

/** Persian / Arabic-Indic digits → Western digits (for parsing typed input). */
export function toLatinDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (d) => {
    const fa = FA.indexOf(d);
    return String(fa >= 0 ? fa : AR.indexOf(d));
  });
}
