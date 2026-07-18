import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ExtractPasswordState = Readonly<{
  password: string;
  showPassword: boolean;
  setPassword(value: string): void;
  setShowPassword(value: boolean): void;
  reset(): void;
}>;

const noop = () => {};

const FALLBACK_EXTRACT_PASSWORD_STATE: ExtractPasswordState = Object.freeze({
  password: "",
  showPassword: false,
  setPassword: noop,
  setShowPassword: noop,
  reset: noop,
});

const ExtractPasswordContext = createContext<ExtractPasswordState>(
  FALLBACK_EXTRACT_PASSWORD_STATE,
);

export function ExtractPasswordProvider({
  children,
}: Readonly<{ children?: ReactNode }>) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const reset = useCallback(() => {
    setPassword("");
    setShowPassword(false);
  }, []);
  const value = useMemo<ExtractPasswordState>(
    () => ({
      password,
      showPassword,
      setPassword,
      setShowPassword,
      reset,
    }),
    [password, reset, showPassword],
  );

  return (
    <ExtractPasswordContext.Provider value={value}>
      {children}
    </ExtractPasswordContext.Provider>
  );
}

export function useExtractPasswordState(): ExtractPasswordState {
  return useContext(ExtractPasswordContext);
}
