// ─── Supported locales ──────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = [
  { code: "en", name: "\ud83c\uddfa\ud83c\uddf8 English" },
  { code: "pt-BR", name: "\ud83c\udde7\ud83c\uddf7 Portugu\u00eas (Brasil)" },
  { code: "pt-PT", name: "\ud83c\uddf5\ud83c\uddf9 Portugu\u00eas (Portugal)" },
  { code: "es", name: "\ud83c\uddea\ud83c\uddf8 Espa\u00f1ol" },
  { code: "fr", name: "\ud83c\uddeb\ud83c\uddf7 Fran\u00e7ais" },
  { code: "de", name: "\ud83c\udde9\ud83c\uddea Deutsch" },
  { code: "it", name: "\ud83c\uddee\ud83c\uddf9 Italiano" },
  { code: "nl", name: "\ud83c\uddf3\ud83c\uddf1 Nederlands" },
  { code: "pl", name: "\ud83c\uddf5\ud83c\uddf1 Polski" },
  {
    code: "ru",
    name: "\ud83c\uddf7\ud83c\uddfa \u0420\u0443\u0441\u0441\u043a\u0438\u0439",
  },
  {
    code: "uk",
    name: "\ud83c\uddfa\ud83c\udde6 \u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430",
  },
  {
    code: "el",
    name: "\ud83c\uddec\ud83c\uddf7 \u0395\u03bb\u03bb\u03b7\u03bd\u03b9\u03ba\u03ac",
  },
  { code: "tr", name: "\ud83c\uddf9\ud83c\uddf7 T\u00fcrk\u00e7e" },
  {
    code: "ar",
    name: "\ud83c\uddf8\ud83c\udde6 \u0627\u0644\u0639\u0631\u0628\u064a\u0629",
  },
  {
    code: "hi",
    name: "\ud83c\uddee\ud83c\uddf3 \u0939\u093f\u0928\u094d\u0926\u0940",
  },
  { code: "ja", name: "\ud83c\uddef\ud83c\uddf5 \u65e5\u672c\u8a9e" },
  { code: "ko", name: "\ud83c\uddf0\ud83c\uddf7 \ud55c\uad6d\uc5b4" },
  {
    code: "zh-CN",
    name: "\ud83c\udde8\ud83c\uddf3 \u4e2d\u6587(\u7b80\u4f53)",
  },
  {
    code: "zh-TW",
    name: "\ud83c\uddf9\ud83c\uddfc \u4e2d\u6587(\u7e41\u9ad4)",
  },
  { code: "th", name: "\ud83c\uddf9\ud83c\udded \u0e44\u0e17\u0e22" },
  { code: "vi", name: "\ud83c\uddfb\ud83c\uddf3 Ti\u1ebfng Vi\u1ec7t" },
  { code: "id", name: "\ud83c\uddee\ud83c\udde9 Bahasa Indonesia" },
  { code: "ms", name: "\ud83c\uddf2\ud83c\uddfe Bahasa Melayu" },
  { code: "sv", name: "\ud83c\uddf8\ud83c\uddea Svenska" },
  { code: "da", name: "\ud83c\udde9\ud83c\uddf0 Dansk" },
  { code: "fi", name: "\ud83c\uddeb\ud83c\uddee Suomi" },
  { code: "nb", name: "\ud83c\uddf3\ud83c\uddf4 Norsk" },
  { code: "cs", name: "\ud83c\udde8\ud83c\uddff \u010ce\u0161tina" },
  { code: "ro", name: "\ud83c\uddf7\ud83c\uddf4 Rom\u00e2n\u0103" },
  { code: "hu", name: "\ud83c\udded\ud83c\uddfa Magyar" },
  {
    code: "he",
    name: "\ud83c\uddee\ud83c\uddf1 \u05e2\u05d1\u05e8\u05d9\u05ea",
  },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

// ─── Translation keys ───────────────────────────────────────────────────────

export interface Translations {
  // Widget (content.tsx)
  widget_placeholder: string;
  widget_empty: string;
  widget_new_chat: string;
  widget_history: string;
  widget_settings: string;
  widget_no_conversations: string;
  widget_msg_count: string; // "{count} msgs"
  widget_just_now: string;
  widget_minutes_ago: string; // "{n}m ago"
  widget_hours_ago: string; // "{n}h ago"
  widget_days_ago: string; // "{n}d ago"
  widget_recipe_imported: string; // "Recipe auto-imported from {name}"
  widget_delete_conversation: string;
  widget_status_thinking: string;
  widget_status_idling: string;
  widget_stopped: string;
  widget_confirm_allow: string;
  widget_confirm_deny: string;
  widget_shortcut_tip: string; // "Tip: press {shortcut} to talk to me anytime"

  // Status pill — tool actions
  status_navigating: string; // "Navigating to {url}"
  status_navigated_to: string; // "Navigated to {path}"
  status_clicked: string; // "Clicked element"
  status_highlighted: string; // "Highlighted element"
  status_reading_page: string; // "Reading page"
  status_fetching: string; // "Fetching data"
  status_filling: string; // "Filling input"
  status_selecting: string; // "Selecting option"
  status_toggling: string; // "Toggling checkbox"
  status_submitting: string; // "Submitting form"
  status_scrolling: string; // "Scrolling"
  status_searching: string; // "Searching page"
  status_extracting: string; // "Extracting table"

  // Popup (App.tsx)
  popup_loading: string;
  popup_provider: string;
  popup_api_key: string;
  popup_api_key_placeholder: string; // "Enter {provider} API key"
  popup_model: string;
  popup_save: string;
  popup_saved: string;
  popup_mode_pro: string;
  popup_mode_own_key: string;
  popup_managed_connected: string;
  popup_managed_sign_out: string;
  popup_managed_subscribe_desc: string;
  popup_managed_subscribe_btn: string;
  popup_recipes: string;
  popup_all_recipes: string;
  popup_recipes_for: string; // "Recipes — {domain}"
  popup_no_recipes_all: string;
  popup_no_recipes_site: string; // "No recipes for {domain}..."
  popup_import: string;
  popup_back: string;
  popup_settings: string;
  popup_yolo_mode: string;
  popup_yolo_desc: string;
  popup_chat_only: string;
  popup_chat_only_desc: string;
  popup_sticky_chat: string;
  popup_sticky_chat_desc: string;
  popup_auto_import_recipes: string;
  popup_auto_import_recipes_desc: string;
  popup_theme: string;
  popup_dark: string;
  popup_light: string;
  popup_language: string;
  popup_language_auto: string;
}

// ─── Translation data ───────────────────────────────────────────────────────

const en: Translations = {
  widget_placeholder: "Ask me anything...",
  widget_empty: "Ask me anything about this page...",
  widget_new_chat: "New chat",
  widget_history: "Conversation history",
  widget_settings: "Settings",
  widget_no_conversations: "No conversations yet",
  widget_msg_count: "{count} msgs",
  widget_just_now: "just now",
  widget_minutes_ago: "{n}m ago",
  widget_hours_ago: "{n}h ago",
  widget_days_ago: "{n}d ago",
  widget_recipe_imported: "Recipe auto-imported from {name}",
  widget_delete_conversation: "Delete conversation",
  widget_status_thinking: "Thinking...",
  widget_status_idling: "Idling...",
  widget_stopped: "Stopped.",
  widget_confirm_allow: "Allow",
  widget_confirm_deny: "Deny",
  widget_shortcut_tip: "Tip: press {shortcut} to talk to me anytime",
  status_navigating: "Navigating to {url}",
  status_navigated_to: "Navigated to {path}",
  status_clicked: "Clicked element",
  status_highlighted: "Highlighted element",
  status_reading_page: "Reading page",
  status_fetching: "Fetching data",
  status_filling: "Filling input",
  status_selecting: "Selecting option",
  status_toggling: "Toggling checkbox",
  status_submitting: "Submitting form",
  status_scrolling: "Scrolling",
  status_searching: "Searching page",
  status_extracting: "Extracting table",
  popup_loading: "Loading...",
  popup_provider: "Provider",
  popup_api_key: "API Key",
  popup_api_key_placeholder: "Enter {provider} API key",
  popup_model: "Model",
  popup_save: "Save Settings",
  popup_saved: "Saved",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Own key",
  popup_managed_connected: "Connected to gyoza platform",
  popup_managed_sign_out: "Sign Out",
  popup_managed_subscribe_desc:
    "Get started with gyoza Pro — no API key needed.",
  popup_managed_subscribe_btn: "Get Started",
  popup_recipes: "Recipes",
  popup_all_recipes: "All Recipes",
  popup_recipes_for: "Recipes \u2014 {domain}",
  popup_no_recipes_all: "No recipes installed yet.",
  popup_no_recipes_site:
    "No recipes for {domain}. Import a recipe to enhance AI navigation.",
  popup_import: "+ Import",
  popup_back: "\u2190 Back",
  popup_settings: "Settings",
  popup_yolo_mode: "Yolo Mode",
  popup_yolo_desc: "Skip confirmations — AI acts immediately without asking",
  popup_chat_only: "Chat Only",
  popup_chat_only_desc:
    "Only chat and read pages — no clicks, forms, or navigation",
  popup_sticky_chat: "Sticky Chat",
  popup_sticky_chat_desc:
    "Keep chatbox open — ignore cursor proximity and stay visible",
  popup_auto_import_recipes: "Auto-import Recipes",
  popup_auto_import_recipes_desc:
    "Automatically import llms.txt recipes from websites you visit",
  popup_theme: "Theme",
  popup_dark: "Dark",
  popup_light: "Light",
  popup_language: "Language",
  popup_language_auto: "Auto (browser)",
};

const ptBR: Translations = {
  widget_placeholder: "Pergunte qualquer coisa...",
  widget_empty: "Pergunte qualquer coisa sobre esta p\u00e1gina...",
  widget_new_chat: "Novo chat",
  widget_history: "Hist\u00f3rico de conversas",
  widget_settings: "Configura\u00e7\u00f5es",
  widget_no_conversations: "Nenhuma conversa ainda",
  widget_msg_count: "{count} msgs",
  widget_just_now: "agora",
  widget_minutes_ago: "{n}min atr\u00e1s",
  widget_hours_ago: "{n}h atr\u00e1s",
  widget_days_ago: "{n}d atr\u00e1s",
  widget_recipe_imported: "Receita importada automaticamente de {name}",
  widget_delete_conversation: "Excluir conversa",
  widget_status_thinking: "Pensando...",
  widget_status_idling: "Ocioso...",
  widget_stopped: "Parado.",
  widget_confirm_allow: "Permitir",
  widget_confirm_deny: "Negar",
  widget_shortcut_tip:
    "Dica: pressione {shortcut} para falar comigo a qualquer momento",
  status_navigating: "Navegando para {url}",
  status_navigated_to: "Navegou para {path}",
  status_clicked: "Elemento clicado",
  status_highlighted: "Elemento destacado",
  status_reading_page: "Lendo a página",
  status_fetching: "Buscando dados",
  status_filling: "Preenchendo campo",
  status_selecting: "Selecionando opção",
  status_toggling: "Alternando checkbox",
  status_submitting: "Enviando formulário",
  status_scrolling: "Rolando",
  status_searching: "Pesquisando na página",
  status_extracting: "Extraindo tabela",
  popup_loading: "Carregando...",
  popup_provider: "Provedor",
  popup_api_key: "Chave de API",
  popup_api_key_placeholder: "Insira a chave de API do {provider}",
  popup_model: "Modelo",
  popup_save: "Salvar Configura\u00e7\u00f5es",
  popup_saved: "Salvo",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Própria chave",
  popup_managed_connected: "Conectado à plataforma gyoza",
  popup_managed_sign_out: "Sair",
  popup_managed_subscribe_desc:
    "Comece com o gyoza Pro — sem chave de API necessária.",
  popup_managed_subscribe_btn: "Começar",
  popup_recipes: "Receitas",
  popup_all_recipes: "Todas as Receitas",
  popup_recipes_for: "Receitas \u2014 {domain}",
  popup_no_recipes_all: "Nenhuma receita instalada.",
  popup_no_recipes_site:
    "Nenhuma receita para {domain}. Importe uma receita para melhorar a navega\u00e7\u00e3o com IA.",
  popup_import: "+ Importar",
  popup_back: "\u2190 Voltar",
  popup_settings: "Configura\u00e7\u00f5es",
  popup_yolo_mode: "Modo Yolo",
  popup_yolo_desc:
    "Pular confirma\u00e7\u00f5es \u2014 IA age imediatamente sem perguntar",
  popup_chat_only: "Apenas Chat",
  popup_chat_only_desc:
    "Apenas conversar e ler p\u00e1ginas \u2014 sem cliques, formul\u00e1rios ou navega\u00e7\u00e3o",
  popup_sticky_chat: "Chat Fixo",
  popup_sticky_chat_desc:
    "Manter chat aberto \u2014 ignorar proximidade do cursor e ficar vis\u00edvel",
  popup_auto_import_recipes: "Importar Receitas Automaticamente",
  popup_auto_import_recipes_desc:
    "Importar automaticamente receitas llms.txt dos sites que você visita",
  popup_theme: "Tema",
  popup_dark: "Escuro",
  popup_light: "Claro",
  popup_language: "Idioma",
  popup_language_auto: "Autom\u00e1tico (navegador)",
};

const ptPT: Translations = {
  ...ptBR,
  widget_empty: "Pergunte qualquer coisa sobre esta p\u00e1gina...",
  widget_no_conversations: "Ainda sem conversas",
  widget_recipe_imported: "Receita importada automaticamente de {name}",
  widget_delete_conversation: "Eliminar conversa",
  popup_mode_own_key: "Própria chave",
  popup_managed_sign_out: "Terminar Sessão",
  popup_managed_subscribe_desc:
    "Comece com o gyoza Pro — sem chave de API necessária.",
  popup_managed_subscribe_btn: "Começar",
  popup_no_recipes_site:
    "Sem receitas para {domain}. Importe uma receita para melhorar a navega\u00e7\u00e3o com IA.",
  popup_import: "+ Importar",
  popup_back: "\u2190 Voltar",
  popup_language_auto: "Autom\u00e1tico (navegador)",
};

const es: Translations = {
  widget_placeholder: "Pregunta lo que quieras...",
  widget_empty: "Pregunta cualquier cosa sobre esta p\u00e1gina...",
  widget_new_chat: "Nuevo chat",
  widget_history: "Historial de conversaciones",
  widget_settings: "Ajustes",
  widget_no_conversations: "A\u00fan no hay conversaciones",
  widget_msg_count: "{count} msgs",
  widget_just_now: "ahora",
  widget_minutes_ago: "hace {n}m",
  widget_hours_ago: "hace {n}h",
  widget_days_ago: "hace {n}d",
  widget_recipe_imported: "Receta importada autom\u00e1ticamente de {name}",
  widget_delete_conversation: "Eliminar conversaci\u00f3n",
  widget_status_thinking: "Pensando...",
  widget_status_idling: "Inactivo...",
  widget_stopped: "Detenido.",
  widget_confirm_allow: "Permitir",
  widget_confirm_deny: "Denegar",
  widget_shortcut_tip:
    "Consejo: pulsa {shortcut} para hablar conmigo en cualquier momento",
  status_navigating: "Navegando a {url}",
  status_navigated_to: "Navegó a {path}",
  status_clicked: "Elemento clicado",
  status_highlighted: "Elemento resaltado",
  status_reading_page: "Leyendo p\u00e1gina",
  status_fetching: "Obteniendo datos",
  status_filling: "Rellenando campo",
  status_selecting: "Seleccionando opci\u00f3n",
  status_toggling: "Alternando casilla",
  status_submitting: "Enviando formulario",
  status_scrolling: "Desplazando",
  status_searching: "Buscando en p\u00e1gina",
  status_extracting: "Extrayendo tabla",
  popup_loading: "Cargando...",
  popup_provider: "Proveedor",
  popup_api_key: "Clave de API",
  popup_api_key_placeholder: "Introduce la clave de API de {provider}",
  popup_model: "Modelo",
  popup_save: "Guardar Ajustes",
  popup_saved: "Guardado",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Tu propia clave",
  popup_managed_connected: "Conectado a la plataforma gyoza",
  popup_managed_sign_out: "Cerrar Sesi\u00f3n",
  popup_managed_subscribe_desc:
    "Empieza con gyoza Pro \u2014 sin clave de API.",
  popup_managed_subscribe_btn: "Empezar",
  popup_recipes: "Recetas",
  popup_all_recipes: "Todas las Recetas",
  popup_recipes_for: "Recetas \u2014 {domain}",
  popup_no_recipes_all: "A\u00fan no hay recetas instaladas.",
  popup_no_recipes_site:
    "Sin recetas para {domain}. Importa una receta para mejorar la navegaci\u00f3n con IA.",
  popup_import: "+ Importar",
  popup_back: "\u2190 Volver",
  popup_settings: "Ajustes",
  popup_yolo_mode: "Modo Yolo",
  popup_yolo_desc:
    "Omitir confirmaciones \u2014 la IA act\u00faa inmediatamente sin preguntar",
  popup_chat_only: "Solo Chat",
  popup_chat_only_desc:
    "Solo chatear y leer p\u00e1ginas \u2014 sin clics, formularios ni navegaci\u00f3n",
  popup_sticky_chat: "Chat Fijo",
  popup_sticky_chat_desc:
    "Mantener chat abierto \u2014 ignorar proximidad del cursor y permanecer visible",
  popup_auto_import_recipes: "Importar Recetas Automáticamente",
  popup_auto_import_recipes_desc:
    "Importar automáticamente recetas llms.txt de los sitios que visitas",
  popup_theme: "Tema",
  popup_dark: "Oscuro",
  popup_light: "Claro",
  popup_language: "Idioma",
  popup_language_auto: "Autom\u00e1tico (navegador)",
};

