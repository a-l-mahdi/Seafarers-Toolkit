import { createElement, useSyncExternalStore, type ReactNode, type Ref } from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';
import i18n from '@/i18n';
import { toLatinDigits, toPersianDigits } from '@/utils/digits';

const subscribe = (onChange: () => void) => {
  i18n.on('languageChanged', onChange);
  return () => i18n.off('languageChanged', onChange);
};

/** True while the app is in Persian, where numbers are shown in Persian digits. */
export function usePersianDigits(): boolean {
  return useSyncExternalStore(subscribe, () => i18n.language === 'fa');
}

function localize(node: ReactNode): ReactNode {
  if (typeof node === 'string') return toPersianDigits(node);
  if (typeof node === 'number') return toPersianDigits(String(node));
  if (Array.isArray(node)) return node.map(localize);
  return node;
}

/** React Native's Text, showing digits in Persian while the app is in Persian. */
export function Text({ children, ...rest }: TextProps & { ref?: Ref<RNText> }) {
  const fa = usePersianDigits();
  if (!fa) return createElement(RNText, rest, children);
  const kids = localize(children);
  // Spread arrays so JSX children stay "static" (no key warnings).
  return Array.isArray(kids)
    ? createElement(RNText, rest, ...kids)
    : createElement(RNText, rest, kids);
}
// Also usable as a type (refs), like the component it wraps.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Text = RNText;

/**
 * React Native's TextInput: shows digits in Persian while the app is in
 * Persian, and always hands Western digits to `onChangeText` (so values parse
 * the same whichever keyboard typed them).
 */
export function TextInput({
  value,
  defaultValue,
  placeholder,
  onChangeText,
  ...rest
}: TextInputProps & { ref?: Ref<RNTextInput> }) {
  const fa = usePersianDigits();
  const show = (v: string | undefined) => (fa && v != null ? toPersianDigits(v) : v);
  return (
    <RNTextInput
      {...rest}
      value={show(value)}
      defaultValue={show(defaultValue)}
      placeholder={show(placeholder)}
      onChangeText={onChangeText ? (v) => onChangeText(toLatinDigits(v)) : undefined}
    />
  );
}
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type TextInput = RNTextInput;
