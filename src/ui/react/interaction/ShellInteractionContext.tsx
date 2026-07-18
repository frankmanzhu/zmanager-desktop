import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from "react";

const detachedSearchInputRef: RefObject<HTMLInputElement | null> = {
  current: null,
};
const ShellSearchInputContext = createContext<
  RefObject<HTMLInputElement | null>
>(detachedSearchInputRef);

export function ShellInteractionProvider({
  children,
  searchInputRef,
}: Readonly<{
  children?: ReactNode;
  searchInputRef: RefObject<HTMLInputElement | null>;
}>) {
  return (
    <ShellSearchInputContext.Provider value={searchInputRef}>
      {children}
    </ShellSearchInputContext.Provider>
  );
}

export function useShellSearchInputRef(): RefObject<HTMLInputElement | null> {
  return useContext(ShellSearchInputContext);
}
