import type { CSSProperties } from "react";

const COLORS = {
  primary: "#E8950A",
  primaryHover: "#D18600",
  bg: "#ffffff",
  bgHover: "#f9f9f9",
  border: "#e5e5e5",
  text: "#1a1a2e",
  textMuted: "#6b7280",
  shadow: "0 4px 24px rgba(0,0,0,0.12)",
  shadowSm: "0 2px 8px rgba(0,0,0,0.08)",
};

export const styles = {
  // ─── Bubble ─────────────────────────────────────────────
  bubble: {
    position: "fixed",
    width: 52,
    height: 52,
    borderRadius: "50%",
    backgroundColor: COLORS.primary,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: COLORS.shadow,
    zIndex: 9999,
    transition: "transform 0.15s ease",
  } as CSSProperties,

  bubbleHover: {
    transform: "scale(1.08)",
  } as CSSProperties,

  bubbleIcon: {
    width: 28,
    height: 28,
    filter: "brightness(0) invert(1)",
  } as CSSProperties,

  // ─── Panel (shared by Bubble expanded + SearchBar dropdown) ────
  panel: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    boxShadow: COLORS.shadow,
    border: `1px solid ${COLORS.border}`,
    overflow: "hidden",
    width: 360,
    maxHeight: 480,
    display: "flex",
    flexDirection: "column",
    zIndex: 9999,
  } as CSSProperties,

  bubblePanel: {
    position: "fixed",
    marginBottom: 8,
  } as CSSProperties,

  dropdownPanel: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    marginTop: 4,
  } as CSSProperties,

  // ─── Input ──────────────────────────────────────────────
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    padding: "8px 12px",
    borderBottom: `1px solid ${COLORS.border}`,
    gap: 8,
  } as CSSProperties,

  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 14,
    fontFamily: "inherit",
    color: COLORS.text,
    backgroundColor: "transparent",
    padding: "4px 0",
  } as CSSProperties,

  // ─── SearchBar input (standalone) ───────────────────────
  searchBarInput: {
    width: "100%",
    padding: "10px 14px",
    fontSize: 14,
    fontFamily: "inherit",
    color: COLORS.text,
    backgroundColor: COLORS.bg,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 8,
    outline: "none",
    transition: "border-color 0.15s ease",
  } as CSSProperties,

  searchBarInputFocus: {
    borderColor: COLORS.primary,
  } as CSSProperties,

  // ─── Messages / Results ─────────────────────────────────
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } as CSSProperties,

  messageUser: {
    alignSelf: "flex-end",
    backgroundColor: COLORS.primary,
    color: "#fff",
    padding: "8px 12px",
    borderRadius: "12px 12px 4px 12px",
    fontSize: 13,
    maxWidth: "80%",
    wordBreak: "break-word",
  } as CSSProperties,

  messageAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#f3f4f6",
    color: COLORS.text,
    padding: "8px 12px",
    borderRadius: "12px 12px 12px 4px",
    fontSize: 13,
    maxWidth: "80%",
    wordBreak: "break-word",
  } as CSSProperties,

  // ─── Clarify Options ────────────────────────────────────
  clarifyWrapper: {
    padding: "8px 12px",
    borderTop: `1px solid ${COLORS.border}`,
  } as CSSProperties,

  clarifyMessage: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 8,
  } as CSSProperties,

  clarifyOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  } as CSSProperties,

  clarifyOption: {
    padding: "8px 12px",
    borderRadius: 8,
    border: `1px solid ${COLORS.border}`,
    backgroundColor: COLORS.bg,
    cursor: "pointer",
    fontSize: 13,
    color: COLORS.text,
    textAlign: "left" as const,
    transition: "background-color 0.1s ease",
  } as CSSProperties,

  clarifyOptionHover: {
    backgroundColor: COLORS.bgHover,
  } as CSSProperties,

  // ─── Loading ────────────────────────────────────────────
  spinner: {
    width: 16,
    height: 16,
    border: `2px solid ${COLORS.border}`,
    borderTopColor: COLORS.primary,
    borderRadius: "50%",
    animation: "gyozai-spin 0.6s linear infinite",
  } as CSSProperties,

  // ─── Error ──────────────────────────────────────────────
  error: {
    padding: "8px 12px",
    fontSize: 12,
    color: "#dc2626",
    backgroundColor: "#fef2f2",
    borderTop: `1px solid #fecaca`,
  } as CSSProperties,

  // ─── Overlay (for SearchBar) ────────────────────────────
  overlay: {
    position: "relative",
    width: "100%",
  } as CSSProperties,
} as const;

// Keyframe animation injected once
export const SPINNER_KEYFRAMES = `
@keyframes gyozai-spin {
  to { transform: rotate(360deg); }
}
`;