const fr: Translations = {
  widget_placeholder: "Demandez n'importe quoi...",
  widget_empty: "Posez une question sur cette page...",
  widget_new_chat: "Nouveau chat",
  widget_history: "Historique des conversations",
  widget_settings: "Param\u00e8tres",
  widget_no_conversations: "Aucune conversation pour le moment",
  widget_msg_count: "{count} msgs",
  widget_just_now: "\u00e0 l'instant",
  widget_minutes_ago: "il y a {n}m",
  widget_hours_ago: "il y a {n}h",
  widget_days_ago: "il y a {n}j",
  widget_recipe_imported: "Recette import\u00e9e automatiquement depuis {name}",
  widget_delete_conversation: "Supprimer la conversation",
  widget_status_thinking: "R\u00e9flexion...",
  widget_status_idling: "Inactif...",
  widget_stopped: "Arr\u00eat\u00e9.",
  widget_confirm_allow: "Autoriser",
  widget_confirm_deny: "Refuser",
  widget_shortcut_tip:
    "Astuce\u00a0: appuyez sur {shortcut} pour me parler \u00e0 tout moment",
  status_navigating: "Navigation vers {url}",
  status_navigated_to: "Navigu\u00e9 vers {path}",
  status_clicked: "\u00c9l\u00e9ment cliqu\u00e9",
  status_highlighted: "\u00c9l\u00e9ment surlign\u00e9",
  status_reading_page: "Lecture de la page",
  status_fetching: "R\u00e9cup\u00e9ration des donn\u00e9es",
  status_filling: "Remplissage du champ",
  status_selecting: "S\u00e9lection d'option",
  status_toggling: "Basculement de case",
  status_submitting: "Envoi du formulaire",
  status_scrolling: "D\u00e9filement",
  status_searching: "Recherche dans la page",
  status_extracting: "Extraction du tableau",
  popup_loading: "Chargement...",
  popup_provider: "Fournisseur",
  popup_api_key: "Cl\u00e9 API",
  popup_api_key_placeholder: "Entrez la cl\u00e9 API {provider}",
  popup_model: "Mod\u00e8le",
  popup_save: "Enregistrer",
  popup_saved: "Enregistr\u00e9",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Ta propre cl\u00e9",
  popup_managed_connected: "Connect\u00e9 \u00e0 la plateforme gyoza",
  popup_managed_sign_out: "Se D\u00e9connecter",
  popup_managed_subscribe_desc:
    "Commencez avec gyoza Pro \u2014 pas besoin de cl\u00e9 API.",
  popup_managed_subscribe_btn: "Commencer",
  popup_recipes: "Recettes",
  popup_all_recipes: "Toutes les Recettes",
  popup_recipes_for: "Recettes \u2014 {domain}",
  popup_no_recipes_all: "Aucune recette install\u00e9e.",
  popup_no_recipes_site:
    "Aucune recette pour {domain}. Importez une recette pour am\u00e9liorer la navigation IA.",
  popup_import: "+ Importer",
  popup_back: "\u2190 Retour",
  popup_settings: "Param\u00e8tres",
  popup_yolo_mode: "Mode Yolo",
  popup_yolo_desc:
    "Ignorer les confirmations \u2014 l'IA agit imm\u00e9diatement sans demander",
  popup_chat_only: "Chat uniquement",
  popup_chat_only_desc:
    "Seulement discuter et lire les pages \u2014 pas de clics, formulaires ou navigation",
  popup_sticky_chat: "Chat \u00c9pingl\u00e9",
  popup_sticky_chat_desc:
    "Garder le chat ouvert \u2014 ignorer la proximit\u00e9 du curseur et rester visible",
  popup_auto_import_recipes: "Importer les recettes automatiquement",
  popup_auto_import_recipes_desc:
    "Importer automatiquement les recettes llms.txt des sites que vous visitez",
  popup_theme: "Th\u00e8me",
  popup_dark: "Sombre",
  popup_light: "Clair",
  popup_language: "Langue",
  popup_language_auto: "Automatique (navigateur)",
};

const de: Translations = {
  widget_placeholder: "Frag mich etwas...",
  widget_empty: "Frag mich etwas \u00fcber diese Seite...",
  widget_new_chat: "Neuer Chat",
  widget_history: "Gespr\u00e4chsverlauf",
  widget_settings: "Einstellungen",
  widget_no_conversations: "Noch keine Gespr\u00e4che",
  widget_msg_count: "{count} Nachr.",
  widget_just_now: "gerade eben",
  widget_minutes_ago: "vor {n}Min",
  widget_hours_ago: "vor {n}Std",
  widget_days_ago: "vor {n}T",
  widget_recipe_imported: "Rezept automatisch importiert von {name}",
  widget_delete_conversation: "Gespr\u00e4ch l\u00f6schen",
  widget_status_thinking: "Denkt nach...",
  widget_status_idling: "Leerlauf...",
  widget_stopped: "Gestoppt.",
  widget_confirm_allow: "Erlauben",
  widget_confirm_deny: "Ablehnen",
  widget_shortcut_tip:
    "Tipp: Dr\u00fccke {shortcut}, um jederzeit mit mir zu sprechen",
  status_navigating: "Navigiert zu {url}",
  status_navigated_to: "Navigiert zu {path}",
  status_clicked: "Element angeklickt",
  status_highlighted: "Element hervorgehoben",
  status_reading_page: "Seite wird gelesen",
  status_fetching: "Daten werden abgerufen",
  status_filling: "Feld wird ausgef\u00fcllt",
  status_selecting: "Option wird ausgew\u00e4hlt",
  status_toggling: "Kontrollk\u00e4stchen umschalten",
  status_submitting: "Formular wird gesendet",
  status_scrolling: "Scrollen",
  status_searching: "Seite durchsuchen",
  status_extracting: "Tabelle extrahieren",
  popup_loading: "Laden...",
  popup_provider: "Anbieter",
  popup_api_key: "API-Schl\u00fcssel",
  popup_api_key_placeholder: "{provider} API-Schl\u00fcssel eingeben",
  popup_model: "Modell",
  popup_save: "Einstellungen Speichern",
  popup_saved: "Gespeichert",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Eigener Schl\u00fcssel",
  popup_managed_connected: "Verbunden mit der gyoza-Plattform",
  popup_managed_sign_out: "Abmelden",
  popup_managed_subscribe_desc:
    "Starte mit gyoza Pro \u2014 kein API-Schl\u00fcssel n\u00f6tig.",
  popup_managed_subscribe_btn: "Loslegen",
  popup_recipes: "Rezepte",
  popup_all_recipes: "Alle Rezepte",
  popup_recipes_for: "Rezepte \u2014 {domain}",
  popup_no_recipes_all: "Noch keine Rezepte installiert.",
  popup_no_recipes_site:
    "Keine Rezepte f\u00fcr {domain}. Importieren Sie ein Rezept, um die KI-Navigation zu verbessern.",
  popup_import: "+ Importieren",
  popup_back: "\u2190 Zur\u00fcck",
  popup_settings: "Einstellungen",
  popup_yolo_mode: "Yolo-Modus",
  popup_yolo_desc:
    "Best\u00e4tigungen \u00fcberspringen \u2014 KI handelt sofort ohne zu fragen",
  popup_chat_only: "Nur Chat",
  popup_chat_only_desc:
    "Nur chatten und Seiten lesen \u2014 keine Klicks, Formulare oder Navigation",
  popup_sticky_chat: "Chat Fixiert",
  popup_sticky_chat_desc:
    "Chat ge\u00f6ffnet halten \u2014 Cursorn\u00e4he ignorieren und sichtbar bleiben",
  popup_auto_import_recipes: "Rezepte automatisch importieren",
  popup_auto_import_recipes_desc:
    "llms.txt-Rezepte automatisch von besuchten Websites importieren",
  popup_theme: "Design",
  popup_dark: "Dunkel",
  popup_light: "Hell",
  popup_language: "Sprache",
  popup_language_auto: "Automatisch (Browser)",
};

const it: Translations = {
  widget_placeholder: "Chiedi qualcosa...",
  widget_empty: "Chiedi qualcosa su questa pagina...",
  widget_new_chat: "Nuova chat",
  widget_history: "Cronologia conversazioni",
  widget_settings: "Impostazioni",
  widget_no_conversations: "Nessuna conversazione ancora",
  widget_msg_count: "{count} msg",
  widget_just_now: "adesso",
  widget_minutes_ago: "{n}min fa",
  widget_hours_ago: "{n}h fa",
  widget_days_ago: "{n}g fa",
  widget_recipe_imported: "Ricetta importata automaticamente da {name}",
  widget_delete_conversation: "Elimina conversazione",
  widget_status_thinking: "Sto pensando...",
  widget_status_idling: "Inattivo...",
  widget_stopped: "Fermato.",
  widget_confirm_allow: "Consenti",
  widget_confirm_deny: "Nega",
  widget_shortcut_tip:
    "Suggerimento: premi {shortcut} per parlarmi in qualsiasi momento",
  status_navigating: "Navigazione verso {url}",
  status_navigated_to: "Navigato a {path}",
  status_clicked: "Elemento cliccato",
  status_highlighted: "Elemento evidenziato",
  status_reading_page: "Lettura pagina",
  status_fetching: "Recupero dati",
  status_filling: "Compilazione campo",
  status_selecting: "Selezione opzione",
  status_toggling: "Cambio casella",
  status_submitting: "Invio modulo",
  status_scrolling: "Scorrimento",
  status_searching: "Ricerca nella pagina",
  status_extracting: "Estrazione tabella",
  popup_loading: "Caricamento...",
  popup_provider: "Provider",
  popup_api_key: "Chiave API",
  popup_api_key_placeholder: "Inserisci la chiave API di {provider}",
  popup_model: "Modello",
  popup_save: "Salva Impostazioni",
  popup_saved: "Salvato",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "La tua chiave",
  popup_managed_connected: "Connesso alla piattaforma gyoza",
  popup_managed_sign_out: "Esci",
  popup_managed_subscribe_desc:
    "Inizia con gyoza Pro — nessuna chiave API necessaria.",
  popup_managed_subscribe_btn: "Inizia",
  popup_recipes: "Ricette",
  popup_all_recipes: "Tutte le Ricette",
  popup_recipes_for: "Ricette \u2014 {domain}",
  popup_no_recipes_all: "Nessuna ricetta installata.",
  popup_no_recipes_site:
    "Nessuna ricetta per {domain}. Importa una ricetta per migliorare la navigazione IA.",
  popup_import: "+ Importa",
  popup_back: "\u2190 Indietro",
  popup_settings: "Impostazioni",
  popup_yolo_mode: "Modalit\u00e0 Yolo",
  popup_yolo_desc:
    "Salta le conferme \u2014 l'IA agisce immediatamente senza chiedere",
  popup_chat_only: "Solo Chat",
  popup_chat_only_desc:
    "Solo chattare e leggere pagine \u2014 nessun clic, moduli o navigazione",
  popup_sticky_chat: "Chat Fisso",
  popup_sticky_chat_desc:
    "Mantieni la chat aperta \u2014 ignora la prossimit\u00e0 del cursore e resta visibile",
  popup_auto_import_recipes: "Importa ricette automaticamente",
  popup_auto_import_recipes_desc:
    "Importa automaticamente le ricette llms.txt dai siti che visiti",
  popup_theme: "Tema",
  popup_dark: "Scuro",
  popup_light: "Chiaro",
  popup_language: "Lingua",
  popup_language_auto: "Automatico (browser)",
};

const nl: Translations = {
  widget_placeholder: "Vraag me iets...",
  widget_empty: "Vraag me iets over deze pagina...",
  widget_new_chat: "Nieuw gesprek",
  widget_history: "Gespreksgeschiedenis",
  widget_settings: "Instellingen",
  widget_no_conversations: "Nog geen gesprekken",
  widget_msg_count: "{count} ber.",
  widget_just_now: "zojuist",
  widget_minutes_ago: "{n}min geleden",
  widget_hours_ago: "{n}u geleden",
  widget_days_ago: "{n}d geleden",
  widget_recipe_imported: "Recept automatisch ge\u00efmporteerd van {name}",
  widget_delete_conversation: "Gesprek verwijderen",
  widget_status_thinking: "Nadenken...",
  widget_status_idling: "Inactief...",
  widget_stopped: "Gestopt.",
  widget_confirm_allow: "Toestaan",
  widget_confirm_deny: "Weigeren",
  widget_shortcut_tip: "Tip: druk op {shortcut} om altijd met me te praten",
  status_navigating: "Navigeren naar {url}",
  status_navigated_to: "Genavigeerd naar {path}",
  status_clicked: "Element aangeklikt",
  status_highlighted: "Element gemarkeerd",
  status_reading_page: "Pagina lezen",
  status_fetching: "Gegevens ophalen",
  status_filling: "Veld invullen",
  status_selecting: "Optie selecteren",
  status_toggling: "Selectievakje wisselen",
  status_submitting: "Formulier verzenden",
  status_scrolling: "Scrollen",
  status_searching: "Pagina doorzoeken",
  status_extracting: "Tabel extraheren",
  popup_loading: "Laden...",
  popup_provider: "Aanbieder",
  popup_api_key: "API-sleutel",
  popup_api_key_placeholder: "Voer {provider} API-sleutel in",
  popup_model: "Model",
  popup_save: "Instellingen Opslaan",
  popup_saved: "Opgeslagen",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Eigen sleutel",
  popup_managed_connected: "Verbonden met gyoza-platform",
  popup_managed_sign_out: "Uitloggen",
  popup_managed_subscribe_desc: "Begin met gyoza Pro — geen API-sleutel nodig.",
  popup_managed_subscribe_btn: "Beginnen",
  popup_recipes: "Recepten",
  popup_all_recipes: "Alle Recepten",
  popup_recipes_for: "Recepten \u2014 {domain}",
  popup_no_recipes_all: "Nog geen recepten ge\u00efnstalleerd.",
  popup_no_recipes_site:
    "Geen recepten voor {domain}. Importeer een recept om AI-navigatie te verbeteren.",
  popup_import: "+ Importeren",
  popup_back: "\u2190 Terug",
  popup_settings: "Instellingen",
  popup_yolo_mode: "Yolo-modus",
  popup_yolo_desc:
    "Bevestigingen overslaan \u2014 AI handelt direct zonder te vragen",
  popup_chat_only: "Alleen Chat",
  popup_chat_only_desc:
    "Alleen chatten en pagina's lezen \u2014 geen klikken, formulieren of navigatie",
  popup_sticky_chat: "Vaste Chat",
  popup_sticky_chat_desc:
    "Chat open houden \u2014 cursorproximiteit negeren en zichtbaar blijven",
  popup_auto_import_recipes: "Recepten automatisch importeren",
  popup_auto_import_recipes_desc:
    "Automatisch llms.txt-recepten importeren van bezochte websites",
  popup_theme: "Thema",
  popup_dark: "Donker",
  popup_light: "Licht",
  popup_language: "Taal",
  popup_language_auto: "Automatisch (browser)",
};

const pl: Translations = {
  widget_placeholder: "Zapytaj o cokolwiek...",
  widget_empty: "Zapytaj o cokolwiek na tej stronie...",
  widget_new_chat: "Nowy czat",
  widget_history: "Historia rozm\u00f3w",
  widget_settings: "Ustawienia",
  widget_no_conversations: "Brak rozm\u00f3w",
  widget_msg_count: "{count} wiad.",
  widget_just_now: "w\u0142a\u015bnie",
  widget_minutes_ago: "{n}min temu",
  widget_hours_ago: "{n}godz. temu",
  widget_days_ago: "{n}d temu",
  widget_recipe_imported: "Przepis automatycznie zaimportowany z {name}",
  widget_delete_conversation: "Usu\u0144 rozmow\u0119",
  widget_status_thinking: "My\u015bl\u0119...",
  widget_status_idling: "Bezczynno\u015b\u0107...",
  widget_stopped: "Zatrzymano.",
  widget_confirm_allow: "Zezw\u00f3l",
  widget_confirm_deny: "Odrzu\u0107",
  widget_shortcut_tip:
    "Wskaz\u00f3wka: naci\u015bnij {shortcut}, aby porozmawiaj ze mn\u0105 w dowolnym momencie",
  status_navigating: "Przechodzenie do {url}",
  status_navigated_to: "Przeszed\u0142 do {path}",
  status_clicked: "Klikni\u0119to element",
  status_highlighted: "Wyr\u00f3\u017cniono element",
  status_reading_page: "Czytanie strony",
  status_fetching: "Pobieranie danych",
  status_filling: "Wype\u0142nianie pola",
  status_selecting: "Wybieranie opcji",
  status_toggling: "Prze\u0142\u0105czanie pola wyboru",
  status_submitting: "Wysy\u0142anie formularza",
  status_scrolling: "Przewijanie",
  status_searching: "Przeszukiwanie strony",
  status_extracting: "Wyodr\u0119bnianie tabeli",
  popup_loading: "\u0141adowanie...",
  popup_provider: "Dostawca",
  popup_api_key: "Klucz API",
  popup_api_key_placeholder: "Wprowad\u017a klucz API {provider}",
  popup_model: "Model",
  popup_save: "Zapisz Ustawienia",
  popup_saved: "Zapisano",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "W\u0142asny klucz",
  popup_managed_connected: "Po\u0142\u0105czono z platform\u0105 gyoza",
  popup_managed_sign_out: "Wyloguj",
  popup_managed_subscribe_desc: "Zacznij z gyoza Pro \u2014 bez klucza API.",
  popup_managed_subscribe_btn: "Rozpocznij",
  popup_recipes: "Przepisy",
  popup_all_recipes: "Wszystkie Przepisy",
  popup_recipes_for: "Przepisy \u2014 {domain}",
  popup_no_recipes_all: "Brak zainstalowanych przepis\u00f3w.",
  popup_no_recipes_site:
    "Brak przepis\u00f3w dla {domain}. Importuj przepis, aby poprawi\u0107 nawigacj\u0119 AI.",
  popup_import: "+ Importuj",
  popup_back: "\u2190 Wstecz",
  popup_settings: "Ustawienia",
  popup_yolo_mode: "Tryb Yolo",
  popup_yolo_desc:
    "Pomi\u0144 potwierdzenia \u2014 AI dzia\u0142a natychmiast bez pytania",
  popup_chat_only: "Tylko Chat",
  popup_chat_only_desc:
    "Tylko czat i czytanie stron \u2014 bez klikania, formularzy i nawigacji",
  popup_sticky_chat: "Przypi\u0119ty Chat",
  popup_sticky_chat_desc:
    "Utrzymuj chat otwarty \u2014 ignoruj blisko\u015b\u0107 kursora i pozostawaj widoczny",
  popup_auto_import_recipes: "Automatycznie importuj przepisy",
  popup_auto_import_recipes_desc:
    "Automatycznie importuj przepisy llms.txt z odwiedzanych stron",
  popup_theme: "Motyw",
  popup_dark: "Ciemny",
  popup_light: "Jasny",
  popup_language: "J\u0119zyk",
  popup_language_auto: "Automatyczny (przegl\u0105darka)",
};

