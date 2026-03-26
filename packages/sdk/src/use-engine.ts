import { useState, useRef, useCallback, useEffect } from "react";
import {
  createEngine,
  type EngineConfig,
  type Action,
  type EngineError,
  type Capabilities,
} from "@gyoz-ai/engine";

export interface UseEngineConfig {
  proxyUrl: string;
  recipeXml?: string;
  manifestMode?: boolean;
  capabilities?: Capabilities;
  httpClient?: (url: string, method: string) => Promise<unknown>;
  onNavigate?: (target: string) => void;
  onClick?: (selector: string) => void;
  onExecuteJs?: (code: string) => void;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: Action[];
}

export interface ClarifyState {
  message: string;
  options: string[];
}

export function useEngine(config: UseEngineConfig) {
  const [messages, setMessages] = useState<Message[]>(() => {
    // Restore messages from sessionStorage so chat persists across page navigations
    if (typeof sessionStorage === "undefined") return [];
    try {
      const stored = sessionStorage.getItem("gyozai_messages");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clarify, setClarify] = useState<ClarifyState | null>(null);
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    try {
      sessionStorage.setItem("gyozai_messages", JSON.stringify(messages));
    } catch {
      // storage full
    }
  }, [messages]);

  // Create engine on mount
  useEffect(() => {
    const engineConfig: EngineConfig = {
      proxyUrl: config.proxyUrl,
      recipeXml: config.recipeXml,
      manifestMode: config.manifestMode ?? true,
      capabilities: config.capabilities,
      httpClient: config.httpClient,
      onMessage: () => {}, // Messages handled via actions in query result
      onNavigate:
        config.onNavigate ??
        ((target) => {
          if (typeof window !== "undefined") window.location.href = target;
        }),
      onClick: config.onClick,
      onExecuteJs: config.onExecuteJs,
      onClarify: (message, options) => {
        setClarify({ message, options });
      },
      onError: (err: EngineError) => {
        setError(err.message);
      },
    };
    engineRef.current = createEngine(engineConfig);

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [config.proxyUrl, config.recipeXml, config.manifestMode]);

  const query = useCallback(async (text: string) => {
    if (!engineRef.current) return;
    setLoading(true);
    setError(null);
    setClarify(null);

    // Add user message
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const result = await engineRef.current.query(text);

      // Each action with a message becomes its own chat bubble
      const actionMessages: Message[] = result.actions
        .filter((a) => a.message)
        .map((a) => ({
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: a.message!,
          actions: [a],
        }));

      if (actionMessages.length > 0) {
        setMessages((prev) => [...prev, ...actionMessages]);
      }
    } catch {
      // Error already set via onError callback
    } finally {
      setLoading(false);
    }
  }, []);

  const selectClarifyOption = useCallback(
    (option: string) => {
      setClarify(null);
      query(option);
    },
    [query],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setClarify(null);
  }, []);

  return {
    messages,
    loading,
    error,
    clarify,
    query,
    selectClarifyOption,
    clearMessages,
  };
}
