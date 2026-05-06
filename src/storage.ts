import AsyncStorage from "@react-native-async-storage/async-storage";

export type Settings = {
  fontSize: number;
  speed: number; // pixels per second
  mirror: boolean;
  lastDocUrl: string;
  lastDocText: string;
};

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 48,
  speed: 60,
  mirror: false,
  lastDocUrl: "",
  lastDocText: "",
};

const KEY = "mytelePrompter.settings.v1";

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}