const ru: Translations = {
  widget_placeholder:
    "\u0421\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u0447\u0442\u043e \u0443\u0433\u043e\u0434\u043d\u043e...",
  widget_empty:
    "\u0421\u043f\u0440\u043e\u0441\u0438\u0442\u0435 \u0447\u0442\u043e-\u043d\u0438\u0431\u0443\u0434\u044c \u043e\u0431 \u044d\u0442\u043e\u0439 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435...",
  widget_new_chat: "\u041d\u043e\u0432\u044b\u0439 \u0447\u0430\u0442",
  widget_history:
    "\u0418\u0441\u0442\u043e\u0440\u0438\u044f \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440\u043e\u0432",
  widget_settings: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
  widget_no_conversations:
    "\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440\u043e\u0432",
  widget_msg_count: "{count} \u0441\u043e\u043e\u0431\u0449.",
  widget_just_now: "\u0442\u043e\u043b\u044c\u043a\u043e \u0447\u0442\u043e",
  widget_minutes_ago: "{n}\u043c\u0438\u043d \u043d\u0430\u0437\u0430\u0434",
  widget_hours_ago: "{n}\u0447 \u043d\u0430\u0437\u0430\u0434",
  widget_days_ago: "{n}\u0434 \u043d\u0430\u0437\u0430\u0434",
  widget_recipe_imported:
    "\u0420\u0435\u0446\u0435\u043f\u0442 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u0438\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u043e\u0432\u0430\u043d \u0438\u0437 {name}",
  widget_delete_conversation:
    "\u0423\u0434\u0430\u043b\u0438\u0442\u044c \u0440\u0430\u0437\u0433\u043e\u0432\u043e\u0440",
  widget_status_thinking: "\u0414\u0443\u043c\u0430\u044e...",
  widget_status_idling: "\u041e\u0436\u0438\u0434\u0430\u043d\u0438\u0435...",
  widget_stopped:
    "\u041e\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043e.",
  widget_confirm_allow:
    "\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c",
  widget_confirm_deny: "\u041e\u0442\u043a\u043b\u043e\u043d\u0438\u0442\u044c",
  widget_shortcut_tip:
    "\u0421\u043e\u0432\u0435\u0442: \u043d\u0430\u0436\u043c\u0438\u0442\u0435 {shortcut}, \u0447\u0442\u043e\u0431\u044b \u043f\u043e\u0433\u043e\u0432\u043e\u0440\u0438\u0442\u044c \u0441\u043e \u043c\u043d\u043e\u0439 \u0432 \u043b\u044e\u0431\u043e\u0435 \u0432\u0440\u0435\u043c\u044f",
  status_navigating:
    "\u041f\u0435\u0440\u0435\u0445\u043e\u0434 \u043d\u0430 {url}",
  status_navigated_to:
    "\u041f\u0435\u0440\u0435\u0448\u0451\u043b \u043d\u0430 {path}",
  status_clicked:
    "\u042d\u043b\u0435\u043c\u0435\u043d\u0442 \u043d\u0430\u0436\u0430\u0442",
  status_highlighted:
    "\u042d\u043b\u0435\u043c\u0435\u043d\u0442 \u0432\u044b\u0434\u0435\u043b\u0435\u043d",
  status_reading_page:
    "\u0427\u0442\u0435\u043d\u0438\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b",
  status_fetching:
    "\u041f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0434\u0430\u043d\u043d\u044b\u0445",
  status_filling:
    "\u0417\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0438\u0435 \u043f\u043e\u043b\u044f",
  status_selecting:
    "\u0412\u044b\u0431\u043e\u0440 \u043e\u043f\u0446\u0438\u0438",
  status_toggling:
    "\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0444\u043b\u0430\u0436\u043a\u0430",
  status_submitting:
    "\u041e\u0442\u043f\u0440\u0430\u0432\u043a\u0430 \u0444\u043e\u0440\u043c\u044b",
  status_scrolling: "\u041f\u0440\u043e\u043a\u0440\u0443\u0442\u043a\u0430",
  status_searching:
    "\u041f\u043e\u0438\u0441\u043a \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435",
  status_extracting:
    "\u0418\u0437\u0432\u043b\u0435\u0447\u0435\u043d\u0438\u0435 \u0442\u0430\u0431\u043b\u0438\u0446\u044b",
  popup_loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...",
  popup_provider: "\u041f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440",
  popup_api_key: "API-\u043a\u043b\u044e\u0447",
  popup_api_key_placeholder:
    "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 API-\u043a\u043b\u044e\u0447 {provider}",
  popup_model: "\u041c\u043e\u0434\u0435\u043b\u044c",
  popup_save: "\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c",
  popup_saved: "\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u043e",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "\u0421\u0432\u043e\u0439 \u043a\u043b\u044e\u0447",
  popup_managed_connected:
    "\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u043e \u043a \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0435 gyoza",
  popup_managed_sign_out: "\u0412\u044b\u0439\u0442\u0438",
  popup_managed_subscribe_desc:
    "\u041d\u0430\u0447\u043d\u0438\u0442\u0435 \u0441 gyoza Pro \u2014 \u043a\u043b\u044e\u0447 API \u043d\u0435 \u043d\u0443\u0436\u0435\u043d.",
  popup_managed_subscribe_btn: "\u041d\u0430\u0447\u0430\u0442\u044c",
  popup_recipes: "\u0420\u0435\u0446\u0435\u043f\u0442\u044b",
  popup_all_recipes:
    "\u0412\u0441\u0435 \u0420\u0435\u0446\u0435\u043f\u0442\u044b",
  popup_recipes_for:
    "\u0420\u0435\u0446\u0435\u043f\u0442\u044b \u2014 {domain}",
  popup_no_recipes_all:
    "\u0420\u0435\u0446\u0435\u043f\u0442\u044b \u043d\u0435 \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u044b.",
  popup_no_recipes_site:
    "\u041d\u0435\u0442 \u0440\u0435\u0446\u0435\u043f\u0442\u043e\u0432 \u0434\u043b\u044f {domain}. \u0418\u043c\u043f\u043e\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0440\u0435\u0446\u0435\u043f\u0442 \u0434\u043b\u044f \u0443\u043b\u0443\u0447\u0448\u0435\u043d\u0438\u044f AI-\u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438.",
  popup_import: "+ \u0418\u043c\u043f\u043e\u0440\u0442",
  popup_back: "\u2190 \u041d\u0430\u0437\u0430\u0434",
  popup_settings: "\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438",
  popup_yolo_mode: "\u0420\u0435\u0436\u0438\u043c Yolo",
  popup_yolo_desc:
    "\u041f\u0440\u043e\u043f\u0443\u0441\u043a\u0430\u0442\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u044f \u2014 \u0418\u0418 \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043d\u0435\u043c\u0435\u0434\u043b\u0435\u043d\u043d\u043e \u0431\u0435\u0437 \u0437\u0430\u043f\u0440\u043e\u0441\u0430",
  popup_chat_only: "\u0422\u043e\u043b\u044c\u043a\u043e \u0447\u0430\u0442",
  popup_chat_only_desc:
    "\u0422\u043e\u043b\u044c\u043a\u043e \u0447\u0430\u0442 \u0438 \u0447\u0442\u0435\u043d\u0438\u0435 \u0441\u0442\u0440\u0430\u043d\u0438\u0446 \u2014 \u0431\u0435\u0437 \u043a\u043b\u0438\u043a\u043e\u0432, \u0444\u043e\u0440\u043c \u0438 \u043d\u0430\u0432\u0438\u0433\u0430\u0446\u0438\u0438",
  popup_sticky_chat:
    "\u0417\u0430\u043a\u0440\u0435\u043f\u043b\u0451\u043d\u043d\u044b\u0439 \u0447\u0430\u0442",
  popup_sticky_chat_desc:
    "\u0414\u0435\u0440\u0436\u0430\u0442\u044c \u0447\u0430\u0442 \u043e\u0442\u043a\u0440\u044b\u0442\u044b\u043c \u2014 \u0438\u0433\u043d\u043e\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0431\u043b\u0438\u0437\u043e\u0441\u0442\u044c \u043a\u0443\u0440\u0441\u043e\u0440\u0430 \u0438 \u043e\u0441\u0442\u0430\u0432\u0430\u0442\u044c\u0441\u044f \u0432\u0438\u0434\u0438\u043c\u044b\u043c",
  popup_auto_import_recipes: "Автоимпорт рецептов",
  popup_auto_import_recipes_desc:
    "Автоматически импортировать рецепты llms.txt с посещаемых сайтов",
  popup_theme: "\u0422\u0435\u043c\u0430",
  popup_dark: "\u0422\u0451\u043c\u043d\u0430\u044f",
  popup_light: "\u0421\u0432\u0435\u0442\u043b\u0430\u044f",
  popup_language: "\u042f\u0437\u044b\u043a",
  popup_language_auto:
    "\u0410\u0432\u0442\u043e (\u0431\u0440\u0430\u0443\u0437\u0435\u0440)",
};

const uk: Translations = {
  widget_placeholder:
    "\u0417\u0430\u043f\u0438\u0442\u0430\u0439\u0442\u0435 \u0431\u0443\u0434\u044c-\u0449\u043e...",
  widget_empty:
    "\u0417\u0430\u043f\u0438\u0442\u0430\u0439\u0442\u0435 \u0449\u043e\u0441\u044c \u043f\u0440\u043e \u0446\u044e \u0441\u0442\u043e\u0440\u0456\u043d\u043a\u0443...",
  widget_new_chat: "\u041d\u043e\u0432\u0438\u0439 \u0447\u0430\u0442",
  widget_history:
    "\u0406\u0441\u0442\u043e\u0440\u0456\u044f \u0440\u043e\u0437\u043c\u043e\u0432",
  widget_settings:
    "\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
  widget_no_conversations:
    "\u0429\u0435 \u043d\u0435\u043c\u0430\u0454 \u0440\u043e\u0437\u043c\u043e\u0432",
  widget_msg_count: "{count} \u043f\u043e\u0432\u0456\u0434.",
  widget_just_now: "\u0449\u043e\u0439\u043d\u043e",
  widget_minutes_ago: "{n}\u0445\u0432 \u0442\u043e\u043c\u0443",
  widget_hours_ago: "{n}\u0433\u043e\u0434 \u0442\u043e\u043c\u0443",
  widget_days_ago: "{n}\u0434 \u0442\u043e\u043c\u0443",
  widget_recipe_imported:
    "\u0420\u0435\u0446\u0435\u043f\u0442 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u043d\u043e \u0456\u043c\u043f\u043e\u0440\u0442\u043e\u0432\u0430\u043d\u043e \u0437 {name}",
  widget_delete_conversation:
    "\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u0440\u043e\u0437\u043c\u043e\u0432\u0443",
  widget_status_thinking: "\u0414\u0443\u043c\u0430\u044e...",
  widget_status_idling:
    "\u041e\u0447\u0456\u043a\u0443\u0432\u0430\u043d\u043d\u044f...",
  widget_stopped: "\u0417\u0443\u043f\u0438\u043d\u0435\u043d\u043e.",
  widget_confirm_allow:
    "\u0414\u043e\u0437\u0432\u043e\u043b\u0438\u0442\u0438",
  widget_confirm_deny: "\u0412\u0456\u0434\u0445\u0438\u043b\u0438\u0442\u0438",
  widget_shortcut_tip:
    "\u041f\u043e\u0440\u0430\u0434\u0430: \u043d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c {shortcut}, \u0449\u043e\u0431 \u043f\u043e\u0433\u043e\u0432\u043e\u0440\u0438\u0442\u0438 \u0437\u0456 \u043c\u043d\u043e\u044e \u0431\u0443\u0434\u044c-\u043a\u043e\u043b\u0438",
  status_navigating:
    "\u041f\u0435\u0440\u0435\u0445\u0456\u0434 \u043d\u0430 {url}",
  status_navigated_to:
    "\u041f\u0435\u0440\u0435\u0439\u0448\u043e\u0432 \u043d\u0430 {path}",
  status_clicked:
    "\u0415\u043b\u0435\u043c\u0435\u043d\u0442 \u043d\u0430\u0442\u0438\u0441\u043d\u0443\u0442\u043e",
  status_highlighted:
    "\u0415\u043b\u0435\u043c\u0435\u043d\u0442 \u0432\u0438\u0434\u0456\u043b\u0435\u043d\u043e",
  status_reading_page:
    "\u0427\u0438\u0442\u0430\u043d\u043d\u044f \u0441\u0442\u043e\u0440\u0456\u043d\u043a\u0438",
  status_fetching:
    "\u041e\u0442\u0440\u0438\u043c\u0430\u043d\u043d\u044f \u0434\u0430\u043d\u0438\u0445",
  status_filling:
    "\u0417\u0430\u043f\u043e\u0432\u043d\u0435\u043d\u043d\u044f \u043f\u043e\u043b\u044f",
  status_selecting:
    "\u0412\u0438\u0431\u0456\u0440 \u043e\u043f\u0446\u0456\u0457",
  status_toggling:
    "\u041f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u043d\u043d\u044f \u043f\u0440\u0430\u043f\u043e\u0440\u0446\u044f",
  status_submitting:
    "\u0412\u0456\u0434\u043f\u0440\u0430\u0432\u043a\u0430 \u0444\u043e\u0440\u043c\u0438",
  status_scrolling: "\u041f\u0440\u043e\u043a\u0440\u0443\u0442\u043a\u0430",
  status_searching:
    "\u041f\u043e\u0448\u0443\u043a \u043d\u0430 \u0441\u0442\u043e\u0440\u0456\u043d\u0446\u0456",
  status_extracting:
    "\u0412\u0438\u043b\u0443\u0447\u0435\u043d\u043d\u044f \u0442\u0430\u0431\u043b\u0438\u0446\u0456",
  popup_loading:
    "\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f...",
  popup_provider: "\u041f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440",
  popup_api_key: "API-\u043a\u043b\u044e\u0447",
  popup_api_key_placeholder:
    "\u0412\u0432\u0435\u0434\u0456\u0442\u044c API-\u043a\u043b\u044e\u0447 {provider}",
  popup_model: "\u041c\u043e\u0434\u0435\u043b\u044c",
  popup_save: "\u0417\u0431\u0435\u0440\u0435\u0433\u0442\u0438",
  popup_saved: "\u0417\u0431\u0435\u0440\u0435\u0436\u0435\u043d\u043e",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key:
    "\u0412\u043b\u0430\u0441\u043d\u0438\u0439 \u043a\u043b\u044e\u0447",
  popup_managed_connected:
    "\u041f\u0456\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u043e \u0434\u043e \u043f\u043b\u0430\u0442\u0444\u043e\u0440\u043c\u0438 gyoza",
  popup_managed_sign_out: "\u0412\u0438\u0439\u0442\u0438",
  popup_managed_subscribe_desc:
    "\u041f\u043e\u0447\u043d\u0456\u0442\u044c \u0437 gyoza Pro \u2014 \u043a\u043b\u044e\u0447 API \u043d\u0435 \u043f\u043e\u0442\u0440\u0456\u0431\u0435\u043d.",
  popup_managed_subscribe_btn: "\u041f\u043e\u0447\u0430\u0442\u0438",
  popup_recipes: "\u0420\u0435\u0446\u0435\u043f\u0442\u0438",
  popup_all_recipes:
    "\u0423\u0441\u0456 \u0420\u0435\u0446\u0435\u043f\u0442\u0438",
  popup_recipes_for:
    "\u0420\u0435\u0446\u0435\u043f\u0442\u0438 \u2014 {domain}",
  popup_no_recipes_all:
    "\u0420\u0435\u0446\u0435\u043f\u0442\u0456\u0432 \u043d\u0435 \u0432\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043e.",
  popup_no_recipes_site:
    "\u041d\u0435\u043c\u0430\u0454 \u0440\u0435\u0446\u0435\u043f\u0442\u0456\u0432 \u0434\u043b\u044f {domain}. \u0406\u043c\u043f\u043e\u0440\u0442\u0443\u0439\u0442\u0435 \u0440\u0435\u0446\u0435\u043f\u0442 \u0434\u043b\u044f \u043f\u043e\u043a\u0440\u0430\u0449\u0435\u043d\u043d\u044f AI-\u043d\u0430\u0432\u0456\u0433\u0430\u0446\u0456\u0457.",
  popup_import: "+ \u0406\u043c\u043f\u043e\u0440\u0442",
  popup_back: "\u2190 \u041d\u0430\u0437\u0430\u0434",
  popup_settings:
    "\u041d\u0430\u043b\u0430\u0448\u0442\u0443\u0432\u0430\u043d\u043d\u044f",
  popup_yolo_mode: "\u0420\u0435\u0436\u0438\u043c Yolo",
  popup_yolo_desc:
    "\u041f\u0440\u043e\u043f\u0443\u0441\u043a\u0430\u0442\u0438 \u043f\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043d\u043d\u044f \u2014 \u0428\u0406 \u0434\u0456\u0454 \u043d\u0435\u0433\u0430\u0439\u043d\u043e \u0431\u0435\u0437 \u0437\u0430\u043f\u0438\u0442\u0443",
  popup_chat_only: "\u0422\u0456\u043b\u044c\u043a\u0438 \u0447\u0430\u0442",
  popup_chat_only_desc:
    "\u0422\u0456\u043b\u044c\u043a\u0438 \u0447\u0430\u0442 \u0456 \u0447\u0438\u0442\u0430\u043d\u043d\u044f \u0441\u0442\u043e\u0440\u0456\u043d\u043e\u043a \u2014 \u0431\u0435\u0437 \u043a\u043b\u0456\u043a\u0456\u0432, \u0444\u043e\u0440\u043c \u0442\u0430 \u043d\u0430\u0432\u0456\u0433\u0430\u0446\u0456\u0457",
  popup_sticky_chat:
    "\u0417\u0430\u043a\u0440\u0456\u043f\u043b\u0435\u043d\u0438\u0439 \u0447\u0430\u0442",
  popup_sticky_chat_desc:
    "\u0422\u0440\u0438\u043c\u0430\u0442\u0438 \u0447\u0430\u0442 \u0432\u0456\u0434\u043a\u0440\u0438\u0442\u0438\u043c \u2014 \u0456\u0433\u043d\u043e\u0440\u0443\u0432\u0430\u0442\u0438 \u0431\u043b\u0438\u0437\u044c\u043a\u0456\u0441\u0442\u044c \u043a\u0443\u0440\u0441\u043e\u0440\u0430 \u0442\u0430 \u0437\u0430\u043b\u0438\u0448\u0430\u0442\u0438\u0441\u044f \u0432\u0438\u0434\u0438\u043c\u0438\u043c",
  popup_auto_import_recipes: "Автоімпорт рецептів",
  popup_auto_import_recipes_desc:
    "Автоматично імпортувати рецепти llms.txt з відвіданих сайтів",
  popup_theme: "\u0422\u0435\u043c\u0430",
  popup_dark: "\u0422\u0435\u043c\u043d\u0430",
  popup_light: "\u0421\u0432\u0456\u0442\u043b\u0430",
  popup_language: "\u041c\u043e\u0432\u0430",
  popup_language_auto:
    "\u0410\u0432\u0442\u043e (\u0431\u0440\u0430\u0443\u0437\u0435\u0440)",
};

