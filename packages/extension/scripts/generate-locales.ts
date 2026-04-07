// Generate _locales/*/messages.json for Chrome/Firefox manifest i18n.
// Run: bun run scripts/generate-locales.ts
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

interface ManifestMessages {
  extName: { message: string; description?: string };
  extDescription: { message: string; description?: string };
  commandToggle: { message: string; description?: string };
}

// Chrome uses underscores in locale codes (pt_BR not pt-BR)
const LOCALE_MESSAGES: Record<string, ManifestMessages> = {
  en: {
    extName: { message: "gyoza \u2014 AI Browser Assistant" },
    extDescription: {
      message:
        "Free floating AI assistant \u2014 no sidebar, no tab switching. Click buttons, fill forms, upload files on any website. BYOK or subscribe",
    },
    commandToggle: { message: "Toggle gyoza widget" },
  },
  pt_BR: {
    extName: { message: "gyoza \u2014 Assistente IA para Navegador" },
    extDescription: {
      message:
        "Assistente IA flutuante e gr\u00e1tis \u2014 sem barra lateral, sem trocar de aba. Clica bot\u00f5es, preenche formul\u00e1rios, envia arquivos em qualquer site. BYOK ou assine",
    },
    commandToggle: { message: "Alternar widget gyoza" },
  },
  pt_PT: {
    extName: { message: "gyoza \u2014 Assistente IA para Navegador" },
    extDescription: {
      message:
        "Assistente IA flutuante e gratuito \u2014 sem barra lateral, sem mudar de separador. Clica bot\u00f5es, preenche formul\u00e1rios, envia ficheiros em qualquer site. BYOK ou subscreva",
    },
    commandToggle: { message: "Alternar widget gyoza" },
  },
  es: {
    extName: { message: "gyoza \u2014 Asistente IA para Navegador" },
    extDescription: {
      message:
        "Asistente IA flotante y gratuito \u2014 sin barra lateral, sin cambiar de pesta\u00f1a. Haz clic en botones, rellena formularios, sube archivos en cualquier sitio web. BYOK o suscr\u00edbete",
    },
    commandToggle: { message: "Alternar widget gyoza" },
  },
  fr: {
    extName: { message: "gyoza \u2014 Assistant IA pour Navigateur" },
    extDescription: {
      message:
        "Assistant IA flottant et gratuit \u2014 pas de barre lat\u00e9rale, pas de changement d\u2019onglet. Cliquez sur des boutons, remplissez des formulaires, t\u00e9l\u00e9versez des fichiers sur n\u2019importe quel site. BYOK ou abonnez-vous",
    },
    commandToggle: { message: "Basculer le widget gyoza" },
  },
  de: {
    extName: { message: "gyoza \u2014 KI-Browser-Assistent" },
    extDescription: {
      message:
        "Kostenloser schwebender KI-Assistent \u2014 keine Seitenleiste, kein Tab-Wechsel. Buttons klicken, Formulare ausf\u00fcllen, Dateien auf jeder Website hochladen. BYOK oder abonnieren",
    },
    commandToggle: { message: "gyoza-Widget umschalten" },
  },
  it: {
    extName: { message: "gyoza \u2014 Assistente IA per Browser" },
    extDescription: {
      message:
        "Assistente IA fluttuante e gratuito \u2014 nessuna barra laterale, nessun cambio di scheda. Clicca pulsanti, compila moduli, carica file su qualsiasi sito. BYOK o abbonati",
    },
    commandToggle: { message: "Attiva/disattiva widget gyoza" },
  },
  nl: {
    extName: { message: "gyoza \u2014 AI-browserassistent" },
    extDescription: {
      message:
        "Gratis zwevende AI-assistent \u2014 geen zijbalk, geen tabwisseling. Klik op knoppen, vul formulieren in, upload bestanden op elke website. BYOK of abonneer",
    },
    commandToggle: { message: "gyoza-widget in-/uitschakelen" },
  },
  pl: {
    extName: { message: "gyoza \u2014 Asystent AI przegl\u0105darki" },
    extDescription: {
      message:
        "Darmowy p\u0142ywaj\u0105cy asystent AI \u2014 bez paska bocznego, bez prze\u0142\u0105czania kart. Klikaj przyciski, wype\u0142niaj formularze, przesy\u0142aj pliki na dowolnej stronie. BYOK lub subskrybuj",
    },
    commandToggle: { message: "Prze\u0142\u0105cz widget gyoza" },
  },
  ru: {
    extName: {
      message:
        "gyoza \u2014 \u0418\u0418-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043d\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430",
    },
    extDescription: {
      message:
        "\u0411\u0435\u0441\u043f\u043b\u0430\u0442\u043d\u044b\u0439 \u043f\u043b\u0430\u0432\u0430\u044e\u0449\u0438\u0439 \u0418\u0418-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043d\u0442 \u2014 \u0431\u0435\u0437 \u0431\u043e\u043a\u043e\u0432\u043e\u0439 \u043f\u0430\u043d\u0435\u043b\u0438, \u0431\u0435\u0437 \u043f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u044f \u0432\u043a\u043b\u0430\u0434\u043e\u043a. \u041d\u0430\u0436\u0438\u043c\u0430\u0439\u0442\u0435 \u043a\u043d\u043e\u043f\u043a\u0438, \u0437\u0430\u043f\u043e\u043b\u043d\u044f\u0439\u0442\u0435 \u0444\u043e\u0440\u043c\u044b, \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u0439\u0442\u0435 \u0444\u0430\u0439\u043b\u044b \u043d\u0430 \u043b\u044e\u0431\u043e\u043c \u0441\u0430\u0439\u0442\u0435. BYOK \u0438\u043b\u0438 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0430",
    },
    commandToggle: {
      message:
        "\u041f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0432\u0438\u0434\u0436\u0435\u0442 gyoza",
    },
  },
  uk: {
    extName: {
      message:
        "gyoza \u2014 \u0428\u0406-\u0430\u0441\u0438\u0441\u0442\u0435\u043d\u0442 \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0430",
    },
    extDescription: {
      message:
        "\u0411\u0435\u0437\u043a\u043e\u0448\u0442\u043e\u0432\u043d\u0438\u0439 \u043f\u043b\u0430\u0432\u0430\u044e\u0447\u0438\u0439 \u0428\u0406-\u0430\u0441\u0438\u0441\u0442\u0435\u043d\u0442 \u2014 \u0431\u0435\u0437 \u0431\u0456\u0447\u043d\u043e\u0457 \u043f\u0430\u043d\u0435\u043b\u0456, \u0431\u0435\u0437 \u043f\u0435\u0440\u0435\u043c\u0438\u043a\u0430\u043d\u043d\u044f \u0432\u043a\u043b\u0430\u0434\u043e\u043a. \u041d\u0430\u0442\u0438\u0441\u043a\u0430\u0439\u0442\u0435 \u043a\u043d\u043e\u043f\u043a\u0438, \u0437\u0430\u043f\u043e\u0432\u043d\u044e\u0439\u0442\u0435 \u0444\u043e\u0440\u043c\u0438, \u0437\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0443\u0439\u0442\u0435 \u0444\u0430\u0439\u043b\u0438 \u043d\u0430 \u0431\u0443\u0434\u044c-\u044f\u043a\u043e\u043c\u0443 \u0441\u0430\u0439\u0442\u0456. BYOK \u0430\u0431\u043e \u043f\u0456\u0434\u043f\u0438\u0441\u043a\u0430",
    },
    commandToggle: {
      message:
        "\u041f\u0435\u0440\u0435\u043c\u043a\u043d\u0443\u0442\u0438 \u0432\u0456\u0434\u0436\u0435\u0442 gyoza",
    },
  },
  el: {
    extName: {
      message:
        "gyoza \u2014 \u0392\u03bf\u03b7\u03b8\u03cc\u03c2 AI \u03c0\u03b5\u03c1\u03b9\u03b7\u03b3\u03b7\u03c4\u03ae",
    },
    extDescription: {
      message:
        "\u0394\u03c9\u03c1\u03b5\u03ac\u03bd \u03b1\u03b9\u03c9\u03c1\u03bf\u03cd\u03bc\u03b5\u03bd\u03bf\u03c2 \u03b2\u03bf\u03b7\u03b8\u03cc\u03c2 AI \u2014 \u03c7\u03c9\u03c1\u03af\u03c2 \u03c0\u03bb\u03b1\u03ca\u03bd\u03ae \u03bc\u03c0\u03ac\u03c1\u03b1, \u03c7\u03c9\u03c1\u03af\u03c2 \u03b1\u03bb\u03bb\u03b1\u03b3\u03ae \u03ba\u03b1\u03c1\u03c4\u03ad\u03bb\u03b1\u03c2. \u039a\u03ac\u03bd\u03c4\u03b5 \u03ba\u03bb\u03b9\u03ba \u03c3\u03b5 \u03ba\u03bf\u03c5\u03bc\u03c0\u03b9\u03ac, \u03c3\u03c5\u03bc\u03c0\u03bb\u03b7\u03c1\u03ce\u03c3\u03c4\u03b5 \u03c6\u03cc\u03c1\u03bc\u03b5\u03c2, \u03b1\u03bd\u03b5\u03b2\u03ac\u03c3\u03c4\u03b5 \u03b1\u03c1\u03c7\u03b5\u03af\u03b1 \u03c3\u03b5 \u03bf\u03c0\u03bf\u03b9\u03bf\u03b4\u03ae\u03c0\u03bf\u03c4\u03b5 \u03b9\u03c3\u03c4\u03cc\u03c4\u03bf\u03c0\u03bf. BYOK \u03ae \u03c3\u03c5\u03bd\u03b4\u03c1\u03bf\u03bc\u03ae",
    },
    commandToggle: {
      message: "\u0395\u03bd\u03b1\u03bb\u03bb\u03b1\u03b3\u03ae widget gyoza",
    },
  },
  tr: {
    extName: {
      message: "gyoza \u2014 Yapay Zeka Taray\u0131c\u0131 Asistan\u0131",
    },
    extDescription: {
      message:
        "\u00dccretsiz y\u00fczen yapay zeka asistan\u0131 \u2014 kenar \u00e7ubu\u011fu yok, sekme de\u011fi\u015ftirme yok. D\u00fc\u011fmelere t\u0131klay\u0131n, formlar\u0131 doldurun, herhangi bir web sitesine dosya y\u00fckleyin. BYOK veya abone olun",
    },
    commandToggle: { message: "gyoza widget\u0131n\u0131 a\u00e7/kapat" },
  },
  ar: {
    extName: {
      message:
        "gyoza \u2014 \u0645\u0633\u0627\u0639\u062f \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0644\u0644\u0645\u062a\u0635\u0641\u062d",
    },
    extDescription: {
      message:
        "\u0645\u0633\u0627\u0639\u062f \u0630\u0643\u0627\u0621 \u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0639\u0627\u0626\u0645 \u0645\u062c\u0627\u0646\u064a \u2014 \u0628\u062f\u0648\u0646 \u0634\u0631\u064a\u0637 \u062c\u0627\u0646\u0628\u064a\u060c \u0628\u062f\u0648\u0646 \u062a\u0628\u062f\u064a\u0644 \u0639\u0644\u0627\u0645\u0627\u062a \u062a\u0628\u0648\u064a\u0628. \u0627\u0646\u0642\u0631 \u0639\u0644\u0649 \u0627\u0644\u0623\u0632\u0631\u0627\u0631\u060c \u0627\u0645\u0644\u0623 \u0627\u0644\u0646\u0645\u0627\u0630\u062c\u060c \u0627\u0631\u0641\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062a \u0639\u0644\u0649 \u0623\u064a \u0645\u0648\u0642\u0639. BYOK \u0623\u0648 \u0627\u0634\u062a\u0631\u0627\u0643",
    },
    commandToggle: {
      message: "\u062a\u0628\u062f\u064a\u0644 \u0623\u062f\u0627\u0629 gyoza",
    },
  },
  hi: {
    extName: {
      message:
        "gyoza \u2014 AI \u092c\u094d\u0930\u093e\u0909\u091c\u093c\u0930 \u0938\u0939\u093e\u092f\u0915",
    },
    extDescription: {
      message:
        "\u092e\u0941\u092b\u094d\u0924 \u092b\u094d\u0932\u094b\u091f\u093f\u0902\u0917 AI \u0938\u0939\u093e\u092f\u0915 \u2014 \u0915\u094b\u0908 \u0938\u093e\u0907\u0921\u092c\u093e\u0930 \u0928\u0939\u0940\u0902, \u091f\u0948\u092c \u0928\u0939\u0940\u0902 \u092c\u0926\u0932\u0928\u093e\u0964 \u092c\u091f\u0928 \u0915\u094d\u0932\u093f\u0915 \u0915\u0930\u0947\u0902, \u092b\u0949\u0930\u094d\u092e \u092d\u0930\u0947\u0902, \u0915\u093f\u0938\u0940 \u092d\u0940 \u0935\u0947\u092c\u0938\u093e\u0907\u091f \u092a\u0930 \u092b\u093e\u0907\u0932 \u0905\u092a\u0932\u094b\u0921 \u0915\u0930\u0947\u0902\u0964 BYOK \u092f\u093e \u0938\u0926\u0938\u094d\u092f\u0924\u093e",
    },
    commandToggle: {
      message:
        "gyoza \u0935\u093f\u091c\u0947\u091f \u091f\u0949\u0917\u0932 \u0915\u0930\u0947\u0902",
    },
  },
  ja: {
    extName: {
      message:
        "gyoza \u2014 AI\u30d6\u30e9\u30a6\u30b6\u30a2\u30b7\u30b9\u30bf\u30f3\u30c8",
    },
    extDescription: {
      message:
        "\u7121\u6599\u306e\u30d5\u30ed\u30fc\u30c6\u30a3\u30f3\u30b0AI\u30a2\u30b7\u30b9\u30bf\u30f3\u30c8 \u2014 \u30b5\u30a4\u30c9\u30d0\u30fc\u306a\u3057\u3001\u30bf\u30d6\u5207\u308a\u66ff\u3048\u306a\u3057\u3002\u30dc\u30bf\u30f3\u30af\u30ea\u30c3\u30af\u3001\u30d5\u30a9\u30fc\u30e0\u5165\u529b\u3001\u3069\u306e\u30b5\u30a4\u30c8\u3067\u3082\u30d5\u30a1\u30a4\u30eb\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9\u3002BYOK\u307e\u305f\u306f\u30b5\u30d6\u30b9\u30af\u30ea\u30d7\u30b7\u30e7\u30f3",
    },
    commandToggle: {
      message:
        "gyoza\u30a6\u30a3\u30b8\u30a7\u30c3\u30c8\u306e\u5207\u308a\u66ff\u3048",
    },
  },
  ko: {
    extName: {
      message:
        "gyoza \u2014 AI \uBE0C\uB77C\uC6B0\uC800 \uC5B4\uC2DC\uC2A4\uD134\uD2B8",
    },
    extDescription: {
      message:
        "\uBB34\uB8CC \uD50C\uB85C\uD305 AI \uC5B4\uC2DC\uC2A4\uD134\uD2B8 \u2014 \uC0AC\uC774\uB4DC\uBC14 \uC5C6\uC74C, \uD0ED \uC804\uD658 \uC5C6\uC74C. \uBC84\uD2BC \uD074\uB9AD, \uC591\uC2DD \uC791\uC131, \uC5B4\uB5A4 \uC6F9\uC0AC\uC774\uD2B8\uC5D0\uC11C\uB4E0 \uD30C\uC77C \uC5C5\uB85C\uB4DC. BYOK \uB610\uB294 \uAD6C\uB3C5",
    },
    commandToggle: { message: "gyoza \uC704\uC82F \uC804\uD658" },
  },
  zh_CN: {
    extName: { message: "gyoza \u2014 AI\u6d4f\u89c8\u5668\u52a9\u624b" },
    extDescription: {
      message:
        "\u514d\u8d39\u60ac\u6d6eAI\u52a9\u624b \u2014 \u65e0\u4fa7\u8fb9\u680f\uff0c\u65e0\u5207\u6362\u6807\u7b7e\u9875\u3002\u70b9\u51fb\u6309\u94ae\u3001\u586b\u5199\u8868\u5355\u3001\u5728\u4efb\u4f55\u7f51\u7ad9\u4e0a\u4f20\u6587\u4ef6\u3002BYOK\u6216\u8ba2\u9605",
    },
    commandToggle: { message: "\u5207\u6362gyoza\u5c0f\u7ec4\u4ef6" },
  },
  zh_TW: {
    extName: { message: "gyoza \u2014 AI\u700f\u89bd\u5668\u52a9\u624b" },
    extDescription: {
      message:
        "\u514d\u8cbbAI\u61f8\u6d6e\u52a9\u624b \u2014 \u7121\u5074\u908a\u6b04\uff0c\u7121\u5207\u63db\u5206\u9801\u3002\u9ede\u64ca\u6309\u9215\u3001\u586b\u5beb\u8868\u55ae\u3001\u5728\u4efb\u4f55\u7db2\u7ad9\u4e0a\u50b3\u6a94\u6848\u3002BYOK\u6216\u8a02\u95b1",
    },
    commandToggle: { message: "\u5207\u63dbgyoza\u5c0f\u5de5\u5177" },
  },
  th: {
    extName: {
      message:
        "gyoza \u2014 \u0e1c\u0e39\u0e49\u0e0a\u0e48\u0e27\u0e22 AI \u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e40\u0e1a\u0e23\u0e32\u0e27\u0e4c\u0e40\u0e0b\u0e2d\u0e23\u0e4c",
    },
    extDescription: {
      message:
        "\u0e1c\u0e39\u0e49\u0e0a\u0e48\u0e27\u0e22 AI \u0e25\u0e2d\u0e22\u0e15\u0e31\u0e27\u0e1f\u0e23\u0e35 \u2014 \u0e44\u0e21\u0e48\u0e21\u0e35\u0e41\u0e16\u0e1a\u0e02\u0e49\u0e32\u0e07 \u0e44\u0e21\u0e48\u0e15\u0e49\u0e2d\u0e07\u0e2a\u0e25\u0e31\u0e1a\u0e41\u0e17\u0e47\u0e1a \u0e04\u0e25\u0e34\u0e01\u0e1b\u0e38\u0e48\u0e21 \u0e01\u0e23\u0e2d\u0e01\u0e1f\u0e2d\u0e23\u0e4c\u0e21 \u0e2d\u0e31\u0e1b\u0e42\u0e2b\u0e25\u0e14\u0e44\u0e1f\u0e25\u0e4c\u0e1a\u0e19\u0e40\u0e27\u0e47\u0e1a\u0e44\u0e0b\u0e15\u0e4c\u0e43\u0e14\u0e01\u0e47\u0e44\u0e14\u0e49 BYOK \u0e2b\u0e23\u0e37\u0e2d\u0e2a\u0e21\u0e31\u0e04\u0e23\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01",
    },
    commandToggle: {
      message:
        "\u0e2a\u0e25\u0e31\u0e1a\u0e27\u0e34\u0e14\u0e40\u0e08\u0e47\u0e15 gyoza",
    },
  },
  vi: {
    extName: {
      message: "gyoza \u2014 Tr\u1ee3 l\u00fd AI tr\u00ecnh duy\u1ec7t",
    },
    extDescription: {
      message:
        "Tr\u1ee3 l\u00fd AI n\u1ed5i mi\u1ec5n ph\u00ed \u2014 kh\u00f4ng thanh b\u00ean, kh\u00f4ng chuy\u1ec3n tab. Nh\u1ea5p n\u00fat, \u0111i\u1ec1n bi\u1ec3u m\u1eabu, t\u1ea3i t\u1ec7p l\u00ean b\u1ea5t k\u1ef3 trang web n\u00e0o. BYOK ho\u1eb7c \u0111\u0103ng k\u00fd",
    },
    commandToggle: { message: "B\u1eadt/t\u1eaft widget gyoza" },
  },
  id: {
    extName: { message: "gyoza \u2014 Asisten AI Browser" },
    extDescription: {
      message:
        "Asisten AI mengambang gratis \u2014 tanpa sidebar, tanpa berpindah tab. Klik tombol, isi formulir, unggah file di situs web mana pun. BYOK atau berlangganan",
    },
    commandToggle: { message: "Beralih widget gyoza" },
  },
  ms: {
    extName: { message: "gyoza \u2014 Pembantu AI Pelayar" },
    extDescription: {
      message:
        "Pembantu AI terapung percuma \u2014 tiada bar sisi, tiada tukar tab. Klik butang, isi borang, muat naik fail di mana-mana laman web. BYOK atau langgan",
    },
    commandToggle: { message: "Togol widget gyoza" },
  },
  sv: {
    extName: { message: "gyoza \u2014 AI-webbl\u00e4sarassistent" },
    extDescription: {
      message:
        "Gratis sv\u00e4vande AI-assistent \u2014 ingen sidof\u00e4lt, ingen flikv\u00e4xling. Klicka p\u00e5 knappar, fyll i formul\u00e4r, ladda upp filer p\u00e5 vilken webbplats som helst. BYOK eller prenumerera",
    },
    commandToggle: { message: "V\u00e4xla gyoza-widget" },
  },
  da: {
    extName: { message: "gyoza \u2014 AI-browserassistent" },
    extDescription: {
      message:
        "Gratis sv\u00e6vende AI-assistent \u2014 ingen sidebj\u00e6lke, ingen faneskift. Klik p\u00e5 knapper, udfyld formularer, upload filer p\u00e5 enhver hjemmeside. BYOK eller abonner",
    },
    commandToggle: { message: "Skift gyoza-widget" },
  },
  fi: {
    extName: { message: "gyoza \u2014 AI-selainapuri" },
    extDescription: {
      message:
        "Ilmainen kelluva AI-apuri \u2014 ei sivupalkkia, ei v\u00e4lilehden vaihtoa. Napsauta painikkeita, t\u00e4yt\u00e4 lomakkeita, lataa tiedostoja mill\u00e4 tahansa verkkosivulla. BYOK tai tilaa",
    },
    commandToggle: { message: "Vaihda gyoza-widget" },
  },
  nb: {
    extName: { message: "gyoza \u2014 AI-nettleserassistent" },
    extDescription: {
      message:
        "Gratis flytende AI-assistent \u2014 ingen sidefelt, ingen fanebytte. Klikk p\u00e5 knapper, fyll ut skjemaer, last opp filer p\u00e5 hvilken som helst nettside. BYOK eller abonner",
    },
    commandToggle: { message: "Veksle gyoza-widget" },
  },
  cs: {
    extName: { message: "gyoza \u2014 AI asistent prohl\u00ed\u017ee\u010de" },
    extDescription: {
      message:
        "Bezplatn\u00fd plovouc\u00ed AI asistent \u2014 \u017e\u00e1dn\u00fd postrann\u00ed panel, \u017e\u00e1dn\u00e9 p\u0159ep\u00edn\u00e1n\u00ed karet. Klikejte na tla\u010d\u00edtka, vypl\u0148ujte formul\u00e1\u0159e, nahr\u00e1vejte soubory na jak\u00e9mkoli webu. BYOK nebo p\u0159edpla\u0165te",
    },
    commandToggle: { message: "P\u0159epnout widget gyoza" },
  },
  ro: {
    extName: { message: "gyoza \u2014 Asistent AI pentru browser" },
    extDescription: {
      message:
        "Asistent AI flotant gratuit \u2014 f\u0103r\u0103 bar\u0103 lateral\u0103, f\u0103r\u0103 schimbarea filelor. Face\u021bi clic pe butoane, completa\u021bi formulare, \u00eenc\u0103rca\u021bi fi\u0219iere pe orice site. BYOK sau abona\u021bi-v\u0103",
    },
    commandToggle: { message: "Comut\u0103 widget-ul gyoza" },
  },
  hu: {
    extName: { message: "gyoza \u2014 AI b\u00f6ng\u00e9sz\u0151 asszisztens" },
    extDescription: {
      message:
        "Ingyenes lebeg\u0151 AI asszisztens \u2014 nincs oldals\u00e1v, nincs lapv\u00e1lt\u00e1s. Kattintson gombokra, t\u00f6lts\u00f6n ki \u0171rlapokat, t\u00f6lts\u00f6n fel f\u00e1jlokat b\u00e1rmely weboldalon. BYOK vagy el\u0151fizet\u00e9s",
    },
    commandToggle: { message: "gyoza widget v\u00e1lt\u00e1sa" },
  },
  he: {
    extName: {
      message:
        "gyoza \u2014 \u05e2\u05d5\u05d6\u05e8 AI \u05dc\u05d3\u05e4\u05d3\u05e4\u05df",
    },
    extDescription: {
      message:
        "\u05e2\u05d5\u05d6\u05e8 AI \u05e6\u05e3 \u05d7\u05d9\u05e0\u05dd \u2014 \u05d1\u05dc\u05d9 \u05e1\u05e8\u05d2\u05dc \u05e6\u05d3, \u05d1\u05dc\u05d9 \u05d4\u05d7\u05dc\u05e4\u05ea \u05dc\u05e9\u05d5\u05e0\u05d9\u05d5\u05ea. \u05dc\u05d7\u05e6\u05d5 \u05e2\u05dc \u05db\u05e4\u05ea\u05d5\u05e8\u05d9\u05dd, \u05de\u05dc\u05d0\u05d5 \u05d8\u05e4\u05e1\u05d9\u05dd, \u05d4\u05e2\u05dc\u05d5 \u05e7\u05d1\u05e6\u05d9\u05dd \u05d1\u05db\u05dc \u05d0\u05ea\u05e8. BYOK \u05d0\u05d5 \u05de\u05e0\u05d5\u05d9",
    },
    commandToggle: {
      message:
        "\u05d4\u05d7\u05dc\u05e4\u05ea \u05d5\u05d9\u05d3\u05d2'\u05d8 gyoza",
    },
  },
};

const PUBLIC_DIR = join(import.meta.dirname!, "..", "public", "_locales");

for (const [locale, messages] of Object.entries(LOCALE_MESSAGES)) {
  const dir = join(PUBLIC_DIR, locale);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "messages.json"),
    JSON.stringify(messages, null, 2) + "\n",
  );
  console.log(`  \u2713 ${locale}/messages.json`);
}

console.log(`\nGenerated ${Object.keys(LOCALE_MESSAGES).length} locale(s)`);
