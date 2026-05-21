import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./navigation";
import { fetchDocText } from "./googleDocs";
import { loadSettings, saveSettings } from "./storage";
import { colors, gradients } from "./theme";

type Props = NativeStackScreenProps<RootStackParamList, "Teleprompter">;

export default function TeleprompterScreen({ route, navigation }: Props) {
  const {
    text: initialText,
    docUrl,
    fontSize: initialFont,
    speed: initialSpeed,
    mirror,
  } = route.params;

  const { height: screenHeight } = useWindowDimensions();

  const [text, setText] = useState(initialText);
  const [fontSize, setFontSize] = useState(initialFont);
  const [speed, setSpeed] = useState(initialSpeed); // px/s
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [live, setLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<
    "idle" | "checking" | "updated" | "error"
  >("idle");

  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const contentHeightRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);
  const textRef = useRef(initialText);
  textRef.current = text;

  const isDraggingRef = useRef(false);
  const wasPlayingRef = useRef(false);

  const LIVE_POLL_MS = 5000;

  // Animation loop driven by requestAnimationFrame.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTickRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastTickRef.current == null) lastTickRef.current = now;
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      const next = offsetRef.current + speed * dt;
      const max = Math.max(0, contentHeightRef.current - screenHeight * 0.5);
      offsetRef.current = next;
      scrollRef.current?.scrollTo({ y: next, animated: false });

      if (next >= max && contentHeightRef.current > 0) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
    };
  }, [playing, speed, screenHeight]);

  const togglePlay = () => setPlaying((p) => !p);

  const restart = () => {
    setPlaying(false);
    offsetRef.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const reload = async () => {
    if (!docUrl) {
      Alert.alert("No document URL", "Cannot reload — no source URL.");
      return;
    }
    try {
      setPlaying(false);
      setReloading(true);
      const fresh = await fetchDocText(docUrl);
      if (!fresh || !fresh.trim()) {
        Alert.alert("Empty document", "The document had no text content.");
        return;
      }
      setText(fresh);
      offsetRef.current = 0;
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      // Persist the refreshed text so Home's "Use last loaded doc" stays current.
      const current = await loadSettings();
      await saveSettings({
        ...current,
        lastDocUrl: docUrl,
        lastDocText: fresh,
      });
    } catch (err: any) {
      Alert.alert("Could not reload", err?.message ?? String(err));
    } finally {
      setReloading(false);
    }
  };

  // Live polling: while enabled, refetch the doc every LIVE_POLL_MS.
  // On change, preserve the user's reading position by keeping their pixel
  // offset if it falls inside the unchanged prefix; otherwise map it
  // proportionally to the new content height.
  useEffect(() => {
    if (!live || !docUrl) return;
    let cancelled = false;

    const checkOnce = async () => {
      if (cancelled) return;
      try {
        setLiveStatus("checking");
        const fresh = await fetchDocText(docUrl);
        if (cancelled) return;
        const old = textRef.current;
        if (fresh === old) {
          setLiveStatus("idle");
          return;
        }

        // Longest common prefix length (chars).
        let common = 0;
        const min = Math.min(old.length, fresh.length);
        while (
          common < min &&
          old.charCodeAt(common) === fresh.charCodeAt(common)
        ) {
          common++;
        }
        const contentH = contentHeightRef.current || 1;
        const progress = Math.min(1, Math.max(0, offsetRef.current / contentH));
        const insideCommonPrefix = progress * (old.length || 1) <= common;

        setText(fresh);
        setLiveStatus("updated");

        // Defer scroll adjust until layout settles.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const newH = contentHeightRef.current || 1;
            const target = insideCommonPrefix
              ? Math.min(
                  offsetRef.current,
                  Math.max(0, newH - screenHeight * 0.5),
                )
              : progress * newH;
            offsetRef.current = target;
            scrollRef.current?.scrollTo({ y: target, animated: false });
          });
        });

        const current = await loadSettings();
        await saveSettings({
          ...current,
          lastDocUrl: docUrl,
          lastDocText: fresh,
        });
      } catch {
        if (!cancelled) setLiveStatus("error");
      }
    };

    checkOnce();
    const id = setInterval(checkOnce, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [live, docUrl, screenHeight]);

  return (
    <View style={styles.root}>
      <View style={styles.tapZone}>
        <ScrollView
          ref={scrollRef}
          style={[styles.scroll, mirror && styles.mirror]}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: screenHeight * 0.4, paddingBottom: screenHeight },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            offsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          onContentSizeChange={(_w, h) => {
            contentHeightRef.current = h;
          }}
          onScrollBeginDrag={() => {
            isDraggingRef.current = true;
            wasPlayingRef.current = playing;
            if (playing) {
              setPlaying(false);
            }
          }}
          onScrollEndDrag={() => {
            // Keep isDragging true briefly so onTouchEnd doesn't toggle controls
            setTimeout(() => { isDraggingRef.current = false; }, 100);
          }}
          onMomentumScrollEnd={() => {
            if (wasPlayingRef.current) {
              setPlaying(true);
              wasPlayingRef.current = false;
            }
          }}
          onTouchEnd={() => {
            if (!isDraggingRef.current) {
              setShowControls((v) => !v);
            }
          }}
        >
          <Text
            style={[
              styles.text,
              { fontSize, lineHeight: Math.round(fontSize * 1.3) },
            ]}
            accessibilityLabel="Teleprompter script"
          >
            {text}
          </Text>
        </ScrollView>

        {/* Reading indicator line */}
        <View pointerEvents="none" style={styles.readerLine} />
      </View>

      {showControls && (
        <LinearGradient
          colors={[
            "rgba(15,10,35,0.96)",
            "rgba(10,10,31,0.85)",
            "rgba(0,0,0,0)",
          ]}
          style={styles.controls}
          pointerEvents="box-none"
        >
          {/* Row 1: Back · Play · LIVE */}
          <View style={styles.bigRow}>
            <View style={[styles.bigSlot, styles.bigSlotStart]}>
              <CtrlBtn
                label="Back"
                big
                smallText
                onPress={() => {
                  setPlaying(false);
                  navigation.goBack();
                }}
              />
            </View>
            <View style={styles.bigSlot}>
              <CtrlBtn
                label={playing ? "❚❚" : "▶"}
                onPress={togglePlay}
                primary
                big
              />
            </View>
            <View style={[styles.bigSlot, styles.bigSlotEnd]}>
              <CtrlBtn
                label={live ? "● LIVE" : "LIVE"}
                onPress={() => setLive((v) => !v)}
                active={live}
                big
                smallText
                accessibilityLabel={
                  live
                    ? "Disable live updates"
                    : "Enable live updates from Google Docs"
                }
              />
            </View>
          </View>

          {/* Row 2: small adjustment buttons */}
          <View style={styles.smallRow}>
            <CtrlBtn
              label="A−"
              onPress={() => setFontSize((f) => {
                const next = Math.max(16, f - 4);
                loadSettings().then((s) => saveSettings({ ...s, fontSize: next }));
                return next;
              })}
            />
            <CtrlBtn
              label="A+"
              onPress={() => setFontSize((f) => {
                const next = Math.min(140, f + 4);
                loadSettings().then((s) => saveSettings({ ...s, fontSize: next }));
                return next;
              })}
            />
            <CtrlBtn
              label="−"
              onPress={() => setSpeed((s) => {
                const next = Math.max(10, s - 10);
                loadSettings().then((curr) => saveSettings({ ...curr, speed: next }));
                return next;
              })}
            />
            <CtrlBtn
              label="+"
              onPress={() => setSpeed((s) => {
                const next = Math.min(400, s + 10);
                loadSettings().then((curr) => saveSettings({ ...curr, speed: next }));
                return next;
              })}
            />
            <CtrlBtn label="↺" onPress={restart} />
          </View>

          <Text style={styles.statusText}>
            {speed} px/s · {fontSize}pt {mirror ? "· mirrored" : ""}
            {live ? ` · live: ${liveStatus}` : ""}
          </Text>
        </LinearGradient>
      )}
    </View>
  );
}