const el: Translations = {
  widget_placeholder:
    "\u03a1\u03c9\u03c4\u03ae\u03c3\u03c4\u03b5 \u03bf\u03c4\u03b9\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5...",
  widget_empty:
    "\u03a1\u03c9\u03c4\u03ae\u03c3\u03c4\u03b5 \u03bf\u03c4\u03b9\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b3\u03b9\u03b1 \u03b1\u03c5\u03c4\u03ae \u03c4\u03b7 \u03c3\u03b5\u03bb\u03af\u03b4\u03b1...",
  widget_new_chat:
    "\u039d\u03ad\u03b1 \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1",
  widget_history:
    "\u0399\u03c3\u03c4\u03bf\u03c1\u03b9\u03ba\u03cc \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03b9\u03ce\u03bd",
  widget_settings: "\u03a1\u03c5\u03b8\u03bc\u03af\u03c3\u03b5\u03b9\u03c2",
  widget_no_conversations:
    "\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b5\u03c2",
  widget_msg_count: "{count} \u03bc\u03bd\u03bc.",
  widget_just_now: "\u03c4\u03ce\u03c1\u03b1",
  widget_minutes_ago: "{n}\u03bb \u03c0\u03c1\u03b9\u03bd",
  widget_hours_ago: "{n}\u03ce \u03c0\u03c1\u03b9\u03bd",
  widget_days_ago: "{n}\u03bc \u03c0\u03c1\u03b9\u03bd",
  widget_recipe_imported:
    "\u0397 \u03c3\u03c5\u03bd\u03c4\u03b1\u03b3\u03ae \u03b5\u03b9\u03c3\u03ae\u03c7\u03b8\u03b7 \u03b1\u03c5\u03c4\u03cc\u03bc\u03b1\u03c4\u03b1 \u03b1\u03c0\u03cc {name}",
  widget_delete_conversation:
    "\u0394\u03b9\u03b1\u03b3\u03c1\u03b1\u03c6\u03ae \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1\u03c2",
  widget_status_thinking: "\u03a3\u03ba\u03ad\u03c8\u03b7...",
  widget_status_idling: "\u0391\u03b4\u03c1\u03b1\u03bd\u03ad\u03c2...",
  widget_stopped:
    "\u03a3\u03c4\u03b1\u03bc\u03b1\u03c4\u03ae\u03b8\u03b7\u03ba\u03b5.",
  widget_confirm_allow: "\u0391\u03c0\u03bf\u03b4\u03bf\u03c7\u03ae",
  widget_confirm_deny: "\u0386\u03c1\u03bd\u03b7\u03c3\u03b7",
  widget_shortcut_tip:
    "\u03a3\u03c5\u03bc\u03b2\u03bf\u03c5\u03bb\u03ae: \u03c0\u03b1\u03c4\u03ae\u03c3\u03c4\u03b5 {shortcut} \u03b3\u03b9\u03b1 \u03bd\u03b1 \u03bc\u03bf\u03c5 \u03bc\u03b9\u03bb\u03ae\u03c3\u03b5\u03c4\u03b5 \u03bf\u03c0\u03bf\u03c4\u03b5\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5",
  status_navigating:
    "\u039c\u03b5\u03c4\u03ac\u03b2\u03b1\u03c3\u03b7 \u03c3\u03c4\u03bf {url}",
  status_navigated_to:
    "\u039c\u03b5\u03c4\u03b1\u03b2\u03ae\u03ba\u03b5 \u03c3\u03c4\u03bf {path}",
  status_clicked:
    "\u039a\u03bb\u03b9\u03ba \u03c3\u03b5 \u03c3\u03c4\u03bf\u03b9\u03c7\u03b5\u03af\u03bf",
  status_highlighted:
    "\u0395\u03c0\u03b9\u03c3\u03ae\u03bc\u03b1\u03bd\u03c3\u03b7 \u03c3\u03c4\u03bf\u03b9\u03c7\u03b5\u03af\u03bf\u03c5",
  status_reading_page:
    "\u0391\u03bd\u03ac\u03b3\u03bd\u03c9\u03c3\u03b7 \u03c3\u03b5\u03bb\u03af\u03b4\u03b1\u03c2",
  status_fetching:
    "\u039b\u03ae\u03c8\u03b7 \u03b4\u03b5\u03b4\u03bf\u03bc\u03ad\u03bd\u03c9\u03bd",
  status_filling:
    "\u03a3\u03c5\u03bc\u03c0\u03bb\u03ae\u03c1\u03c9\u03c3\u03b7 \u03c0\u03b5\u03b4\u03af\u03bf\u03c5",
  status_selecting: "\u0395\u03c0\u03b9\u03bb\u03bf\u03b3\u03ae",
  status_toggling:
    "\u0395\u03bd\u03b1\u03bb\u03bb\u03b1\u03b3\u03ae \u03c0\u03bb\u03b1\u03b9\u03c3\u03af\u03bf\u03c5",
  status_submitting:
    "\u03a5\u03c0\u03bf\u03b2\u03bf\u03bb\u03ae \u03c6\u03cc\u03c1\u03bc\u03b1\u03c2",
  status_scrolling: "\u039a\u03cd\u03bb\u03b9\u03c3\u03b7",
  status_searching:
    "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7 \u03c3\u03b5\u03bb\u03af\u03b4\u03b1\u03c2",
  status_extracting:
    "\u0395\u03be\u03b1\u03b3\u03c9\u03b3\u03ae \u03c0\u03af\u03bd\u03b1\u03ba\u03b1",
  popup_loading: "\u03a6\u03cc\u03c1\u03c4\u03c9\u03c3\u03b7...",
  popup_provider: "\u03a0\u03ac\u03c1\u03bf\u03c7\u03bf\u03c2",
  popup_api_key: "\u039a\u03bb\u03b5\u03b9\u03b4\u03af API",
  popup_api_key_placeholder:
    "\u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03c4\u03bf \u03ba\u03bb\u03b5\u03b9\u03b4\u03af API {provider}",
  popup_model: "\u039c\u03bf\u03bd\u03c4\u03ad\u03bb\u03bf",
  popup_save: "\u0391\u03c0\u03bf\u03b8\u03ae\u03ba\u03b5\u03c5\u03c3\u03b7",
  popup_saved:
    "\u0391\u03c0\u03bf\u03b8\u03b7\u03ba\u03b5\u03cd\u03c4\u03b7\u03ba\u03b5",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key:
    "\u0394\u03b9\u03ba\u03cc \u03c3\u03bf\u03c5 \u03ba\u03bb\u03b5\u03b9\u03b4\u03af",
  popup_managed_connected:
    "\u03a3\u03c5\u03bd\u03b4\u03b5\u03b4\u03b5\u03bc\u03ad\u03bd\u03bf \u03c3\u03c4\u03b7\u03bd \u03c0\u03bb\u03b1\u03c4\u03c6\u03cc\u03c1\u03bc\u03b1 gyoza",
  popup_managed_sign_out:
    "\u0391\u03c0\u03bf\u03c3\u03cd\u03bd\u03b4\u03b5\u03c3\u03b7",
  popup_managed_subscribe_desc:
    "\u039e\u03b5\u03ba\u03b9\u03bd\u03ae\u03c3\u03c4\u03b5 \u03bc\u03b5 \u03c4\u03bf gyoza Pro \u2014 \u03b4\u03b5\u03bd \u03c7\u03c1\u03b5\u03b9\u03ac\u03b6\u03b5\u03c4\u03b1\u03b9 \u03ba\u03bb\u03b5\u03b9\u03b4\u03af API.",
  popup_managed_subscribe_btn:
    "\u039e\u03b5\u03ba\u03b9\u03bd\u03ae\u03c3\u03c4\u03b5",
  popup_recipes: "\u03a3\u03c5\u03bd\u03c4\u03b1\u03b3\u03ad\u03c2",
  popup_all_recipes:
    "\u038c\u03bb\u03b5\u03c2 \u03bf\u03b9 \u03a3\u03c5\u03bd\u03c4\u03b1\u03b3\u03ad\u03c2",
  popup_recipes_for:
    "\u03a3\u03c5\u03bd\u03c4\u03b1\u03b3\u03ad\u03c2 \u2014 {domain}",
  popup_no_recipes_all:
    "\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c3\u03c5\u03bd\u03c4\u03b1\u03b3\u03ad\u03c2.",
  popup_no_recipes_site:
    "\u0394\u03b5\u03bd \u03c5\u03c0\u03ac\u03c1\u03c7\u03bf\u03c5\u03bd \u03c3\u03c5\u03bd\u03c4\u03b1\u03b3\u03ad\u03c2 \u03b3\u03b9\u03b1 {domain}. \u0395\u03b9\u03c3\u03ac\u03b3\u03b5\u03c4\u03b5 \u03bc\u03b9\u03b1 \u03c3\u03c5\u03bd\u03c4\u03b1\u03b3\u03ae \u03b3\u03b9\u03b1 \u03ba\u03b1\u03bb\u03cd\u03c4\u03b5\u03c1\u03b7 AI \u03c0\u03bb\u03bf\u03ae\u03b3\u03b7\u03c3\u03b7.",
  popup_import: "+ \u0395\u03b9\u03c3\u03b1\u03b3\u03c9\u03b3\u03ae",
  popup_back: "\u2190 \u03a0\u03af\u03c3\u03c9",
  popup_settings: "\u03a1\u03c5\u03b8\u03bc\u03af\u03c3\u03b5\u03b9\u03c2",
  popup_yolo_mode:
    "\u039b\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 Yolo",
  popup_yolo_desc:
    "\u03a0\u03b1\u03c1\u03ac\u03bb\u03b5\u03b9\u03c8\u03b7 \u03b5\u03c0\u03b9\u03b2\u03b5\u03b2\u03b1\u03b9\u03ce\u03c3\u03b5\u03c9\u03bd \u2014 \u03c4\u03bf AI \u03b5\u03bd\u03b5\u03c1\u03b3\u03b5\u03af \u03b1\u03bc\u03ad\u03c3\u03c9\u03c2",
  popup_chat_only:
    "\u039c\u03cc\u03bd\u03bf \u03a3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1",
  popup_chat_only_desc:
    "\u039c\u03cc\u03bd\u03bf \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1 \u03ba\u03b1\u03b9 \u03b1\u03bd\u03ac\u03b3\u03bd\u03c9\u03c3\u03b7 \u03c3\u03b5\u03bb\u03af\u03b4\u03c9\u03bd \u2014 \u03c7\u03c9\u03c1\u03af\u03c2 \u03ba\u03bb\u03b9\u03ba, \u03c6\u03cc\u03c1\u03bc\u03b5\u03c2 \u03ae \u03c0\u03bb\u03bf\u03ae\u03b3\u03b7\u03c3\u03b7",
  popup_sticky_chat:
    "\u03a3\u03c4\u03b1\u03b8\u03b5\u03c1\u03ae \u03a3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1",
  popup_sticky_chat_desc:
    "\u039a\u03c1\u03b1\u03c4\u03ae\u03c3\u03c4\u03b5 \u03c4\u03b7 \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1 \u03b1\u03bd\u03bf\u03b9\u03c7\u03c4\u03ae \u2014 \u03b1\u03b3\u03bd\u03bf\u03ae\u03c3\u03c4\u03b5 \u03c4\u03b7\u03bd \u03b5\u03b3\u03b3\u03cd\u03c4\u03b7\u03c4\u03b1 \u03ba\u03ad\u03c1\u03c3\u03bf\u03c1\u03b1",
  popup_auto_import_recipes: "Αυτόματη εισαγωγή συνταγών",
  popup_auto_import_recipes_desc:
    "Αυτόματη εισαγωγή συνταγών llms.txt από ιστότοπους που επισκέπτεστε",
  popup_theme: "\u0398\u03ad\u03bc\u03b1",
  popup_dark: "\u03a3\u03ba\u03bf\u03c4\u03b5\u03b9\u03bd\u03cc",
  popup_light: "\u03a6\u03c9\u03c4\u03b5\u03b9\u03bd\u03cc",
  popup_language: "\u0393\u03bb\u03ce\u03c3\u03c3\u03b1",
  popup_language_auto:
    "\u0391\u03c5\u03c4\u03cc\u03bc\u03b1\u03c4\u03bf (\u03c0\u03c1\u03cc\u03b3\u03c1\u03b1\u03bc\u03bc\u03b1 \u03c0\u03b5\u03c1\u03b9\u03ae\u03b3\u03b7\u03c3\u03b7\u03c2)",
};

const tr: Translations = {
  widget_placeholder: "Bir \u015fey sor...",
  widget_empty: "Bu sayfa hakk\u0131nda bir \u015fey sor...",
  widget_new_chat: "Yeni sohbet",
  widget_history: "Sohbet ge\u00e7mi\u015fi",
  widget_settings: "Ayarlar",
  widget_no_conversations: "Hen\u00fcz sohbet yok",
  widget_msg_count: "{count} msj",
  widget_just_now: "\u015fimdi",
  widget_minutes_ago: "{n}dk \u00f6nce",
  widget_hours_ago: "{n}sa \u00f6nce",
  widget_days_ago: "{n}g \u00f6nce",
  widget_recipe_imported:
    "Tarif {name} kayna\u011f\u0131ndan otomatik i\u00e7e aktar\u0131ld\u0131",
  widget_delete_conversation: "Sohbeti sil",
  widget_status_thinking: "D\u00fc\u015f\u00fcn\u00fcyor...",
  widget_status_idling: "Bo\u015fta...",
  widget_stopped: "Durduruldu.",
  widget_confirm_allow: "\u0130zin ver",
  widget_confirm_deny: "Reddet",
  widget_shortcut_tip:
    "\u0130pucu: her zaman benimle konu\u015fmak i\u00e7in {shortcut} tu\u015funa bas\u0131n",
  status_navigating: "{url} adresine gidiliyor",
  status_navigated_to: "{path} sayfas\u0131na gidildi",
  status_clicked: "\u00d6\u011feye t\u0131kland\u0131",
  status_highlighted: "\u00d6\u011fe vurguland\u0131",
  status_reading_page: "Sayfa okunuyor",
  status_fetching: "Veri al\u0131n\u0131yor",
  status_filling: "Alan dolduruluyor",
  status_selecting: "Se\u00e7enek se\u00e7iliyor",
  status_toggling: "Onay kutusu de\u011fi\u015ftiriliyor",
  status_submitting: "Form g\u00f6nderiliyor",
  status_scrolling: "Kayd\u0131r\u0131l\u0131yor",
  status_searching: "Sayfada aran\u0131yor",
  status_extracting: "Tablo \u00e7\u0131kar\u0131l\u0131yor",
  popup_loading: "Y\u00fckleniyor...",
  popup_provider: "Sa\u011flay\u0131c\u0131",
  popup_api_key: "API Anahtar\u0131",
  popup_api_key_placeholder: "{provider} API anahtar\u0131n\u0131 girin",
  popup_model: "Model",
  popup_save: "Ayarlar\u0131 Kaydet",
  popup_saved: "Kaydedildi",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Kendi anahtar\u0131n",
  popup_managed_connected: "gyoza platformuna ba\u011fl\u0131",
  popup_managed_sign_out: "\u00c7\u0131k\u0131\u015f Yap",
  popup_managed_subscribe_desc:
    "gyoza Pro ile ba\u015flay\u0131n \u2014 API anahtar\u0131 gerekmez.",
  popup_managed_subscribe_btn: "Ba\u015flay\u0131n",
  popup_recipes: "Tarifler",
  popup_all_recipes: "T\u00fcm Tarifler",
  popup_recipes_for: "Tarifler \u2014 {domain}",
  popup_no_recipes_all: "Hen\u00fcz tarif y\u00fcklenmemi\u015f.",
  popup_no_recipes_site:
    "{domain} i\u00e7in tarif yok. AI navigasyonunu geli\u015ftirmek i\u00e7in bir tarif i\u00e7e aktar\u0131n.",
  popup_import: "+ \u0130\u00e7e Aktar",
  popup_back: "\u2190 Geri",
  popup_settings: "Ayarlar",
  popup_yolo_mode: "Yolo Modu",
  popup_yolo_desc:
    "Onaylar\u0131 atla \u2014 AI sormadan hemen harekete ge\u00e7er",
  popup_chat_only: "Sadece Sohbet",
  popup_chat_only_desc:
    "Sadece sohbet ve sayfa okuma \u2014 t\u0131klama, form veya gezinme yok",
  popup_sticky_chat: "Sabit Sohbet",
  popup_sticky_chat_desc:
    "Sohbeti a\u00e7\u0131k tut \u2014 imle\u00e7 yak\u0131nl\u0131\u011f\u0131n\u0131 yoksay ve g\u00f6r\u00fcn\u00fcr kal",
  popup_auto_import_recipes: "Tarifleri otomatik içe aktar",
  popup_auto_import_recipes_desc:
    "Ziyaret ettiğiniz web sitelerinden llms.txt tariflerini otomatik içe aktar",
  popup_theme: "Tema",
  popup_dark: "Koyu",
  popup_light: "A\u00e7\u0131k",
  popup_language: "Dil",
  popup_language_auto: "Otomatik (taray\u0131c\u0131)",
};

