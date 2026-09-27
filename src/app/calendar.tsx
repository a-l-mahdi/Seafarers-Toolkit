import { useMemo, useState } from 'react';
import {
  Alert,
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/primitives';
import { TelegramHeader, useFloatingHeaderPadding } from '@/components/telegram-header';
import { DatePickerField, MonthYearPickerModal, TimePickerModal } from '@/components/ui/date-picker';
import {
  useCalendarNotes,
  useContracts,
  useDeleteCalendarNote,
  useDocuments,
  useLeaveSettings,
  useSaveCalendarNote,
} from '@/hooks/queries';
import {
  buildCalendarEvents,
  daysFromToday,
  notesToShow,
  upcomingEventIndex,
  type CalendarEvent,
  type CalendarEventKind,
} from '@/domain/calendar-events';
import { ensureNotificationPermission, noteFireAt } from '@/services/notification-service';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/hooks/use-theme';
import { showSavedToast } from '@/components/saved-toast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Radius, Spacing } from '@/constants/theme';
import type { CalendarNote } from '@/types/domain';
import {
  gregorianToJalali,
  isoToDate,
  jalaliDaysInMonth,
  jalaliToGregorianExact,
  JALALI_MONTHS,
  todayISO,
} from '@/utils/date';

const pad = (n: number) => String(n).padStart(2, '0');

interface MonthView {
  /** Number of days in the displayed month (in the selected calendar). */
  days: number;
  /** Column index (0-6) of the first day of the month. */
  firstCol: number;
  title: string;
  /** Gregorian ISO date for the given day-of-month in the displayed calendar. */
  isoForDay: (day: number) => string;
  parts: { y: number; m: number };
}

function buildMonthView(anchorISO: string, calendar: 'gregorian' | 'jalali', locale: string): MonthView {
  if (calendar === 'jalali') {
    const [jy, jm] = gregorianToJalali(anchorISO).split('/').map(Number);
    const firstIso = jalaliToGregorianExact(jy, jm, 1)!;
    return {
      days: jalaliDaysInMonth(jy, jm),
      // Jalali weeks start on Saturday (getDay 6) → column 0.
      firstCol: (isoToDate(firstIso).getUTCDay() + 1) % 7,
      title: `${JALALI_MONTHS[jm - 1]} ${jy}`,
      isoForDay: (d) => jalaliToGregorianExact(jy, jm, d)!,
      parts: { y: jy, m: jm },
    };
  }
  const [y, m] = anchorISO.split('-').map(Number);
  const firstIso = `${y}-${pad(m)}-01`;
  const formatter = new Intl.DateTimeFormat(locale === 'fa' ? 'fa' : 'en', {
    month: 'long',
    year: 'numeric',
  });
  return {
    days: new Date(y, m, 0).getDate(),
    firstCol: isoToDate(firstIso).getUTCDay(),
    title: formatter.format(isoToDate(firstIso)),
    isoForDay: (d) => `${y}-${pad(m)}-${pad(d)}`,
    parts: { y, m },
  };
}

const KINDS: CalendarEventKind[] = ['trip_start', 'trip_end', 'leave_start', 'leave_end', 'doc_expiry', 'note'];

const KIND_ICON: Record<CalendarEventKind, keyof typeof Ionicons.glyphMap> = {
  trip_start: 'boat',
  trip_end: 'flag',
  leave_start: 'sunny',
  leave_end: 'hourglass',
  doc_expiry: 'alert-circle',
  note: 'create',
};

function useKindColors(): Record<CalendarEventKind, string> {
  const colors = useTheme();
  const dark = useColorScheme() === 'dark';
  return {
    trip_start: colors.primary,
    trip_end: colors.warning,
    leave_start: colors.success,
    leave_end: dark ? '#2DD4BF' : '#0D9488',
    doc_expiry: colors.danger,
    note: dark ? '#A78BFA' : '#7C3AED',
  };
}

/** Day and month of a date in the user's calendar, e.g. { day: '5', month: 'مهر' }. */
function useDayParts() {
  const calendarPref = useSettingsStore((s) => s.calendar);
  const locale = useSettingsStore((s) => s.locale);
  return (iso: string) => {
    if (calendarPref === 'jalali') {
      const [, jm, jd] = gregorianToJalali(iso).split('/').map(Number);
      return { day: String(jd), month: JALALI_MONTHS[jm - 1] };
    }
    const d = isoToDate(iso);
    return {
      day: String(d.getUTCDate()),
      month: new Intl.DateTimeFormat(locale === 'fa' ? 'fa' : 'en', { month: 'short', timeZone: 'UTC' }).format(d),
    };
  };
}

/** Long date in the user's calendar, e.g. "۵ مهر ۱۴۰۵" / "Oct 5, 2026". */
function useLongDate() {
  const calendarPref = useSettingsStore((s) => s.calendar);
  const locale = useSettingsStore((s) => s.locale);
  return (iso: string) => {
    if (calendarPref === 'jalali') {
      const [jy, jm, jd] = gregorianToJalali(iso).split('/').map(Number);
      return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
    }
    return new Intl.DateTimeFormat(locale === 'fa' ? 'fa' : 'en', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(isoToDate(iso));
  };
}

/** Default reminder time: the next full hour today, otherwise 09:00. */
function defaultTime(date: string): string {
  if (date !== todayISO()) return '09:00';
  const h = new Date().getHours() + 1;
  return h > 23 ? '23:59' : `${pad(h)}:00`;
}

type EditorState = { note: CalendarNote | null; date: string };

export default function CalendarScreen() {
  const { t } = useTranslation();
  const colors = useTheme();
  const kindColor = useKindColors();
  const insets = useSafeAreaInsets();
  const headerPad = useFloatingHeaderPadding();
  const router = useRouter();
  const { note: focusNoteId } = useLocalSearchParams<{ note?: string }>();
  const calendarPref = useSettingsStore((s) => s.calendar);
  const locale = useSettingsStore((s) => s.locale);
  const longDate = useLongDate();
  const [anchor, setAnchor] = useState(() => todayISO());
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // null → follow "the next event from today".
  const [eventIndex, setEventIndex] = useState<number | null>(null);
  const [slideDir, setSlideDir] = useState<-1 | 0 | 1>(0);
  // Direction of the last month step, for the grid's slide-in.
  const [monthDir, setMonthDir] = useState<-1 | 0 | 1>(0);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const { data: contracts } = useContracts();
  const { data: documents } = useDocuments();
  const { data: leaveSettings } = useLeaveSettings();
  const { data: notes } = useCalendarNotes();

  const view = useMemo(() => buildMonthView(anchor, calendarPref, locale), [anchor, calendarPref, locale]);

  const events = useMemo(
    () =>
      buildCalendarEvents({
        contracts: contracts ?? [],
        documents: (documents ?? []).map((d) => ({ id: d.id, name: d.name, expiryDate: d.expiryDate })),
        notes: notes ?? [],
        leaveSettings: leaveSettings ?? null,
      }),
    [contracts, documents, notes, leaveSettings],
  );

  /** Kinds per day, in a fixed order, for the dots under each day. */
  const kindsByDay = useMemo(() => {
    const map = new Map<string, Set<CalendarEventKind>>();
    for (const e of events) {
      if (!map.has(e.date)) map.set(e.date, new Set());
      map.get(e.date)!.add(e.kind);
    }
    return map;
  }, [events]);

  const index = events.length === 0 ? -1 : Math.min(eventIndex ?? upcomingEventIndex(events), events.length - 1);
  const current = index >= 0 ? events[index] : null;

  const showEvent = (i: number, dir: -1 | 0 | 1) => {
    const e = events[i];
    if (!e) return;
    setSlideDir(dir);
    setMonthDir(0);
    setEventIndex(i);
    setSelected(e.date);
    setAnchor(e.date);
  };

  // Opened from a note reminder: bring that note up once its data is loaded.
  const [focusedNote, setFocusedNote] = useState<string | null>(null);
  if (focusNoteId && focusedNote !== focusNoteId && notes) {
    const i = events.findIndex((e) => e.kind === 'note' && e.refId === focusNoteId);
    if (i >= 0) {
      setFocusedNote(focusNoteId);
      showEvent(i, 0);
    }
  }

  const weekdayLabels = useMemo(() => {
    if (calendarPref === 'jalali') return ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
    const fmt = new Intl.DateTimeFormat(locale === 'fa' ? 'fa' : 'en', { weekday: 'narrow' });
    // 2023-01-01 was a Sunday (getUTCDay 0) → labels for columns 0..6.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
  }, [calendarPref, locale]);
  // Friday is the weekend in the Persian calendar.
  const weekendCol = calendarPref === 'jalali' ? 6 : -1;

  const cells: (number | null)[] = [
    ...Array.from({ length: view.firstCol }, () => null),
    ...Array.from({ length: view.days }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = todayISO();

  const changeMonth = (dir: -1 | 1) => {
    const { y, m } = view.parts;
    let [ny, nm] = [y, m + dir];
    if (nm === 0) [ny, nm] = [y - 1, 12];
    if (nm === 13) [ny, nm] = [y + 1, 1];
    setMonthDir(dir);
    setAnchor(calendarPref === 'jalali' ? jalaliToGregorianExact(ny, nm, 1)! : `${ny}-${pad(nm)}-01`);
  };

  // Swiping the calendar left / right moves between months (mirrored in RTL,
  // where the next month lies to the left). Vertical drags fail the pan, so the
  // page still scrolls.
  const monthSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (Math.abs(e.translationX) < 50 && Math.abs(e.velocityX) < 500) return;
      changeMonth(e.translationX < 0 !== I18nManager.isRTL ? 1 : -1);
    });
  const gridEntering =
    monthDir === 0
      ? FadeIn.duration(180)
      : monthDir > 0 !== I18nManager.isRTL
        ? FadeInRight.duration(220)
        : FadeInLeft.duration(220);

  const pickMonth = (y: number, m: number) => {
    setPickerOpen(false);
    setMonthDir(0);
    setAnchor(calendarPref === 'jalali' ? jalaliToGregorianExact(y, m, 1)! : `${y}-${pad(m)}-01`);
  };

  const goToday = () => {
    setSelected(null);
    setMonthDir(0);
    setAnchor(todayISO());
    setSlideDir(0);
    setEventIndex(null);
  };

  const pressDay = (iso: string) => {
    if (iso === selected) {
      setSelected(null);
      return;
    }
    setSelected(iso);
    const i = events.findIndex((e) => e.date === iso);
    if (i >= 0 && i !== index) {
      setSlideDir(i > index ? 1 : -1);
      setEventIndex(i);
    }
  };

  const openEvent = (e: CalendarEvent) => {
    if (e.kind === 'note') {
      const note = notes?.find((n) => n.id === e.refId);
      if (note) setEditor({ note, date: note.date });
    } else if (e.kind === 'doc_expiry') {
      router.push({ pathname: '/document-alert', params: { id: e.refId } });
    } else {
      router.push({ pathname: '/contract-detail', params: { id: e.refId } });
    }
  };

  const newNote = (date?: string) => setEditor({ note: null, date: date ?? selected ?? today });

  const prevIcon: keyof typeof Ionicons.glyphMap = I18nManager.isRTL ? 'chevron-forward' : 'chevron-back';
  const nextIcon: keyof typeof Ionicons.glyphMap = I18nManager.isRTL ? 'chevron-back' : 'chevron-forward';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TelegramHeader
        title={t('calendar.title')}
        onBack={() => router.back()}
        actions={[{ icon: 'add', label: t('calendar.editor.newTitle'), onPress: () => newNote() }]}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          { paddingTop: headerPad, paddingBottom: Spacing.xxl + insets.bottom },
        ]}
        style={{ backgroundColor: colors.background, flex: 1 }}
      >
        <GestureDetector gesture={monthSwipe}>
          <View collapsable={false}>
            <Card>
              {/* One row: month & year with "today" beside it, the month arrows at the far end. */}
              <View style={styles.monthRow}>
                <Pressable onPress={() => setPickerOpen(true)} hitSlop={8} style={styles.titleBtn}>
                  <Text style={[styles.monthTitle, { color: colors.text }]} numberOfLines={1}>
                    {view.title}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={goToday}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.todayBtn,
                    { backgroundColor: colors.primaryMuted, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="today-outline" size={14} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>{t('common.today')}</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable
                  onPress={() => changeMonth(-1)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.monthArrow,
                    { backgroundColor: colors.primaryMuted, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name={prevIcon} size={18} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() => changeMonth(1)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.monthArrow,
                    { backgroundColor: colors.primaryMuted, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name={nextIcon} size={18} color={colors.primary} />
                </Pressable>
              </View>
              <View style={styles.weekRow}>
                {weekdayLabels.map((label, i) => (
                  <Text
                    key={`w${i}`}
                    style={[styles.weekLabel, { color: i === weekendCol ? colors.danger : colors.textMuted }]}
                  >
                    {label}
                  </Text>
                ))}
              </View>
              <Animated.View key={`${view.parts.y}-${view.parts.m}`} entering={gridEntering} style={styles.grid}>
                {cells.map((day, i) => {
                  if (day === null) return <View key={`e${i}`} style={styles.cell} />;
                  const iso = view.isoForDay(day);
                  const kinds = kindsByDay.get(iso);
                  const isToday = iso === today;
                  const isSelected = iso === selected;
                  const weekend = i % 7 === weekendCol;
                  return (
                    <Pressable
                      key={iso}
                      style={styles.cell}
                      onPress={() => pressDay(iso)}
                      onLongPress={() => newNote(iso)}
                      delayLongPress={350}
                    >
                      <View
                        style={[
                          styles.dayCircle,
                          isToday ? { backgroundColor: colors.primary } : null,
                          isSelected && !isToday ? { borderWidth: 2, borderColor: colors.primary } : null,
                          isSelected && isToday ? { borderWidth: 2, borderColor: colors.primaryMuted } : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            {
                              color: isToday ? colors.onPrimary : weekend ? colors.danger : colors.text,
                              fontWeight: isToday || isSelected ? '800' : '500',
                            },
                          ]}
                        >
                          {day}
                        </Text>
                      </View>
                      <View style={styles.dots}>
                        {kinds
                          ? KINDS.filter((k) => kinds.has(k))
                              .slice(0, 4)
                              .map((k) => <View key={k} style={[styles.dot, { backgroundColor: kindColor[k] }]} />)
                          : null}
                      </View>
                    </Pressable>
                  );
                })}
              </Animated.View>
              <View style={[styles.legend, { borderTopColor: colors.border }]}>
                {KINDS.map((k) => (
                  <View key={k} style={styles.legendChip}>
                    <View style={[styles.dot, { backgroundColor: kindColor[k] }]} />
                    <Text style={[styles.legendText, { color: colors.textMuted }]}>{t(`calendar.kind.${k}`)}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </GestureDetector>

        <UpcomingEventCard
          event={current}
          index={index}
          total={events.length}
          slideDir={slideDir}
          onChange={showEvent}
          onOpen={openEvent}
          longDate={longDate}
        />

        <NotesCard notes={notesToShow(notes ?? [], selected)} onOpen={(note) => setEditor({ note, date: note.date })} />
      </ScrollView>

      {pickerOpen ? (
        <MonthYearPickerModal
          calendar={calendarPref}
          year={view.parts.y}
          month={view.parts.m}
          onClose={() => setPickerOpen(false)}
          onConfirm={pickMonth}
        />
      ) : null}

      {editor ? (
        <NoteEditorModal
          key={editor.note?.id ?? `new-${editor.date}`}
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={(date) => {
            setEditor(null);
            setSelected(date);
            setAnchor(date);
            setEventIndex(null);
          }}
        />
      ) : null}
    </View>
  );
}

/** "رویداد پیش رو": one event at a time, stepped with ‹ › (or a swipe) through past and future. */
function UpcomingEventCard({
  event,
  index,
  total,
  slideDir,
  onChange,
  onOpen,
  longDate,
}: {
  event: CalendarEvent | null;
  index: number;
  total: number;
  slideDir: -1 | 0 | 1;
  onChange: (index: number, dir: -1 | 1) => void;
  onOpen: (event: CalendarEvent) => void;
  longDate: (iso: string) => string;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const kindColor = useKindColors();
  const rtl = I18nManager.isRTL;
  const canStep = (dir: -1 | 1) => (dir < 0 ? index > 0 : index >= 0 && index < total - 1);
  const step = (dir: -1 | 1) => {
    if (canStep(dir)) onChange(index + dir, dir);
  };

  // Swipe like the arrows: in RTL the later event lies to the left.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (Math.abs(e.translationX) < 50 && Math.abs(e.velocityX) < 500) return;
      step(e.translationX < 0 !== rtl ? 1 : -1);
    });

  /** The arrow on one side; in RTL the left one goes forward and the right one back. */
  const arrow = (side: 'left' | 'right') => {
    const dir: -1 | 1 = (side === 'left') !== rtl ? -1 : 1;
    const enabled = canStep(dir);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir < 0 ? t('calendar.previous') : t('calendar.next')}
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPress={() => step(dir)}
        hitSlop={10}
        style={({ pressed }) => [
          styles.navArrow,
          {
            backgroundColor: enabled ? colors.primaryMuted : colors.surfaceMuted,
            opacity: enabled ? (pressed ? 0.7 : 1) : 0.45,
            transform: [{ scale: pressed ? 0.92 : 1 }],
          },
        ]}
      >
        <Ionicons
          name={side === 'left' ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={enabled ? colors.primary : colors.textMuted}
        />
      </Pressable>
    );
  };

  let body = <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('calendar.noEvents')}</Text>;
  if (event) {
    const color = kindColor[event.kind];
    const days = daysFromToday(event.date);
    const rel =
      days === 0
        ? t('calendar.rel.today')
        : days === 1
          ? t('calendar.rel.tomorrow')
          : days === -1
            ? t('calendar.rel.yesterday')
            : days > 1
              ? t('calendar.rel.inDays', { count: days })
              : t('calendar.rel.daysAgo', { count: -days });
    // A later event slides in from the side its arrow is on.
    const entering =
      slideDir === 0
        ? FadeIn.duration(200)
        : slideDir > 0 !== rtl
          ? FadeInRight.duration(240)
          : FadeInLeft.duration(240);
    body = (
      <Animated.View key={event.key} entering={entering} style={{ flex: 1 }}>
        <Pressable
          onPress={() => onOpen(event)}
          android_ripple={{ color: colors.surfaceMuted }}
          style={[styles.eventBody, { backgroundColor: `${color}14`, borderColor: `${color}40` }]}
        >
          <View style={[styles.eventIcon, { backgroundColor: color }]}>
            <Ionicons name={KIND_ICON[event.kind]} size={22} color="#FFFFFF" />
          </View>
          <View style={styles.eventInfo}>
            <View style={styles.eventTop}>
              <Text style={[styles.eventKind, { color }]} numberOfLines={1}>
                {t(`calendar.kind.${event.kind}`)}
              </Text>
              <View style={[styles.relChip, { backgroundColor: days < 0 ? colors.surfaceMuted : color }]}>
                <Text style={[styles.relText, { color: days < 0 ? colors.textMuted : '#FFFFFF' }]}>{rel}</Text>
              </View>
            </View>
            <Text style={[styles.eventLabel, { color: colors.text }]} numberOfLines={2}>
              {event.label}
            </Text>
            <View style={styles.eventMeta}>
              <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.eventDate, { color: colors.textMuted }]}>{longDate(event.date)}</Text>
              {event.time ? (
                <>
                  <Ionicons
                    name={event.remind ? 'notifications' : 'time-outline'}
                    size={13}
                    color={event.remind ? color : colors.textMuted}
                  />
                  <Text style={[styles.eventDate, { color: event.remind ? color : colors.textMuted }]}>
                    {event.time}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Card>
      <View style={styles.cardHead}>
        <Ionicons name="sparkles" size={16} color={colors.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('calendar.upcoming')}</Text>
      </View>
      {/* Arrows keep their sides; which way each steps follows the language. */}
      <GestureDetector gesture={swipe}>
        <View style={styles.navRow} collapsable={false}>
          {arrow('left')}
          <View style={{ flex: 1, direction: rtl ? 'rtl' : 'ltr' }}>{body}</View>
          {arrow('right')}
        </View>
      </GestureDetector>
    </Card>
  );
}

/** Up to three notes, each with its day. */
function NotesCard({ notes, onOpen }: { notes: CalendarNote[]; onOpen: (note: CalendarNote) => void }) {
  const { t } = useTranslation();
  const colors = useTheme();
  const violet = useKindColors().note;
  const dayParts = useDayParts();

  return (
    <Card>
      <View style={styles.cardHead}>
        <Ionicons name="create" size={16} color={violet} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{t('calendar.notes.title')}</Text>
      </View>
      {notes.length === 0 ? (
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('calendar.notes.empty')}</Text>
      ) : (
        <View style={{ gap: Spacing.sm }}>
          {notes.map((note) => {
            const { day, month } = dayParts(note.date);
            const passed = note.date < todayISO();
            return (
              <Animated.View key={note.id} entering={FadeIn.duration(200)}>
                <Pressable
                  onPress={() => onOpen(note)}
                  android_ripple={{ color: colors.surfaceMuted }}
                  style={[styles.noteRow, { backgroundColor: colors.surfaceMuted }]}
                >
                  <View style={[styles.noteBadge, { backgroundColor: passed ? colors.border : violet }]}>
                    <Text style={[styles.noteDay, { color: passed ? colors.textMuted : '#FFFFFF' }]}>{day}</Text>
                    <Text
                      style={[styles.noteMonth, { color: passed ? colors.textMuted : '#FFFFFF' }]}
                      numberOfLines={1}
                    >
                      {month}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[styles.noteText, { color: colors.text }]} numberOfLines={2}>
                      {note.text}
                    </Text>
                    {note.time ? (
                      <View style={styles.eventMeta}>
                        <Ionicons
                          name={note.remind ? 'notifications' : 'time-outline'}
                          size={13}
                          color={note.remind ? violet : colors.textMuted}
                        />
                        <Text style={[styles.eventDate, { color: note.remind ? violet : colors.textMuted }]}>
                          {note.time}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Ionicons
                    name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'}
                    size={16}
                    color={colors.textMuted}
                  />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

/** Add / edit a note; with the reminder on, a notification fires on that day at that time. */
function NoteEditorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: EditorState;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useTheme();
  const violet = useKindColors().note;
  const save = useSaveCalendarNote();
  const remove = useDeleteCalendarNote();
  const editing = initial.note;
  const [date, setDate] = useState(editing?.date ?? initial.date);
  const [text, setText] = useState(editing?.text ?? '');
  const [remind, setRemind] = useState(editing?.remind ?? false);
  const [time, setTime] = useState(editing?.time ?? defaultTime(editing?.date ?? initial.date));
  const [timeOpen, setTimeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = save.isPending || remove.isPending;

  const submit = async () => {
    const body = text.trim();
    if (!body) {
      setError(t('calendar.editor.textRequired'));
      return;
    }
    if (!date) return;
    const fireAt = noteFireAt({ date, time, remind });
    // An unchanged, already-fired reminder can stay as it is.
    const unchanged = !!editing && editing.remind && editing.date === date && editing.time === time;
    if (remind && !unchanged && (!fireAt || fireAt.getTime() <= Date.now())) {
      setError(t('calendar.editor.timePast'));
      return;
    }
    setError(null);
    if (remind && !unchanged && !(await ensureNotificationPermission())) {
      Alert.alert(t('calendar.editor.remind'), t('calendar.editor.permissionOff'));
    }
    await save.mutateAsync({ id: editing?.id, date, time: remind ? time : null, text: body, remind });
    showSavedToast();
    onSaved(date);
  };

  const confirmDelete = () => {
    if (!editing) return;
    Alert.alert(t('calendar.editor.deleteConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(editing.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetBand, { backgroundColor: violet }]}>
              <Ionicons name="create" size={20} color="#FFFFFF" />
              <Text style={styles.sheetTitle}>
                {editing ? t('calendar.editor.editTitle') : t('calendar.editor.newTitle')}
              </Text>
              {editing ? (
                <Pressable onPress={confirmDelete} hitSlop={10} disabled={busy} style={styles.sheetDelete}>
                  <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
              <DatePickerField
                label={t('calendar.editor.date')}
                value={date}
                onChange={(iso) => {
                  if (!iso) return;
                  setDate(iso);
                  setError(null);
                }}
              />
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t('calendar.editor.text')}</Text>
              <TextInput
                value={text}
                onChangeText={(v) => {
                  setText(v);
                  if (error) setError(null);
                }}
                placeholder={t('calendar.editor.placeholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus={!editing}
                textAlignVertical="top"
                style={[
                  styles.textInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surface,
                    borderColor: error && !text.trim() ? colors.danger : colors.border,
                    textAlign: I18nManager.isRTL ? 'right' : 'left',
                  },
                ]}
              />
              <View style={[styles.remindRow, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.remindIcon, { backgroundColor: remind ? violet : colors.border }]}>
                  <Ionicons name={remind ? 'notifications' : 'notifications-off-outline'} size={16} color="#FFFFFF" />
                </View>
                <Text style={[styles.remindLabel, { color: colors.text }]}>{t('calendar.editor.remind')}</Text>
                <Switch
                  value={remind}
                  onValueChange={(v) => {
                    setRemind(v);
                    setError(null);
                  }}
                  trackColor={{ false: colors.border, true: `${violet}80` }}
                  thumbColor={remind ? violet : colors.surface}
                />
              </View>
              {remind ? (
                <Animated.View entering={FadeIn.duration(180)}>
                  <Pressable
                    onPress={() => setTimeOpen(true)}
                    style={[styles.timeRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  >
                    <Ionicons name="time-outline" size={18} color={violet} />
                    <Text style={[styles.remindLabel, { color: colors.textMuted }]}>{t('calendar.editor.time')}</Text>
                    <Text style={[styles.timeValue, { color: violet }]}>{time}</Text>
                  </Pressable>
                </Animated.View>
              ) : null}
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <View style={styles.sheetActions}>
                <Pressable onPress={onClose} style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  onPress={submit}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: violet, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('common.save')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
      {timeOpen ? (
        <TimePickerModal
          value={time}
          onClose={() => setTimeOpen(false)}
          onConfirm={(v) => {
            setTime(v);
            setTimeOpen(false);
            setError(null);
          }}
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  monthArrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  titleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    flexShrink: 1,
  },
  monthTitle: { fontSize: 17, fontWeight: '800' },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, paddingVertical: 3, alignItems: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 14, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: Spacing.md,
    rowGap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 11, fontWeight: '600' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  navRow: { direction: 'ltr', flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  navArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: Spacing.md, flex: 1 },
  eventBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  eventIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1, gap: 4 },
  eventTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  eventKind: { fontSize: 12, fontWeight: '800', flexShrink: 1 },
  relChip: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  relText: { fontSize: 11, fontWeight: '800' },
  eventLabel: { fontSize: 15, fontWeight: '700' },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  eventDate: { fontSize: 12, fontWeight: '600' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  noteBadge: { width: 48, height: 52, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  noteDay: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  noteMonth: { fontSize: 10, fontWeight: '700', maxWidth: 44 },
  noteText: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: '#00000090', justifyContent: 'center', padding: Spacing.lg },
  sheet: { borderRadius: 22, overflow: 'hidden', maxHeight: '90%' },
  sheetBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', flex: 1 },
  sheetDelete: { padding: 2 },
  sheetBody: { padding: Spacing.lg },
  fieldLabel: { fontSize: 13, marginBottom: 6, fontWeight: '500' },
  textInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    minHeight: 96,
    maxHeight: 180,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    marginBottom: Spacing.md,
  },
  remindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    minHeight: 48,
  },
  remindIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  remindLabel: { flex: 1, fontSize: 15, fontWeight: '600' },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    marginTop: Spacing.sm,
  },
  timeValue: { fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  error: { fontSize: 13, marginTop: Spacing.sm, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, alignItems: 'center' },
});
