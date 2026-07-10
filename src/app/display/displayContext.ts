import {
  formatBytes as formatBytesValue,
  formatCompressionRatio,
  formatDate as formatDateValue,
  type FormatBytesOptions,
  type FormatCompressionRatioOptions,
  type FormatDateOptions,
} from "../formatting";
import {
  localeDirection,
  resolveLocalePreference,
  type LocalePreference,
  type SupportedLocale,
  type TextDirection,
} from "../i18n/locale";
import {
  createTranslator,
  type Translator,
} from "../i18n/translator";

export type DisplayFormatters = {
  bytes: (value?: number | null, options?: DisplayFormatBytesOptions) => string;
  date: (value?: string | number | Date | null, options?: DisplayFormatDateOptions) => string;
  ratio: (
    uncompressedBytes?: number | null,
    compressedBytes?: number | null,
    options?: DisplayFormatRatioOptions,
  ) => string;
};

export type DisplayContextSnapshot = {
  resolvedLocale: SupportedLocale;
  translator: Translator;
  documentLanguage: SupportedLocale;
  documentDirection: TextDirection;
  format: DisplayFormatters;
};

export type CreateDisplayContextOptions = {
  browserLanguages?: readonly string[];
};

export type DisplayRefreshWorkspace = "browse" | "create";

export type DisplayRefreshSurface = DisplayRefreshWorkspace | "jobs" | "preferences";

export type DisplayRefreshState = {
  activeWorkspace: DisplayRefreshWorkspace;
  jobsVisible?: boolean;
  preferencesVisible?: boolean;
};

export type DisplayDocumentElement = {
  lang: string;
  dir: string;
};

export type DisplayRefreshEffects = {
  commitContext?: (context: DisplayContextSnapshot) => void;
  documentElement?: DisplayDocumentElement;
  refreshCommands?: (context: DisplayContextSnapshot) => void;
};

type DisplayFormatBytesOptions = Omit<FormatBytesOptions, "locale">;
type DisplayFormatDateOptions = Omit<FormatDateOptions, "locale">;
type DisplayFormatRatioOptions = Omit<FormatCompressionRatioOptions, "locale">;

export function createDisplayContext(
  localePreference: LocalePreference,
  options: CreateDisplayContextOptions = {},
): DisplayContextSnapshot {
  const resolvedLocale = resolveLocalePreference(
    localePreference,
    options.browserLanguages,
  );

  return {
    resolvedLocale,
    translator: createTranslator(resolvedLocale),
    documentLanguage: resolvedLocale,
    documentDirection: localeDirection(resolvedLocale),
    format: createDisplayFormatters(resolvedLocale),
  };
}

export function refreshDisplayContext(
  localePreference: LocalePreference,
  effects: DisplayRefreshEffects,
  options: CreateDisplayContextOptions = {},
): DisplayContextSnapshot {
  const context = createDisplayContext(localePreference, options);
  effects.commitContext?.(context);
  applyDisplayContextRefresh(context, effects);
  return context;
}

export function applyDisplayContextRefresh(
  context: DisplayContextSnapshot,
  effects: DisplayRefreshEffects,
): void {
  if (effects.documentElement) {
    applyDisplayDocumentMetadata(effects.documentElement, context);
  }

  effects.refreshCommands?.(context);
}

export function selectDisplayRefreshSurfaces(
  state: DisplayRefreshState,
): readonly DisplayRefreshSurface[] {
  const surfaces: DisplayRefreshSurface[] = [state.activeWorkspace];
  if (state.jobsVisible) {
    surfaces.push("jobs");
  }
  if (state.preferencesVisible) {
    surfaces.push("preferences");
  }
  return surfaces;
}

export function applyDisplayDocumentMetadata(
  element: DisplayDocumentElement,
  context: DisplayContextSnapshot,
): void {
  element.lang = context.documentLanguage;
  element.dir = context.documentDirection;
}

function createDisplayFormatters(locale: SupportedLocale): DisplayFormatters {
  return {
    bytes(value, options = {}) {
      return formatBytesValue(value, { ...options, locale });
    },
    date(value, options = {}) {
      return formatDateValue(value, { ...options, locale });
    },
    ratio(uncompressedBytes, compressedBytes, options = {}) {
      return formatCompressionRatio(uncompressedBytes, compressedBytes, {
        ...options,
        locale,
      });
    },
  };
}