const ar: Translations = {
  widget_placeholder:
    "\u0627\u0633\u0623\u0644 \u0623\u064a \u0634\u064a\u0621...",
  widget_empty:
    "\u0627\u0633\u0623\u0644 \u0623\u064a \u0634\u064a\u0621 \u0639\u0646 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062d\u0629...",
  widget_new_chat:
    "\u0645\u062d\u0627\u062f\u062b\u0629 \u062c\u062f\u064a\u062f\u0629",
  widget_history:
    "\u0633\u062c\u0644 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0627\u062a",
  widget_settings: "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a",
  widget_no_conversations:
    "\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u062d\u0627\u062f\u062b\u0627\u062a \u0628\u0639\u062f",
  widget_msg_count: "{count} \u0631\u0633\u0627\u0626\u0644",
  widget_just_now: "\u0627\u0644\u0622\u0646",
  widget_minutes_ago: "\u0645\u0646\u0630 {n}\u062f",
  widget_hours_ago: "\u0645\u0646\u0630 {n}\u0633",
  widget_days_ago: "\u0645\u0646\u0630 {n}\u064a",
  widget_recipe_imported:
    "\u062a\u0645 \u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0648\u0635\u0641\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0645\u0646 {name}",
  widget_delete_conversation:
    "\u062d\u0630\u0641 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629",
  widget_status_thinking:
    "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u0641\u0643\u064a\u0631...",
  widget_status_idling: "\u062e\u0627\u0645\u0644...",
  widget_stopped: "\u062a\u0645 \u0627\u0644\u0625\u064a\u0642\u0627\u0641.",
  widget_confirm_allow: "\u0633\u0645\u0627\u062d",
  widget_confirm_deny: "\u0631\u0641\u0636",
  widget_shortcut_tip:
    "\u0646\u0635\u064a\u062d\u0629: \u0627\u0636\u063a\u0637 {shortcut} \u0644\u0644\u062a\u062d\u062f\u062b \u0645\u0639\u064a \u0641\u064a \u0623\u064a \u0648\u0642\u062a",
  status_navigating:
    "\u0627\u0644\u0627\u0646\u062a\u0642\u0627\u0644 \u0625\u0644\u0649 {url}",
  status_navigated_to:
    "\u062a\u0645 \u0627\u0644\u0627\u0646\u062a\u0642\u0627\u0644 \u0625\u0644\u0649 {path}",
  status_clicked:
    "\u062a\u0645 \u0627\u0644\u0646\u0642\u0631 \u0639\u0644\u0649 \u0627\u0644\u0639\u0646\u0635\u0631",
  status_highlighted:
    "\u062a\u0645 \u062a\u0645\u064a\u064a\u0632 \u0627\u0644\u0639\u0646\u0635\u0631",
  status_reading_page:
    "\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0635\u0641\u062d\u0629",
  status_fetching:
    "\u062c\u0644\u0628 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
  status_filling: "\u0645\u0644\u0621 \u0627\u0644\u062d\u0642\u0644",
  status_selecting:
    "\u0627\u062e\u062a\u064a\u0627\u0631 \u062e\u064a\u0627\u0631",
  status_toggling:
    "\u062a\u0628\u062f\u064a\u0644 \u0645\u0631\u0628\u0639 \u0627\u0644\u0627\u062e\u062a\u064a\u0627\u0631",
  status_submitting:
    "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0646\u0645\u0648\u0630\u062c",
  status_scrolling: "\u0627\u0644\u062a\u0645\u0631\u064a\u0631",
  status_searching:
    "\u0627\u0644\u0628\u062d\u062b \u0641\u064a \u0627\u0644\u0635\u0641\u062d\u0629",
  status_extracting:
    "\u0627\u0633\u062a\u062e\u0631\u0627\u062c \u0627\u0644\u062c\u062f\u0648\u0644",
  popup_loading:
    "\u062c\u0627\u0631\u064a \u0627\u0644\u062a\u062d\u0645\u064a\u0644...",
  popup_provider: "\u0627\u0644\u0645\u0632\u0648\u062f",
  popup_api_key: "\u0645\u0641\u062a\u0627\u062d API",
  popup_api_key_placeholder:
    "\u0623\u062f\u062e\u0644 \u0645\u0641\u062a\u0627\u062d API \u0644\u0640 {provider}",
  popup_model: "\u0627\u0644\u0646\u0645\u0648\u0630\u062c",
  popup_save:
    "\u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a",
  popup_saved: "\u062a\u0645 \u0627\u0644\u062d\u0641\u0638",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key:
    "\u0645\u0641\u062a\u0627\u062d\u0643 \u0627\u0644\u062e\u0627\u0635",
  popup_managed_connected:
    "\u0645\u062a\u0635\u0644 \u0628\u0645\u0646\u0635\u0629 gyoza",
  popup_managed_sign_out:
    "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c",
  popup_managed_subscribe_desc:
    "\u0627\u0628\u062f\u0623 \u0645\u0639 gyoza Pro \u2014 \u0644\u0627 \u062d\u0627\u062c\u0629 \u0644\u0645\u0641\u062a\u0627\u062d API.",
  popup_managed_subscribe_btn: "\u0627\u0628\u062f\u0623",
  popup_recipes: "\u0627\u0644\u0648\u0635\u0641\u0627\u062a",
  popup_all_recipes:
    "\u062c\u0645\u064a\u0639 \u0627\u0644\u0648\u0635\u0641\u0627\u062a",
  popup_recipes_for:
    "\u0627\u0644\u0648\u0635\u0641\u0627\u062a \u2014 {domain}",
  popup_no_recipes_all:
    "\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u0635\u0641\u0627\u062a \u0645\u062b\u0628\u062a\u0629.",
  popup_no_recipes_site:
    "\u0644\u0627 \u062a\u0648\u062c\u062f \u0648\u0635\u0641\u0627\u062a \u0644\u0640 {domain}. \u0627\u0633\u062a\u0648\u0631\u062f \u0648\u0635\u0641\u0629 \u0644\u062a\u062d\u0633\u064a\u0646 \u0627\u0644\u062a\u0635\u0641\u062d \u0628\u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a.",
  popup_import: "+ \u0627\u0633\u062a\u064a\u0631\u0627\u062f",
  popup_back: "\u0631\u062c\u0648\u0639 \u2192",
  popup_settings: "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a",
  popup_yolo_mode: "\u0648\u0636\u0639 Yolo",
  popup_yolo_desc:
    "\u062a\u062e\u0637\u064a \u0627\u0644\u062a\u0623\u0643\u064a\u062f\u0627\u062a \u2014 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u064a\u062a\u0635\u0631\u0641 \u0641\u0648\u0631\u0627\u064b",
  popup_chat_only: "\u0645\u062d\u0627\u062f\u062b\u0629 \u0641\u0642\u0637",
  popup_chat_only_desc:
    "\u0641\u0642\u0637 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629 \u0648\u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0635\u0641\u062d\u0627\u062a \u2014 \u0628\u062f\u0648\u0646 \u0646\u0642\u0631\u0627\u062a \u0623\u0648 \u0646\u0645\u0627\u0630\u062c \u0623\u0648 \u062a\u0646\u0642\u0644",
  popup_sticky_chat:
    "\u0645\u062d\u0627\u062f\u062b\u0629 \u0645\u062b\u0628\u062a\u0629",
  popup_sticky_chat_desc:
    "\u0625\u0628\u0642\u0627\u0621 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629 \u0645\u0641\u062a\u0648\u062d\u0629 \u2014 \u062a\u062c\u0627\u0647\u0644 \u0642\u0631\u0628 \u0627\u0644\u0645\u0624\u0634\u0631 \u0648\u0627\u0644\u0628\u0642\u0627\u0621 \u0645\u0631\u0626\u064a\u064b\u0627",
  popup_auto_import_recipes: "استيراد الوصفات تلقائياً",
  popup_auto_import_recipes_desc:
    "استيراد وصفات llms.txt تلقائياً من المواقع التي تزورها",
  popup_theme: "\u0627\u0644\u0645\u0638\u0647\u0631",
  popup_dark: "\u062f\u0627\u0643\u0646",
  popup_light: "\u0641\u0627\u062a\u062d",
  popup_language: "\u0627\u0644\u0644\u063a\u0629",
  popup_language_auto:
    "\u062a\u0644\u0642\u0627\u0626\u064a (\u0627\u0644\u0645\u062a\u0635\u0641\u062d)",
};

const hi: Translations = {
  widget_placeholder:
    "\u0915\u0941\u091b \u092d\u0940 \u092a\u0942\u091b\u0947\u0902...",
  widget_empty:
    "\u0907\u0938 \u092a\u0947\u091c \u0915\u0947 \u092c\u093e\u0930\u0947 \u092e\u0947\u0902 \u0915\u0941\u091b \u092d\u0940 \u092a\u0942\u091b\u0947\u0902...",
  widget_new_chat: "\u0928\u0908 \u091a\u0948\u091f",
  widget_history:
    "\u092c\u093e\u0924\u091a\u0940\u0924 \u0907\u0924\u093f\u0939\u093e\u0938",
  widget_settings: "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938",
  widget_no_conversations:
    "\u0905\u092d\u0940 \u0915\u094b\u0908 \u092c\u093e\u0924\u091a\u0940\u0924 \u0928\u0939\u0940\u0902",
  widget_msg_count: "{count} \u0938\u0902\u0926\u0947\u0936",
  widget_just_now: "\u0905\u092d\u0940",
  widget_minutes_ago: "{n}\u092e\u093f\u0928\u091f \u092a\u0939\u0932\u0947",
  widget_hours_ago: "{n}\u0918\u0902\u091f\u0947 \u092a\u0939\u0932\u0947",
  widget_days_ago: "{n}\u0926\u093f\u0928 \u092a\u0939\u0932\u0947",
  widget_recipe_imported:
    "\u0930\u0947\u0938\u093f\u092a\u0940 {name} \u0938\u0947 \u0911\u091f\u094b-\u0907\u0902\u092a\u094b\u0930\u094d\u091f \u0939\u0941\u0908",
  widget_delete_conversation:
    "\u092c\u093e\u0924\u091a\u0940\u0924 \u0939\u091f\u093e\u090f\u0902",
  widget_status_thinking:
    "\u0938\u094b\u091a \u0930\u0939\u093e \u0939\u0948...",
  widget_status_idling:
    "\u0928\u093f\u0937\u094d\u0915\u094d\u0930\u093f\u092f...",
  widget_stopped: "\u0930\u0941\u0915\u093e\u0964",
  widget_confirm_allow: "\u0905\u0928\u0941\u092e\u0924\u093f",
  widget_confirm_deny: "\u0905\u0938\u094d\u0935\u0940\u0915\u093e\u0930",
  widget_shortcut_tip:
    "\u0938\u0941\u091d\u093e\u0935: \u0915\u093f\u0938\u0940 \u092d\u0940 \u0938\u092e\u092f \u092e\u0941\u091d\u0938\u0947 \u092c\u093e\u0924 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f {shortcut} \u0926\u092c\u093e\u090f\u0902",
  status_navigating:
    "{url} \u092a\u0930 \u091c\u093e \u0930\u0939\u093e \u0939\u0948",
  status_navigated_to: "{path} \u092a\u0930 \u0917\u092f\u093e",
  status_clicked:
    "\u0924\u0924\u094d\u0935 \u092a\u0930 \u0915\u094d\u0932\u093f\u0915 \u0915\u093f\u092f\u093e",
  status_highlighted:
    "\u0924\u0924\u094d\u0935 \u0939\u093e\u0907\u0932\u093e\u0907\u091f \u0915\u093f\u092f\u093e",
  status_reading_page:
    "\u092a\u0947\u091c \u092a\u0922\u093c \u0930\u0939\u093e \u0939\u0948",
  status_fetching:
    "\u0921\u0947\u091f\u093e \u092a\u094d\u0930\u093e\u092a\u094d\u0924 \u0915\u0930 \u0930\u0939\u093e \u0939\u0948",
  status_filling:
    "\u0907\u0928\u092a\u0941\u091f \u092d\u0930 \u0930\u0939\u093e \u0939\u0948",
  status_selecting:
    "\u0935\u093f\u0915\u0932\u094d\u092a \u091a\u0941\u0928 \u0930\u0939\u093e \u0939\u0948",
  status_toggling:
    "\u091a\u0947\u0915\u092c\u0949\u0915\u094d\u0938 \u091f\u0949\u0917\u0932",
  status_submitting:
    "\u092b\u0949\u0930\u094d\u092e \u0938\u092c\u092e\u093f\u091f \u0915\u0930 \u0930\u0939\u093e \u0939\u0948",
  status_scrolling:
    "\u0938\u094d\u0915\u094d\u0930\u094b\u0932\u093f\u0902\u0917",
  status_searching: "\u092a\u0947\u091c \u092e\u0947\u0902 \u0916\u094b\u091c",
  status_extracting:
    "\u091f\u0947\u092c\u0932 \u0928\u093f\u0915\u093e\u0932 \u0930\u0939\u093e \u0939\u0948",
  popup_loading:
    "\u0932\u094b\u0921 \u0939\u094b \u0930\u0939\u093e \u0939\u0948...",
  popup_provider: "\u092a\u094d\u0930\u0926\u093e\u0924\u093e",
  popup_api_key: "API \u0915\u0941\u0902\u091c\u0940",
  popup_api_key_placeholder:
    "{provider} API \u0915\u0941\u0902\u091c\u0940 \u0926\u0930\u094d\u091c \u0915\u0930\u0947\u0902",
  popup_model: "\u092e\u0949\u0921\u0932",
  popup_save:
    "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938 \u0938\u0939\u0947\u091c\u0947\u0902",
  popup_saved: "\u0938\u0939\u0947\u091c\u093e \u0917\u092f\u093e",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "\u0905\u092a\u0928\u0940 \u0915\u0941\u0902\u091c\u0940",
  popup_managed_connected:
    "gyoza \u092a\u094d\u0932\u0947\u091f\u092b\u0949\u0930\u094d\u092e \u0938\u0947 \u091c\u0941\u0921\u093c\u093e",
  popup_managed_sign_out: "\u0938\u093e\u0907\u0928 \u0906\u0909\u091f",
  popup_managed_subscribe_desc:
    "gyoza Pro \u0915\u0947 \u0938\u093e\u0925 \u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902 \u2014 API \u0915\u0941\u0902\u091c\u0940 \u0915\u0940 \u091c\u093c\u0930\u0942\u0930\u0924 \u0928\u0939\u0940\u0902\u0964",
  popup_managed_subscribe_btn:
    "\u0936\u0941\u0930\u0942 \u0915\u0930\u0947\u0902",
  popup_recipes: "\u0930\u0947\u0938\u093f\u092a\u0940",
  popup_all_recipes: "\u0938\u092d\u0940 \u0930\u0947\u0938\u093f\u092a\u0940",
  popup_recipes_for: "\u0930\u0947\u0938\u093f\u092a\u0940 \u2014 {domain}",
  popup_no_recipes_all:
    "\u0905\u092d\u0940 \u0915\u094b\u0908 \u0930\u0947\u0938\u093f\u092a\u0940 \u0928\u0939\u0940\u0902\u0964",
  popup_no_recipes_site:
    "{domain} \u0915\u0947 \u0932\u093f\u090f \u0915\u094b\u0908 \u0930\u0947\u0938\u093f\u092a\u0940 \u0928\u0939\u0940\u0902\u0964 AI \u0928\u0947\u0935\u093f\u0917\u0947\u0936\u0928 \u092c\u0947\u0939\u0924\u0930 \u0915\u0930\u0928\u0947 \u0915\u0947 \u0932\u093f\u090f \u0930\u0947\u0938\u093f\u092a\u0940 \u0907\u0902\u092a\u094b\u0930\u094d\u091f \u0915\u0930\u0947\u0902\u0964",
  popup_import: "+ \u0907\u0902\u092a\u094b\u0930\u094d\u091f",
  popup_back: "\u2190 \u0935\u093e\u092a\u0938",
  popup_settings: "\u0938\u0947\u091f\u093f\u0902\u0917\u094d\u0938",
  popup_yolo_mode: "Yolo \u092e\u094b\u0921",
  popup_yolo_desc:
    "\u092a\u0941\u0937\u094d\u091f\u093f \u091b\u094b\u0921\u093c\u0947\u0902 \u2014 AI \u0924\u0941\u0930\u0902\u0924 \u0915\u093e\u0930\u094d\u0930\u0935\u093e\u0908 \u0915\u0930\u0924\u093e \u0939\u0948",
  popup_chat_only: "\u0915\u0947\u0935\u0932 \u091a\u0948\u091f",
  popup_chat_only_desc:
    "\u0915\u0947\u0935\u0932 \u091a\u0948\u091f \u0914\u0930 \u092a\u0947\u091c \u092a\u0922\u093c\u0947\u0902 \u2014 \u0915\u094b\u0908 \u0915\u094d\u0932\u093f\u0915, \u092b\u0949\u0930\u094d\u092e \u092f\u093e \u0928\u0947\u0935\u093f\u0917\u0947\u0936\u0928 \u0928\u0939\u0940\u0902",
  popup_sticky_chat: "\u0938\u094d\u0925\u093f\u0930 \u091a\u0948\u091f",
  popup_sticky_chat_desc:
    "\u091a\u0948\u091f \u0916\u0941\u0932\u093e \u0930\u0916\u0947\u0902 \u2014 \u0915\u0930\u094d\u0938\u0930 \u0928\u093f\u0915\u091f\u0924\u093e \u0905\u0928\u0926\u0947\u0916\u093e \u0915\u0930\u0947\u0902 \u0914\u0930 \u0926\u093f\u0916\u093e\u0908 \u0926\u0947\u0902",
  popup_auto_import_recipes: "रेसिपी स्वचालित रूप से आयात करें",
  popup_auto_import_recipes_desc:
    "आपके द्वारा विज़िट की जाने वाली वेबसाइटों से llms.txt रेसिपी स्वचालित रूप से आयात करें",
  popup_theme: "\u0925\u0940\u092e",
  popup_dark: "\u0921\u093e\u0930\u094d\u0915",
  popup_light: "\u0932\u093e\u0907\u091f",
  popup_language: "\u092d\u093e\u0937\u093e",
  popup_language_auto:
    "\u0911\u091f\u094b (\u092c\u094d\u0930\u093e\u0909\u091c\u093c\u0930)",
};

