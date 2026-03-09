import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { translations, Language, TranslationKeys } from "@/lib/i18n";

interface LanguageContextType {
  lang: Language;
  t: TranslationKeys;
  toggleLang: () => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => {
    try {
      return (localStorage.getItem("chainnova_lang") as Language) || "en";
    } catch {
      return "en";
    }
  });

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "en" ? "zh" : "en";
      try { localStorage.setItem("chainnova_lang", next); } catch {}
      return next;
    });
  }, []);

  const t = translations[lang] as TranslationKeys;

  return (
    <LanguageContext.Provider value={{ lang, t, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
