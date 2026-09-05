import { useCallback } from 'react';
import { gregorianToJalali, isISODate } from '@/utils/date';
import { useSettingsStore } from '@/store/settings-store';

/** Returns a formatter that renders ISO dates according to the user's calendar preference. */
export function useFormattedDate() {
  const calendar = useSettingsStore((s) => s.calendar);

  return useCallback(
    (iso: string | null | undefined): string => {
      if (!iso || !isISODate(iso)) return iso ?? '';
      return calendar === 'jalali' ? gregorianToJalali(iso) : iso;
    },
    [calendar]
  );
}