const ja: Translations = {
  widget_placeholder:
    "\u4f55\u3067\u3082\u805e\u3044\u3066\u304f\u3060\u3055\u3044...",
  widget_empty:
    "\u3053\u306e\u30da\u30fc\u30b8\u306b\u3064\u3044\u3066\u4f55\u3067\u3082\u805e\u3044\u3066\u304f\u3060\u3055\u3044...",
  widget_new_chat: "\u65b0\u3057\u3044\u30c1\u30e3\u30c3\u30c8",
  widget_history: "\u4f1a\u8a71\u5c65\u6b74",
  widget_settings: "\u8a2d\u5b9a",
  widget_no_conversations:
    "\u4f1a\u8a71\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093",
  widget_msg_count: "{count}\u4ef6",
  widget_just_now: "\u305f\u3063\u305f\u4eca",
  widget_minutes_ago: "{n}\u5206\u524d",
  widget_hours_ago: "{n}\u6642\u9593\u524d",
  widget_days_ago: "{n}\u65e5\u524d",
  widget_recipe_imported:
    "{name}\u304b\u3089\u30ec\u30b7\u30d4\u3092\u81ea\u52d5\u30a4\u30f3\u30dd\u30fc\u30c8\u3057\u307e\u3057\u305f",
  widget_delete_conversation: "\u4f1a\u8a71\u3092\u524a\u9664",
  widget_status_thinking: "\u8003\u3048\u4e2d...",
  widget_status_idling: "\u5f85\u6a5f\u4e2d...",
  widget_stopped: "\u505c\u6b62\u3057\u307e\u3057\u305f\u3002",
  widget_confirm_allow: "\u8a31\u53ef",
  widget_confirm_deny: "\u62d2\u5426",
  widget_shortcut_tip:
    "\u30d2\u30f3\u30c8: {shortcut} \u3092\u62bc\u3057\u3066\u3044\u3064\u3067\u3082\u8a71\u3057\u304b\u3051\u3066\u304f\u3060\u3055\u3044",
  status_navigating: "{url}\u306b\u79fb\u52d5\u4e2d",
  status_navigated_to: "{path} \u306b\u79fb\u52d5\u3057\u307e\u3057\u305f",
  status_clicked: "\u8981\u7d20\u3092\u30af\u30ea\u30c3\u30af",
  status_highlighted: "\u8981\u7d20\u3092\u30cf\u30a4\u30e9\u30a4\u30c8",
  status_reading_page: "\u30da\u30fc\u30b8\u3092\u8aad\u307f\u53d6\u308a\u4e2d",
  status_fetching: "\u30c7\u30fc\u30bf\u3092\u53d6\u5f97\u4e2d",
  status_filling: "\u5165\u529b\u4e2d",
  status_selecting: "\u30aa\u30d7\u30b7\u30e7\u30f3\u3092\u9078\u629e\u4e2d",
  status_toggling:
    "\u30c1\u30a7\u30c3\u30af\u30dc\u30c3\u30af\u30b9\u3092\u5207\u308a\u66ff\u3048",
  status_submitting: "\u30d5\u30a9\u30fc\u30e0\u3092\u9001\u4fe1\u4e2d",
  status_scrolling: "\u30b9\u30af\u30ed\u30fc\u30eb\u4e2d",
  status_searching: "\u30da\u30fc\u30b8\u3092\u691c\u7d22\u4e2d",
  status_extracting: "\u30c6\u30fc\u30d6\u30eb\u3092\u62bd\u51fa\u4e2d",
  popup_loading: "\u8aad\u307f\u8fbc\u307f\u4e2d...",
  popup_provider: "\u30d7\u30ed\u30d0\u30a4\u30c0\u30fc",
  popup_api_key: "API\u30ad\u30fc",
  popup_api_key_placeholder:
    "{provider}\u306eAPI\u30ad\u30fc\u3092\u5165\u529b",
  popup_model: "\u30e2\u30c7\u30eb",
  popup_save: "\u8a2d\u5b9a\u3092\u4fdd\u5b58",
  popup_saved: "\u4fdd\u5b58\u6e08\u307f",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "\u81ea\u5206\u306e\u30ad\u30fc",
  popup_managed_connected:
    "gyoza\u30d7\u30e9\u30c3\u30c8\u30d5\u30a9\u30fc\u30e0\u306b\u63a5\u7d9a\u6e08\u307f",
  popup_managed_sign_out: "\u30b5\u30a4\u30f3\u30a2\u30a6\u30c8",
  popup_managed_subscribe_desc:
    "gyoza Pro\u3067\u59cb\u3081\u307e\u3057\u3087\u3046 \u2014 API\u30ad\u30fc\u4e0d\u8981\u3002",
  popup_managed_subscribe_btn: "\u59cb\u3081\u308b",
  popup_recipes: "\u30ec\u30b7\u30d4",
  popup_all_recipes: "\u3059\u3079\u3066\u306e\u30ec\u30b7\u30d4",
  popup_recipes_for: "\u30ec\u30b7\u30d4 \u2014 {domain}",
  popup_no_recipes_all:
    "\u30ec\u30b7\u30d4\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093\u3002",
  popup_no_recipes_site:
    "{domain}\u306e\u30ec\u30b7\u30d4\u306f\u3042\u308a\u307e\u305b\u3093\u3002AI\u30ca\u30d3\u30b2\u30fc\u30b7\u30e7\u30f3\u3092\u5411\u4e0a\u3055\u305b\u308b\u306b\u306f\u30ec\u30b7\u30d4\u3092\u30a4\u30f3\u30dd\u30fc\u30c8\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
  popup_import: "+ \u30a4\u30f3\u30dd\u30fc\u30c8",
  popup_back: "\u2190 \u623b\u308b",
  popup_settings: "\u8a2d\u5b9a",
  popup_yolo_mode: "Yolo\u30e2\u30fc\u30c9",
  popup_yolo_desc:
    "\u78ba\u8a8d\u3092\u30b9\u30ad\u30c3\u30d7 \u2014 AI\u304c\u78ba\u8a8d\u306a\u3057\u3067\u5373\u5ea7\u306b\u5b9f\u884c",
  popup_chat_only: "\u30c1\u30e3\u30c3\u30c8\u306e\u307f",
  popup_chat_only_desc:
    "\u30c1\u30e3\u30c3\u30c8\u3068\u30da\u30fc\u30b8\u306e\u95b2\u89a7\u306e\u307f \u2014 \u30af\u30ea\u30c3\u30af\u3001\u30d5\u30a9\u30fc\u30e0\u3001\u30ca\u30d3\u30b2\u30fc\u30b7\u30e7\u30f3\u306a\u3057",
  popup_sticky_chat: "\u30c1\u30e3\u30c3\u30c8\u56fa\u5b9a",
  popup_sticky_chat_desc:
    "\u30c1\u30e3\u30c3\u30c8\u3092\u958b\u3044\u305f\u307e\u307e\u306b\u3059\u308b \u2014 \u30ab\u30fc\u30bd\u30eb\u306e\u8fd1\u63a5\u3092\u7121\u8996\u3057\u3066\u8868\u793a\u3057\u7d9a\u3051\u308b",
  popup_auto_import_recipes: "レシピの自動インポート",
  popup_auto_import_recipes_desc:
    "訪問したウェブサイトからllms.txtレシピを自動的にインポート",
  popup_theme: "\u30c6\u30fc\u30de",
  popup_dark: "\u30c0\u30fc\u30af",
  popup_light: "\u30e9\u30a4\u30c8",
  popup_language: "\u8a00\u8a9e",
  popup_language_auto: "\u81ea\u52d5\uff08\u30d6\u30e9\u30a6\u30b6\u30fc\uff09",
};

const ko: Translations = {
  widget_placeholder:
    "\ubb34\uc5c7\uc774\ub4e0 \ubb3c\uc5b4\ubcf4\uc138\uc694...",
  widget_empty:
    "\uc774 \ud398\uc774\uc9c0\uc5d0 \ub300\ud574 \ubb34\uc5c7\uc774\ub4e0 \ubb3c\uc5b4\ubcf4\uc138\uc694...",
  widget_new_chat: "\uc0c8 \ucc44\ud305",
  widget_history: "\ub300\ud654 \uae30\ub85d",
  widget_settings: "\uc124\uc815",
  widget_no_conversations:
    "\ub300\ud654\uac00 \uc544\uc9c1 \uc5c6\uc2b5\ub2c8\ub2e4",
  widget_msg_count: "{count}\uac1c \uba54\uc2dc\uc9c0",
  widget_just_now: "\ubc29\uae08",
  widget_minutes_ago: "{n}\ubd84 \uc804",
  widget_hours_ago: "{n}\uc2dc\uac04 \uc804",
  widget_days_ago: "{n}\uc77c \uc804",
  widget_recipe_imported:
    "{name}\uc5d0\uc11c \ub808\uc2dc\ud53c\uac00 \uc790\ub3d9 \uac00\uc838\uc624\uae30 \ub428",
  widget_delete_conversation: "\ub300\ud654 \uc0ad\uc81c",
  widget_status_thinking: "\uc0dd\uac01 \uc911...",
  widget_status_idling: "\ub300\uae30 \uc911...",
  widget_stopped: "\uc815\uc9c0\ub428.",
  widget_confirm_allow: "\ud5c8\uc6a9",
  widget_confirm_deny: "\uac70\ubd80",
  widget_shortcut_tip:
    "\ud301: {shortcut}\uc744 \ub20c\ub7ec \uc5b8\uc81c\ub4e0 \uc800\uc640 \ub300\ud654\ud558\uc138\uc694",
  status_navigating: "{url}\uc73c\ub85c \uc774\ub3d9 \uc911",
  status_navigated_to: "{path}(\uc73c)\ub85c \uc774\ub3d9\ud568",
  status_clicked: "\uc694\uc18c \ud074\ub9ad\ub428",
  status_highlighted: "\uc694\uc18c \uac15\uc870\ub428",
  status_reading_page: "\ud398\uc774\uc9c0 \uc77d\ub294 \uc911",
  status_fetching: "\ub370\uc774\ud130 \uac00\uc838\uc624\ub294 \uc911",
  status_filling: "\uc785\ub825 \uc911",
  status_selecting: "\uc635\uc158 \uc120\ud0dd \uc911",
  status_toggling: "\uccb4\ud06c\ubc15\uc2a4 \uc804\ud658",
  status_submitting: "\uc591\uc2dd \uc81c\ucd9c \uc911",
  status_scrolling: "\uc2a4\ud06c\ub864 \uc911",
  status_searching: "\ud398\uc774\uc9c0 \uac80\uc0c9 \uc911",
  status_extracting: "\ud14c\uc774\ube14 \ucd94\ucd9c \uc911",
  popup_loading: "\ub85c\ub529 \uc911...",
  popup_provider: "\uc81c\uacf5\uc790",
  popup_api_key: "API \ud0a4",
  popup_api_key_placeholder:
    "{provider} API \ud0a4\ub97c \uc785\ub825\ud558\uc138\uc694",
  popup_model: "\ubaa8\ub378",
  popup_save: "\uc124\uc815 \uc800\uc7a5",
  popup_saved: "\uc800\uc7a5\ub428",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "\ub0b4 \ud0a4 \uc0ac\uc6a9",
  popup_managed_connected: "gyoza \ud50c\ub7ab\ud3fc\uc5d0 \uc5f0\uacb0\ub428",
  popup_managed_sign_out: "\ub85c\uadf8\uc544\uc6c3",
  popup_managed_subscribe_desc:
    "gyoza Pro\ub85c \uc2dc\uc791\ud558\uc138\uc694 \u2014 API \ud0a4\uac00 \ud544\uc694 \uc5c6\uc2b5\ub2c8\ub2e4.",
  popup_managed_subscribe_btn: "\uc2dc\uc791\ud558\uae30",
  popup_recipes: "\ub808\uc2dc\ud53c",
  popup_all_recipes: "\ubaa8\ub4e0 \ub808\uc2dc\ud53c",
  popup_recipes_for: "\ub808\uc2dc\ud53c \u2014 {domain}",
  popup_no_recipes_all:
    "\uc124\uce58\ub41c \ub808\uc2dc\ud53c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.",
  popup_no_recipes_site:
    "{domain}\uc5d0 \ub300\ud55c \ub808\uc2dc\ud53c\uac00 \uc5c6\uc2b5\ub2c8\ub2e4. AI \ud0d0\uc0c9\uc744 \uac1c\uc120\ud558\ub824\uba74 \ub808\uc2dc\ud53c\ub97c \uac00\uc838\uc624\uc138\uc694.",
  popup_import: "+ \uac00\uc838\uc624\uae30",
  popup_back: "\u2190 \ub4a4\ub85c",
  popup_settings: "\uc124\uc815",
  popup_yolo_mode: "Yolo \ubaa8\ub4dc",
  popup_yolo_desc:
    "\ud655\uc778 \uac74\ub108\ub6f0\uae30 \u2014 AI\uac00 \ubb3b\uc9c0 \uc54a\uace0 \uc989\uc2dc \uc2e4\ud589",
  popup_chat_only: "\ucc44\ud305\ub9cc",
  popup_chat_only_desc:
    "\ucc44\ud305\uacfc \ud398\uc774\uc9c0 \uc77d\uae30\ub9cc \u2014 \ud074\ub9ad, \uc591\uc2dd, \ud0d0\uc0c9 \uc5c6\uc74c",
  popup_sticky_chat: "\uace0\uc815 \ucc44\ud305",
  popup_sticky_chat_desc:
    "\ucc44\ud305\ucc3d \uc5f4\ub9b0 \uc0c1\ud0dc \uc720\uc9c0 \u2014 \ucee4\uc11c \uadfc\uc811 \ubb34\uc2dc\ud558\uace0 \uacc4\uc18d \ud45c\uc2dc",
  popup_auto_import_recipes: "레시피 자동 가져오기",
  popup_auto_import_recipes_desc:
    "방문하는 웹사이트에서 llms.txt 레시피를 자동으로 가져오기",
  popup_theme: "\ud14c\ub9c8",
  popup_dark: "\ub2e4\ud06c",
  popup_light: "\ub77c\uc774\ud2b8",
  popup_language: "\uc5b8\uc5b4",
  popup_language_auto: "\uc790\ub3d9 (\ube0c\ub77c\uc6b0\uc800)",
};

const zhCN: Translations = {
  widget_placeholder: "\u968f\u4fbf\u95ee...",
  widget_empty:
    "\u5173\u4e8e\u8fd9\u4e2a\u9875\u9762\uff0c\u968f\u4fbf\u95ee...",
  widget_new_chat: "\u65b0\u5bf9\u8bdd",
  widget_history: "\u5bf9\u8bdd\u5386\u53f2",
  widget_settings: "\u8bbe\u7f6e",
  widget_no_conversations: "\u6682\u65e0\u5bf9\u8bdd",
  widget_msg_count: "{count}\u6761",
  widget_just_now: "\u521a\u521a",
  widget_minutes_ago: "{n}\u5206\u949f\u524d",
  widget_hours_ago: "{n}\u5c0f\u65f6\u524d",
  widget_days_ago: "{n}\u5929\u524d",
  widget_recipe_imported:
    "\u5df2\u4ece{name}\u81ea\u52a8\u5bfc\u5165\u914d\u65b9",
  widget_delete_conversation: "\u5220\u9664\u5bf9\u8bdd",
  widget_status_thinking: "\u601d\u8003\u4e2d...",
  widget_status_idling: "\u7a7a\u95f2\u4e2d...",
  widget_stopped: "\u5df2\u505c\u6b62\u3002",
  widget_confirm_allow: "\u5141\u8bb8",
  widget_confirm_deny: "\u62d2\u7edd",
  widget_shortcut_tip:
    "\u63d0\u793a\uff1a\u6309 {shortcut} \u968f\u65f6\u4e0e\u6211\u5bf9\u8bdd",
  status_navigating: "\u6b63\u5728\u5bfc\u822a\u5230 {url}",
  status_navigated_to: "\u5df2\u5bfc\u822a\u5230 {path}",
  status_clicked: "\u5df2\u70b9\u51fb\u5143\u7d20",
  status_highlighted: "\u5df2\u9ad8\u4eae\u5143\u7d20",
  status_reading_page: "\u6b63\u5728\u8bfb\u53d6\u9875\u9762",
  status_fetching: "\u6b63\u5728\u83b7\u53d6\u6570\u636e",
  status_filling: "\u6b63\u5728\u586b\u5199\u8f93\u5165",
  status_selecting: "\u6b63\u5728\u9009\u62e9\u9009\u9879",
  status_toggling: "\u6b63\u5728\u5207\u6362\u590d\u9009\u6846",
  status_submitting: "\u6b63\u5728\u63d0\u4ea4\u8868\u5355",
  status_scrolling: "\u6b63\u5728\u6eda\u52a8",
  status_searching: "\u6b63\u5728\u641c\u7d22\u9875\u9762",
  status_extracting: "\u6b63\u5728\u63d0\u53d6\u8868\u683c",
  popup_loading: "\u52a0\u8f7d\u4e2d...",
  popup_provider: "\u63d0\u4f9b\u5546",
  popup_api_key: "API\u5bc6\u94a5",
  popup_api_key_placeholder: "\u8f93\u5165{provider} API\u5bc6\u94a5",
  popup_model: "\u6a21\u578b",
  popup_save: "\u4fdd\u5b58\u8bbe\u7f6e",
  popup_saved: "\u5df2\u4fdd\u5b58",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "\u81ea\u6709\u5bc6\u94a5",
  popup_managed_connected: "\u5df2\u8fde\u63a5\u5230gyoza\u5e73\u53f0",
  popup_managed_sign_out: "\u9000\u51fa",
  popup_managed_subscribe_desc:
    "\u5f00\u59cb\u4f7f\u7528gyoza Pro \u2014 \u65e0\u9700API\u5bc6\u94a5\u3002",
  popup_managed_subscribe_btn: "\u5f00\u59cb\u4f7f\u7528",
  popup_recipes: "\u914d\u65b9",
  popup_all_recipes: "\u6240\u6709\u914d\u65b9",
  popup_recipes_for: "\u914d\u65b9 \u2014 {domain}",
  popup_no_recipes_all: "\u5c1a\u672a\u5b89\u88c5\u914d\u65b9\u3002",
  popup_no_recipes_site:
    "{domain}\u65e0\u914d\u65b9\u3002\u5bfc\u5165\u914d\u65b9\u4ee5\u589e\u5f3aAI\u5bfc\u822a\u3002",
  popup_import: "+ \u5bfc\u5165",
  popup_back: "\u2190 \u8fd4\u56de",
  popup_settings: "\u8bbe\u7f6e",
  popup_yolo_mode: "Yolo\u6a21\u5f0f",
  popup_yolo_desc:
    "\u8df3\u8fc7\u786e\u8ba4 \u2014 AI\u65e0\u9700\u8be2\u95ee\u7acb\u5373\u6267\u884c",
  popup_chat_only: "\u4ec5\u804a\u5929",
  popup_chat_only_desc:
    "\u4ec5\u804a\u5929\u548c\u9605\u8bfb\u9875\u9762 \u2014 \u65e0\u70b9\u51fb\u3001\u8868\u5355\u6216\u5bfc\u822a",
  popup_sticky_chat: "\u56fa\u5b9a\u804a\u5929",
  popup_sticky_chat_desc:
    "\u4fdd\u6301\u804a\u5929\u6253\u5f00 \u2014 \u5ffd\u7565\u5149\u6807\u63a5\u8fd1\u5e76\u4fdd\u6301\u53ef\u89c1",
  popup_auto_import_recipes: "自动导入食谱",
  popup_auto_import_recipes_desc: "自动从您访问的网站导入llms.txt食谱",
  popup_theme: "\u4e3b\u9898",
  popup_dark: "\u6df1\u8272",
  popup_light: "\u6d45\u8272",
  popup_language: "\u8bed\u8a00",
  popup_language_auto: "\u81ea\u52a8\uff08\u6d4f\u89c8\u5668\uff09",
};

