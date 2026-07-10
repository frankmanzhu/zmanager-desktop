import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type CreatePasswordState = Readonly<{
  password: string;
  passwordConfirm: string;
  showPassword: boolean;
  setPassword(value: string): void;
  setPasswordConfirm(value: string): void;
  setShowPassword(value: boolean): void;
  reset(): void;
}>;

const noop = () => {};

const FALLBACK_CREATE_PASSWORD_STATE: CreatePasswordState = Object.freeze({
  password: "",
  passwordConfirm: "",
  showPassword: false,
  setPassword: noop,
  setPasswordConfirm: noop,
  setShowPassword: noop,
  reset: noop,
});

const CreatePasswordContext = createContext<CreatePasswordState>(FALLBACK_CREATE_PASSWORD_STATE);

export function CreatePasswordProvider({ children }: Readonly<{ children?: ReactNode }>) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const reset = useCallback(() => {
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
  }, []);
  const value = useMemo<CreatePasswordState>(() => ({
    password,
    passwordConfirm,
    showPassword,
    setPassword,
    setPasswordConfirm,
    setShowPassword,
    reset,
  }), [password, passwordConfirm, reset, showPassword]);

  return (
    <CreatePasswordContext.Provider value={value}>
      {children}
    </CreatePasswordContext.Provider>
  );
}

export function useCreatePasswordState(): CreatePasswordState {
  return useContext(CreatePasswordContext);
}
