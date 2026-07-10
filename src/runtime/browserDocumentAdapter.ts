import {
  APP_DETAILS_PANE_DEFAULT_WIDTH_PX,
  APP_DETAILS_PANE_MAX_WIDTH_PX,
  APP_DETAILS_PANE_MIN_WIDTH_PX,
  APP_MENU_BAR_HEIGHT_PX,
  APP_MIN_WINDOW_HEIGHT_PX,
  APP_MIN_WINDOW_WIDTH_PX,
  APP_NAV_PANE_DEFAULT_WIDTH_PX,
  APP_NAV_PANE_MAX_WIDTH_PX,
  APP_NAV_PANE_MIN_WIDTH_PX,
  APP_PATH_BAR_HEIGHT_PX,
  APP_STATUS_BAR_HEIGHT_PX,
  APP_STATUS_BAR_PARTS,
  APP_TOOLBAR_HEIGHT_PX,
} from "../app/constants";
import {
  applyDisplayDocumentMetadata,
  type DisplayContextSnapshot,
} from "../app/display/displayContext";

export type BrowserDocumentAdapter = Readonly<{
  initializeLayout(): void;
  setQuickActionJobMode(active: boolean): void;
  applyDisplayMetadata(context: DisplayContextSnapshot): void;
  usesLinuxWindowChrome(): boolean;
}>;

export type CreateBrowserDocumentAdapterOptions = Readonly<{
  documentRef?: Document;
  navigatorRef?: Pick<Navigator, "userAgent">;
  isDesktopRuntime: () => boolean;
}>;

const layoutVariables = {
  "--zmanager-min-window-width": APP_MIN_WINDOW_WIDTH_PX,
  "--zmanager-min-window-height": APP_MIN_WINDOW_HEIGHT_PX,
  "--zmanager-menu-height": APP_MENU_BAR_HEIGHT_PX,
  "--zmanager-toolbar-height": APP_TOOLBAR_HEIGHT_PX,
  "--zmanager-pathbar-height": APP_PATH_BAR_HEIGHT_PX,
  "--zmanager-statusbar-height": APP_STATUS_BAR_HEIGHT_PX,
  "--zmanager-nav-pane-min": APP_NAV_PANE_MIN_WIDTH_PX,
  "--zmanager-nav-pane-width": APP_NAV_PANE_DEFAULT_WIDTH_PX,
  "--zmanager-nav-pane-max": APP_NAV_PANE_MAX_WIDTH_PX,
  "--zmanager-details-pane-min": APP_DETAILS_PANE_MIN_WIDTH_PX,
  "--zmanager-details-pane-width": APP_DETAILS_PANE_DEFAULT_WIDTH_PX,
  "--zmanager-details-pane-max": APP_DETAILS_PANE_MAX_WIDTH_PX,
} as const;

export function createBrowserDocumentAdapter(
  options: CreateBrowserDocumentAdapterOptions,
): BrowserDocumentAdapter {
  const documentRef = options.documentRef ?? document;
  const navigatorRef = options.navigatorRef ?? navigator;
  const useLinuxWindowChrome = options.isDesktopRuntime() && /\bLinux\b/i.test(navigatorRef.userAgent);

  return {
    initializeLayout() {
      if (useLinuxWindowChrome) {
        documentRef.body.classList.add("linux-window-chrome");
      }

      for (const [name, value] of Object.entries(layoutVariables)) {
        documentRef.documentElement.style.setProperty(name, `${value}px`);
      }
      documentRef.documentElement.style.setProperty("--zmanager-statusbar-parts", `${APP_STATUS_BAR_PARTS}`);
    },
    setQuickActionJobMode(active) {
      documentRef.body.classList.toggle("quick-action-job-mode", active);
    },
    applyDisplayMetadata(context) {
      applyDisplayDocumentMetadata(documentRef.documentElement, context);
    },
    usesLinuxWindowChrome() {
      return useLinuxWindowChrome;
    },
  };
}
