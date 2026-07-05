import { DEFAULT_LOCALE, type SupportedLocale } from "./locale";
import { enMessages, type EnMessageKey } from "./messages.en";

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

export function applyTranslations(root: ParentNode, translator: Translator): void {
  for (const element of root.querySelectorAll<HTMLElement>("[data-i18n-text]")) {
    const key = element.dataset.i18nText as MessageKey | undefined;
    if (key) {
      element.textContent = translator.t(key);
    }
  }

  applyTranslatedAttribute(root, "data-i18n-aria-label", "aria-label", translator);
  applyTranslatedAttribute(root, "data-i18n-title", "title", translator);
  applyTranslatedAttribute(root, "data-i18n-placeholder", "placeholder", translator);
}

export function interpolateMessage(message: string, params: MessageParams): string {
  return message.replace(INTERPOLATION_PATTERN, (source, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) {
      return source;
    }
    return String(params[name] ?? "");
  });
}

function applyTranslatedAttribute(
  root: ParentNode,
  sourceAttribute: string,
  targetAttribute: string,
  translator: Translator,
): void {
  for (const element of root.querySelectorAll<HTMLElement>(`[${sourceAttribute}]`)) {
    const key = element.getAttribute(sourceAttribute) as MessageKey | null;
    if (key) {
      element.setAttribute(targetAttribute, translator.t(key));
    }
  }
}
