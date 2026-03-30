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
  { id: "openai", name: "OpenAI" },
  { id: "gemini", name: "Gemini (Google)" },
] as const;

const MODELS: Record<string, Array<{ id: string; name: string }>> = {
  claude: [
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet 4.5" },
    { id: "claude-opus-4-5-20251101", name: "Claude Opus 4.5" },
    { id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1" },
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-opus-4-20250514", name: "Claude Opus 4" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ],
};

type Tab = "provider" | "recipes" | "settings";

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<Tab>("provider");

  useEffect(() => {
    getSettings().then(setSettings);
    getRecipes().then(setRecipes);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
    await saveSettings(settings);
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
        <span className="popup-version">v0.0.1</span>
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
                onClick={() => setSettings({ ...settings, mode: "byok" })}
              >
                BYOK
              </button>
              <button
                className={`mode-btn ${settings.mode === "managed" ? "active" : ""}`}
                onClick={() => setSettings({ ...settings, mode: "managed" })}
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
                  value={settings.apiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, apiKey: e.target.value })
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
                  <div className="status-row">
                    <span className="status-dot" />
                    <span>{tr.popup_managed_connected}</span>
                  </div>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const updated = { ...settings, managedToken: undefined };
                      setSettings(updated);
                      saveSettings(updated);
                    }}
                  >
                    {tr.popup_managed_sign_out}
                  </button>
                </div>
              ) : (
                <div>
                  <p className="desc-text">{tr.popup_managed_subscribe_desc}</p>
                  <button
                    className="btn-primary"
                    onClick={() =>
                      chrome.tabs.create({ url: "https://gyoz.ai/subscribe" })
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
