import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  APP_DETAILS_PANE_DEFAULT_WIDTH_PX,
  APP_NAV_PANE_DEFAULT_WIDTH_PX,
} from "../../../app/constants";

export type ResizablePane = "navigation" | "details";

type ResizablePaneContextValue = Readonly<{
  detailsWidth: number;
  navigationWidth: number;
  setWidth(pane: ResizablePane, width: number): void;
}>;

const ResizablePaneContext = createContext<ResizablePaneContextValue | null>(
  null,
);

export function ResizablePaneProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [navigationWidth, setNavigationWidth] = useState(
    APP_NAV_PANE_DEFAULT_WIDTH_PX,
  );
  const [detailsWidth, setDetailsWidth] = useState(
    APP_DETAILS_PANE_DEFAULT_WIDTH_PX,
  );
  const value = useMemo<ResizablePaneContextValue>(
    () => ({
      detailsWidth,
      navigationWidth,
      setWidth: (pane, width) =>
        pane === "navigation"
          ? setNavigationWidth(width)
          : setDetailsWidth(width),
    }),
    [detailsWidth, navigationWidth],
  );

  return (
    <ResizablePaneContext.Provider value={value}>
      {children}
    </ResizablePaneContext.Provider>
  );
}

export function useResizablePaneLayout(): ResizablePaneContextValue {
  const value = useContext(ResizablePaneContext);
  if (!value) {
    throw new Error("Resizable pane layout requires ResizablePaneProvider");
  }
  return value;
}

const NAVIGATION_WIDTH_CLASSES = {
  150: "w-[150px]",
  166: "w-[166px]",
  182: "w-[182px]",
  198: "w-[198px]",
  214: "w-[214px]",
  230: "w-[230px]",
  246: "w-[246px]",
  262: "w-[262px]",
  278: "w-[278px]",
  294: "w-[294px]",
  310: "w-[310px]",
  326: "w-[326px]",
  342: "w-[342px]",
  358: "w-[358px]",
  360: "w-[360px]",
} as const;

const DETAILS_WIDTH_CLASSES = {
  220: "w-[220px]",
  236: "w-[236px]",
  252: "w-[252px]",
  268: "w-[268px]",
  284: "w-[284px]",
  300: "w-[300px]",
  316: "w-[316px]",
  332: "w-[332px]",
  348: "w-[348px]",
  364: "w-[364px]",
  380: "w-[380px]",
  396: "w-[396px]",
  412: "w-[412px]",
  428: "w-[428px]",
  444: "w-[444px]",
  460: "w-[460px]",
  476: "w-[476px]",
  492: "w-[492px]",
  508: "w-[508px]",
  520: "w-[520px]",
} as const;

export function resizablePaneWidthClass(
  pane: ResizablePane,
  width: number,
): string {
  const classes =
    pane === "navigation" ? NAVIGATION_WIDTH_CLASSES : DETAILS_WIDTH_CLASSES;
  const widths = Object.keys(classes).map(Number);
  const closest = widths.reduce((best, candidate) =>
    Math.abs(candidate - width) < Math.abs(best - width) ? candidate : best,
  );
  return classes[closest as keyof typeof classes];
}
