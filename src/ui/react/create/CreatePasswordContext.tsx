import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CreatePasswordState = Readonly<{
  password: string;
  passwordConfirm: string;
  showPassword: boolean;
  signingIdentityPassword: string;
  setPassword(value: string): void;
  setPasswordConfirm(value: string): void;
  setShowPassword(value: boolean): void;
  setSigningIdentityPassword(value: string): void;
  reset(): void;
}>;

const noop = () => {};

const FALLBACK_CREATE_PASSWORD_STATE: CreatePasswordState = Object.freeze({
  password: "",
  passwordConfirm: "",
  showPassword: false,
  signingIdentityPassword: "",
  setPassword: noop,
  setPasswordConfirm: noop,
  setShowPassword: noop,
  setSigningIdentityPassword: noop,
  reset: noop,
});

const CreatePasswordContext = createContext<CreatePasswordState>(
  FALLBACK_CREATE_PASSWORD_STATE,
);

export function CreatePasswordProvider({
  children,
}: Readonly<{ children?: ReactNode }>) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingIdentityPassword, setSigningIdentityPassword] = useState("");
  const reset = useCallback(() => {
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setSigningIdentityPassword("");
  }, []);
  const value = useMemo<CreatePasswordState>(
    () => ({
      password,
      passwordConfirm,
      showPassword,
      signingIdentityPassword,
      setPassword,
      setPasswordConfirm,
      setShowPassword,
      setSigningIdentityPassword,
      reset,
    }),
    [password, passwordConfirm, reset, showPassword, signingIdentityPassword],
  );

  return (
    <CreatePasswordContext.Provider value={value}>
      {children}
    </CreatePasswordContext.Provider>
  );
}

export function useCreatePasswordState(): CreatePasswordState {
  return useContext(CreatePasswordContext);
}
