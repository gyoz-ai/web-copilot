import React, { useState, useEffect } from "react";
import {
  getSettings,
  saveSettings,
  type ExtensionSettings,
} from "../../lib/storage";
import {
  getRecipes,
  getRecipesForDomain,
  removeRecipe,
  importRecipeFromFile,
  toggleRecipe,
  type StoredRecipe,
} from "../../lib/recipes";

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

function getStyles(isDark: boolean): Record<string, React.CSSProperties> {
  const BRAND = "#E8950A";

  return {
    container: {
      padding: 0,
      display: "flex",
      flexDirection: "column",
      background: isDark ? "#0a0a0f" : "#ffffff",
    },
    loading: {
      padding: 40,
      textAlign: "center",
      color: isDark ? "#71717a" : "#9ca3af",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 16px 12px",
      borderBottom: isDark ? "1px solid #2a2a3a" : "1px solid #e5e5e5",
      background: "inherit",
    },
    headerTitle: { display: "flex", alignItems: "center", gap: 8 },
    logo: { fontSize: 24 },
    title: { fontSize: 18, fontWeight: 700, color: BRAND },
    version: { fontSize: 11, color: isDark ? "#71717a" : "#9ca3af" },
    section: {
      padding: "12px 16px",
      borderBottom: isDark ? "1px solid #1a1a2e" : "1px solid #f3f4f6",
    },
    modeToggle: {
      display: "flex",
      gap: 0,
      borderRadius: 8,
      overflow: "hidden",
      border: isDark ? "1px solid #2a2a3a" : "1px solid #e5e5e5",
    },
    modeBtn: {
      flex: 1,
      padding: "8px 0",
      border: "none",
      background: isDark ? "#12121a" : "#fff",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 500,
      color: isDark ? "#71717a" : "#6b7280",
    },
    modeActive: {
      flex: 1,
      padding: "8px 0",
      border: "none",
      background: BRAND,
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 600,
      color: "#fff",
    },
    label: {
      display: "block",
      fontSize: 12,
      fontWeight: 500,
      color: isDark ? "#a1a1aa" : "#374151",
      marginBottom: 4,
      marginTop: 10,
    },
    select: {
      width: "100%",
      padding: "8px 10px",
      borderRadius: 6,
      border: isDark ? "1px solid #2a2a3a" : "1px solid #d1d5db",
      fontSize: 13,
      background: isDark ? "#12121a" : "#fff",
      color: isDark ? "#e4e4e7" : "#1a1a2e",
      outline: "none",
    },
    input: {
      flex: 1,
      padding: "8px 10px",
      borderRadius: 6,
      border: isDark ? "1px solid #2a2a3a" : "1px solid #d1d5db",
      fontSize: 13,
      background: isDark ? "#12121a" : "#fff",
      color: isDark ? "#e4e4e7" : "#1a1a2e",
      outline: "none",
    },
    keyRow: { display: "flex", gap: 6, alignItems: "center" },
    eyeBtn: {
      border: "none",
      background: "none",
      cursor: "pointer",
      fontSize: 16,
      padding: "4px",
    },
    saveBtn: {
      width: "100%",
      padding: "10px 0",
      borderRadius: 8,
      border: "none",
      background: BRAND,
      color: "#fff",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      marginTop: 14,
    },
    desc: {
      fontSize: 13,
      color: isDark ? "#71717a" : "#9ca3af",
      marginBottom: 12,
      lineHeight: "1.4",
    },
    statusRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      marginBottom: 10,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "#22c55e",
    },
    signOutBtn: {
      width: "100%",
      padding: "8px 0",
      borderRadius: 8,
      border: isDark ? "1px solid #2a2a3a" : "1px solid #d1d5db",
      background: isDark ? "#12121a" : "#fff",
      color: isDark ? "#71717a" : "#6b7280",
      fontSize: 13,
      cursor: "pointer",
    },
    sectionHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 600,
      color: isDark ? undefined : "#1a1a2e",
    },
    importBtn: {
      border: isDark ? "1px solid #2a2a3a" : "1px solid #d1d5db",
      borderRadius: 6,
      padding: "4px 10px",
      fontSize: 12,
      cursor: "pointer",
      background: isDark ? "#12121a" : "#fff",
      color: isDark ? "#a1a1aa" : "#374151",
    },
    emptyText: {
      fontSize: 12,
      color: isDark ? "#71717a" : "#9ca3af",
      lineHeight: "1.4",
    },
    recipeList: { display: "flex", flexDirection: "column", gap: 6 },
    recipeItem: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "8px 10px",
      borderRadius: 6,
      background: isDark ? "#12121a" : "#f9fafb",
      border: isDark ? "1px solid #1a1a2e" : "1px solid #f3f4f6",
    },
    recipeName: {
      fontSize: 13,
      fontWeight: 500,
      color: isDark ? "#e4e4e7" : "#1a1a2e",
    },
    recipeDomain: { fontSize: 11, color: isDark ? "#71717a" : "#9ca3af" },
    toggleBtn: {
      border: isDark ? "1px solid #2a2a3a" : "1px solid #d1d5db",
      borderRadius: 4,
      padding: "2px 6px",
      fontSize: 10,
      fontWeight: 600,
      cursor: "pointer",
      background: isDark ? "#12121a" : "#fff",
      color: isDark ? "#71717a" : "#6b7280",
    },
    deleteBtn: {
      border: "none",
      background: "none",
      cursor: "pointer",
      fontSize: 14,
      color: isDark ? "#71717a" : "#9ca3af",
      padding: "4px",
    },
    settingRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    settingLabel: {
      fontSize: 13,
      fontWeight: 500,
      color: isDark ? "#e4e4e7" : "#1a1a2e",
    },
    settingDesc: {
      fontSize: 11,
      color: isDark ? "#71717a" : "#9ca3af",
      marginTop: 2,
    },
  };
}

