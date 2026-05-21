import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { fetchDocText } from "./googleDocs";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from "./storage";
import type { RootStackParamList } from "./navigation";
import { colors, gradients } from "./theme";

const BUILD_VERSION = new Date().toLocaleString();

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const s = await loadSettings();
        setSettings(s);
        setUrl(s.lastDocUrl);
      })();
    }, [])
  );

  const update = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const handleStart = async (useCached: boolean) => {
    try {
      setLoading(true);
      let text = settings.lastDocText;
      if (!useCached) {
        text = await fetchDocText(url);
        update({ lastDocUrl: url, lastDocText: text });
      }
      if (!text || !text.trim()) {
        Alert.alert("Empty document", "The document had no text content.");
        return;
      }
      navigation.navigate("Teleprompter", {
        text,
        docUrl: useCached ? settings.lastDocUrl : url,
        fontSize: settings.fontSize,
        speed: settings.speed,
        mirror: settings.mirror,
      });
    } catch (err: any) {
      Alert.alert("Could not load doc", err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={gradients.appBg} style={styles.flex}>
      <View pointerEvents="none" style={[styles.glow, styles.glowTop]} />
      <View pointerEvents="none" style={[styles.glow, styles.glowBottom]} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.eyebrow}>TELEPROMPTER</Text>
            <Text style={styles.title}>CueLine</Text>
            <Text style={styles.subtitle}>
              Paste a Google Docs link. Set sharing to{" "}
              <Text style={styles.subtitleEm}>“Anyone with the link”</Text> so
              the app can read it.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Google Docs URL</Text>
            <View style={styles.inputWrap}>
              <TextInput
                accessibilityLabel="Google Docs URL"
                style={[styles.input, styles.inputWithClear]}
                value={url}
                onChangeText={setUrl}
                placeholder="https://docs.google.com/document/d/..."
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={() => handleStart(false)}
              />
              {url.length > 0 && (
                <Pressable
                  onPress={() => setUrl("")}
                  style={styles.clearBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear URL"
                  hitSlop={8}
                >
                  <Text style={styles.clearBtnText}>✕</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Font size</Text>
              <Text style={styles.valueText}>{settings.fontSize}pt</Text>
            </View>
            <View style={styles.btnRow}>
              <SmallBtn
                label="A−"
                onPress={() =>
                  update({ fontSize: Math.max(16, settings.fontSize - 4) })
                }
              />
              <SmallBtn
                label="A+"
                onPress={() =>
                  update({ fontSize: Math.min(120, settings.fontSize + 4) })
                }
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.label}>Scroll speed</Text>
              <Text style={styles.valueText}>{settings.speed} px/s</Text>
            </View>
            <View style={styles.btnRow}>
              <SmallBtn
                label="−"
                onPress={() =>
                  update({ speed: Math.max(10, settings.speed - 10) })
                }
              />
              <SmallBtn
                label="+"
                onPress={() =>
                  update({ speed: Math.min(400, settings.speed + 10) })
                }
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Mirror text</Text>
                <Text style={styles.helpInline}>
                  For reflective teleprompter rigs
                </Text>
              </View>
              <Switch
                value={settings.mirror}
                onValueChange={(v) => update({ mirror: v })}
                trackColor={{ false: "#3a3358", true: colors.accent }}
                thumbColor="#fff"
                ios_backgroundColor="#3a3358"
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load doc and start teleprompter"
            onPress={() => handleStart(false)}
            disabled={loading || !url.trim()}
            style={({ pressed }) => [
              styles.primaryWrap,
              (loading || !url.trim()) && styles.btnDisabled,
              pressed && styles.btnPressed,
            ]}
          >
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Load & Start</Text>
              )}
            </LinearGradient>
          </Pressable>

          {settings.lastDocText ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use last loaded document"
              onPress={() => handleStart(true)}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.btnPressed,
              ]}
            >
              <Text style={styles.secondaryBtnText}>
                Use last loaded doc
                <Text style={styles.secondaryBtnTextDim}>
                  {"  "}· {settings.lastDocText.length.toLocaleString()} chars
                </Text>
              </Text>
            </Pressable>
          ) : null}

          <Text style={styles.help}>
            Tip: In Google Docs → Share → General access → “Anyone with the
            link” → Viewer.
          </Text>
          <Text style={styles.buildVersion}>Build: {BUILD_VERSION}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function SmallBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.smallBtn, pressed && styles.btnPressed]}
    >
      <Text style={styles.smallBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 200,
  },
  glowTop: {
    top: -120,
    right: -80,
    backgroundColor: colors.accent,
    opacity: 0.35,
  },
  glowBottom: {
    bottom: -160,
    left: -100,
    backgroundColor: colors.accent2,
    opacity: 0.18,
  },
  header: { gap: 6, marginTop: 8 },
  eyebrow: {
    color: colors.accentSoft,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  subtitleEm: { color: colors.text, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  label: { color: colors.text, fontSize: 15, fontWeight: "600" },
  valueText: {
    color: colors.accentSoft,
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  helpInline: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: "rgba(0,0,0,0.35)",
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  inputWithClear: {
    paddingRight: 40,
  },
  clearBtn: {
    position: "absolute",
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  btnRow: { flexDirection: "row", gap: 8 },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  smallBtn: {
    flex: 1,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtnText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  primaryWrap: {
    marginTop: 6,
    borderRadius: 14,
    shadowColor: colors.accent,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryBtn: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  secondaryBtnTextDim: { color: colors.textMuted, fontWeight: "400" },
  btnDisabled: { opacity: 0.45 },
  btnPressed: { opacity: 0.75 },
  help: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  buildVersion: {
    color: "#ffffff",
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
});