function CtrlBtn({
  label,
  onPress,
  primary,
  disabled,
  active,
  big,
  smallText,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  active?: boolean;
  big?: boolean;
  smallText?: boolean;
  accessibilityLabel?: string;
}) {
  if (primary) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.ctrlBtnPrimaryWrap,
          big && styles.ctrlBtnBigWrap,
          disabled && { opacity: 0.5 },
          pressed && !disabled && { opacity: 0.85 },
        ]}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.ctrlBtn,
            big && styles.ctrlBtnBig,
            styles.ctrlBtnPrimary,
          ]}
        >
          <Text
            style={[
              styles.ctrlBtnText,
              big && styles.ctrlBtnTextBig,
              smallText && styles.ctrlBtnTextBigSmall,
              styles.ctrlBtnTextPrimary,
            ]}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }
  if (active) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          big && styles.ctrlBtnBigWrap,
          disabled && { opacity: 0.5 },
          pressed && !disabled && { opacity: 0.85 },
        ]}
      >
        <LinearGradient
          colors={gradients.live}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.ctrlBtn,
            big && styles.ctrlBtnBig,
            styles.ctrlBtnActive,
          ]}
        >
          <Text
            style={[
              styles.ctrlBtnText,
              big && styles.ctrlBtnTextBig,
              smallText && styles.ctrlBtnTextBigSmall,
              styles.ctrlBtnTextActive,
            ]}
          >
            {label}
          </Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.ctrlBtn,
        big && styles.ctrlBtnBig,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.ctrlBtnText,
          big && styles.ctrlBtnTextBig,
          smallText && styles.ctrlBtnTextBigSmall,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  tapZone: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  text: { color: "#fff", fontWeight: "600" },
  mirror: { transform: [{ scaleX: -1 }] },
  readerLine: {
    position: "absolute",
    left: 16,
    right: 16,
    top: "40%",
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.7,
    borderRadius: 1,
    shadowColor: colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  controls: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingTop: 56,
    paddingBottom: 18,
    paddingHorizontal: 12,
    gap: 8,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  smallRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  bigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bigSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bigSlotEnd: { alignItems: "flex-end" },
  bigSlotStart: { alignItems: "flex-start" },
  controlsLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flexShrink: 1,
  },
  controlsCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  controlsRight: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  ctrlBtn: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 48,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnBig: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    minWidth: 96,
    minHeight: 60,
    borderRadius: 14,
  },
  ctrlBtnBigWrap: {
    borderRadius: 14,
  },
  ctrlBtnPrimaryWrap: {
    borderRadius: 14,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  ctrlBtnPrimary: { borderColor: "transparent" },
  ctrlBtnActive: { borderColor: "transparent" },
  ctrlBtnText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  ctrlBtnTextBig: { fontSize: 22, fontWeight: "800" },
  ctrlBtnTextBigSmall: { fontSize: 16, fontWeight: "700", letterSpacing: 0.5 },
  ctrlBtnTextPrimary: { color: "#fff" },
  ctrlBtnTextActive: { color: "#fff" },
  statusText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    letterSpacing: 0.3,
  },
});