export function App() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [recipes, setRecipes] = useState<StoredRecipe[]>([]);
  const [currentDomain, setCurrentDomain] = useState<string>("");
  const [showAllRecipes, setShowAllRecipes] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings().then(setSettings);
    getRecipes().then(setRecipes);
    // Get current tab's domain
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          setCurrentDomain(new URL(tabs[0].url).host);
        } catch {}
      }
    });
  }, []);

  const isDark = !settings || settings.theme !== "light";
  const s = getStyles(isDark);

  // Sync body background/color with theme so scrollbar and any uncovered areas match
  useEffect(() => {
    document.body.style.background = isDark ? "#0a0a0f" : "#ffffff";
    document.body.style.color = isDark ? "#e4e4e7" : "#1a1a2e";
  }, [isDark]);

  if (!settings) return <div style={s.loading}>Loading...</div>;

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleImportRecipe = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml";
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
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTitle}>
          <img
            src="/icon-128.png"
            alt="gyozAI"
            style={{ width: 24, height: 24 }}
          />
          <span style={s.title}>gyoz.ai</span>
        </div>
        <span style={s.version}>v0.0.1</span>
      </div>

      {/* Mode Toggle */}
      <div style={s.section}>
        <div style={s.modeToggle}>
          <button
            style={settings.mode === "byok" ? s.modeActive : s.modeBtn}
            onClick={() => setSettings({ ...settings, mode: "byok" })}
          >
            BYOK
          </button>
          <button
            style={settings.mode === "managed" ? s.modeActive : s.modeBtn}
            onClick={() => setSettings({ ...settings, mode: "managed" })}
          >
            Managed
          </button>
        </div>
      </div>

      {/* BYOK Config */}
      {settings.mode === "byok" && (
        <div style={s.section}>
          <label style={s.label}>Provider</label>
          <select
            style={s.select}
            value={settings.provider}
            onChange={(e) => {
              const provider = e.target.value as ExtensionSettings["provider"];
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

          <label style={s.label}>API Key</label>
          <div style={s.keyRow}>
            <input
              type={showKey ? "text" : "password"}
              style={s.input}
              value={settings.apiKey}
              onChange={(e) =>
                setSettings({ ...settings, apiKey: e.target.value })
              }
              placeholder={`Enter ${PROVIDERS.find((p) => p.id === settings.provider)?.name} API key`}
            />
            <button style={s.eyeBtn} onClick={() => setShowKey(!showKey)}>
              {showKey ? "\u{1F648}" : "\u{1F441}\uFE0F"}
            </button>
          </div>

          <label style={s.label}>Model</label>
          <select
            style={s.select}
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

          <button style={s.saveBtn} onClick={handleSave}>
            {saved ? "\u2713 Saved" : "Save Settings"}
          </button>
        </div>
      )}

      {/* Managed Mode */}
      {settings.mode === "managed" && (
        <div style={s.section}>
          {settings.managedToken ? (
            <div>
              <div style={s.statusRow}>
                <span style={s.statusDot} />
                <span>Connected to gyozAI platform</span>
              </div>
              <button
                style={s.signOutBtn}
                onClick={() => {
                  setSettings({ ...settings, managedToken: undefined });
                  handleSave();
                }}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div>
              <p style={s.desc}>
                Subscribe to use gyozAI without your own API key.
              </p>
              <button
                style={s.saveBtn}
                onClick={() =>
                  chrome.tabs.create({ url: "https://gyoz.ai/subscribe" })
                }
              >
                Subscribe & Sign In
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recipes */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>
            {showAllRecipes
              ? "All Recipes"
              : `Recipes${currentDomain ? ` \u2014 ${currentDomain}` : ""}`}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              style={s.importBtn}
              onClick={() => setShowAllRecipes(!showAllRecipes)}
              title={
                showAllRecipes ? "Show current site" : "Manage all recipes"
              }
            >
              {showAllRecipes ? "\u2190 Back" : "\u{1F4D3}"}
            </button>
            <button style={s.importBtn} onClick={handleImportRecipe}>
              + Import
            </button>
          </div>
        </div>
        {displayRecipes.length === 0 ? (
          <p style={s.emptyText}>
            {showAllRecipes
              ? "No recipes installed yet."
              : `No recipes for ${currentDomain || "this site"}. Import an XML recipe to enhance AI navigation.`}
          </p>
        ) : (
          <div style={s.recipeList}>
            {displayRecipes.map((r) => (
              <div
                key={r.id}
                style={{
                  ...s.recipeItem,
                  opacity: r.enabled === false ? 0.5 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={s.recipeName}>{r.name}</div>
                  <div style={s.recipeDomain}>{r.domain}</div>
                </div>
                <button
                  style={s.toggleBtn}
                  title={r.enabled !== false ? "Disable" : "Enable"}
                  onClick={() => handleToggleRecipe(r.id)}
                >
                  {r.enabled !== false ? "ON" : "OFF"}
                </button>
                <button
                  style={s.deleteBtn}
                  onClick={() => handleDeleteRecipe(r.id)}
                >
                  {"\u2715"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Settings</span>
        </div>

        {/* Yolo Mode */}
        <div style={s.settingRow}>
          <div>
            <div style={s.settingLabel}>Yolo Mode</div>
            <div style={s.settingDesc}>
              Skip confirmations — AI acts immediately without asking
            </div>
          </div>
          <button
            style={s.toggleBtn}
            onClick={() => {
              const updated = { ...settings, yoloMode: !settings.yoloMode };
              setSettings(updated);
              saveSettings(updated);
            }}
          >
            {settings.yoloMode ? "ON" : "OFF"}
          </button>
        </div>

        {/* Theme */}
        <div style={s.settingRow}>
          <div style={s.settingLabel}>Theme</div>
          <div style={s.modeToggle}>
            <button
              style={
                settings.theme === "dark" || !settings.theme
                  ? s.modeActive
                  : s.modeBtn
              }
              onClick={() => {
                const updated = {
                  ...settings,
                  theme: "dark" as const,
                };
                setSettings(updated);
                saveSettings(updated);
              }}
            >
              Dark
            </button>
            <button
              style={settings.theme === "light" ? s.modeActive : s.modeBtn}
              onClick={() => {
                const updated = {
                  ...settings,
                  theme: "light" as const,
                };
                setSettings(updated);
                saveSettings(updated);
              }}
            >
              Light
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
