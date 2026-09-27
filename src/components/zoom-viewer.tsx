import { useState, type ReactElement, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fitContainer, Gallery } from 'react-native-zoom-toolkit';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

export interface Box {
  width: number;
  height: number;
}

/**
 * Full-screen viewer: pinch or double-tap to zoom, drag to look around,
 * swipe to the next item. A single tap hides / shows the bars.
 */
export function ZoomViewer<T>({
  items,
  initialIndex,
  keyOf,
  renderItem,
  title,
  actions,
  onIndexChange,
  onClose,
}: {
  items: T[];
  initialIndex: number;
  keyOf: (item: T, index: number) => string;
  /** Draws one item fitted inside `box` (the zoom is applied on top). */
  renderItem: (item: T, box: Box) => ReactElement;
  title?: (index: number) => string;
  /** Buttons for the bottom dock, for the item on screen. */
  actions?: (index: number) => ReactNode;
  onIndexChange?: (index: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const [chrome, setChrome] = useState(true);
  const box = { width, height };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.stage}>
          <Gallery
            data={items}
            initialIndex={initialIndex}
            keyExtractor={keyOf}
            renderItem={(item) => renderItem(item, box)}
            maxScale={5}
            gap={16}
            onIndexChange={(i) => {
              setIndex(i);
              onIndexChange?.(i);
            }}
            onTap={() => setChrome((c) => !c)}
          />
        </View>

        {chrome ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(160)}
            style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}
          >
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.glassBtn, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={styles.title} numberOfLines={1}>
              {title?.(index) ?? ''}
            </Text>
            {items.length > 1 ? (
              <View style={styles.counter}>
                <Text style={styles.counterText}>
                  {index + 1} / {items.length}
                </Text>
              </View>
            ) : (
              <View style={styles.glassSpacer} />
            )}
          </Animated.View>
        ) : null}

        {chrome && actions ? (
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(160)}
            style={[styles.dock, { marginBottom: insets.bottom + Spacing.lg }]}
          >
            {actions(index)}
          </Animated.View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

/** A round, coloured action for the viewer's dock. */
export function ViewerAction({
  icon,
  label,
  tint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.dockAction, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      <View style={[styles.dockIcon, { backgroundColor: tint, shadowColor: tint }]}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <Text style={styles.dockLabel}>{label}</Text>
    </Pressable>
  );
}

export function DockDivider() {
  return <View style={styles.dockDivider} />;
}

/** A photo fitted inside `box`, keeping its aspect ratio. */
export function FitImage({ uri, box }: { uri: string; box: Box }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const size = fitContainer(ratio ?? box.width / box.height, box);
  return (
    <Image
      source={{ uri }}
      style={size}
      contentFit="contain"
      onLoad={(e) => {
        if (e.source.width && e.source.height) setRatio(e.source.width / e.source.height);
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#05080D' },
  stage: { flex: 1, direction: 'ltr' },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: '#05080DB3',
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  glassBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF1F',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF40',
  },
  pressed: { opacity: 0.6 },
  glassSpacer: { width: 42 },
  counter: {
    minWidth: 42,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF1F',
  },
  counterText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dock: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 28,
    backgroundColor: '#141A24E6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF30',
  },
  dockDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: '#FFFFFF30' },
  dockAction: { alignItems: 'center', gap: 6, minWidth: 64 },
  dockIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  dockLabel: { color: '#FFFFFFE6', fontSize: 12, fontWeight: '700' },
});
