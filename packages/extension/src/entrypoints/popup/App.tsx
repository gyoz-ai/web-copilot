import React, { useState, useEffect } from "react";
import {
  getSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  type ExtensionSettings,
} from "../../lib/storage";
import {
  getRecipes,
  removeRecipe,
  importRecipeFromFile,
  toggleRecipe,
  type StoredRecipe,
} from "../../lib/recipes";
import {
  SUPPORTED_LOCALES,
  type LocaleCode,
  detectBrowserLocale,
  resolveLocale,
  getTranslations,
  t,
} from "../../lib/i18n";

const PROVIDERS = [
  { id: "claude", name: "Claude (Anthropic)" },
  { id: "openai", name: "ChatGPT (OpenAI)" },
  { id: "gemini", name: "Gemini (Google)" },
] as const;

const MODELS: Record<string, Array<{ id: string; name: string }>> = {
  claude: [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
    { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
  ],
  gemini: [
    { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash Preview" },
    {
      id: "gemini-3.1-flash-lite-preview",
      name: "Gemini 3.1 Flash Lite Preview",
    },
  ],
};

const PLATFORM_URL = "https://gyoz.ai";

/** Friendly display names + tier for managed models (client-side mapping) */
const MANAGED_MODEL_META: Record<
  string,
  { name: string; tier: "fast" | "balanced" | "expert" }
> = {
  // Anthropic
  "claude-haiku-4-5-20251001": { name: "Claude Haiku 4.5", tier: "fast" },
  "claude-sonnet-4-6": { name: "Claude Sonnet 4.6", tier: "balanced" },
  "claude-opus-4-6": { name: "Claude Opus 4.6", tier: "expert" },
  // OpenAI
  "gpt-5.4-nano": { name: "GPT-5.4 Nano", tier: "fast" },
  "gpt-5.4-mini": { name: "GPT-5.4 Mini", tier: "balanced" },
  "gpt-5.4": { name: "GPT-5.4", tier: "expert" },
  // Google
  "gemini-3.1-flash-lite-preview": {
    name: "Gemini 3.1 Flash Lite",
    tier: "fast",
  },
  "gemini-3-flash-preview": { name: "Gemini 3 Flash", tier: "balanced" },
  "gemini-3.1-pro-preview": { name: "Gemini 3.1 Pro", tier: "expert" },
};

const TIER_COLORS: Record<string, { bg: string; fg: string }> = {
  fast: { bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  balanced: { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6" },
  expert: { bg: "rgba(168,85,247,0.15)", fg: "#a855f7" },
};

function getManagedModelDisplay(id: string, provider: string) {
  const meta = MANAGED_MODEL_META[id];
  return {
    name: meta?.name ?? id,
    tier: meta?.tier ?? "balanced",
    provider,
  };
}

interface ManagedModels {
  plan: string;
  modelSelection: boolean;
  models: Array<{ id: string; provider: string }>;
}

interface ManagedUsageInfo {
  plan: string;
  tier: string;
  weeklyLimit: number;
  usage: { requestCount: number; totalCredits: number };
  remaining: number;
}

type Tab = "provider" | "recipes" | "settings";

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("provider");
  const [managedModels, setManagedModels] = useState<ManagedModels | null>(
    null,
  );
  const [managedUsage, setManagedUsage] = useState<ManagedUsageInfo | null>(
    null,
  );
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!modelDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelDropdownOpen]);

  useEffect(() => {
    console.log("[gyoza:popup] Mounting — loading settings...");
    getSettings().then((s) => {
      console.log(
        "[gyoza:popup] Settings loaded → provider:",
        s.provider,
        "mode:",
        s.mode,
        "hasApiKey:",
        !!s.apiKeys[s.provider],
        "apiKeyLen:",
        s.apiKeys[s.provider]?.length || 0,
        "hasManagedToken:",
        !!s.managedToken,
      );
      setSettings(s);
      // Fetch managed info if signed in
      if (s.managedToken) {
        const headers = { Authorization: `Bearer ${s.managedToken}` };
        fetch(`${PLATFORM_URL}/v1/ai/models`, { headers })
          .then((r) => r.json())
          .then(setManagedModels)
          .catch(() => {});
        fetch(`${PLATFORM_URL}/v1/ai/usage`, { headers })
          .then((r) => r.json())
          .then(setManagedUsage)
          .catch(() => {});
      }
    });
    getRecipes().then(setRecipes);
    browser.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          setCurrentDomain(new URL(tabs[0].url).host);
        } catch {}
      }
    });
  }, []);

  const locale: LocaleCode =
    settings.language === "auto"
      ? detectBrowserLocale()
      : resolveLocale(settings.language);
  const tr = getTranslations(locale);

  const handleSave = async () => {
    console.log(
      "[gyoza:popup] handleSave called → provider:",
      settings.provider,
      "apiKeyLen:",
      settings.apiKeys[settings.provider]?.length || 0,
      "mode:",
      settings.mode,
    );
    await saveSettings(settings);
    // Re-read to confirm persistence
    const check = await getSettings();
    console.log(
      "[gyoza:popup] handleSave verify → apiKeyLen:",
      check.apiKeys[check.provider]?.length || 0,
      "provider:",
      check.provider,
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleImportRecipe = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.md";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      await importRecipeFromFile(file.name, text);
      setRecipes(await getRecipes());
    };
    input.click();
  };

  const handleDeleteRecipe = async (id: string) => {
    await removeRecipe(id);
    setRecipes(await getRecipes());
  };

  const handleToggleRecipe = async (id: string) => {
    await toggleRecipe(id);
    setRecipes(await getRecipes());
  };

  const domainRecipes = recipes.filter((r) => r.domain === currentDomain);
  const displayRecipes = showAllRecipes ? recipes : domainRecipes;
  const models = MODELS[settings.provider] || [];

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <div className="popup-header-left">
          <img src="/icon-128.png" alt="gyoza" className="popup-logo" />
          <span className="popup-brand">gyoza</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="popup-tabs">
        <button
          className={`popup-tab ${tab === "provider" ? "active" : ""}`}
          onClick={() => setTab("provider")}
        >
          {tr.popup_provider}
        </button>
        <button
          className={`popup-tab ${tab === "recipes" ? "active" : ""}`}
          onClick={() => setTab("recipes")}
        >
          {tr.popup_recipes}
        </button>
        <button
          className={`popup-tab ${tab === "settings" ? "active" : ""}`}
          onClick={() => setTab("settings")}
        >
          {tr.popup_settings}
        </button>
      </div>

      {/* ═══ Provider Tab ═══ */}
      {tab === "provider" && (
        <>
          {/* Mode Toggle */}
          <div className="popup-section">
            <div className="mode-toggle">
              <button
                className={`mode-btn ${settings.mode === "byok" ? "active" : ""}`}
                onClick={() => {
                  const updated = { ...settings, mode: "byok" as const };
                  setSettings(updated);
                  saveSettings(updated);
                }}
              >
                BYOK
              </button>
              <button
                className={`mode-btn ${settings.mode === "managed" ? "active" : ""}`}
                onClick={() => {
                  const updated = { ...settings, mode: "managed" as const };
                  setSettings(updated);
                  saveSettings(updated);
                }}
              >
                Managed
              </button>
            </div>
          </div>

          {/* BYOK Config */}
          {settings.mode === "byok" && (
            <div className="popup-section">
              <label className="form-label">{tr.popup_provider}</label>
              <select
                className="form-select"
                value={settings.provider}
                onChange={(e) => {
                  const provider = e.target
                    .value as ExtensionSettings["provider"];
                  const firstModel = MODELS[provider]?.[0]?.id || "";
                  setSettings({ ...settings, provider, model: firstModel });
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <label className="form-label">{tr.popup_api_key}</label>
              <div className="key-row">
                <input
                  type={showKey ? "text" : "password"}
                  className="form-input"
                  value={settings.apiKeys[settings.provider]}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      apiKeys: {
                        ...settings.apiKeys,
                        [settings.provider]: e.target.value,
                      },
                    })
                  }
                  placeholder={t(tr, "popup_api_key_placeholder", {
                    provider:
                      PROVIDERS.find((p) => p.id === settings.provider)?.name ||
                      "",
                  })}
                />
                <button
                  className="eye-btn"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? "\u{1F648}" : "\u{1F441}\uFE0F"}
                </button>
              </div>

              <label className="form-label">{tr.popup_model}</label>
              <select
                className="form-select"
                value={settings.model}
                onChange={(e) =>
                  setSettings({ ...settings, model: e.target.value })
                }
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>

              <button
                className={`btn-primary ${saved ? "saved" : ""}`}
                onClick={handleSave}
              >
                {saved ? `\u2713 ${tr.popup_saved}` : tr.popup_save}
              </button>
            </div>
          )}

          {/* Managed Mode */}
          {settings.mode === "managed" && (
            <div className="popup-section">
              {settings.managedToken ? (
                <div>
                  {/* Plan badge + status */}
                  <div className="status-row">
                    <span className="status-dot" />
                    <span>{tr.popup_managed_connected}</span>
                    {managedUsage?.tier && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 8px",
                          borderRadius: 12,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background: "rgba(232,149,10,0.2)",
                          color: "#E8950A",
                        }}
                      >
                        {managedUsage.tier}
                      </span>
                    )}
                  </div>

                  {/* Usage progress bar */}
                  {managedUsage && managedUsage.weeklyLimit > 0 && (
                    <div style={{ margin: "10px 0" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          marginBottom: 4,
                          opacity: 0.7,
                        }}
                      >
                        <span>Weekly usage</span>
                        <span>
                          {managedUsage.usage.totalCredits ??
                            managedUsage.usage.requestCount}{" "}
                          / {managedUsage.weeklyLimit}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 3,
                          background: "rgba(255,255,255,0.1)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 3,
                            width: `${Math.min(100, ((managedUsage.usage.totalCredits ?? managedUsage.usage.requestCount) / managedUsage.weeklyLimit) * 100)}%`,
                            background:
                              (managedUsage.usage.totalCredits ??
                                managedUsage.usage.requestCount) >=
                              managedUsage.weeklyLimit
                                ? "#ef4444"
                                : "#E8950A",
                            transition: "width 0.3s",
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {managedUsage && managedUsage.weeklyLimit === -1 && (
                    <div
                      style={{ fontSize: 11, opacity: 0.7, margin: "8px 0" }}
                    >
                      Generous usage ({managedUsage.usage.requestCount} requests
                      this week)
                    </div>
                  )}

                  {/* Model selector (pro+ only) */}
                  {managedModels?.modelSelection && (
                    <div style={{ margin: "10px 0" }}>
                      <label className="form-label">{tr.popup_model}</label>
                      <div className="managed-model-dropdown" ref={dropdownRef}>
                        {/* Trigger button showing selected model */}
                        {(() => {
                          const sel = managedModels.models.find(
                            (m) => m.id === settings.model,
                          );
                          const display = sel
                            ? getManagedModelDisplay(sel.id, sel.provider)
                            : {
                                name: settings.model,
                                tier: "balanced" as const,
                              };
                          const tierColor =
                            TIER_COLORS[display.tier] || TIER_COLORS.balanced;
                          return (
                            <button
                              className={`managed-model-trigger ${modelDropdownOpen ? "open" : ""}`}
                              onClick={() =>
                                setModelDropdownOpen(!modelDropdownOpen)
                              }
                            >
                              <span className="managed-model-name">
                                {display.name}
                              </span>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span
                                  className="managed-model-tier"
                                  style={{
                                    background: tierColor.bg,
                                    color: tierColor.fg,
                                  }}
                                >
                                  {display.tier}
                                </span>
                                <span className="managed-model-chevron">
                                  {"\u25BE"}
                                </span>
                              </div>
                            </button>
                          );
                        })()}
                        {/* Dropdown items */}
                        {modelDropdownOpen && (
                          <div className="managed-model-list">
                            {managedModels.models.map((m) => {
                              const display = getManagedModelDisplay(
                                m.id,
                                m.provider,
                              );
                              const tierColor = TIER_COLORS[display.tier];
                              const isSelected = settings.model === m.id;
                              return (
                                <button
                                  key={m.id}
                                  className={`managed-model-item ${isSelected ? "selected" : ""}`}
                                  onClick={() => {
                                    const updated = {
                                      ...settings,
                                      model: m.id,
                                    };
                                    setSettings(updated);
                                    saveSettings(updated);
                                    setModelDropdownOpen(false);
                                  }}
                                >
                                  <span className="managed-model-name">
                                    {display.name}
                                  </span>
                                  <span
                                    className="managed-model-tier"
                                    style={{
                                      background: tierColor.bg,
                                      color: tierColor.fg,
                                    }}
                                  >
                                    {display.tier}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() =>
                        browser.tabs.create({ url: "https://gyoz.ai/account" })
                      }
                    >
                      Manage Plan
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1 }}
                      onClick={() => {
                        const updated = {
                          ...settings,
                          managedToken: undefined,
                          managedPlan: undefined,
                          managedUsage: undefined,
                        };
                        setSettings(updated);
                        saveSettings(updated);
                        setManagedModels(null);
                        setManagedUsage(null);
                      }}
                    >
                      {tr.popup_managed_sign_out}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="desc-text">{tr.popup_managed_subscribe_desc}</p>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      browser.tabs.create({ url: "https://gyoz.ai/pricing" })
                    }
                  >
                    {tr.popup_managed_subscribe_btn}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══ Recipes Tab ═══ */}
      {tab === "recipes" && (
        <div className="popup-section">
          <div className="section-header">
            <span className="section-title">
              {showAllRecipes
                ? tr.popup_all_recipes
                : currentDomain
                  ? t(tr, "popup_recipes_for", { domain: currentDomain })
                  : tr.popup_recipes}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="action-btn"
                onClick={() => setShowAllRecipes(!showAllRecipes)}
                title={showAllRecipes ? tr.popup_back : tr.popup_all_recipes}
              >
                {showAllRecipes ? tr.popup_back : "\u{1F4D3}"}
              </button>
              <button className="action-btn" onClick={handleImportRecipe}>
                {tr.popup_import}
              </button>
            </div>
          </div>
          {displayRecipes.length === 0 ? (
            <p className="empty-text">
              {showAllRecipes
                ? tr.popup_no_recipes_all
                : t(tr, "popup_no_recipes_site", {
                    domain: currentDomain || "this site",
                  })}
            </p>
          ) : (
            <div className="recipe-list">
              {displayRecipes.map((r) => (
                <div
                  key={r.id}
                  className={`recipe-item ${r.enabled === false ? "disabled" : ""}`}
                >
                  <div className="recipe-info">
                    <div className="recipe-name">{r.name}</div>
                    <div className="recipe-domain">{r.domain}</div>
                  </div>
                  <div className="recipe-actions">
                    <button
                      className={`toggle-btn ${r.enabled !== false ? "active" : ""}`}
                      title={r.enabled !== false ? "Disable" : "Enable"}
                      onClick={() => handleToggleRecipe(r.id)}
                    >
                      {r.enabled !== false ? "ON" : "OFF"}
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteRecipe(r.id)}
                    >
                      {"\u2715"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Settings Tab ═══ */}
      {tab === "settings" && (
        <>
          <div className="popup-section">
            {/* Language */}
            <div className="setting-row">
              <div className="setting-label">{tr.popup_language}</div>
              <select
                className="setting-select"
                value={settings.language}
                onChange={(e) => {
                  const updated = { ...settings, language: e.target.value };
                  setSettings(updated);
                  saveSettings(updated);
                }}
              >
                <option value="auto">{tr.popup_language_auto}</option>
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Yolo Mode */}
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">{tr.popup_yolo_mode}</div>
                <div className="setting-desc">{tr.popup_yolo_desc}</div>
              </div>
              <button
                className={`toggle-btn ${settings.yoloMode ? "active" : ""}`}
                onClick={() => {
                  const updated = {
                    ...settings,
                    yoloMode: !settings.yoloMode,
                  };
                  setSettings(updated);
                  saveSettings(updated);
                }}
              >
                {settings.yoloMode ? "ON" : "OFF"}
              </button>
            </div>

            {/* Auto-import Recipes */}
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">
                  {tr.popup_auto_import_recipes}
                </div>
                <div className="setting-desc">
                  {tr.popup_auto_import_recipes_desc}
                </div>
              </div>
              <button
                className={`toggle-btn ${settings.autoImportRecipes ? "active" : ""}`}
                onClick={() => {
                  const updated = {
                    ...settings,
                    autoImportRecipes: !settings.autoImportRecipes,
                  };
                  setSettings(updated);
                  saveSettings(updated);
                }}
              >
                {settings.autoImportRecipes ? "ON" : "OFF"}
              </button>
            </div>

            {/* Avatar Size */}
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Avatar Size</div>
                <div className="setting-desc">
                  Size of the gyoza avatar widget on pages
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {(["small", "medium", "big"] as const).map((size) => (
                  <button
                    key={size}
                    className={`toggle-btn ${settings.agentSize === size ? "active" : ""}`}
                    style={{ fontSize: 11, padding: "4px 10px" }}
                    onClick={() => {
                      const updated = { ...settings, agentSize: size };
                      setSettings(updated);
                      saveSettings(updated);
                    }}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Typing Sound */}
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Typing Sound</div>
                <div className="setting-desc">
                  Play a subtle click sound during message typing animation
                </div>
              </div>
              <button
                className={`toggle-btn ${settings.typingSound ? "active" : ""}`}
                onClick={() => {
                  const updated = {
                    ...settings,
                    typingSound: !settings.typingSound,
                  };
                  setSettings(updated);
                  saveSettings(updated);
                }}
              >
                {settings.typingSound ? "ON" : "OFF"}
              </button>
            </div>

            {/* Bubble Opacity */}
            <div className="setting-row">
              <div className="setting-info">
                <div className="setting-label">Bubble Opacity</div>
                <div className="setting-desc">
                  Transparency of chat message bubbles (
                  {Math.round((settings.bubbleOpacity ?? 0.85) * 100)}%)
                </div>
              </div>
              <input
                type="range"
                min="0.3"
                max="1"
                step="0.05"
                value={settings.bubbleOpacity ?? 0.85}
                onChange={(e) => {
                  const updated = {
                    ...settings,
                    bubbleOpacity: parseFloat(e.target.value),
                  };
                  setSettings(updated);
                  saveSettings(updated);
                }}
                style={{ width: 80, accentColor: "#E8950A" }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