const zhTW: Translations = {
  ...zhCN,
  widget_empty:
    "\u95dc\u65bc\u9019\u500b\u9801\u9762\uff0c\u96a8\u4fbf\u554f...",
  widget_no_conversations: "\u5c1a\u7121\u5c0d\u8a71",
  widget_delete_conversation: "\u522a\u9664\u5c0d\u8a71",
  widget_status_thinking: "\u601d\u8003\u4e2d...",
  widget_status_idling: "\u9592\u7f6e\u4e2d...",
  widget_stopped: "\u5df2\u505c\u6b62\u3002",
  widget_confirm_allow: "\u5141\u8a31",
  widget_confirm_deny: "\u62d2\u7d55",
  widget_shortcut_tip:
    "\u63d0\u793a\uff1a\u6309 {shortcut} \u96a8\u6642\u8207\u6211\u5c0d\u8a71",
  status_navigating: "\u6b63\u5728\u5c0e\u822a\u81f3 {url}",
  status_navigated_to: "\u5df2\u5c0e\u822a\u81f3 {path}",
  status_clicked: "\u5df2\u9ede\u64ca\u5143\u7d20",
  status_highlighted: "\u5df2\u9ad8\u4eae\u5143\u7d20",
  status_reading_page: "\u6b63\u5728\u8b80\u53d6\u9801\u9762",
  status_fetching: "\u6b63\u5728\u7372\u53d6\u8cc7\u6599",
  status_filling: "\u6b63\u5728\u586b\u5beb\u8f38\u5165",
  status_selecting: "\u6b63\u5728\u9078\u64c7\u9078\u9805",
  status_toggling: "\u6b63\u5728\u5207\u63db\u6838\u53d6\u65b9\u584a",
  status_submitting: "\u6b63\u5728\u63d0\u4ea4\u8868\u55ae",
  status_scrolling: "\u6b63\u5728\u6372\u52d5",
  status_searching: "\u6b63\u5728\u641c\u5c0b\u9801\u9762",
  status_extracting: "\u6b63\u5728\u64f7\u53d6\u8868\u683c",
  popup_loading: "\u8f09\u5165\u4e2d...",
  popup_api_key: "API\u91d1\u9470",
  popup_api_key_placeholder: "\u8f38\u5165{provider} API\u91d1\u9470",
  popup_save: "\u5132\u5b58\u8a2d\u5b9a",
  popup_saved: "\u5df2\u5132\u5b58",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "\u81ea\u6709\u91d1\u9470",
  popup_managed_connected: "\u5df2\u9023\u63a5\u5230gyoza\u5e73\u53f0",
  popup_managed_sign_out: "\u767b\u51fa",
  popup_managed_subscribe_desc:
    "\u958b\u59cb\u4f7f\u7528gyoza Pro \u2014 \u7121\u9700API\u91d1\u9470\u3002",
  popup_managed_subscribe_btn: "\u958b\u59cb\u4f7f\u7528",
  popup_recipes: "\u914d\u65b9",
  popup_all_recipes: "\u6240\u6709\u914d\u65b9",
  popup_no_recipes_all: "\u5c1a\u672a\u5b89\u88dd\u914d\u65b9\u3002",
  popup_no_recipes_site:
    "{domain}\u7121\u914d\u65b9\u3002\u532f\u5165\u914d\u65b9\u4ee5\u589e\u5f37AI\u5c0e\u822a\u3002",
  popup_import: "+ \u532f\u5165",
  popup_back: "\u2190 \u8fd4\u56de",
  popup_settings: "\u8a2d\u5b9a",
  popup_yolo_desc:
    "\u8df3\u904e\u78ba\u8a8d \u2014 AI\u7121\u9700\u8a62\u554f\u7acb\u5373\u57f7\u884c",
  popup_chat_only: "\u50c5\u804a\u5929",
  popup_chat_only_desc:
    "\u50c5\u804a\u5929\u548c\u95b1\u8b80\u9801\u9762 \u2014 \u7121\u9ede\u64ca\u3001\u8868\u55ae\u6216\u5c0e\u89bd",
  popup_sticky_chat: "\u56fa\u5b9a\u804a\u5929",
  popup_sticky_chat_desc:
    "\u4fdd\u6301\u804a\u5929\u958b\u555f \u2014 \u5ffd\u7565\u6e38\u6a19\u63a5\u8fd1\u4e26\u4fdd\u6301\u53ef\u898b",
  popup_auto_import_recipes: "自動匯入食譜",
  popup_auto_import_recipes_desc: "自動從您造訪的網站匯入llms.txt食譜",
  popup_theme: "\u4e3b\u984c",
  popup_dark: "\u6df1\u8272",
  popup_light: "\u6dfa\u8272",
  popup_language: "\u8a9e\u8a00",
  popup_language_auto: "\u81ea\u52d5\uff08\u700f\u89bd\u5668\uff09",
};

const th: Translations = {
  widget_placeholder:
    "\u0e16\u0e32\u0e21\u0e2d\u0e30\u0e44\u0e23\u0e01\u0e47\u0e44\u0e14\u0e49...",
  widget_empty:
    "\u0e16\u0e32\u0e21\u0e2d\u0e30\u0e44\u0e23\u0e01\u0e47\u0e44\u0e14\u0e49\u0e40\u0e01\u0e35\u0e48\u0e22\u0e27\u0e01\u0e31\u0e1a\u0e2b\u0e19\u0e49\u0e32\u0e19\u0e35\u0e49...",
  widget_new_chat: "\u0e41\u0e0a\u0e17\u0e43\u0e2b\u0e21\u0e48",
  widget_history:
    "\u0e1b\u0e23\u0e30\u0e27\u0e31\u0e15\u0e34\u0e01\u0e32\u0e23\u0e2a\u0e19\u0e17\u0e19\u0e32",
  widget_settings: "\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32",
  widget_no_conversations:
    "\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e01\u0e32\u0e23\u0e2a\u0e19\u0e17\u0e19\u0e32",
  widget_msg_count: "{count} \u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21",
  widget_just_now:
    "\u0e40\u0e21\u0e37\u0e48\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48",
  widget_minutes_ago:
    "{n}\u0e19\u0e32\u0e17\u0e35\u0e17\u0e35\u0e48\u0e41\u0e25\u0e49\u0e27",
  widget_hours_ago:
    "{n}\u0e0a\u0e31\u0e48\u0e27\u0e42\u0e21\u0e07\u0e17\u0e35\u0e48\u0e41\u0e25\u0e49\u0e27",
  widget_days_ago:
    "{n}\u0e27\u0e31\u0e19\u0e17\u0e35\u0e48\u0e41\u0e25\u0e49\u0e27",
  widget_recipe_imported:
    "\u0e19\u0e33\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e15\u0e23\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34\u0e08\u0e32\u0e01 {name}",
  widget_delete_conversation:
    "\u0e25\u0e1a\u0e01\u0e32\u0e23\u0e2a\u0e19\u0e17\u0e19\u0e32",
  widget_status_thinking: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e04\u0e34\u0e14...",
  widget_status_idling: "\u0e27\u0e48\u0e32\u0e07...",
  widget_stopped: "\u0e2b\u0e22\u0e38\u0e14\u0e41\u0e25\u0e49\u0e27",
  widget_confirm_allow: "\u0e2d\u0e19\u0e38\u0e0d\u0e32\u0e15",
  widget_confirm_deny: "\u0e1b\u0e0f\u0e34\u0e40\u0e2a\u0e18",
  widget_shortcut_tip:
    "\u0e40\u0e04\u0e25\u0e47\u0e14\u0e25\u0e31\u0e1a: \u0e01\u0e14 {shortcut} \u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e1e\u0e39\u0e14\u0e04\u0e38\u0e22\u0e01\u0e31\u0e1a\u0e09\u0e31\u0e19\u0e44\u0e14\u0e49\u0e17\u0e38\u0e01\u0e40\u0e21\u0e37\u0e48\u0e2d",
  status_navigating:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e19\u0e33\u0e17\u0e32\u0e07\u0e44\u0e1b {url}",
  status_navigated_to:
    "\u0e44\u0e1b\u0e17\u0e35\u0e48 {path} \u0e41\u0e25\u0e49\u0e27",
  status_clicked:
    "\u0e04\u0e25\u0e34\u0e01\u0e2d\u0e07\u0e04\u0e4c\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a",
  status_highlighted:
    "\u0e44\u0e2e\u0e44\u0e25\u0e17\u0e4c\u0e2d\u0e07\u0e04\u0e4c\u0e1b\u0e23\u0e30\u0e01\u0e2d\u0e1a",
  status_reading_page:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2d\u0e48\u0e32\u0e19\u0e2b\u0e19\u0e49\u0e32",
  status_fetching:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e14\u0e36\u0e07\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25",
  status_filling:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e01\u0e23\u0e2d\u0e01\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25",
  status_selecting:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e25\u0e37\u0e2d\u0e01\u0e15\u0e31\u0e27\u0e40\u0e25\u0e37\u0e2d\u0e01",
  status_toggling:
    "\u0e2a\u0e25\u0e31\u0e1a\u0e0a\u0e48\u0e2d\u0e07\u0e17\u0e33\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e2b\u0e21\u0e32\u0e22",
  status_submitting:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e2a\u0e48\u0e07\u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21",
  status_scrolling:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e40\u0e25\u0e37\u0e48\u0e2d\u0e19",
  status_searching:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e2b\u0e19\u0e49\u0e32",
  status_extracting:
    "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e14\u0e36\u0e07\u0e15\u0e32\u0e23\u0e32\u0e07",
  popup_loading: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14...",
  popup_provider:
    "\u0e1c\u0e39\u0e49\u0e43\u0e2b\u0e49\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23",
  popup_api_key: "\u0e04\u0e35\u0e22\u0e4c API",
  popup_api_key_placeholder:
    "\u0e01\u0e23\u0e2d\u0e01\u0e04\u0e35\u0e22\u0e4c API {provider}",
  popup_model: "\u0e42\u0e21\u0e40\u0e14\u0e25",
  popup_save:
    "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e01\u0e32\u0e23\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32",
  popup_saved: "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e41\u0e25\u0e49\u0e27",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key:
    "\u0e04\u0e35\u0e22\u0e4c\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13",
  popup_managed_connected:
    "\u0e40\u0e0a\u0e37\u0e48\u0e2d\u0e21\u0e15\u0e48\u0e2d\u0e41\u0e1e\u0e25\u0e15\u0e1f\u0e2d\u0e23\u0e4c\u0e21 gyoza",
  popup_managed_sign_out:
    "\u0e2d\u0e2d\u0e01\u0e08\u0e32\u0e01\u0e23\u0e30\u0e1a\u0e1a",
  popup_managed_subscribe_desc:
    "\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19\u0e01\u0e31\u0e1a gyoza Pro \u2014 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e43\u0e0a\u0e49\u0e04\u0e35\u0e22\u0e4c API",
  popup_managed_subscribe_btn:
    "\u0e40\u0e23\u0e34\u0e48\u0e21\u0e15\u0e49\u0e19",
  popup_recipes: "\u0e2a\u0e39\u0e15\u0e23",
  popup_all_recipes:
    "\u0e2a\u0e39\u0e15\u0e23\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14",
  popup_recipes_for: "\u0e2a\u0e39\u0e15\u0e23 \u2014 {domain}",
  popup_no_recipes_all:
    "\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e39\u0e15\u0e23\u0e17\u0e35\u0e48\u0e15\u0e34\u0e14\u0e15\u0e31\u0e49\u0e07",
  popup_no_recipes_site:
    "\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e39\u0e15\u0e23\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a {domain} \u0e19\u0e33\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e15\u0e23\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e1b\u0e23\u0e31\u0e1a\u0e1b\u0e23\u0e38\u0e07\u0e01\u0e32\u0e23\u0e19\u0e33\u0e17\u0e32\u0e07 AI",
  popup_import: "+ \u0e19\u0e33\u0e40\u0e02\u0e49\u0e32",
  popup_back: "\u2190 \u0e01\u0e25\u0e31\u0e1a",
  popup_settings: "\u0e15\u0e31\u0e49\u0e07\u0e04\u0e48\u0e32",
  popup_yolo_mode: "\u0e42\u0e2b\u0e21\u0e14 Yolo",
  popup_yolo_desc:
    "\u0e02\u0e49\u0e32\u0e21\u0e01\u0e32\u0e23\u0e22\u0e37\u0e19\u0e22\u0e31\u0e19 \u2014 AI \u0e17\u0e33\u0e07\u0e32\u0e19\u0e17\u0e31\u0e19\u0e17\u0e35\u0e42\u0e14\u0e22\u0e44\u0e21\u0e48\u0e16\u0e32\u0e21",
  popup_chat_only:
    "\u0e41\u0e0a\u0e17\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19",
  popup_chat_only_desc:
    "\u0e41\u0e0a\u0e17\u0e41\u0e25\u0e30\u0e2d\u0e48\u0e32\u0e19\u0e2b\u0e19\u0e49\u0e32\u0e40\u0e27\u0e47\u0e1a\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19 \u2014 \u0e44\u0e21\u0e48\u0e21\u0e35\u0e01\u0e32\u0e23\u0e04\u0e25\u0e34\u0e01 \u0e41\u0e1a\u0e1a\u0e1f\u0e2d\u0e23\u0e4c\u0e21 \u0e2b\u0e23\u0e37\u0e2d\u0e01\u0e32\u0e23\u0e19\u0e33\u0e17\u0e32\u0e07",
  popup_sticky_chat: "\u0e41\u0e0a\u0e17\u0e04\u0e07\u0e17\u0e35\u0e48",
  popup_sticky_chat_desc:
    "\u0e40\u0e1b\u0e34\u0e14\u0e41\u0e0a\u0e17\u0e04\u0e49\u0e32\u0e07\u0e44\u0e27\u0e49 \u2014 \u0e44\u0e21\u0e48\u0e2a\u0e19\u0e43\u0e08\u0e04\u0e27\u0e32\u0e21\u0e43\u0e01\u0e25\u0e49\u0e40\u0e04\u0e2d\u0e23\u0e4c\u0e40\u0e0b\u0e2d\u0e23\u0e4c\u0e41\u0e25\u0e30\u0e41\u0e2a\u0e14\u0e07\u0e15\u0e25\u0e2d\u0e14",
  popup_auto_import_recipes: "นำเข้าสูตรอัตโนมัติ",
  popup_auto_import_recipes_desc:
    "นำเข้าสูตร llms.txt จากเว็บไซต์ที่คุณเยี่ยมชมโดยอัตโนมัติ",
  popup_theme: "\u0e18\u0e35\u0e21",
  popup_dark: "\u0e21\u0e37\u0e14",
  popup_light: "\u0e2a\u0e27\u0e48\u0e32\u0e07",
  popup_language: "\u0e20\u0e32\u0e29\u0e32",
  popup_language_auto:
    "\u0e2d\u0e31\u0e15\u0e42\u0e19\u0e21\u0e31\u0e15\u0e34 (\u0e40\u0e1a\u0e23\u0e32\u0e27\u0e40\u0e0b\u0e2d\u0e23\u0e4c)",
};

