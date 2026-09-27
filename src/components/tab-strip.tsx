import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  type ComponentType,
  type ReactNode,
  type RefObject,
} from 'react';
import { I18nManager, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

/** Shared settle spring for the strip: page glide, tab-bar tap and pill. */
export const STRIP_SPRING = { damping: 26, stiffness: 240, mass: 0.9, overshootClamping: true };

type TabStrip = {
  /** Strip translation in px produced by the tab layout (the pager). */
  pageX: SharedValue<number>;
  tabCount: number;
  /** Per-tab "scroll back to the top" callbacks, registered by the scenes. */
  scrollResets: Map<number, () => void>;
};

/** Any list/scroll view: ScrollView has scrollTo, FlatList has scrollToOffset. */
type Scrollable = {
  scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

/**
 * The tab navigator's scene wrapper is a plain RN `Animated.View` (React
 * Navigation's), which cannot run Reanimated styles — so each tab scene is
 * wrapped in its own `Animated.View` that rides the shared strip value here.
 */
const TabStripContext = createContext<TabStrip | null>(null);

export function TabStripProvider({ pageX, tabCount, scrollResets, children }: TabStrip & { children: ReactNode }) {
  return (
    <TabStripContext.Provider value={{ pageX, tabCount, scrollResets }}>{children}</TabStripContext.Provider>
  );
}

/** Index of the tab scene a component renders in (set by withTabStrip). */
const SceneIndexContext = createContext<number | null>(null);

/**
 * Ref for a tab's main ScrollView/FlatList. When the user moves to another tab,
 * the layout scrolls this list back to the top (off-screen), so the tab always
 * opens at its start. Returning from a pushed screen keeps the position.
 */
export function useTabScrollReset<T extends Scrollable>(): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const strip = useContext(TabStripContext);
  const index = useContext(SceneIndexContext);
  useEffect(() => {
    if (!strip || index === null) return;
    const reset = () => {
      const node = ref.current;
      if (node?.scrollToOffset) node.scrollToOffset({ offset: 0, animated: false });
      else node?.scrollTo?.({ y: 0, animated: false });
    };
    strip.scrollResets.set(index, reset);
    return () => {
      if (strip.scrollResets.get(index) === reset) strip.scrollResets.delete(index);
    };
  }, [strip, index]);
  return ref;
}

/** Physical left-to-right slot of a tab; RTL mirrors the strip like the tab bar. */
function slotOf(index: number, tabCount: number): number {
  return I18nManager.isRTL ? tabCount - 1 - index : index;
}

/** Animated strip transform for one tab scene (its slot offset + the drag). */
function useTabStripStyle(index: number) {
  const strip = useContext(TabStripContext);
  const { width } = useWindowDimensions();
  const offset = strip ? slotOf(index, strip.tabCount) * width : 0;
  const pageX = strip?.pageX;
  return useAnimatedStyle(() => ({ transform: [{ translateX: (pageX ? pageX.value : 0) + offset }] }));
}

/** HOC: renders a tab screen inside its slice of the draggable page strip. */
export function withTabStrip(Screen: ComponentType, index: number) {
  return function TabStripWrapped() {
    const stripStyle = useTabStripStyle(index);
    return (
      <SceneIndexContext.Provider value={index}>
        <Animated.View style={[styles.scene, stripStyle]}>{createElement(Screen)}</Animated.View>
      </SceneIndexContext.Provider>
    );
  };
}

const styles = StyleSheet.create({ scene: { flex: 1 } });
