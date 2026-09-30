import { getLocales } from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "@/locales/en/common.json";
import enLegal from "@/locales/en/legal.json";
import enSettings from "@/locales/en/settings.json";
import frCommon from "@/locales/fr/common.json";
import frLegal from "@/locales/fr/legal.json";
import frSettings from "@/locales/fr/settings.json";
import type { Language } from "@/store/settings";

export function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === "fr" ? "fr" : "en";
}

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, settings: enSettings, legal: enLegal },
    fr: { common: frCommon, settings: frSettings, legal: frLegal },
  },
  lng: deviceLanguage(),
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnEmptyString: false,
});

export function applyLanguage(language: Language | null) {
  const target = language ?? deviceLanguage();
  if (i18n.language !== target) i18n.changeLanguage(target);
}

export default i18n;
