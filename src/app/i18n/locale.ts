export type SupportedLocale = "en";
export type LocalePreference = "system" | SupportedLocale;
export type TextDirection = "ltr" | "rtl";

export type LocaleMetadata = {
  labelKey: string;
  direction: TextDirection;
  aliases: readonly string[];
};
export type LocaleAliasMap = Record<string, string>;

export const DEFAULT_LOCALE: SupportedLocale = "en";
export const SYSTEM_LOCALE_PREFERENCE: LocalePreference = "system";

export const SUPPORTED_LOCALES = ["en"] as const satisfies readonly SupportedLocale[];

export const LOCALE_METADATA = {
  en: {
    labelKey: "preferences.language.english",
    direction: "ltr",
    aliases: ["en-US", "en-GB", "en-AU", "en-CA", "en-NZ"],
  },
} as const satisfies Record<SupportedLocale, LocaleMetadata>;

export const LOCALE_ALIASES = {
  "en-US": "en",
  "en-GB": "en",
  "en-AU": "en",
  "en-CA": "en",
  "en-NZ": "en",
  "zh-Hans": "zh-CN",
  "zh-Hans-CN": "zh-CN",
  "zh-SG": "zh-CN",
} as const satisfies LocaleAliasMap;

export function isSupportedLocale(
  value: string | null | undefined,
  supportedLocales: readonly string[] = SUPPORTED_LOCALES,
): value is SupportedLocale {
  return typeof value === "string" && supportedLocales.includes(value);
}

export function isLocalePreference(value: string | null | undefined): value is LocalePreference {
  return value === SYSTEM_LOCALE_PREFERENCE || isSupportedLocale(value);
}

export function normalizeLocaleTag(value: string): string {
  return value
    .trim()
    .replace(/_/g, "-")
    .split("-")
    .map((part, index) => {
      if (index === 0) {
        return part.toLowerCase();
      }
      if (part.length === 2) {
        return part.toUpperCase();
      }
      if (part.length === 4) {
        return `${part[0]?.toUpperCase() ?? ""}${part.slice(1).toLowerCase()}`;
      }
      return part;
    })
    .join("-");
}

export function resolveLocalePreference(
  preference: LocalePreference,
  browserLanguages: readonly string[] = navigatorLanguages(),
  supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALES,
): SupportedLocale {
  if (preference === SYSTEM_LOCALE_PREFERENCE) {
    return resolveBestLocale(browserLanguages, supportedLocales);
  }

  const selectedLocale = preference as SupportedLocale;
  if (supportedLocales.includes(selectedLocale)) {
    return selectedLocale;
  }

  return resolveBestLocale(browserLanguages, supportedLocales);
}

export function resolveBestLocale(
  browserLanguages: readonly string[],
): SupportedLocale;
export function resolveBestLocale<TLocale extends string>(
  browserLanguages: readonly string[],
  supportedLocales: readonly TLocale[],
  aliases?: LocaleAliasMap,
): TLocale;
export function resolveBestLocale<TLocale extends string>(
  browserLanguages: readonly string[],
  supportedLocales: readonly TLocale[] = SUPPORTED_LOCALES as unknown as readonly TLocale[],
  aliases: LocaleAliasMap = LOCALE_ALIASES,
): TLocale {
  const supported = new Set<string>(supportedLocales);
  const normalizedAliases = new Map(
    Object.entries(aliases).map(([alias, locale]) => [normalizeLocaleTag(alias), locale]),
  );

  for (const language of browserLanguages) {
    const normalized = normalizeLocaleTag(language);
    if (supported.has(normalized)) {
      return normalized as TLocale;
    }
  }

  for (const language of browserLanguages) {
    const normalized = normalizeLocaleTag(language);
    const alias = normalizedAliases.get(normalized);
    if (alias && supported.has(alias)) {
      return alias as TLocale;
    }
  }

  return DEFAULT_LOCALE as TLocale;
}

export function localeDirection(locale: SupportedLocale): TextDirection {
  return LOCALE_METADATA[locale].direction;
}

function navigatorLanguages(): readonly string[] {
  if (typeof navigator === "undefined") {
    return [];
  }
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}
