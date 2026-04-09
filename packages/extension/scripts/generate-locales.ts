// Generate _locales/*/messages.json for Chrome/Firefox/Safari manifest i18n.
// Run: bun run scripts/generate-locales.ts
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

interface ManifestMessages {
  extName: { message: string; description: string };
  extDescription: { message: string; description: string };
  commandToggle: { message: string; description: string };
}

// Chrome uses underscores in locale codes (pt_BR not pt-BR).
// Safari requires a "description" field on every key and
// extDescription.message must be ≤112 characters.
const LOCALE_MESSAGES: Record<string, ManifestMessages> = {
  en: {
    extName: {
      message: "gyoza — AI Browser Assistant",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Floating AI assistant — no sidebar, no tab switching. Click, fill forms, navigate any site. BYOK or subscribe.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Toggle gyoza widget",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  pt_BR: {
    extName: {
      message: "gyoza — Assistente IA para Navegador",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Assistente IA flutuante — sem barra lateral. Clique, formulários, navegue qualquer site. BYOK ou assinatura.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Alternar widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  pt_PT: {
    extName: {
      message: "gyoza — Assistente IA para Navegador",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Assistente IA flutuante — sem barra lateral. Clique, formulários, navegue qualquer site. BYOK ou subscrição.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Alternar widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  es: {
    extName: {
      message: "gyoza — Asistente IA para Navegador",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Asistente IA flotante — sin barra lateral. Clic, formularios, navega cualquier sitio. BYOK o suscripción.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Alternar widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  fr: {
    extName: {
      message: "gyoza — Assistant IA pour Navigateur",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Assistant IA flottant — sans barre latérale. Cliquez, formulaires, naviguez partout. BYOK ou abonnement.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Basculer le widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  de: {
    extName: {
      message: "gyoza — KI-Browser-Assistent",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Schwebender KI-Assistent — keine Seitenleiste. Klicken, Formulare ausfüllen, jede Seite nutzen. BYOK oder Abo.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "gyoza-Widget umschalten",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  it: {
    extName: {
      message: "gyoza — Assistente IA per Browser",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Assistente IA fluttuante — nessuna barra laterale. Clic, moduli, naviga ovunque. BYOK o abbonamento.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Attiva/disattiva widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  nl: {
    extName: {
      message: "gyoza — AI-browserassistent",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Zwevende AI-assistent — geen zijbalk. Klik, vul formulieren in, navigeer elke site. BYOK of abonnement.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "gyoza-widget in-/uitschakelen",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  pl: {
    extName: {
      message: "gyoza — Asystent AI przeglądarki",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Pływający asystent AI — bez paska bocznego. Klikaj, formularze, przeglądaj strony. BYOK lub subskrypcja.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Przełącz widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  ru: {
    extName: {
      message: "gyoza — ИИ-ассистент браузера",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Плавающий ИИ-ассистент — без боковой панели. Клик, формы, навигация по любому сайту. BYOK или подписка.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Переключить виджет gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  uk: {
    extName: {
      message: "gyoza — ШІ-асистент браузера",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Плаваючий ШІ-асистент — без бічної панелі. Клік, форми, навігація будь-яким сайтом. BYOK або підписка.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Перемкнути віджет gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  el: {
    extName: {
      message: "gyoza — Βοηθός AI περιηγητή",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Αιωρούμενος βοηθός AI — χωρίς πλαϊνή μπάρα. Κλικ, φόρμες, πλοήγηση παντού. BYOK ή συνδρομή.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Εναλλαγή widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  tr: {
    extName: {
      message: "gyoza — Yapay Zeka Tarayıcı Asistanı",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Yüzen AI asistanı — kenar çubuğu yok. Tıklayın, form doldurun, her siteyi gezin. BYOK veya abonelik.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "gyoza widgetını aç/kapat",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  ar: {
    extName: {
      message: "gyoza — مساعد ذكاء اصطناعي للمتصفح",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "مساعد ذكاء اصطناعي عائم — بدون شريط جانبي. انقر، املأ النماذج، تنقل في أي موقع. مفتاحك أو اشتراك.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "تبديل أداة gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  hi: {
    extName: {
      message: "gyoza — AI ब्राउज़र सहायक",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "फ्लोटिंग AI सहायक — कोई साइडबार नहीं। क्लिक, फॉर्म भरें, किसी भी साइट पर जाएं। BYOK या सदस्यता।",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "gyoza विजेट टॉगल करें",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  ja: {
    extName: {
      message: "gyoza — AIブラウザアシスタント",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "フローティングAIアシスタント — サイドバー不要。クリック、フォーム入力、あらゆるサイトを操作。BYOKまたはサブスク。",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "gyozaウィジェットの切り替え",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  ko: {
    extName: {
      message: "gyoza — AI 브라우저 어시스턴트",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "플로팅 AI 어시스턴트 — 사이드바 없음. 클릭, 양식 작성, 모든 사이트 탐색. BYOK 또는 구독.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "gyoza 위젯 전환",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  zh_CN: {
    extName: {
      message: "gyoza — AI浏览器助手",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "免费悬浮AI助手 — 无侧边栏。点击、填写表单、浏览任何网站。自带密钥或订阅。",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "切换gyoza小组件",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  zh_TW: {
    extName: {
      message: "gyoza — AI瀏覽器助手",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "免費AI懸浮助手 — 無側邊欄。點擊、填寫表單、瀏覽任何網站。自帶金鑰或訂閱。",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "切換gyoza小工具",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  th: {
    extName: {
      message: "gyoza — ผู้ช่วย AI สำหรับเบราว์เซอร์",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "ผู้ช่วย AI ลอยตัว — ไม่มีแถบข้าง คลิก กรอกฟอร์ม ท่องเว็บไซต์ใดก็ได้ BYOK หรือสมัครสมาชิก",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "สลับวิดเจ็ต gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  vi: {
    extName: {
      message: "gyoza — Trợ lý AI trình duyệt",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Trợ lý AI nổi — không thanh bên. Nhấp, điền biểu mẫu, điều hướng bất kỳ trang nào. BYOK hoặc đăng ký.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Bật/tắt widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  id: {
    extName: {
      message: "gyoza — Asisten AI Browser",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Asisten AI mengambang — tanpa sidebar. Klik, isi formulir, navigasi situs mana pun. BYOK atau berlangganan.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Beralih widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  ms: {
    extName: {
      message: "gyoza — Pembantu AI Pelayar",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Pembantu AI terapung — tiada bar sisi. Klik, isi borang, navigasi mana-mana laman. BYOK atau langgan.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Togol widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  sv: {
    extName: {
      message: "gyoza — AI-webbläsarassistent",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Svävande AI-assistent — inget sidofält. Klicka, formulär, navigera vilken sida som helst. BYOK eller abonnemang.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Växla gyoza-widget",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  da: {
    extName: {
      message: "gyoza — AI-browserassistent",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Svævende AI-assistent — ingen sidebjælke. Klik, udfyld formularer, naviger alle sider. BYOK eller abonnement.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Skift gyoza-widget",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  fi: {
    extName: {
      message: "gyoza — AI-selainapuri",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Kelluva AI-apuri — ei sivupalkkia. Napsauta, täytä lomakkeita, selaa mitä tahansa sivustoa. BYOK tai tilaus.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Vaihda gyoza-widget",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  nb: {
    extName: {
      message: "gyoza — AI-nettleserassistent",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Flytende AI-assistent — ingen sidefelt. Klikk, fyll ut skjemaer, naviger alle nettsteder. BYOK eller abonnement.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Veksle gyoza-widget",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  cs: {
    extName: {
      message: "gyoza — AI asistent prohlížeče",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Plovoucí AI asistent — žádný panel. Klikejte, vyplňujte formuláře, procházejte weby. BYOK nebo předplatné.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Přepnout widget gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  ro: {
    extName: {
      message: "gyoza — Asistent AI pentru browser",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Asistent AI flotant — fără bară laterală. Clic, completați formulare, navigați orice site. BYOK sau abonament.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "Comută widget-ul gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  hu: {
    extName: {
      message: "gyoza — AI böngésző asszisztens",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "Lebegő AI asszisztens — nincs oldalsáv. Kattintson, űrlapok, navigáljon bárhol. BYOK vagy előfizetés.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "gyoza widget váltása",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
  he: {
    extName: {
      message: "gyoza — עוזר AI לדפדפן",
      description: "The name of the extension",
    },
    extDescription: {
      message:
        "עוזר AI צף — בלי סרגל צד. לחצו, מלאו טפסים, נווטו בכל אתר. מפתח משלכם או מנוי.",
      description: "A short description of the extension",
    },
    commandToggle: {
      message: "החלפת וידג'ט gyoza",
      description: "Keyboard shortcut to toggle the widget",
    },
  },
};

// Validate all extDescription.message ≤ 112 chars (Safari requirement)
for (const [locale, msgs] of Object.entries(LOCALE_MESSAGES)) {
  const len = msgs.extDescription.message.length;
  if (len > 112) {
    console.error(
      `ERROR: ${locale} extDescription.message is ${len} chars (max 112)`,
    );
    process.exit(1);
  }
}

const PUBLIC_DIR = join(import.meta.dirname!, "..", "public", "_locales");

for (const [locale, messages] of Object.entries(LOCALE_MESSAGES)) {
  const dir = join(PUBLIC_DIR, locale);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "messages.json"),
    JSON.stringify(messages, null, 2) + "\n",
  );
  console.log(`  ✓ ${locale}/messages.json`);
}

console.log(`\nGenerated ${Object.keys(LOCALE_MESSAGES).length} locale(s)`);
