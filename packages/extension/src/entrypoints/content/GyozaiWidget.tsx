import React, {
  useState,
  useReducer,
  useRef,
  useEffect,
  useCallback,
} from "react";
import type { ExtensionSettings } from "../../lib/storage";
import { Avatar, AVATAR_SIZES } from "./components/Avatar";
import { SpeechBubble } from "./components/SpeechBubble";
import {
  type Expression,
  DEFAULT_EXPRESSION,
  EXPRESSIONS,
} from "../../lib/expressions";

import { TypewriterText } from "./components/TypewriterText";
import { useProximity } from "./hooks/useProximity";
import {
  capturePageContext,
  formatPageContext,
  captureCleanHtml,
} from "@gyoz-ai/engine";
import type { SnapshotType } from "@gyoz-ai/engine";
import type { Conversation, ConversationSummary } from "../../lib/storage";
import type { WidgetSession } from "../../lib/session";
import { saveImages, getImages } from "../../lib/image-store";
import {
  compressImage,
  imageFromClipboard,
  blobToDataUrl,
  MAX_IMAGES_PER_MESSAGE,
} from "../../lib/image-utils";
import {
  type LocaleCode,
  detectBrowserLocale,
  resolveLocale,
  getTranslations,
  t,
} from "../../lib/i18n";
import { FormatMessage } from "./components/FormatMessage";
import type {
  Message,
  ClarifyState,
  AgentResult,
  ViewMode,
  StreamEventMessage,
} from "./types";
import {
  mapExtraRequests,
  sanitizeError,
  savePendingNav,
  loadAndClearPendingNav,
  getTabId,
  loadConversationIndex,
  loadConversation,
  persistConversation,
  removeConversation,
} from "./helpers";

// These are set by index.tsx at module scope and shared with this component.
// They must be set before GyozaiWidget mounts.
export let _preloadedTabId: number | null = null;
export let _preloadedLocale: LocaleCode | null = null;
export let _preloadedSession: WidgetSession | null = null;
export let _preloadedAvatarPosition: { x: number; y: number } | null = null;
export let _preloadedExpression: string | null = null;
export let _preloadedChatScale: number | null = null;
export let _preloadedChatFullscreen: boolean | null = null;
export let _preloadReady: Promise<void> = Promise.resolve();

export function setPreloadState(state: {
  tabId: number | null;
  locale: LocaleCode | null;
  session: WidgetSession | null;
  avatarPosition?: { x: number; y: number } | null;
  expression?: string | null;
  chatScale?: number | null;
  chatFullscreen?: boolean | null;
  ready: Promise<void>;
}) {
  _preloadedTabId = state.tabId;
  _preloadedLocale = state.locale;
  _preloadedSession = state.session;
  if (state.avatarPosition !== undefined)
    _preloadedAvatarPosition = state.avatarPosition;
  if (state.expression !== undefined) _preloadedExpression = state.expression;
  if (state.chatScale !== undefined) _preloadedChatScale = state.chatScale;
  if (state.chatFullscreen !== undefined)
    _preloadedChatFullscreen = state.chatFullscreen;
  _preloadReady = state.ready;
}

// Module-level state shared with the query logic
let pendingSnapshotTypes: SnapshotType[] | null = null;
let pendingExtraContext: string | null = null;
let autoFollowUpUsed = false;
let queryCounter = 0;

const S = {
  brand: "color: #E8950A; font-weight: bold",
  req: "color: #3b82f6; font-weight: bold",
  res: "color: #22c55e; font-weight: bold",
  action: "color: #a855f7; font-weight: bold",
  err: "color: #ef4444; font-weight: bold",
  dim: "color: #9ca3af",
};

function log(...args: unknown[]) {
  console.log("%c[gyoza]", S.brand, ...args);
}

function saveSessionViaBackground(tabId: number, session: WidgetSession): void {
  browser.runtime
    .sendMessage({ type: "gyozai_save_session", tabId, session })
    .catch(() => {});
}

/** Renders images/files for a user message by resolving imageIds from IndexedDB. */
function MessageImages({
  imageIds,
  cache,
}: {
  imageIds: string[];
  cache: React.RefObject<
    Map<string, { dataUrl: string; filename?: string; kind?: "image" | "file" }>
  >;
}) {
  const [entries, setEntries] = useState<
    Map<string, { dataUrl: string; filename?: string; kind?: "image" | "file" }>
  >(new Map());

  useEffect(() => {
    let cancelled = false;
    // Use cached entries where available, fetch the rest from IndexedDB
    const cached = new Map<
      string,
      { dataUrl: string; filename?: string; kind?: "image" | "file" }
    >();
    const missing: string[] = [];
    for (const id of imageIds) {
      const entry = cache.current.get(id);
      if (entry) cached.set(id, entry);
      else missing.push(id);
    }

    if (missing.length === 0) {
      setEntries(cached);
      return;
    }

    getImages(missing).then((results) => {
      if (cancelled) return;
      const merged = new Map(cached);
      for (const r of results) {
        const resolved = {
          dataUrl: r.dataUrl,
          filename: r.filename,
          kind: r.kind,
        };
        merged.set(r.id, resolved);
        cache.current.set(r.id, resolved);
      }
      setEntries(merged);
    });

    return () => {
      cancelled = true;
    };
  }, [imageIds, cache]);

  if (entries.size === 0 && imageIds.length > 0) {
    return (
      <div className="gyozai-msg-image-placeholder">Loading attachments...</div>
    );
  }

  return (
    <div className="gyozai-msg-images">
      {imageIds.map((id) => {
        const entry = entries.get(id);
        if (!entry) return null;
        if (entry.kind === "file") {
          return (
            <div key={id} className="gyozai-msg-file-frame">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span className="gyozai-file-name">
                {entry.filename || "file"}
              </span>
            </div>
          );
        }
        return (
          <div key={id} className="gyozai-msg-image-frame">
            <img
              src={entry.dataUrl}
              alt="Attached image"
              className="gyozai-msg-image"
            />
          </div>
        );
      })}
    </div>
  );
}

