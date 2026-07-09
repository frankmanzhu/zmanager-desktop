function browserClipboard(): Clipboard | undefined {
  return typeof navigator === "undefined" ? undefined : navigator.clipboard;
}

export function canReadClipboard(): boolean {
  return typeof browserClipboard()?.readText === "function";
}

export async function readClipboardText(): Promise<string | null> {
  const clipboard = browserClipboard();
  if (typeof clipboard?.readText !== "function") {
    return null;
  }

  return clipboard.readText();
}

export function canWriteClipboard(): boolean {
  return typeof browserClipboard()?.writeText === "function";
}

export async function writeClipboardText(value: string): Promise<void> {
  const clipboard = browserClipboard();
  if (typeof clipboard?.writeText !== "function") {
    throw new Error("Clipboard write is not available.");
  }

  await clipboard.writeText(value);
}
