// ─── Widget Styles ───────────────────────────────────────────────────────────
// Dark-only design matching the main gyoza website (warm oklch palette)

export const WIDGET_STYLES = `
  :host {
    /* Brand */
    --g-brand-400: oklch(0.72 0.17 74);
    --g-brand-500: oklch(0.66 0.18 72);
    --g-brand-600: oklch(0.58 0.16 70);

    /* Surfaces */
    --g-surface-0: oklch(0.13 0.015 50);
    --g-surface-1: oklch(0.16 0.012 48);
    --g-surface-2: oklch(0.2 0.01 46);
    --g-surface-3: oklch(0.25 0.008 44);
    --g-surface-border: oklch(0.3 0.01 50);

    /* Text */
    --g-text-primary: oklch(0.93 0.005 80);
    --g-text-secondary: oklch(0.65 0.01 70);
    --g-text-muted: oklch(0.5 0.008 65);

    /* Semantic */
    --g-error: oklch(0.63 0.24 25);
    --g-error-bg: oklch(0.18 0.03 25);
  }

  * { box-sizing: border-box; }

  /* ─── Scrollbar ─────────────────────────────────────────── */

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: var(--g-surface-border);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: var(--g-surface-3);
  }

  /* ─── Bubble ────────────────────────────────────────────── */

  .gyozai-bubble {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1px solid var(--g-surface-border);
    background: var(--g-surface-1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    box-shadow:
      0 4px 24px rgba(0, 0, 0, 0.35),
      0 0 0 0 oklch(0.66 0.18 72 / 0);
    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  }
  .gyozai-bubble:hover {
    transform: scale(1.1);
    box-shadow:
      0 6px 28px rgba(0, 0, 0, 0.4),
      0 0 0 3px oklch(0.66 0.18 72 / 0.2);
    border-color: var(--g-brand-500);
  }

  /* ─── Panel ─────────────────────────────────────────────── */

  .gyozai-panel {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 380px;
    max-height: 520px;
    height: fit-content;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding-top: 12px;
    z-index: 2147483647;
    font-family: 'Satoshi', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    background: transparent;
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    border: none;
    color: var(--g-text-primary);
    will-change: transform, opacity;
  }

  .gyozai-panel-open {
    animation: gyozai-panel-in 0.2s ease-out;
  }

  @keyframes gyozai-panel-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ─── Resize Handle ──────────────────────────────────────── */

  .gyozai-resize-handle {
    position: absolute;
    top: 0;
    right: 0;
    width: 24px;
    height: 24px;
    cursor: nwse-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
    opacity: 0.5;
    transition: opacity 0.2s ease, color 0.2s ease, background 0.2s ease;
    color: var(--g-text-secondary);
    border-radius: 0 16px 0 8px;
  }

  .gyozai-resize-handle svg {
    pointer-events: none;
  }

  .gyozai-resize-handle:hover {
    opacity: 1;
    color: var(--g-brand-500);
    background: oklch(0.66 0.18 72 / 0.08);
  }

  .gyozai-resize-handle-active {
    opacity: 1;
    color: var(--g-brand-500);
  }
  .gyozai-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    color: var(--g-text-muted);
    transition: all 0.2s ease;
  }
  .gyozai-icon-btn:hover {
    color: var(--g-brand-500);
    background: oklch(0.66 0.18 72 / 0.08);
  }
  .gyozai-icon-btn-active {
    color: var(--g-brand-500);
    background: oklch(0.66 0.18 72 / 0.1);
  }

  /* ─── Messages ──────────────────────────────────────────── */

  .gyozai-messages {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
  }

  .gyozai-empty {
    text-align: center;
    padding: 24px 16px;
    font-size: 13px;
    color: #fff;
    line-height: 1.5;
    background: oklch(0.25 0.02 50);
    border-radius: 12px;
  }

  .gyozai-msg {
    padding: 10px 14px;
    border-radius: 14px;
    font-size: 13px;
    max-width: 85%;
    word-break: break-word;
    line-height: 1.5;
    position: relative;
    animation: gyozai-msg-in 0.25s ease-out;
    backdrop-filter: blur(8px);
  }

  @keyframes gyozai-msg-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .gyozai-msg-user {
    align-self: flex-end;
    background: linear-gradient(135deg, oklch(0.66 0.18 72 / 0.85), oklch(0.58 0.16 70 / 0.85));
    color: #fff;
    border-radius: 14px 14px 4px 14px;
    box-shadow: 0 2px 8px oklch(0.66 0.18 72 / 0.2);
  }
  .gyozai-msg-user::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: -6px;
    border-width: 6px 0 0 6px;
    border-style: solid;
    border-color: oklch(0.58 0.16 70 / 0.85) transparent transparent transparent;
  }

  .gyozai-msg-assistant {
    align-self: flex-start;
    background: oklch(0.2 0.01 46 / 0.85);
    color: var(--g-text-primary);
    border-radius: 14px 14px 14px 4px;
    border: 1px solid oklch(0.3 0.01 50 / 0.5);
  }
  .gyozai-msg-assistant::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: -6px;
    border-width: 6px 6px 0 0;
    border-style: solid;
    border-color: oklch(0.2 0.01 46 / 0.85) transparent transparent transparent;
  }

  /* ─── Tool Status Messages ────────────────────────────────── */

  .gyozai-msg-status {
    align-self: flex-start;
    background: oklch(0.18 0.015 50 / 0.9);
    color: oklch(0.6 0.02 50);
    border: none;
    border-left: 2px solid oklch(0.55 0.15 60 / 0.7);
    border-radius: 4px;
    font-size: 11px;
    font-style: italic;
    padding: 5px 10px;
    max-width: 90%;
  }
  .gyozai-msg-status::after {
    display: none;
  }

  /* ─── Typing Indicator ──────────────────────────────────── */

  .gyozai-typing {
    display: flex;
    gap: 5px;
    padding: 4px 0;
  }
  .gyozai-typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--g-brand-500);
    opacity: 0.6;
    animation: gyozai-bounce 1.4s infinite ease-in-out both;
  }
  .gyozai-typing span:nth-child(1) { animation-delay: -0.32s; }
  .gyozai-typing span:nth-child(2) { animation-delay: -0.16s; }

  @keyframes gyozai-bounce {
    0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* ─── Input ─────────────────────────────────────────────── */

  .gyozai-input-row {
    display: flex;
    flex-direction: column;
    padding: 8px;
    gap: 4px;
    background: oklch(0.13 0.015 50 / 0.85);
    border-radius: 12px;
    backdrop-filter: blur(8px);
    border: 1px solid oklch(0.3 0.01 50 / 0.5);
    margin: 4px 0;
  }
  .gyozai-input-inner {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  /* ─── Image preview strip ──────────────────────────────── */
  .gyozai-image-preview-row {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding: 2px 0;
  }
  .gyozai-preview-thumb {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .gyozai-preview-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .gyozai-preview-remove {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: oklch(0.55 0.2 25);
    color: #fff;
    font-size: 11px;
    line-height: 16px;
    text-align: center;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .gyozai-preview-remove:hover {
    background: oklch(0.48 0.22 25);
  }

  /* ─── Upload button ────────────────────────────────────── */
  .gyozai-upload-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }

  /* ─── Message images ───────────────────────────────────── */
  .gyozai-msg-images {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 6px;
  }
  .gyozai-msg-image {
    max-width: 100%;
    max-height: 160px;
    border-radius: 8px;
    cursor: pointer;
    display: block;
  }
  .gyozai-msg-image:hover {
    opacity: 0.85;
  }
  .gyozai-msg-image-placeholder {
    color: var(--g-text-muted);
    font-size: 11px;
    font-style: italic;
    margin-bottom: 4px;
  }

  .gyozai-input {
    flex: 1;
    border-radius: 10px;
    outline: none;
    font-size: 13px;
    font-family: inherit;
    padding: 9px 12px;
    border: 1px solid var(--g-surface-border);
    color: var(--g-text-primary);
    background: var(--g-surface-0);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .gyozai-input:focus {
    border-color: var(--g-brand-500);
    box-shadow: 0 0 0 3px oklch(0.66 0.18 72 / 0.1);
  }
  .gyozai-input:disabled { opacity: 0.5; }
  .gyozai-input::placeholder { color: var(--g-text-muted); }

  .gyozai-send-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: linear-gradient(135deg, var(--g-brand-500), var(--g-brand-600));
    color: #fff;
    cursor: pointer;
    padding: 9px;
    border-radius: 10px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px oklch(0.66 0.18 72 / 0.25);
  }
  .gyozai-send-btn:hover {
    box-shadow: 0 4px 12px oklch(0.66 0.18 72 / 0.4);
    transform: translateY(-1px);
  }
  .gyozai-send-btn:disabled {
    opacity: 0.35;
    cursor: default;
    transform: none;
    box-shadow: none;
  }
  .gyozai-stop-btn {
    background: linear-gradient(135deg, oklch(0.55 0.2 25), oklch(0.48 0.22 25)) !important;
    box-shadow: 0 2px 8px oklch(0.5 0.2 25 / 0.3) !important;
  }
  .gyozai-stop-btn:hover {
    box-shadow: 0 4px 12px oklch(0.5 0.2 25 / 0.5) !important;
  }

  /* ─── Error ─────────────────────────────────────────────── */

  .gyozai-error {
    padding: 8px 14px;
    font-size: 12px;
    color: oklch(0.72 0.2 25);
    background: var(--g-error-bg);
    border-top: 1px solid oklch(0.25 0.04 25);
  }

  /* ─── Clarify ───────────────────────────────────────────── */

  .gyozai-clarify {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 8px 14px;
    border-top: 1px solid var(--g-surface-border);
    animation: gyozai-fade-in 0.2s ease-out;
  }

  .gyozai-clarify-btn {
    padding: 6px 14px;
    font-size: 12px;
    font-family: inherit;
    border: 1px solid oklch(0.66 0.18 72 / 0.35);
    border-radius: 20px;
    color: var(--g-brand-400);
    background: oklch(0.2 0.03 72 / 0.95);
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .gyozai-clarify-btn:hover {
    background: linear-gradient(135deg, var(--g-brand-500), var(--g-brand-600));
    border-color: var(--g-brand-500);
    color: #fff;
    box-shadow: 0 2px 8px oklch(0.66 0.18 72 / 0.25);
  }

  /* ─── Confirmation (safeguard) ───────────────────────────── */

  .gyozai-confirm-text {
    font-size: 12px;
    color: oklch(0.75 0.12 72);
    font-weight: 500;
    width: 100%;
  }

  /* ─── Status Pill ───────────────────────────────────────── */

  .gyozai-status-pill {
    display: inline-block;
    padding: 5px 14px;
    font-size: 12px;
    font-weight: 500;
    color: var(--g-text-secondary);
    background: oklch(0.18 0.015 50 / 0.9);
    border: 1px solid oklch(0.3 0.01 50 / 0.5);
    border-radius: 20px;
    backdrop-filter: blur(8px);
    white-space: nowrap;
    animation: gyozai-fade-in 0.3s ease-out;
  }

  /* ─── Toast ─────────────────────────────────────────────── */

  .gyozai-toast {
    padding: 8px 14px;
    font-size: 12px;
    color: var(--g-brand-400);
    text-align: center;
    background: var(--g-surface-1);
    border-top: 1px solid var(--g-surface-border);
    animation: gyozai-fade-in 0.3s ease-out;
  }

  .gyozai-floating-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 500;
    color: #E8950A;
    text-align: center;
    background: #1a1a2e;
    border: 1px solid #2a2a3a;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 2147483647;
    animation: gyozai-fade-in 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  @keyframes gyozai-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ─── History ───────────────────────────────────────────── */

  .gyozai-history-item {
    display: flex;
    align-items: center;
    gap: 4px;
    border-radius: 10px;
    background: oklch(0.16 0.012 48 / 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid oklch(0.3 0.01 50 / 0.5);
    transition: background 0.2s ease;
  }
  .gyozai-history-item:hover {
    background: oklch(0.2 0.015 50 / 0.95);
    border-color: oklch(0.35 0.01 50 / 0.6);
  }
  .gyozai-history-item-active {
    background: oklch(0.22 0.03 72 / 0.95);
    border: 1px solid oklch(0.66 0.18 72 / 0.3);
  }

  .gyozai-history-item-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 10px 12px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    min-width: 0;
  }

  .gyozai-history-title {
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--g-text-primary);
  }

  .gyozai-history-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    color: var(--g-text-muted);
  }

  .gyozai-history-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    opacity: 0;
    transition: all 0.2s ease;
    color: var(--g-text-muted);
    flex-shrink: 0;
  }
  .gyozai-history-item:hover .gyozai-history-delete {
    opacity: 0.5;
  }
  .gyozai-history-delete:hover {
    opacity: 1 !important;
    color: oklch(0.65 0.22 25);
    background: oklch(0.63 0.24 25 / 0.1);
  }

  /* ─── Avatar Talking Animation ───────────────────────────── */

  .gyozai-avatar-talking {
    animation: gyozai-avatar-pulse 1.5s ease-in-out infinite;
  }

  @keyframes gyozai-avatar-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }

  /* ─── Speech Bubble (out-of-proximity) ─────────────────── */

  .gyozai-speech-bubble {
    max-width: 280px;
    width: max-content;
    position: relative;
    margin-bottom: 8px;
  }

  .gyozai-speech-content {
    padding: 10px 14px;
    border-radius: 14px 14px 14px 4px;
    background: oklch(0.16 0.012 48 / 0.92);
    border: 1px solid var(--g-surface-border);
    color: var(--g-text-primary);
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    max-height: 120px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 5;
    -webkit-box-orient: vertical;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  }

  /* Tail pointing down toward avatar */
  .gyozai-speech-content::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px 6px 0 6px;
    border-style: solid;
    border-color: oklch(0.16 0.012 48 / 0.92) transparent transparent transparent;
  }

  .gyozai-speech-enter {
    animation: gyozai-speech-in 0.3s ease-out;
  }

  .gyozai-speech-exit {
    animation: gyozai-speech-out 0.3s ease-in forwards;
  }

  @keyframes gyozai-speech-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes gyozai-speech-out {
    from { opacity: 1; transform: translateY(0); }
    to { opacity: 0; transform: translateY(-8px); }
  }

  .gyozai-speech-thinking {
    color: var(--g-text-muted);
    font-style: italic;
  }

  .gyozai-thinking-dots span {
    animation: gyozai-dot-pulse 1.4s infinite ease-in-out;
  }
  .gyozai-thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
  .gyozai-thinking-dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes gyozai-dot-pulse {
    0%, 80%, 100% { opacity: 0.3; }
    40% { opacity: 1; }
  }
`;