export function GyozaiWidget() {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<ClarifyState | null>(null);
  const [confirmation, setConfirmation] = useState<{
    description: string;
    onConfirm: () => void;
    onDeny: () => void;
  } | null>(null);
  const activePortRef = useRef<ReturnType<
    typeof browser.runtime.connect
  > | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Use preloaded locale if available, else detect from browser
  const [locale, setLocale] = useState<LocaleCode>(
    _preloadedLocale ?? detectBrowserLocale(),
  );
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [historyList, setHistoryList] = useState<ConversationSummary[]>([]);
  const [agentSize, setAgentSize] =
    useState<ExtensionSettings["agentSize"]>("medium");
  const [typingAnimation, setTypingAnimation] = useState(true);
  const [typingSound, setTypingSound] = useState(true);
  const [bubbleOpacity, setBubbleOpacity] = useState(0.85);
  const [stickyChat, setStickyChat] = useState(false);
  const stickyChatRef = useRef(false);
  const [chatScale, setChatScale] = useState(_preloadedChatScale ?? 1);
  const [isResizing, setIsResizing] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(
    _preloadedChatFullscreen ?? false,
  );
  const chatFullscreenRef = useRef(_preloadedChatFullscreen ?? false);
  const resizeStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startScale: number;
  } | null>(null);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [isTypewriting, setIsTypewriting] = useState(false);
  const [expression, setExpression] = useState<Expression>(() => {
    // Session expression > preloaded local storage > default
    const saved = _preloadedSession?.expression ?? _preloadedExpression ?? null;
    return saved && EXPRESSIONS.includes(saved as Expression)
      ? (saved as Expression)
      : DEFAULT_EXPRESSION;
  });
  // Track which message IDs have been animated — prevents
  // re-playing typewriter when toggling chatbox open/closed or leaving proximity.
  const animatedMsgIdsRef = useRef<Set<string>>(new Set());
  const [avatarPosition, setAvatarPosition] = useState<{
    x: number;
    y: number;
  } | null>(_preloadedAvatarPosition);
  // Bumped when the avatar's rendered position changes so the status
  // pill / speech bubble re-reads the avatar bounding rect.
  const [, bumpAvatarPosTick] = useReducer((c: number) => c + 1, 0);
  // Tracks whether session has been restored — prevents the save effect
  // from immediately overwriting the stored session with empty defaults.
  const sessionRestoredRef = useRef(false);

  // Active conversation tracking — null means fresh/new conversation
  const activeConvIdRef = useRef<string | null>(null);
  // Tracks the last user-submitted query text for legacy navigation path
  const lastUserQueryRef = useRef<string>("");
  // Streaming: tracks the current query's ID to correlate streaming events
  const currentQueryIdRef = useRef<string | null>(null);
  const latestLlmHistoryRef = useRef<Array<{ role: string; content: string }>>(
    [],
  );
  const tabIdRef = useRef<number | null>(null);
  const resumingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pending attachments (images, PDFs, text files) waiting to be sent with the next message
  interface PendingAttachment {
    id: string;
    dataUrl: string;
    blob: Blob;
    mimeType: string;
    /** Original filename for file attachments (PDF, TXT). */
    filename?: string;
    /** 'image' for images, 'file' for PDF/TXT. */
    kind: "image" | "file";
  }
  const [pendingImages, setPendingImages] = useState<PendingAttachment[]>([]);

  // Cache of resolved attachment data for rendered messages
  const imageCache = useRef<
    Map<string, { dataUrl: string; filename?: string; kind?: "image" | "file" }>
  >(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollTopRef = useRef<number | null>(null);
  const scrollRestoredRef = useRef(false);
  const lastKnownScrollTopRef = useRef(0);
  const avatarWrapperRef = useRef<HTMLDivElement>(null);

  // Restore scroll position after session restore + messages render
  const [scrollReady, setScrollReady] = useState(false);
  useEffect(() => {
    if (
      !scrollRestoredRef.current &&
      savedScrollTopRef.current !== null &&
      messagesContainerRef.current &&
      messages.length > 0
    ) {
      const saved = savedScrollTopRef.current;
      scrollRestoredRef.current = true;
      savedScrollTopRef.current = null;
      log("Restoring scroll to", saved);
      const container = messagesContainerRef.current;
      container.scrollTop = saved;
      requestAnimationFrame(() => {
        container.scrollTop = saved;
      });
    }
  }, [messages, scrollReady]);

  // Restore scroll position after SPA reattachment (host detach/reattach)
  useEffect(() => {
    const onReattach = () => {
      const container = messagesContainerRef.current;
      const saved = lastKnownScrollTopRef.current;
      if (container && saved > 0) {
        log("Restoring scroll after reattach to", saved);
        requestAnimationFrame(() => {
          container.scrollTop = saved;
          requestAnimationFrame(() => {
            container.scrollTop = saved;
          });
        });
      }
    };
    window.addEventListener("gyozai:reattached", onReattach);
    return () => window.removeEventListener("gyozai:reattached", onReattach);
  }, []);

  // Keep refs in sync so closures always read fresh value
  useEffect(() => {
    stickyChatRef.current = stickyChat;
  }, [stickyChat]);
  useEffect(() => {
    chatFullscreenRef.current = chatFullscreen;
  }, [chatFullscreen]);

  // ─── Resize constants & handlers ──────────────────────────
  const SCALE_MIN = 0.7;
  const SCALE_MAX = 1.5;
  const SCALE_SENSITIVITY = 0.003;
  const isResizingRef = useRef(false);

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeStartRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        startScale: chatScale,
      };
      setIsResizing(true);
      isResizingRef.current = true;

      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;cursor:nwse-resize;";
      const root = (e.target as HTMLElement).getRootNode();
      if (root instanceof ShadowRoot) {
        root.appendChild(overlay);
      } else {
        document.body.appendChild(overlay);
      }

      const onMove = (ev: PointerEvent) => {
        const start = resizeStartRef.current;
        if (!start) return;
        const dx = ev.clientX - start.pointerX;
        const dy = ev.clientY - start.pointerY;
        const diagonalDelta = (dx + dy) / Math.SQRT2;
        const newScale = Math.min(
          SCALE_MAX,
          Math.max(
            SCALE_MIN,
            start.startScale + diagonalDelta * SCALE_SENSITIVITY,
          ),
        );
        setChatScale(newScale);
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        overlay.remove();
        setIsResizing(false);
        isResizingRef.current = false;
        resizeStartRef.current = null;
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [chatScale],
  );

  // Persist scale when resize ends
  const prevResizingRef = useRef(false);
  useEffect(() => {
    if (prevResizingRef.current && !isResizing) {
      const scaleToSave = chatScale;
      browser.runtime
        .sendMessage({ type: "gyozai_get_settings" })
        .then((s: ExtensionSettings) => {
          browser.storage.local
            .set({ gyozai_settings: { ...s, chatScale: scaleToSave } })
            .catch(() => {});
        })
        .catch(() => {});
    }
    prevResizingRef.current = isResizing;
  }, [isResizing, chatScale]);

  // hoverOpen: true = chatbox was opened by proximity (closes on leave)
  // false = chatbox was opened by click (stays open until clicked again)
  const hoverOpenRef = useRef(false);

  // Proximity detection — open chatbox when cursor is near avatar
  const proximityRadius = AVATAR_SIZES[agentSize] * 0.75;
  const panelRef = useRef<HTMLDivElement>(null);
  const speechBubbleRef = useRef<HTMLDivElement>(null);
  const insidePanelRef = useRef(false);
  const dragDropGraceRef = useRef(false);
  const { forceInside, startLeave } = useProximity({
    elementRef: avatarWrapperRef,
    radius: proximityRadius,
    onEnter: () => {
      hoverOpenRef.current = true;
      setExpanded(true);
    },
    onLeave: () => {
      // Don't close if sticky mode is on
      if (stickyChatRef.current || chatFullscreenRef.current) return;
      // Don't close if cursor is still inside the chatbox/input panel
      // or if we just dropped the avatar (grace period)
      if (
        hoverOpenRef.current &&
        !insidePanelRef.current &&
        !dragDropGraceRef.current
      ) {
        setExpanded(false);
      }
    },
    leaveDelay: 50,
  });

  // ─── Restore session from browser.storage.session after preload ───
  useEffect(() => {
    _preloadReady.then(() => {
      log(
        "Session preload resolved — tabId:",
        _preloadedTabId,
        "session:",
        _preloadedSession
          ? `expanded=${_preloadedSession.expanded}, msgs=${_preloadedSession.messages.length}, convId=${_preloadedSession.activeConvId}`
          : "null",
      );
      if (_preloadedSession) {
        setExpanded(_preloadedSession.expanded);
        setInput(_preloadedSession.input);
        setMessages(_preloadedSession.messages);
        // Mark all restored messages as already animated — don't replay on refresh
        for (const m of _preloadedSession.messages) {
          animatedMsgIdsRef.current.add(m.id);
        }
        setViewMode(_preloadedSession.viewMode);
        setAvatarPosition(_preloadedSession.avatarPosition ?? null);
        if (
          _preloadedSession.expression &&
          EXPRESSIONS.includes(_preloadedSession.expression as Expression)
        ) {
          setExpression(_preloadedSession.expression as Expression);
        }
        activeConvIdRef.current = _preloadedSession.activeConvId;
        savedScrollTopRef.current = _preloadedSession.scrollTop ?? null;
        lastKnownScrollTopRef.current = _preloadedSession.scrollTop ?? 0;
        log("Session restored from storage");
      }
      // Mark restored so the save effect can start persisting
      sessionRestoredRef.current = true;
    });
  }, []);

  // ─── Persist widget session on every state change ───
  // Writes IMMEDIATELY (no debounce) to browser.storage.session so the
  // session is always up-to-date before any navigation can kill the page.
  // Keep a ref to the latest session so beforeunload can read it.
  const latestSessionRef = useRef<{
    tabId: number;
    session: WidgetSession;
  } | null>(null);

  useEffect(() => {
    // Don't save until session has been restored (avoids overwriting
    // the stored session with empty defaults on first render).
    if (!sessionRestoredRef.current) return;
    const tabId = tabIdRef.current ?? _preloadedTabId;
    if (tabId == null) return;
    const session: WidgetSession = {
      expanded,
      activeConvId: activeConvIdRef.current,
      messages,
      input,
      viewMode,
      avatarPosition,
      scrollTop: lastKnownScrollTopRef.current,
      expression,
    };
    latestSessionRef.current = { tabId, session };
    // Write immediately via background worker (content scripts can't
    // access browser.storage.session directly).
    browser.runtime
      .sendMessage({ type: "gyozai_save_session", tabId, session })
      .then((r) => {
        if (r?.ok) {
          log(
            "Session saved ✓ — expanded:",
            expanded,
            "msgs:",
            messages.length,
            "convId:",
            activeConvIdRef.current,
          );
        } else {
          log("Session save returned not-ok");
        }
      })
      .catch((err) => log("Session save FAILED:", err));
  }, [expanded, messages, input, viewMode, avatarPosition, expression]);

  // ─── Flush session on page unload (cross-origin nav) ───
  // Uses both direct storage write AND background worker message
  // to maximize the chance the write lands before the page dies.
  useEffect(() => {
    const flush = () => {
      const latest = latestSessionRef.current;
      if (!latest || !sessionRestoredRef.current) return;
      log("Flushing session on page unload/hide");
      // Background worker write — survives page destruction
      saveSessionViaBackground(latest.tabId, latest.session);
    };
    window.addEventListener("beforeunload", flush);
    const onVisChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, []);

  // Save scroll position on every scroll (debounced) so it survives navigation
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      // When the panel is hidden (display:none), the browser resets scrollTop
      // to 0 and fires a scroll event. Ignore these phantom resets so we don't
      // overwrite the real scroll position.
      if (container.offsetParent === null && container.scrollTop === 0) return;
      // Track last known good scroll position (survives host detach/reattach)
      lastKnownScrollTopRef.current = container.scrollTop;
      // Update ref immediately for beforeunload
      if (latestSessionRef.current) {
        latestSessionRef.current.session.scrollTop = container.scrollTop;
      }
      // Debounced save to background (300ms)
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const latest = latestSessionRef.current;
        if (latest && sessionRestoredRef.current) {
          saveSessionViaBackground(latest.tabId, latest.session);
        }
      }, 300);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });

  // Listen for auto-imported recipe notification
  useEffect(() => {
    const handler = (msg: { type: string; filename?: string }) => {
      if (msg.type === "gyozai_recipe_auto_added" && msg.filename) {
        setToast(
          t(getTranslations(locale), "widget_recipe_imported", {
            name: msg.filename,
          }),
        );
        setTimeout(() => setToast(null), 4000);
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  // Listen for recipe install events from gyoz.ai platform
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        name: string;
        content: string;
      };
      if (!detail?.content) return;
      browser.runtime
        .sendMessage({
          type: "gyozai_auto_import_recipe",
          filename: detail.name || "recipe",
          content: detail.content,
        })
        .then((resp) => {
          const label = detail.name || "recipe";
          if (resp?.skipped) {
            setToast(`${label} is already installed`);
          } else {
            setToast(`${label} installed successfully`);
          }
          setTimeout(() => setToast(null), 4000);
        });
    };
    window.addEventListener("gyozai-install-recipe", handler);
    return () => window.removeEventListener("gyozai-install-recipe", handler);
  }, []);

  // Locale is preloaded at module scope; just listen for runtime changes
  useEffect(() => {
    // Apply preloaded settings (may have resolved after initial render)
    _preloadReady.then(() => {
      if (_preloadedLocale) setLocale(_preloadedLocale);
      // Load initial agentSize
      browser.runtime
        .sendMessage({ type: "gyozai_get_settings" })
        .then((s: ExtensionSettings | undefined) => {
          if (s?.agentSize) setAgentSize(s.agentSize);
          if (typeof s?.typingAnimation === "boolean")
            setTypingAnimation(s.typingAnimation);
          if (typeof s?.typingSound === "boolean")
            setTypingSound(s.typingSound);
          if (typeof s?.bubbleOpacity === "number")
            setBubbleOpacity(s.bubbleOpacity);
          if (typeof s?.stickyChat === "boolean") setStickyChat(s.stickyChat);
          if (typeof s?.chatScale === "number") setChatScale(s.chatScale);
          if (typeof s?.chatFullscreen === "boolean")
            setChatFullscreen(s.chatFullscreen);
        })
        .catch(() => {});
    });
    const handler = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      const newSettings = changes.gyozai_settings?.newValue;
      if (typeof newSettings?.language === "string") {
        setLocale(
          newSettings.language === "auto"
            ? detectBrowserLocale()
            : resolveLocale(newSettings.language),
        );
      }
      if (newSettings?.agentSize) {
        setAgentSize(newSettings.agentSize);
      }
      if (typeof newSettings?.typingAnimation === "boolean") {
        setTypingAnimation(newSettings.typingAnimation);
      }
      if (typeof newSettings?.typingSound === "boolean") {
        setTypingSound(newSettings.typingSound);
      }
      if (typeof newSettings?.bubbleOpacity === "number") {
        setBubbleOpacity(newSettings.bubbleOpacity);
      }
      if (typeof newSettings?.stickyChat === "boolean") {
        setStickyChat(newSettings.stickyChat);
      }
      if (typeof newSettings?.chatScale === "number") {
        setChatScale(newSettings.chatScale);
      }
      if (typeof newSettings?.chatFullscreen === "boolean") {
        setChatFullscreen(newSettings.chatFullscreen);
      }
    };
    browser.storage.onChanged.addListener(handler);
    return () => browser.storage.onChanged.removeListener(handler);
  }, []);

  // Resume conversation after navigation (full-page or SPA).
  // Loads pending-nav from storage, restores conversation, captures new page
  // context, and sends a follow-up query to continue the task.
  async function resumeFromPendingNav(tid: number) {
    if (resumingRef.current) return;
    resumingRef.current = true;
    try {
      // Loop: after a navigated SPA result, a NEW pending-nav may be waiting.
      // The SPA check message can't re-enter (resumingRef blocks it),
      // so we must re-check here. For full-page navigations, break —
      // the new content script's mount effect will handle it.
      while (true) {
        const pendingNav = await loadAndClearPendingNav(tid);
        if (!pendingNav) break;

        // Remember the URL before this iteration — used to detect SPA vs full-page nav
        const urlBeforeQuery = window.location.href;

        log(
          "Resuming after navigation — pending-nav state:",
          JSON.stringify(pendingNav),
        );

        // Restore the conversation that was in progress
        activeConvIdRef.current = pendingNav.conversationId;
        const conv = await loadConversation(pendingNav.conversationId);
        if (conv) {
          log(
            "Restored conversation:",
            conv.id,
            "messages:",
            conv.messages.length,
          );
          setMessages(conv.messages);
        }

        setExpanded(true);
        setLoading(true);

        // Show navigate status so user sees what happened
        const displayPath =
          window.location.pathname +
          (window.location.search ? window.location.search : "");
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: getTranslations(locale).status_navigated_to.replace(
              "{path}",
              displayPath,
            ),
            type: "tool-status" as const,
          },
        ]);

        // Small delay to let the new page render fully
        await new Promise((r) => setTimeout(r, 500));

        // Capture the requested snapshots on the NEW page
        const pageCtx = capturePageContext(pendingNav.snapshotTypes);
        const ctxText = formatPageContext(pageCtx);

        if (ctxText) {
          pendingExtraContext = ctxText;
          log("Captured", ctxText.length, "chars from new page");
        }

        // Extract the real original user query — pending-nav queries can nest
        // ("Navigation complete... Original: "Navigation complete... Original: "real query"")
        // so we dig out the innermost one, or fall back to the first user message.
        let realOriginalQuery = pendingNav.originalQuery;
        const innerMatch = pendingNav.originalQuery.match(
          /Original user request: "([^"]+)"/,
        );
        if (innerMatch) {
          // Keep extracting until we get the innermost
          let q = innerMatch[1];
          let next = q.match(/Original user request: "([^"]+)"/);
          while (next) {
            q = next[1];
            next = q.match(/Original user request: "([^"]+)"/);
          }
          realOriginalQuery = q;
        } else if (conv) {
          // Fallback: use the first user message from conversation
          const firstUser = conv.messages.find((m) => m.role === "user");
          if (firstUser) realOriginalQuery = firstUser.content;
        }

        // Persist the original user query so auto-follow-ups have context
        lastUserQueryRef.current = realOriginalQuery;

        const followUpQuery =
          `Navigation complete — now on ${window.location.href}. ` +
          `Continue working on the original request from the conversation history. ` +
          `The current page content is included below — do NOT call get_page_context. ` +
          `Read the page carefully and take the next actions needed. ` +
          `Do NOT navigate away — you were redirected here for a reason. ` +
          `Use click, scroll_to, and other tools to interact with THIS page.`;
        log("Follow-up query:", followUpQuery);

        let navigated = false;
        try {
          autoFollowUpUsed = false;
          const result = await sendQuery(
            followUpQuery,
            pendingExtraContext || undefined,
            { disableNavigate: true },
          );
          pendingExtraContext = null;
          navigated = !!result.navigated;
          await processAgentResult(result);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          setLoading(false);
        }

        // Only loop for SPA navigations (URL changed in-place).
        // For full-page navigations, the URL hasn't changed yet (page is
        // unloading) — break and let the new content script handle it.
        if (!navigated) break;
        if (window.location.href === urlBeforeQuery) break;
      }
    } finally {
      resumingRef.current = false;
    }
  }

  // Get tab ID on mount + check for pending navigation (cross-page resume)
  // Uses preloaded tab ID if already resolved, otherwise waits for it.
  useEffect(() => {
    _preloadReady.then(async () => {
      const tid = _preloadedTabId ?? (await getTabId());
      tabIdRef.current = tid;
      setInitialized(true);

      if (tid == null) return;

      await resumeFromPendingNav(tid);
    });
  }, []);

  // Listen for confirmation requests from background (tool execution safeguards)
  useEffect(() => {
    const confirmHandler = (
      msg: { type: string; description?: string },
      _sender: unknown,
      sendResponse: (response: boolean) => void,
    ) => {
      if (msg.type === "gyozai_confirm_action" && msg.description) {
        setConfirmation({
          description: msg.description,
          onConfirm: () => {
            sendResponse(true);
            setConfirmation(null);
          },
          onDeny: () => {
            sendResponse(false);
            setConfirmation(null);
          },
        });
        return true; // keep sendResponse alive for async
      }
    };
    browser.runtime.onMessage.addListener(confirmHandler);
    return () => browser.runtime.onMessage.removeListener(confirmHandler);
  }, []);

  // Listen for toggle command and SPA navigation resume from background
  useEffect(() => {
    const handler = (msg: { type: string }) => {
      if (msg.type === "gyozai_toggle") {
        log("Toggle shortcut received");
        setExpanded((prev) => {
          if (prev) {
            startNewChat();
            hoverOpenRef.current = false;
            return false;
          }
          // Shortcut-opened — don't let proximity auto-close it
          hoverOpenRef.current = false;
          return true;
        });
      }
      // Background notifies us after a click-triggered SPA navigation
      // saved pending-nav and aborted the stream. Re-check pending-nav
      // since the mount useEffect won't re-fire on SPA navigations.
      if (msg.type === "gyozai_check_pending_nav") {
        log("SPA pending-nav check requested by background");
        const tid = tabIdRef.current;
        if (tid != null) {
          resumeFromPendingNav(tid);
        }
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, []);

  // Auto-focus input when expanded
  useEffect(() => {
    if (expanded && initialized && viewMode === "chat") {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [expanded, initialized, viewMode]);

  // Restore scroll position when panel re-expands (display:none → display:flex
  // resets scrollTop to 0, so we need to restore from lastKnownScrollTopRef)
  useEffect(() => {
    if (!expanded) return;
    const container = messagesContainerRef.current;
    const saved = lastKnownScrollTopRef.current;
    if (container && saved > 0) {
      requestAnimationFrame(() => {
        container.scrollTop = saved;
      });
    }
  }, [expanded]);

  // Safety net: periodically check if cursor is still near panel/avatar
  // Shadow DOM onMouseLeave can miss fast exits — this catches them
  useEffect(() => {
    if (!expanded || !hoverOpenRef.current) return;
    let lastX = 0;
    let lastY = 0;
    const trackMouse = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
    };
    document.addEventListener("mousemove", trackMouse, { passive: true });

    const isInRect = (x: number, y: number, r: DOMRect, margin: number) =>
      x >= r.left - margin &&
      x <= r.right + margin &&
      y >= r.top - margin &&
      y <= r.bottom + margin;

    const interval = setInterval(() => {
      if (stickyChatRef.current || chatFullscreenRef.current) return;
      if (
        !hoverOpenRef.current ||
        !expanded ||
        dragDropGraceRef.current ||
        isResizingRef.current
      )
        return;
      const panel = panelRef.current;
      const avatar = avatarWrapperRef.current;
      const bubble = speechBubbleRef.current;
      if (!panel || !avatar) return;

      const m = 40;
      const inPanel = isInRect(lastX, lastY, panel.getBoundingClientRect(), m);
      const inAvatar = isInRect(
        lastX,
        lastY,
        avatar.getBoundingClientRect(),
        m,
      );
      const inBubble =
        bubble && isInRect(lastX, lastY, bubble.getBoundingClientRect(), m);

      if (!inPanel && !inAvatar && !inBubble) {
        insidePanelRef.current = false;
        hoverOpenRef.current = false;
        setExpanded(false);
      }
    }, 300);

    return () => {
      document.removeEventListener("mousemove", trackMouse);
      clearInterval(interval);
    };
  }, [expanded]);

  // Scroll to bottom only when NEW messages are added (not on restore)
  const lastMsgCountRef = useRef(0);
  useEffect(() => {
    // Skip if scroll was just restored from session
    if (
      scrollRestoredRef.current &&
      messages.length <= lastMsgCountRef.current
    ) {
      lastMsgCountRef.current = messages.length;
      return;
    }
    if (
      messages.length > lastMsgCountRef.current &&
      lastMsgCountRef.current > 0
    ) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 30);
    }
    lastMsgCountRef.current = messages.length;
  }, [messages, loading]);

  // Keep scrolling during typewriter animation
  useEffect(() => {
    if (!isTypewriting) return;
    const interval = setInterval(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => clearInterval(interval);
  }, [isTypewriting]);

  // Helper to add an assistant message
  const addAssistantMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "assistant", content },
    ]);
  }, []);

  // Save current conversation to storage (messages + clarify state)
  const saveCurrentConversation = useCallback(
    async (msgs: Message[], currentClarify: ClarifyState | null) => {
      if (msgs.length === 0) return;

      let convId = activeConvIdRef.current;
      const now = Date.now();

      if (!convId) {
        convId = crypto.randomUUID();
        activeConvIdRef.current = convId;
      }

      const firstUserMsg = msgs.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 80)
        : "New conversation";

      const existing = await loadConversation(convId);

      const conv: Conversation = {
        id: convId,
        title,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        domain: existing?.domain || window.location.host,
        messages: msgs,
        llmHistory:
          existing?.llmHistory && existing.llmHistory.length > 0
            ? existing.llmHistory
            : latestLlmHistoryRef.current,
        pendingClarify: currentClarify,
      };

      await persistConversation(conv);
    },
    [],
  );

  // Auto-save whenever messages or clarify change
  useEffect(() => {
    if (!initialized) return;
    saveCurrentConversation(messages, clarify);
  }, [messages, clarify, initialized, saveCurrentConversation]);

  // Start a fresh chat
  const startNewChat = useCallback(() => {
    activeConvIdRef.current = null;
    setMessages([]);
    setError(null);
    setClarify(null);
    setViewMode("chat");
    log("New chat started");
  }, []);

  // Load a conversation from history
  const loadFromHistory = useCallback(async (id: string) => {
    const conv = await loadConversation(id);
    if (!conv) return;
    activeConvIdRef.current = conv.id;
    setMessages(conv.messages);
    // Mark all loaded messages as already animated — don't replay on history load
    for (const m of conv.messages) {
      animatedMsgIdsRef.current.add(m.id);
    }
    setError(null);
    setClarify(conv.pendingClarify || null);
    setViewMode("chat");
    log("Loaded conversation:", conv.title.slice(0, 40));
  }, []);

  // Open history view
  const openHistory = useCallback(async () => {
    const index = await loadConversationIndex();
    setHistoryList(index);
    setViewMode("history");
  }, []);

  // Delete a conversation from history
  const deleteFromHistory = useCallback(async (id: string) => {
    await removeConversation(id);
    setHistoryList((prev) => prev.filter((c) => c.id !== id));
    // If we deleted the active conversation, reset
    if (activeConvIdRef.current === id) {
      activeConvIdRef.current = null;
      setMessages([]);
    }
  }, []);

  // Send a query to the background worker
  async function sendQuery(
    query: string,
    extraPageContext?: string,
    options?: { disableNavigate?: boolean },
    images?: string[],
    files?: Array<{ dataUrl: string; mimeType: string; filename?: string }>,
  ): Promise<AgentResult> {
    lastUserQueryRef.current = query;
    const currentRoute = window.location.pathname;

    const [recipe, extSettings] = await Promise.all([
      browser.runtime.sendMessage({
        type: "gyozai_get_recipe",
        domain: window.location.host,
      }),
      browser.runtime.sendMessage({ type: "gyozai_get_settings" }),
    ]);

    const manifestMode = !!recipe?.content;

    // Generate a queryId for streaming event correlation
    const queryId = crypto.randomUUID();
    currentQueryIdRef.current = queryId;

    const payload: Record<string, unknown> = {
      type: "gyozai_query",
      queryId,
      query,
      manifestMode,
      recipe: recipe?.content,
      currentRoute,
      conversationId: activeConvIdRef.current,
      context: {
        currentUrl: window.location.href,
        pageTitle: document.title,
        language: navigator.language,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      },
      capabilities: {
        navigate: !options?.disableNavigate && !extSettings?.chatOnly,
        showMessage: true,
        click: !extSettings?.chatOnly,
        highlightUi: true,
        fetch: false,
        clarify: !extSettings?.yoloMode,
      },
    };

    if (extraPageContext) {
      payload.pageContext = extraPageContext;
    }

    if (images && images.length > 0) {
      payload.images = images;
    }

    if (files && files.length > 0) {
      payload.files = files;
    }

    // ─── Log request ───────────────────
    queryCounter++;
    const qn = queryCounter;
    console.group(`%c[gyoza] ━━━ REQUEST #${qn} ━━━`, S.req);
    console.log(
      `%cQuery:%c ${query.slice(0, 120)}${query.length > 120 ? "..." : ""}`,
      S.req,
      "",
    );
    console.log(
      `%cMode:%c ${manifestMode ? "manifest (recipe)" : "no-manifest (raw HTML)"}`,
      S.req,
      "",
    );
    console.log(
      `%cModel:%c ${extSettings?.provider || "?"} / ${extSettings?.model || "?"}`,
      S.req,
      "",
    );
    console.log(`%cRoute:%c ${currentRoute}`, S.req, "");
    if (manifestMode && recipe?.content) {
      console.log(`%cRecipe:%c ${recipe.content.length} chars`, S.req, "");
    }
    console.groupEnd();

    const start = Date.now();
    console.log(
      `%c[gyoza:query] Sending to background (queryId: ${queryId.slice(0, 8)}, convId: ${activeConvIdRef.current?.slice(0, 8) || "none"})`,
      "color: #3b82f6",
    );
    // Use port-based messaging for queries — Firefox GC's sendResponse on
    // long-running async handlers ("Promised response went out of scope").
    console.log("[gyoza:query] Using PORT-based messaging (Firefox-safe)");
    const result = await new Promise<AgentResult>((resolve, reject) => {
      const port = browser.runtime.connect({ name: "gyozai_query" });
      activePortRef.current = port;
      console.log("[gyoza:query] Port connected, posting message...");
      port.onMessage.addListener((msg: AgentResult) => {
        console.log("[gyoza:query] Port received response ✓");
        activePortRef.current = null;
        resolve(msg);
        port.disconnect();
      });
      port.onDisconnect.addListener(() => {
        activePortRef.current = null;
        const err = browser.runtime.lastError;
        console.warn(
          "[gyoza:query] Port disconnected unexpectedly:",
          err?.message,
        );
        reject(new Error(err?.message || "Background connection lost"));
      });
      port.postMessage(payload);
    });
    const ms = Date.now() - start;
    console.log(
      `%c[gyoza:query] Response received in ${ms}ms (messages: ${result?.messages?.length || 0}, tools: ${result?.toolCalls?.length || 0}, error: ${result?.error || "none"})`,
      result?.error ? "color: #ef4444" : "color: #22c55e",
    );

    // ─── Log response ──────────────────
    console.group(`%c[gyoza] ━━━ RESPONSE #${qn} (${ms}ms) ━━━`, S.res);
    if (result?.error) {
      console.log(`%c Error:%c ${result.error}`, S.err, "");
    } else {
      console.log(`%cMessages:%c ${result?.messages?.length || 0}`, S.res, "");
      if (result?.toolCalls?.length) {
        for (const tc of result.toolCalls) {
          console.log(
            `%c  → ${tc.tool}%c ${JSON.stringify(tc.args).slice(0, 100)}`,
            S.action,
            S.dim,
          );
        }
      }
      if (result?.navigated) {
        console.log(`%c  navigated:%c true`, S.action, "");
      }
      if (result?.clarify) {
        console.log(
          `%c  clarify:%c ${result.clarify.options.join(", ")}`,
          S.action,
          "",
        );
      }
    }
    console.groupEnd();

    // Raw response for debugging
    console.groupCollapsed(`%c[gyoza] RAW #${qn}`, S.dim);
    console.log("Response:", result);
    console.groupEnd();

    return result;
  }

  // Dispatch a single DOM action (legacy managed mode only)
  async function dispatchDomAction(action: {
    type: string;
    target?: string;
    selector?: string;
    code?: string;
  }): Promise<string | undefined> {
    switch (action.type) {
      case "navigate":
        if (action.target) {
          log("Navigate →", action.target);
          window.location.href = action.target;
        }
        break;
      case "click":
        if (action.selector) {
          const el = document.querySelector(
            action.selector,
          ) as HTMLElement | null;
          log("Click →", action.selector, el ? "(found)" : "(NOT FOUND)");
          el?.click();
        }
        break;
      case "execute-js":
        if (action.code) {
          const result = await browser.runtime.sendMessage({
            type: "gyozai_exec",
            code: action.code,
          });
          if (result?.error) {
            return result.error;
          }
        }
        break;
      case "highlight-ui":
        if (action.selector) {
          const el = document.querySelector(
            action.selector,
          ) as HTMLElement | null;
          if (el) {
            const prev = el.style.cssText;
            el.style.cssText += `;outline:3px solid #E8950A!important;outline-offset:4px!important;border-radius:8px!important;box-shadow:0 0 20px rgba(232,149,10,0.4)!important;transition:all 0.3s ease!important;`;
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            setTimeout(() => {
              el.style.cssText = prev;
            }, 4000);
          }
        }
        break;
    }
    return undefined;
  }

  // Build simplified status lines from tool calls
  function buildToolStatusLines(toolCalls: AgentResult["toolCalls"]): string[] {
    if (!toolCalls?.length) return [];
    const lines: string[] = [];
    for (const tc of toolCalls) {
      switch (tc.tool) {
        case "navigate": {
          const url = (tc.args as { url?: string }).url || "";
          lines.push(`Navigated to ${url}`);
          break;
        }
        case "click":
          lines.push("Clicked element");
          break;
        case "highlight_ui":
          lines.push("Highlighted element");
          break;
        case "get_page_context":
          lines.push("Read page");
          break;
        case "fetch_url":
          lines.push("Fetched data");
          break;
      }
    }
    return lines;
  }

  // Add a tool-status message (visually distinct from normal chat)
  const addToolStatusMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        type: "tool-status" as const,
      },
    ]);
  }, []);

  // ─── Listen for streaming events from background worker ───
  useEffect(() => {
    const handler = (msg: StreamEventMessage) => {
      if (msg.type !== "gyozai_stream_event") return;

      const myQueryId = currentQueryIdRef.current;
      if (msg.queryId !== myQueryId) {
        console.log(
          "%c[gyoza:stream] REJECTED event (queryId mismatch: got %s, expected %s)",
          "color: #ef4444",
          msg.queryId?.slice(0, 8),
          myQueryId?.slice(0, 8),
          msg.event,
        );
        return;
      }

      const evt = msg.event;
      console.log(
        `%c[gyoza:stream] ${evt.kind}`,
        "color: #a855f7; font-weight: bold",
        "content" in evt ? (evt.content as string)?.slice(0, 80) : evt,
      );

      switch (evt.kind) {
        case "message":
          addAssistantMessage(evt.content);
          break;
        case "tool-status":
          addToolStatusMessage(evt.content);
          break;
        case "expression":
          if (evt.face && EXPRESSIONS.includes(evt.face as Expression)) {
            setExpression(evt.face as Expression);
            browser.runtime
              .sendMessage({
                type: "gyozai_save_expression",
                expression: evt.face,
              })
              .catch(() => {});
          }
          break;
        case "clarify":
          setClarify({ message: evt.message, options: evt.options });
          break;
      }
    };
    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, [addAssistantMessage, addToolStatusMessage]);

  // Process the agent result from the background worker
  async function processAgentResult(result: AgentResult): Promise<void> {
    console.log(
      "%c[gyoza:result] processAgentResult called",
      "color: #3b82f6; font-weight: bold",
      {
        messages: result.messages?.length || 0,
        toolCalls: result.toolCalls?.length || 0,
        error: result.error || null,
        navigated: result.navigated || false,
        streamed: result.streamed || false,
        hasLlmHistory: (result.llmHistory?.length || 0) > 0,
        clarify: result.clarify ? "yes" : "no",
      },
    );

    // Stash LLM history so saveCurrentConversation can seed it
    if (result.llmHistory && result.llmHistory.length > 0) {
      latestLlmHistoryRef.current = result.llmHistory;
    }

    // Clear the streaming queryId — no more events expected
    currentQueryIdRef.current = null;

    if (result.error) {
      setError(result.error);
      return;
    }

    // ─── Check if this is a legacy managed-mode response ─────
    if (result.actions && result.actions.length > 0) {
      await handleLegacyResponse(result);
      return;
    }

    // ─── BYOK tool-calling response ──────────────────────────

    // Streamed responses: all UI updates already happened via streaming events.
    // Continuation is handled by prepareStep (forces tool calls) and the
    // pending-nav loop — no client-side follow-up hacks needed.
    if (result.streamed) {
      return;
    }

    // Non-streamed fallback (e.g. no queryId was set)
    const statusLines = buildToolStatusLines(result.toolCalls);
    for (const line of statusLines) {
      addToolStatusMessage(line);
    }

    const aiMessages = result.messages?.filter((m) => m.trim()) || [];
    for (const msg of aiMessages) {
      addAssistantMessage(msg);
    }

    if (result.clarify) {
      setClarify({
        message: result.clarify.message,
        options: result.clarify.options,
      });
    }
  }

  // Handle legacy managed-mode responses (structured output with actions array)
  async function handleLegacyResponse(result: AgentResult): Promise<void> {
    const actions = result.actions || [];
    const extraRequests = result.extraRequests;
    const autoContinue = result.autoContinue;

    // Handle extraRequests (legacy only)
    if (extraRequests && extraRequests.length > 0) {
      const snapshotTypes = mapExtraRequests(extraRequests);

      const hasPageChange = actions.some(
        (a) => a.type === "navigate" || a.type === "click",
      );

      if (hasPageChange) {
        await savePendingNav({
          snapshotTypes,
          originalQuery: lastUserQueryRef.current,
          conversationId: activeConvIdRef.current || "",
          tabId: tabIdRef.current ?? 0,
          timestamp: Date.now(),
        });
        await dispatchLegacyActions(actions);
        return;
      }

      const pageCtx = capturePageContext(snapshotTypes);
      const ctxText = formatPageContext(pageCtx);
      await dispatchLegacyActions(actions);

      if (autoContinue) {
        const context = ctxText || captureCleanHtml();
        if (!context) return;
        pendingExtraContext = context;
        const followUp = await sendQuery(
          "Page context is now available. Complete the task.",
          context,
        );
        await processAgentResult(followUp);
      } else if (ctxText) {
        pendingExtraContext = ctxText;
      }
      return;
    }

    // Handle fetch (legacy only)
    const fetchAction = actions.find((a) => a.type === "fetch");
    if (fetchAction && fetchAction.url) {
      if (fetchAction.message) addAssistantMessage(fetchAction.message);
      try {
        const fetchResult = await fetch(fetchAction.url, {
          method: fetchAction.method || "GET",
        }).then((r) => r.text());
        const followUp = await sendQuery(
          `Based on fetched results from ${fetchAction.url}: ${fetchResult}`,
        );
        await processAgentResult(followUp);
      } catch (e) {
        addAssistantMessage(
          `Failed to fetch ${fetchAction.url}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      return;
    }

    await dispatchLegacyActions(actions);
  }

  // Dispatch legacy actions (managed mode)
  async function dispatchLegacyActions(
    actions: Array<{
      type: string;
      target?: string;
      selector?: string;
      code?: string;
      message?: string;
      options?: string[];
    }>,
  ): Promise<void> {
    const showMessages = actions
      .filter((a) => a.type === "show-message" && a.message)
      .map((a) => a.message!);
    if (showMessages.length > 0) {
      addAssistantMessage(showMessages.join("\n\n"));
    }

    const clarifyAction = actions.find(
      (a) => a.type === "clarify" && a.message,
    );
    if (clarifyAction) {
      addAssistantMessage(clarifyAction.message!);
      setClarify({
        message: clarifyAction.message!,
        options: clarifyAction.options || [],
      });
    }

    await new Promise((r) => setTimeout(r, 50));

    for (const action of actions) {
      if (
        action.type === "show-message" ||
        action.type === "clarify" ||
        action.type === "fetch"
      ) {
        continue;
      }

      const jsError = await dispatchDomAction(action);
      if (jsError && action.type === "execute-js") {
        const errorMsg = sanitizeError(jsError);
        log("JS failed, re-querying AI:", errorMsg);
        autoFollowUpUsed = false;
        const retry = await sendQuery(
          `The code failed with error: "${errorMsg}". Try a different approach.`,
        );
        await processAgentResult(retry);
        return;
      }
    }
  }

  // ─── Attachment upload helpers ──────────────────────────────────────────────

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ACCEPTED_FILE_TYPES = new Set(["application/pdf", "text/plain"]);

  const handleImageFiles = useCallback(
    async (files: FileList | File[]) => {
      const remaining = MAX_IMAGES_PER_MESSAGE - pendingImages.length;
      const toProcess = Array.from(files).slice(0, remaining);
      if (toProcess.length === 0) return;

      const newAttachments: PendingAttachment[] = [];
      for (const file of toProcess) {
        if (file.type.startsWith("image/")) {
          // Image: compress as before
          const { blob, mimeType } = await compressImage(file);
          const dataUrl = await blobToDataUrl(blob);
          newAttachments.push({
            id: crypto.randomUUID(),
            dataUrl,
            blob,
            mimeType,
            kind: "image",
          });
        } else if (ACCEPTED_FILE_TYPES.has(file.type)) {
          // PDF or TXT: read raw, enforce size limit
          if (file.size > MAX_FILE_SIZE) continue;
          const dataUrl = await blobToDataUrl(file);
          newAttachments.push({
            id: crypto.randomUUID(),
            dataUrl,
            blob: file,
            mimeType: file.type,
            filename: file.name,
            kind: "file",
          });
        }
      }
      if (newAttachments.length > 0) {
        setPendingImages((prev) =>
          [...prev, ...newAttachments].slice(0, MAX_IMAGES_PER_MESSAGE),
        );
      }
    },
    [pendingImages.length],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        const result = imageFromClipboard(item);
        if (result) imageFiles.push(result.blob as File);
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleImageFiles(imageFiles);
      }
    },
    [handleImageFiles],
  );

  const removePendingImage = useCallback((id: string) => {
    setPendingImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleScreenshot = useCallback(async () => {
    if (pendingImages.length >= MAX_IMAGES_PER_MESSAGE) return;
    try {
      const response = await browser.runtime.sendMessage({
        type: "gyozai_capture_tab",
      });
      if (response?.error) return;
      const dataUrl = response.dataUrl as string;
      // Convert data URL to blob for IndexedDB storage
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      setPendingImages((prev) =>
        [
          ...prev,
          {
            id: crypto.randomUUID(),
            dataUrl,
            blob,
            mimeType: "image/jpeg",
            kind: "image" as const,
          },
        ].slice(0, MAX_IMAGES_PER_MESSAGE),
      );
    } catch {
      // Silently fail — screenshot not critical
    }
  }, [pendingImages.length]);

  // ─── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const trimmed = input.trim();
    const hasImages = pendingImages.length > 0;
    if ((!trimmed && !hasImages) || loading) return;
    setInput("");
    setError(null);
    setLoading(true);
    setClarify(null);

    // Capture pending images before clearing
    const imagesToSend = [...pendingImages];
    setPendingImages([]);

    // Build user message with optional imageIds
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      ...(imagesToSend.length > 0 && {
        imageIds: imagesToSend.map((img) => img.id),
      }),
    };

    // Cache attachment data for immediate rendering
    for (const img of imagesToSend) {
      imageCache.current.set(img.id, {
        dataUrl: img.dataUrl,
        filename: img.filename,
        kind: img.kind,
      });
    }

    setMessages((prev) => [...prev, userMsg]);

    // Ensure a conversation ID exists before the first query so the
    // background worker can persist LLM history for follow-up calls.
    if (!activeConvIdRef.current) {
      activeConvIdRef.current = crypto.randomUUID();
    }

    // Persist attachment blobs to IndexedDB
    if (imagesToSend.length > 0) {
      saveImages(
        activeConvIdRef.current,
        imagesToSend.map((img) => ({
          id: img.id,
          blob: img.blob,
          mimeType: img.mimeType,
          filename: img.filename,
          kind: img.kind,
        })),
      ).catch(console.error);
    }

    try {
      autoFollowUpUsed = false;
      const imageAttachments = imagesToSend.filter((a) => a.kind === "image");
      const fileAttachments = imagesToSend.filter((a) => a.kind === "file");
      console.log(
        "%c[gyoza:submit] handleSubmit → sendQuery",
        "color: #3b82f6; font-weight: bold",
        trimmed.slice(0, 60),
        imageAttachments.length > 0
          ? `(+${imageAttachments.length} image(s))`
          : "",
        fileAttachments.length > 0
          ? `(+${fileAttachments.length} file(s))`
          : "",
      );
      const imageDataUrls =
        imageAttachments.length > 0
          ? imageAttachments.map((img) => img.dataUrl)
          : undefined;
      const filePayloads =
        fileAttachments.length > 0
          ? fileAttachments.map((f) => ({
              dataUrl: f.dataUrl,
              mimeType: f.mimeType,
              filename: f.filename,
            }))
          : undefined;
      const result = await sendQuery(
        trimmed,
        pendingExtraContext || undefined,
        undefined,
        imageDataUrls,
        filePayloads,
      );
      pendingExtraContext = null;
      console.log(
        "%c[gyoza:submit] sendQuery returned → calling processAgentResult",
        "color: #3b82f6",
      );
      await processAgentResult(result);
      console.log(
        "%c[gyoza:submit] processAgentResult completed",
        "color: #22c55e",
      );
    } catch (err) {
      console.log(
        "%c[gyoza:submit] ERROR in handleSubmit:",
        "color: #ef4444; font-weight: bold",
        err,
      );
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleClarifyOption = async (option: string) => {
    if (loading) return;
    setClarify(null);
    setError(null);
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: option },
    ]);

    try {
      autoFollowUpUsed = false;
      const result = await sendQuery(option, pendingExtraContext || undefined);
      pendingExtraContext = null;
      await processAgentResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  function handleStop() {
    if (activePortRef.current) {
      activePortRef.current.disconnect();
      activePortRef.current = null;
    }
    setLoading(false);
    setConfirmation(null);
    const tr = getTranslations(locale);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: tr.widget_stopped,
      },
    ]);
  }

  // Avatar click disabled — chatbox opens via proximity only

  const tr = getTranslations(locale);

  // Format relative time
  function timeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return t(tr, "widget_just_now");
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t(tr, "widget_minutes_ago", { n: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t(tr, "widget_hours_ago", { n: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return t(tr, "widget_days_ago", { n: days });
    return new Date(timestamp).toLocaleDateString();
  }

  return (
    <>
      {/* Toast — always visible, even when panel is closed */}
      {toast && <div className="gyozai-floating-toast">{toast}</div>}

      {/* Status pill / speech bubble — centered above avatar */}
      {!expanded &&
        !isDraggingAvatar &&
        (() => {
          const rect = avatarWrapperRef.current?.getBoundingClientRect();
          if (!rect) return null;
          const showAbove = rect.top > window.innerHeight / 2;
          const avatarCenterX = rect.left + rect.width / 2;
          const verticalPos = showAbove
            ? { bottom: window.innerHeight - rect.top + 8 }
            : { top: rect.bottom + 8 };

          // Find tool-status from the current turn only (after the last user message)
          let lastUserIdx = -1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === "user") {
              lastUserIdx = i;
              break;
            }
          }
          const currentTurnMsgs =
            lastUserIdx >= 0 ? messages.slice(lastUserIdx) : messages;
          const lastStatus =
            [...currentTurnMsgs]
              .reverse()
              .find((m) => m.type === "tool-status") || null;
          // Always use the last ASSISTANT message for the speech bubble,
          // even if the user sent a message after it.
          const lastAssistantMsg = [...messages]
            .reverse()
            .find((m) => m.role === "assistant" && m.type !== "tool-status");
          const isThinking = loading;

          // Check if the most recent message is a tool-status (action in progress)
          const lastMsg = messages[messages.length - 1];
          const activeStatus = lastMsg?.type === "tool-status" ? lastMsg : null;

          // Find which is newer: last assistant message or last tool-status
          const lastAssistantIdx = lastAssistantMsg
            ? messages.lastIndexOf(lastAssistantMsg)
            : -1;
          const lastStatusIdx = lastStatus
            ? messages.lastIndexOf(lastStatus)
            : -1;
          const assistantIsNewer = lastAssistantIdx > lastStatusIdx;

          // When loading: always show the status pill (with loading animation)
          // When idle: show whichever is newer — assistant message (speech
          // bubble) or tool-status (pill). Fall back to idle pill.
          if (isThinking) {
            // Show animated dots in the pill, same as the open chatbox
            const statusText = activeStatus
              ? activeStatus.content
              : lastStatus?.content;
            return (
              <div
                style={{
                  position: "fixed",
                  zIndex: 2147483647,
                  pointerEvents: "none",
                  left: avatarCenterX,
                  transform: "translateX(-50%)",
                  ...verticalPos,
                }}
              >
                <div className="gyozai-status-pill">
                  {statusText || tr.widget_status_thinking}
                  <span className="gyozai-thinking-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </div>
            );
          }

          // Not loading — show newest of assistant message vs tool-status
          const showPill =
            activeStatus ||
            (!assistantIsNewer && lastStatus) ||
            !lastAssistantMsg;
          const pillText = activeStatus
            ? activeStatus.content
            : lastStatus?.content || tr.widget_status_idling;

          if (showPill) {
            return (
              <div
                style={{
                  position: "fixed",
                  zIndex: 2147483647,
                  pointerEvents: "none",
                  left: avatarCenterX,
                  transform: "translateX(-50%)",
                  ...verticalPos,
                }}
              >
                <div className="gyozai-status-pill">{pillText}</div>
              </div>
            );
          }

          // Speech bubble with last assistant message
          const bubbleWidth = 280;
          const pad = 8;
          return (
            <div
              ref={speechBubbleRef}
              style={{
                position: "fixed",
                zIndex: 2147483647,
                left: Math.max(
                  pad,
                  Math.min(
                    avatarCenterX - bubbleWidth / 2,
                    window.innerWidth - bubbleWidth - pad,
                  ),
                ),
                ...verticalPos,
              }}
              onMouseEnter={() => {
                hoverOpenRef.current = true;
                setExpanded(true);
              }}
            >
              <SpeechBubble
                text={lastAssistantMsg!.content}
                isThinking={false}
                autoDismissMs={0}
                soundEnabled={typingAnimation && typingSound}
                typewriterEnabled={
                  typingAnimation &&
                  !animatedMsgIdsRef.current.has(lastAssistantMsg!.id)
                }
                onTypingChange={(typing) => {
                  setIsTypewriting(typing);
                  if (!typing)
                    animatedMsgIdsRef.current.add(lastAssistantMsg!.id);
                }}
              />
            </div>
          );
        })()}

      {/* Avatar widget */}
      <Avatar
        size={agentSize}
        expression={expression}
        isTalking={isTypewriting}
        position={avatarPosition}
        onDragEnd={(pos) => {
          setAvatarPosition(pos);
          // Persist to local storage (survives browser close)
          browser.storage.local
            .set({ gyozai_avatar_position: pos })
            .catch(() => {});
        }}
        onClick={() => {}}
        wrapperRef={avatarWrapperRef}
        onDragStateChange={(dragging) => {
          const wasDragging = isDraggingAvatar;
          setIsDraggingAvatar(dragging);
          // When a real drag ends (was dragging → now not), the cursor is still
          // on the avatar — force proximity open so the panel reappears.
          // Brief grace period prevents the proximity leave from immediately
          // closing the panel (cursor may be outside the new avatar position).
          if (wasDragging && !dragging) {
            dragDropGraceRef.current = true;
            setTimeout(() => {
              dragDropGraceRef.current = false;
            }, 600);
            hoverOpenRef.current = true;
            forceInside();
            setExpanded(true);
          }
        }}
        onPositionChange={bumpAvatarPosTick}
      />

      {/* Chat panel — positioned dynamically relative to avatar */}
      <div
        className={`gyozai-panel ${expanded ? "gyozai-panel-open" : ""} ${chatFullscreen ? "gyozai-panel-fullscreen" : ""}`}
        style={{
          display:
            chatFullscreen || (expanded && !isDraggingAvatar) ? "flex" : "none",
          ...(!chatFullscreen && {
            transform: chatScale !== 1 ? `scale(${chatScale})` : undefined,
            transformOrigin: avatarWrapperRef.current
              ? avatarWrapperRef.current.getBoundingClientRect().top >
                window.innerHeight / 2
                ? "bottom center"
                : "top center"
              : "bottom center",
            transition: isResizing ? "none" : "transform 0.15s ease-out",
          }),
          ...(!chatFullscreen && avatarWrapperRef.current
            ? (() => {
                const rect = avatarWrapperRef.current.getBoundingClientRect();
                const avatarCenterX = rect.left + rect.width / 2;
                const showAbove = rect.top > window.innerHeight / 2;
                const panelCssWidth = 380;
                const visualOffset =
                  (panelCssWidth * chatScale - panelCssWidth) / 2;
                const left = Math.max(
                  8 + visualOffset,
                  Math.min(
                    avatarCenterX - panelCssWidth / 2,
                    window.innerWidth - panelCssWidth - 8 - visualOffset,
                  ),
                );
                return showAbove
                  ? { left, bottom: window.innerHeight - rect.top + 8 }
                  : { left, top: rect.bottom + 8 };
              })()
            : {}),
        }}
        ref={panelRef}
        onMouseEnter={() => {
          insidePanelRef.current = true;
          forceInside();
        }}
        onMouseLeave={() => {
          if (chatFullscreen || isResizingRef.current) return;
          insidePanelRef.current = false;
          if (hoverOpenRef.current) {
            startLeave();
          }
        }}
      >
        {/* Resize handle — top-right corner (hidden in fullscreen) */}
        {!chatFullscreen && (
          <div
            className={`gyozai-resize-handle${isResizing ? " gyozai-resize-handle-active" : ""}`}
            onPointerDown={handleResizePointerDown}
            onDoubleClick={() => {
              setChatScale(1);
              browser.runtime
                .sendMessage({ type: "gyozai_get_settings" })
                .then((s: ExtensionSettings) => {
                  browser.storage.local
                    .set({ gyozai_settings: { ...s, chatScale: 1 } })
                    .catch(() => {});
                })
                .catch(() => {});
            }}
            title="Drag to resize, double-click to reset"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M2 10L10 2" />
              <path d="M6 10L10 6" />
            </svg>
          </div>
        )}

        {/* History View */}
        {viewMode === "history" && (
          <div className="gyozai-messages">
            {historyList.length === 0 && (
              <div className="gyozai-empty">{tr.widget_no_conversations}</div>
            )}
            {historyList.map((conv) => (
              <div
                key={conv.id}
                className={`gyozai-history-item ${activeConvIdRef.current === conv.id ? "gyozai-history-item-active" : ""}`}
              >
                <button
                  className="gyozai-history-item-content"
                  onClick={() => loadFromHistory(conv.id)}
                >
                  <div className="gyozai-history-title">{conv.title}</div>
                  <div className="gyozai-history-meta">
                    <span>{conv.domain}</span>
                    <span>{timeAgo(conv.updatedAt)}</span>
                    <span>
                      {t(tr, "widget_msg_count", {
                        count: conv.messageCount,
                      })}
                    </span>
                  </div>
                </button>
                <button
                  className="gyozai-history-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFromHistory(conv.id);
                  }}
                  title={tr.widget_delete_conversation}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chat View */}
        {viewMode === "chat" && (
          <>
            {/* Messages — speech bubble style */}
            <div
              className="gyozai-messages"
              ref={(node) => {
                messagesContainerRef.current = node;
                if (node && !scrollReady) setScrollReady(true);
              }}
            >
              {messages.length === 0 && (
                <div className="gyozai-empty" style={{ opacity: 0.6 }}>
                  {(() => {
                    const isMac =
                      navigator.platform?.includes("Mac") ??
                      navigator.userAgent.includes("Mac");
                    const shortcut = isMac ? "\u2318\u21e7E" : "Ctrl+Shift+E";
                    return tr.widget_shortcut_tip.replace(
                      "{shortcut}",
                      shortcut,
                    );
                  })()}
                </div>
              )}
              {messages.map((msg, idx) => {
                const isToolStatus = msg.type === "tool-status";
                const isLatestAssistant =
                  msg.role === "assistant" &&
                  !isToolStatus &&
                  idx === messages.length - 1;
                const msgClass = isToolStatus
                  ? "gyozai-msg gyozai-msg-status"
                  : `gyozai-msg gyozai-msg-${msg.role}`;
                return (
                  <div
                    key={msg.id}
                    className={msgClass}
                    style={{ opacity: isToolStatus ? 1 : bubbleOpacity }}
                  >
                    {isToolStatus ? (
                      msg.content
                    ) : msg.role === "assistant" ? (
                      typingAnimation &&
                      isLatestAssistant &&
                      !animatedMsgIdsRef.current.has(msg.id) ? (
                        <TypewriterText
                          text={msg.content}
                          speed={5}
                          enabled={true}
                          soundEnabled={typingAnimation && typingSound}
                          onTypingChange={(typing) => {
                            setIsTypewriting(typing);
                            if (!typing) animatedMsgIdsRef.current.add(msg.id);
                          }}
                        />
                      ) : (
                        <FormatMessage text={msg.content} />
                      )
                    ) : (
                      <>
                        {msg.imageIds && msg.imageIds.length > 0 && (
                          <MessageImages
                            imageIds={msg.imageIds}
                            cache={imageCache}
                          />
                        )}
                        {msg.content}
                      </>
                    )}
                  </div>
                );
              })}
              {loading && (
                <div className="gyozai-msg gyozai-msg-assistant">
                  <div className="gyozai-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Clarify options */}
            {clarify && !loading && (
              <div className="gyozai-clarify">
                {clarify.options.map((option, i) => (
                  <button
                    key={i}
                    className="gyozai-clarify-btn"
                    onClick={() => handleClarifyOption(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {/* Action confirmation (safeguard for submit_form) */}
            {confirmation && (
              <div className="gyozai-clarify">
                <span className="gyozai-confirm-text">
                  {confirmation.description}
                </span>
                <button
                  className="gyozai-clarify-btn"
                  onClick={confirmation.onConfirm}
                >
                  {tr.widget_confirm_allow}
                </button>
                <button
                  className="gyozai-clarify-btn"
                  onClick={confirmation.onDeny}
                >
                  {tr.widget_confirm_deny}
                </button>
              </div>
            )}

            {/* Error — render URLs as clickable links */}
            {error && (
              <div className="gyozai-error">
                {error.split(/(https?:\/\/\S+)/g).map((part, i) =>
                  /^https?:\/\//.test(part) ? (
                    <a
                      key={i}
                      href={part}
                      onClick={(e) => {
                        e.preventDefault();
                        window.open(part, "_blank", "noopener,noreferrer");
                      }}
                      style={{
                        color: "inherit",
                        textDecoration: "underline",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {part}
                    </a>
                  ) : (
                    part
                  ),
                )}
              </div>
            )}

            {/* Toast */}
            {toast && <div className="gyozai-toast">{toast}</div>}
          </>
        )}

        {/* Input row — always visible (both chat and history views) */}
        <div className="gyozai-input-row">
          {/* Attachment preview strip */}
          {pendingImages.length > 0 && (
            <div className="gyozai-image-preview-row">
              {pendingImages.map((img) => (
                <div key={img.id} className="gyozai-preview-thumb">
                  {img.kind === "file" ? (
                    <div className="gyozai-file-preview">
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      <span className="gyozai-file-name">
                        {img.filename
                          ? img.filename.length > 12
                            ? img.filename.slice(0, 10) + "..."
                            : img.filename
                          : "file"}
                      </span>
                    </div>
                  ) : (
                    <img src={img.dataUrl} alt="Preview" />
                  )}
                  <button
                    className="gyozai-preview-remove"
                    onClick={() => removePendingImage(img.id)}
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Textarea — full width */}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-resize up to 3 lines
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 66) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (viewMode === "history") setViewMode("chat");
                handleSubmit();
              }
              if (e.key === "Escape") {
                startNewChat();
                setExpanded(false);
              }
            }}
            onPaste={handlePaste}
            placeholder={tr.widget_placeholder}
            className="gyozai-input"
            disabled={loading}
            rows={1}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,application/pdf,text/plain"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files) handleImageFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {/* Action buttons row */}
          <div className="gyozai-input-actions">
            <div className="gyozai-input-actions-left">
              <button
                className="gyozai-icon-btn gyozai-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                title={tr.widget_attach_image}
                disabled={
                  loading || pendingImages.length >= MAX_IMAGES_PER_MESSAGE
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
              </button>
              <button
                className="gyozai-icon-btn gyozai-upload-btn"
                onClick={handleScreenshot}
                title={tr.widget_screenshot}
                disabled={
                  loading || pendingImages.length >= MAX_IMAGES_PER_MESSAGE
                }
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </button>
            </div>
            <div className="gyozai-input-actions-right">
              <button
                className="gyozai-icon-btn"
                onClick={startNewChat}
                title={tr.widget_new_chat}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                className="gyozai-icon-btn"
                onClick={() => openHistory()}
                title={tr.widget_history}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </button>
              <button
                className="gyozai-icon-btn"
                onClick={() => {
                  const next = !chatFullscreen;
                  setChatFullscreen(next);
                  if (next) {
                    setChatScale(1);
                    setExpanded(true);
                  }
                  browser.runtime
                    .sendMessage({ type: "gyozai_get_settings" })
                    .then((s: ExtensionSettings) => {
                      browser.storage.local
                        .set({
                          gyozai_settings: {
                            ...s,
                            chatFullscreen: next,
                            ...(next ? { chatScale: 1 } : {}),
                          },
                        })
                        .catch(() => {});
                    })
                    .catch(() => {});
                }}
                title={chatFullscreen ? "Minimize" : "Maximize"}
              >
                {chatFullscreen ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                ) : (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                )}
              </button>
              <button
                className="gyozai-icon-btn"
                onClick={() =>
                  browser.runtime.sendMessage({ type: "gyozai_open_popup" })
                }
                title={tr.widget_settings}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                </svg>
              </button>
              {loading ? (
                <button
                  className="gyozai-send-btn gyozai-stop-btn"
                  onClick={handleStop}
                  title={tr.widget_stop}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              ) : (
                <button
                  className="gyozai-send-btn"
                  onClick={handleSubmit}
                  disabled={!input.trim() && pendingImages.length === 0}
                  title={tr.widget_send}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 2L11 13" />
                    <path d="M22 2l-7 20-4-9-9-4z" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// captureCleanHtml is imported from @gyoz-ai/engine