const vi: Translations = {
  widget_placeholder: "H\u1ecfi b\u1ea5t c\u1ee9 \u0111i\u1ec1u g\u00ec...",
  widget_empty:
    "H\u1ecfi b\u1ea5t c\u1ee9 \u0111i\u1ec1u g\u00ec v\u1ec1 trang n\u00e0y...",
  widget_new_chat: "Cu\u1ed9c tr\u00f2 chuy\u1ec7n m\u1edbi",
  widget_history: "L\u1ecbch s\u1eed h\u1ed9i tho\u1ea1i",
  widget_settings: "C\u00e0i \u0111\u1eb7t",
  widget_no_conversations:
    "Ch\u01b0a c\u00f3 cu\u1ed9c tr\u00f2 chuy\u1ec7n n\u00e0o",
  widget_msg_count: "{count} tin nh\u1eafn",
  widget_just_now: "v\u1eeba xong",
  widget_minutes_ago: "{n} ph\u00fat tr\u01b0\u1edbc",
  widget_hours_ago: "{n} gi\u1edd tr\u01b0\u1edbc",
  widget_days_ago: "{n} ng\u00e0y tr\u01b0\u1edbc",
  widget_recipe_imported:
    "C\u00f4ng th\u1ee9c \u0111\u00e3 t\u1ef1 \u0111\u1ed9ng nh\u1eadp t\u1eeb {name}",
  widget_delete_conversation: "X\u00f3a cu\u1ed9c tr\u00f2 chuy\u1ec7n",
  widget_status_thinking: "\u0110ang suy ngh\u0129...",
  widget_status_idling: "Ngh\u1ec9 ng\u01a1i...",
  widget_stopped: "\u0110\u00e3 d\u1eebng.",
  widget_confirm_allow: "Cho ph\u00e9p",
  widget_confirm_deny: "T\u1eeb ch\u1ed1i",
  widget_shortcut_tip:
    "M\u1eb9o: nh\u1ea5n {shortcut} \u0111\u1ec3 n\u00f3i chuy\u1ec7n v\u1edbi t\u00f4i b\u1ea5t c\u1ee9 l\u00fac n\u00e0o",
  status_navigating: "\u0110ang chuy\u1ec3n \u0111\u1ebfn {url}",
  status_navigated_to: "\u0110\u00e3 chuy\u1ec3n \u0111\u1ebfn {path}",
  status_clicked: "\u0110\u00e3 nh\u1ea5p ph\u1ea7n t\u1eed",
  status_highlighted: "\u0110\u00e3 \u0111\u00e1nh d\u1ea5u ph\u1ea7n t\u1eed",
  status_reading_page: "\u0110ang \u0111\u1ecdc trang",
  status_fetching: "\u0110ang l\u1ea5y d\u1eef li\u1ec7u",
  status_filling: "\u0110ang \u0111i\u1ec1n d\u1eef li\u1ec7u",
  status_selecting: "\u0110ang ch\u1ecdn t\u00f9y ch\u1ecdn",
  status_toggling: "Chuy\u1ec3n \u0111\u1ed5i h\u1ed9p ki\u1ec3m",
  status_submitting: "\u0110ang g\u1eedi bi\u1ec3u m\u1eabu",
  status_scrolling: "\u0110ang cu\u1ed9n",
  status_searching: "\u0110ang t\u00ecm ki\u1ebfm trang",
  status_extracting: "\u0110ang tr\u00edch xu\u1ea5t b\u1ea3ng",
  popup_loading: "\u0110ang t\u1ea3i...",
  popup_provider: "Nh\u00e0 cung c\u1ea5p",
  popup_api_key: "Kh\u00f3a API",
  popup_api_key_placeholder: "Nh\u1eadp kh\u00f3a API {provider}",
  popup_model: "M\u00f4 h\u00ecnh",
  popup_save: "L\u01b0u C\u00e0i \u0110\u1eb7t",
  popup_saved: "\u0110\u00e3 l\u01b0u",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Kh\u00f3a ri\u00eang",
  popup_managed_connected:
    "\u0110\u00e3 k\u1ebft n\u1ed1i v\u1edbi n\u1ec1n t\u1ea3ng gyoza",
  popup_managed_sign_out: "\u0110\u0103ng xu\u1ea5t",
  popup_managed_subscribe_desc:
    "B\u1eaft \u0111\u1ea7u v\u1edbi gyoza Pro \u2014 kh\u00f4ng c\u1ea7n kh\u00f3a API.",
  popup_managed_subscribe_btn: "B\u1eaft \u0111\u1ea7u",
  popup_recipes: "C\u00f4ng th\u1ee9c",
  popup_all_recipes: "T\u1ea5t c\u1ea3 C\u00f4ng th\u1ee9c",
  popup_recipes_for: "C\u00f4ng th\u1ee9c \u2014 {domain}",
  popup_no_recipes_all: "Ch\u01b0a c\u00f3 c\u00f4ng th\u1ee9c n\u00e0o.",
  popup_no_recipes_site:
    "Kh\u00f4ng c\u00f3 c\u00f4ng th\u1ee9c cho {domain}. Nh\u1eadp c\u00f4ng th\u1ee9c \u0111\u1ec3 c\u1ea3i thi\u1ec7n \u0111i\u1ec1u h\u01b0\u1edbng AI.",
  popup_import: "+ Nh\u1eadp",
  popup_back: "\u2190 Quay l\u1ea1i",
  popup_settings: "C\u00e0i \u0111\u1eb7t",
  popup_yolo_mode: "Ch\u1ebf \u0111\u1ed9 Yolo",
  popup_yolo_desc:
    "B\u1ecf qua x\u00e1c nh\u1eadn \u2014 AI h\u00e0nh \u0111\u1ed9ng ngay m\u00e0 kh\u00f4ng h\u1ecfi",
  popup_chat_only: "Ch\u1ec9 tr\u00f2 chuy\u1ec7n",
  popup_chat_only_desc:
    "Ch\u1ec9 tr\u00f2 chuy\u1ec7n v\u00e0 \u0111\u1ecdc trang \u2014 kh\u00f4ng nh\u1ea5p, bi\u1ec3u m\u1eabu ho\u1eb7c \u0111i\u1ec1u h\u01b0\u1edbng",
  popup_sticky_chat: "Ghim Tr\u00f2 Chuy\u1ec7n",
  popup_sticky_chat_desc:
    "Gi\u1eef tr\u00f2 chuy\u1ec7n m\u1edf \u2014 b\u1ecf qua v\u1ecb tr\u00ed con tr\u1ecf v\u00e0 lu\u00f4n hi\u1ec3n th\u1ecb",
  popup_auto_import_recipes: "Tự động nhập công thức",
  popup_auto_import_recipes_desc:
    "Tự động nhập công thức llms.txt từ các trang web bạn truy cập",
  popup_theme: "Giao di\u1ec7n",
  popup_dark: "T\u1ed1i",
  popup_light: "S\u00e1ng",
  popup_language: "Ng\u00f4n ng\u1eef",
  popup_language_auto: "T\u1ef1 \u0111\u1ed9ng (tr\u00ecnh duy\u1ec7t)",
};

const id: Translations = {
  widget_placeholder: "Tanyakan apa saja...",
  widget_empty: "Tanyakan apa saja tentang halaman ini...",
  widget_new_chat: "Obrolan baru",
  widget_history: "Riwayat percakapan",
  widget_settings: "Pengaturan",
  widget_no_conversations: "Belum ada percakapan",
  widget_msg_count: "{count} pesan",
  widget_just_now: "baru saja",
  widget_minutes_ago: "{n}m lalu",
  widget_hours_ago: "{n}j lalu",
  widget_days_ago: "{n}h lalu",
  widget_recipe_imported: "Resep diimpor otomatis dari {name}",
  widget_delete_conversation: "Hapus percakapan",
  widget_status_thinking: "Berpikir...",
  widget_status_idling: "Menganggur...",
  widget_stopped: "Dihentikan.",
  widget_confirm_allow: "Izinkan",
  widget_confirm_deny: "Tolak",
  widget_shortcut_tip:
    "Tips: tekan {shortcut} untuk berbicara dengan saya kapan saja",
  status_navigating: "Menavigasi ke {url}",
  status_navigated_to: "Dinavigasi ke {path}",
  status_clicked: "Elemen diklik",
  status_highlighted: "Elemen disorot",
  status_reading_page: "Membaca halaman",
  status_fetching: "Mengambil data",
  status_filling: "Mengisi input",
  status_selecting: "Memilih opsi",
  status_toggling: "Mengubah kotak centang",
  status_submitting: "Mengirim formulir",
  status_scrolling: "Menggulir",
  status_searching: "Mencari di halaman",
  status_extracting: "Mengekstrak tabel",
  popup_loading: "Memuat...",
  popup_provider: "Penyedia",
  popup_api_key: "Kunci API",
  popup_api_key_placeholder: "Masukkan kunci API {provider}",
  popup_model: "Model",
  popup_save: "Simpan Pengaturan",
  popup_saved: "Tersimpan",
  popup_mode_pro: "gyoza Pro",
  popup_mode_own_key: "Kunci sendiri",
  popup_managed_connected: "Terhubung ke platform gyoza",
  popup_managed_sign_out: "Keluar",
  popup_managed_subscribe_desc:
    "Mulai dengan gyoza Pro \u2014 tanpa kunci API.",
  popup_managed_subscribe_btn: "Mulai",
  popup_recipes: "Resep",
  popup_all_recipes: "Semua Resep",
  popup_recipes_for: "Resep \u2014 {domain}",
  popup_no_recipes_all: "Belum ada resep terpasang.",
  popup_no_recipes_site:
    "Tidak ada resep untuk {domain}. Impor resep untuk meningkatkan navigasi AI.",
  popup_import: "+ Impor",
  popup_back: "\u2190 Kembali",
  popup_settings: "Pengaturan",
  popup_yolo_mode: "Mode Yolo",
  popup_yolo_desc:
    "Lewati konfirmasi \u2014 AI bertindak langsung tanpa bertanya",
  popup_chat_only: "Hanya Chat",
  popup_chat_only_desc:
    "Hanya chat dan membaca halaman \u2014 tanpa klik, formulir, atau navigasi",
  popup_sticky_chat: "Chat Tetap",
  popup_sticky_chat_desc:
    "Biarkan chat terbuka \u2014 abaikan kedekatan kursor dan tetap terlihat",
  popup_auto_import_recipes: "Impor resep otomatis",
  popup_auto_import_recipes_desc:
    "Impor resep llms.txt secara otomatis dari situs web yang Anda kunjungi",
  popup_theme: "Tema",
  popup_dark: "Gelap",
  popup_light: "Terang",
  popup_language: "Bahasa",
  popup_language_auto: "Otomatis (browser)",
};

const ms: Translations = {
  ...id,
  widget_placeholder: "Tanya apa sahaja...",
  widget_empty: "Tanya apa sahaja tentang halaman ini...",
  widget_new_chat: "Sembang baru",
  widget_history: "Sejarah perbualan",
  widget_no_conversations: "Belum ada perbualan",
  popup_save: "Simpan Tetapan",
  popup_settings: "Tetapan",
  popup_language: "Bahasa",
  popup_language_auto: "Auto (pelayar)",
};

// Scandinavian + other European languages use English as fallback with overrides

const sv: Translations = {
  ...en,
  widget_placeholder: "Fr\u00e5ga mig n\u00e5got...",
  widget_empty: "Fr\u00e5ga mig n\u00e5got om den h\u00e4r sidan...",
  widget_new_chat: "Ny chatt",
  widget_history: "Konversationshistorik",
  widget_settings: "Inst\u00e4llningar",
  widget_no_conversations: "\u00c4nnu inga konversationer",
  widget_just_now: "just nu",
  widget_minutes_ago: "{n}min sedan",
  widget_hours_ago: "{n}t sedan",
  widget_days_ago: "{n}d sedan",
  popup_save: "Spara Inst\u00e4llningar",
  popup_saved: "Sparat",
  popup_settings: "Inst\u00e4llningar",
  popup_theme: "Tema",
  popup_dark: "M\u00f6rkt",
  popup_light: "Ljust",
  popup_language: "Spr\u00e5k",
  popup_language_auto: "Automatiskt (webbl\u00e4sare)",
};

const da: Translations = {
  ...en,
  widget_placeholder: "Sp\u00f8rg om hvad som helst...",
  widget_empty: "Sp\u00f8rg om hvad som helst om denne side...",
  widget_new_chat: "Ny chat",
  widget_history: "Samtalehistorik",
  widget_settings: "Indstillinger",
  widget_no_conversations: "Ingen samtaler endnu",
  widget_just_now: "lige nu",
  popup_save: "Gem Indstillinger",
  popup_saved: "Gemt",
  popup_settings: "Indstillinger",
  popup_dark: "M\u00f8rk",
  popup_light: "Lys",
  popup_language: "Sprog",
  popup_language_auto: "Automatisk (browser)",
};

const fi: Translations = {
  ...en,
  widget_placeholder: "Kysy mit\u00e4 vain...",
  widget_empty: "Kysy mit\u00e4 vain t\u00e4st\u00e4 sivusta...",
  widget_new_chat: "Uusi keskustelu",
  widget_history: "Keskusteluhistoria",
  widget_settings: "Asetukset",
  widget_no_conversations: "Ei viel\u00e4 keskusteluja",
  widget_just_now: "juuri nyt",
  popup_save: "Tallenna Asetukset",
  popup_saved: "Tallennettu",
  popup_settings: "Asetukset",
  popup_dark: "Tumma",
  popup_light: "Vaalea",
  popup_language: "Kieli",
  popup_language_auto: "Automaattinen (selain)",
};

const nb: Translations = {
  ...en,
  widget_placeholder: "Sp\u00f8r meg om hva som helst...",
  widget_empty: "Sp\u00f8r meg om hva som helst om denne siden...",
  widget_new_chat: "Ny chat",
  widget_history: "Samtalehistorikk",
  widget_settings: "Innstillinger",
  widget_no_conversations: "Ingen samtaler enn\u00e5",
  widget_just_now: "akkurat n\u00e5",
  popup_save: "Lagre Innstillinger",
  popup_saved: "Lagret",
  popup_settings: "Innstillinger",
  popup_dark: "M\u00f8rk",
  popup_light: "Lys",
  popup_language: "Spr\u00e5k",
  popup_language_auto: "Automatisk (nettleser)",
};

const cs: Translations = {
  ...en,
  widget_placeholder: "Zeptejte se na cokoli...",
  widget_empty: "Zeptejte se na cokoli o t\u00e9to str\u00e1nce...",
  widget_new_chat: "Nov\u00fd chat",
  widget_history: "Historie konverzac\u00ed",
  widget_settings: "Nastaven\u00ed",
  widget_no_conversations: "Zat\u00edm \u017e\u00e1dn\u00e9 konverzace",
  widget_just_now: "pr\u00e1v\u011b",
  popup_save: "Ulo\u017eit Nastaven\u00ed",
  popup_saved: "Ulo\u017eeno",
  popup_settings: "Nastaven\u00ed",
  popup_dark: "Tmav\u00fd",
  popup_light: "Sv\u011btl\u00fd",
  popup_language: "Jazyk",
  popup_language_auto: "Automaticky (prohl\u00ed\u017ee\u010d)",
  status_navigated_to: "P\u0159e\u0161el na {path}",
};

const ro: Translations = {
  ...en,
  widget_placeholder: "\u00centreba\u021bi orice...",
  widget_empty: "\u00centreba\u021bi orice despre aceast\u0103 pagin\u0103...",
  widget_new_chat: "Conversa\u021bie nou\u0103",
  widget_history: "Istoricul conversa\u021biilor",
  widget_settings: "Set\u0103ri",
  widget_no_conversations: "\u00cenc\u0103 nu exist\u0103 conversa\u021bii",
  widget_just_now: "chiar acum",
  popup_save: "Salveaz\u0103 Set\u0103rile",
  popup_saved: "Salvat",
  popup_settings: "Set\u0103ri",
  popup_dark: "\u00centunecat",
  popup_light: "Luminos",
  popup_language: "Limb\u0103",
  popup_language_auto: "Automat (browser)",
};

const hu: Translations = {
  ...en,
  widget_placeholder: "K\u00e9rdezz b\u00e1rmit...",
  widget_empty: "K\u00e9rdezz b\u00e1rmit err\u0151l az oldalr\u00f3l...",
  widget_new_chat: "\u00daj cseveg\u00e9s",
  widget_history: "Besz\u00e9lget\u00e9s el\u0151zm\u00e9nyek",
  widget_settings: "Be\u00e1ll\u00edt\u00e1sok",
  widget_no_conversations: "M\u00e9g nincsenek besz\u00e9lget\u00e9sek",
  widget_just_now: "\u00e9pp most",
  popup_save: "Be\u00e1ll\u00edt\u00e1sok Ment\u00e9se",
  popup_saved: "Mentve",
  popup_settings: "Be\u00e1ll\u00edt\u00e1sok",
  popup_dark: "S\u00f6t\u00e9t",
  popup_light: "Vil\u00e1gos",
  popup_language: "Nyelv",
  popup_language_auto: "Automatikus (b\u00f6ng\u00e9sz\u0151)",
};

const he: Translations = {
  ...en,
  widget_placeholder: "...\u05e9\u05d0\u05dc \u05db\u05dc \u05d3\u05d1\u05e8",
  widget_empty:
    "...\u05e9\u05d0\u05dc \u05db\u05dc \u05d3\u05d1\u05e8 \u05e2\u05dc \u05d4\u05d3\u05e3 \u05d4\u05d6\u05d4",
  widget_new_chat: "\u05e6\u05f2\u05d8 \u05d7\u05d3\u05e9",
  widget_history:
    "\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9\u05ea \u05e9\u05d9\u05d7\u05d5\u05ea",
  widget_settings: "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea",
  widget_no_conversations:
    "\u05d0\u05d9\u05df \u05e2\u05d3\u05d9\u05d9\u05df \u05e9\u05d9\u05d7\u05d5\u05ea",
  popup_save: "\u05e9\u05de\u05d5\u05e8 \u05d4\u05d2\u05d3\u05e8\u05d5\u05ea",
  popup_saved: "\u05e0\u05e9\u05de\u05e8",
  popup_settings: "\u05d4\u05d2\u05d3\u05e8\u05d5\u05ea",
  popup_dark: "\u05db\u05d4\u05d4",
  popup_light: "\u05d1\u05d4\u05d9\u05e8",
  popup_language: "\u05e9\u05e4\u05d4",
  popup_language_auto:
    "\u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 (\u05d3\u05e4\u05d3\u05e4\u05df)",
};

// ─── Locale map ─────────────────────────────────────────────────────────────

const TRANSLATIONS: Record<string, Translations> = {
  en,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  es,
  fr,
  de,
  it,
  nl,
  pl,
  ru,
  uk,
  el,
  tr,
  ar,
  hi,
  ja,
  ko,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  th,
  vi,
  id,
  ms,
  sv,
  da,
  fi,
  nb,
  cs,
  ro,
  hu,
  he,
};

// ─── Locale resolution ─────────────────────────────────────────────────────

/**
 * Detect the best locale from the browser.
 * Uses navigator.language → exact match → base language match → "en".
 */
export function detectBrowserLocale(): LocaleCode {
  const browserLang = navigator.language; // e.g. "pt-BR", "en-US", "zh-CN"
  return resolveLocale(browserLang);
}

/**
 * Resolve a language tag to a supported locale code.
 * Tries exact match, then base language (e.g. "pt" → "pt-BR").
 */
export function resolveLocale(tag: string): LocaleCode {
  // Exact match
  if (tag in TRANSLATIONS) return tag as LocaleCode;

  // Normalize: "pt_BR" → "pt-BR"
  const normalized = tag.replace("_", "-");
  if (normalized in TRANSLATIONS) return normalized as LocaleCode;

  // Base language match: "en-US" → "en", "pt" → "pt-BR"
  const base = tag.split("-")[0].split("_")[0];
  if (base in TRANSLATIONS) return base as LocaleCode;

  // Special cases: bare "pt" → "pt-BR", bare "zh" → "zh-CN", bare "no" → "nb"
  const baseMap: Record<string, LocaleCode> = {
    pt: "pt-BR",
    zh: "zh-CN",
    no: "nb",
  };
  if (base in baseMap) return baseMap[base];

  return "en";
}

/**
 * Get translations for a locale code.
 */
export function getTranslations(locale: LocaleCode): Translations {
  return TRANSLATIONS[locale] || en;
}

/**
 * Interpolate placeholders in a translation string.
 * e.g. t("widget_msg_count", { count: 5 }) → "5 msgs"
 */
export function t(
  translations: Translations,
  key: keyof Translations,
  params?: Record<string, string | number>,
): string {
  let text = translations[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}
