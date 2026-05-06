// Centralized theme tokens for CueLine.
export const colors = {
  bgTop: "#0f0a23",
  bgMid: "#0a0a1f",
  bgBottom: "#000000",
  surface: "rgba(255,255,255,0.04)",
  surfaceStrong: "rgba(255,255,255,0.08)",
  border: "rgba(255,255,255,0.10)",
  borderStrong: "rgba(255,255,255,0.18)",
  text: "#f5f3ff",
  textDim: "#a8a4c7",
  textMuted: "#6b6890",
  accent: "#7c5cff",
  accentSoft: "#a78bfa",
  accent2: "#22d3ee",
  live: "#f43f5e",
  liveSoft: "#fb7185",
};

export const gradients = {
  appBg: [colors.bgTop, colors.bgMid, colors.bgBottom] as const,
  primary: ["#8b5cf6", "#6d28d9"] as const,
  live: ["#f43f5e", "#be123c"] as const,
};
