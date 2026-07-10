export type PasswordPromptAdapter = Readonly<{
  promptForPassword(message: string): string | null;
}>;

export function createBrowserPasswordPromptAdapter(
  windowRef: Pick<Window, "prompt"> = window,
): PasswordPromptAdapter {
  return {
    promptForPassword(message) {
      const value = windowRef.prompt(message);
      if (!value) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    },
  };
}
