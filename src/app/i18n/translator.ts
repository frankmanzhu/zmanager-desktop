import { DEFAULT_LOCALE, type SupportedLocale } from "./locale";
import { enMessages, type EnMessageKey } from "./messages.en";
import { zhCnMessages } from "./messages.zh-CN";

export type MessageKey = EnMessageKey;
export type MessageCatalog = Record<MessageKey, string>;
export type MessageParams = Record<string, string | number | boolean | null | undefined>;
export type Translator = {
  locale: string;
  t: (key: MessageKey, params?: MessageParams) => string;
};

const INTERPOLATION_PATTERN = /\{([A-Za-z0-9_]+)\}/g;

const catalogs = {
  en: enMessages,
  "zh-CN": zhCnMessages,
} as const satisfies Record<SupportedLocale, MessageCatalog>;

export function createTranslator(
  locale: SupportedLocale,
  catalogOverrides: Partial<Record<SupportedLocale, Partial<MessageCatalog>>> = {},
): Translator {
  return createTranslatorFromCatalog(locale, {
    ...catalogs[locale],
    ...catalogOverrides[locale],
  });
}

export function createTranslatorFromCatalog(
  locale: string,
  catalog: Partial<MessageCatalog>,
  fallbackCatalog: MessageCatalog = catalogs[DEFAULT_LOCALE],
): Translator {
  const englishCatalog = catalogs[DEFAULT_LOCALE];

  return {
    locale,
    t: (key, params = {}) => {
      const message = catalog[key] ?? fallbackCatalog[key] ?? englishCatalog[key] ?? key;
      return interpolateMessage(message, params);
    },
  };
}

export function interpolateMessage(message: string, params: MessageParams): string {
  return message.replace(INTERPOLATION_PATTERN, (source, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      return source;
    }
    return String(params[name] ?? "");
  });
}
