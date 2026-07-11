import { saveNativeDialog } from "./runtime";
import type { NativeDialogErrorMessages } from "../app/dialogs";

export function chooseTzapIdentityDestination(
  defaultPath: string,
  reportStatus: (message: string) => void,
  messages: NativeDialogErrorMessages,
) {
  return saveNativeDialog({
    title: "Create TZAP signing identity",
    defaultPath,
    filters: [{ name: "PKCS#12 identity", extensions: ["p12", "pfx"] }],
  }, reportStatus, messages);
}
