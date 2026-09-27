import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';

/** True once `values` differ from what they were on the first render. */
export function useIsDirty(values: unknown): boolean {
  const current = JSON.stringify(values);
  const [initial] = useState(current);
  return current !== initial;
}

/**
 * Asks before leaving a screen with unsaved changes (back button, gesture or
 * header): Yes runs `onSave`, which closes the screen via `leave` when it
 * succeeds (or returns true to leave right away), No leaves without saving (after `onDiscard`), Cancel stays.
 *
 * Returns `leave`, which closes the screen without asking — call it after
 * saving or deleting instead of `router.back()`.
 */
export function useUnsavedGuard(dirty: boolean, onSave: () => unknown, onDiscard?: () => void): () => void {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [leaving, setLeaving] = useState(false);
  // The navigation that was held back, replayed once leaving is allowed.
  const pending = useRef<NavigationAction | null>(null);

  usePreventRemove(dirty && !leaving, ({ data }) => {
    Alert.alert(
      t('common.unsaved.title'),
      t('common.unsaved.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.unsaved.no'),
          style: 'destructive',
          onPress: () => {
            onDiscard?.();
            pending.current = data.action;
            setLeaving(true);
          },
        },
        {
          text: t('common.unsaved.yes'),
          onPress: () => {
            pending.current = data.action;
            if (onSave() === true) setLeaving(true);
          },
        },
      ],
      { cancelable: true },
    );
  });

  // Leave exactly once: the screen re-renders while it closes (saved data
  // refreshing), and a second goBack would pop the screen underneath too.
  const left = useRef(false);
  useEffect(() => {
    if (!leaving || left.current) return;
    left.current = true;
    const action = pending.current;
    pending.current = null;
    if (action) navigation.dispatch(action);
    else if (navigation.canGoBack()) navigation.goBack();
  }, [leaving, navigation]);

  return () => setLeaving(true);
}
