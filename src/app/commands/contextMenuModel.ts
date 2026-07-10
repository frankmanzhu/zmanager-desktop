export type ContextMenuActionPayload = Readonly<{
  action: string;
  archivePath?: string;
  columnId?: string;
  compressMenuPath?: string;
  entryPath?: string;
  folderPath?: string;
  sourcePath?: string;
  sourcePaths?: readonly string[];
}>;

export type ContextMenuModelItem =
  | Readonly<{
      type: "action";
      label: string;
      payload: ContextMenuActionPayload;
      disabled?: boolean;
      disabledReason?: string;
      title?: string;
      shortcut?: string;
    }>
  | Readonly<{
      type: "checkbox";
      label: string;
      payload: ContextMenuActionPayload;
      checked: boolean;
      disabled?: boolean;
      disabledReason?: string;
      title?: string;
      shortcut?: string;
    }>
  | Readonly<{
      type: "caption";
      label: string;
    }>
  | Readonly<{
      type: "separator";
    }>;

export function contextMenuAction(
  label: string,
  payload: ContextMenuActionPayload,
  options: Readonly<{
    disabled?: boolean;
    disabledReason?: string;
    title?: string;
    shortcut?: string;
  }> = {},
): ContextMenuModelItem {
  return {
    type: "action",
    label,
    payload,
    ...options,
  };
}

export function contextMenuCheckbox(
  label: string,
  payload: ContextMenuActionPayload,
  checked: boolean,
  options: Readonly<{
    disabled?: boolean;
    disabledReason?: string;
    title?: string;
    shortcut?: string;
  }> = {},
): ContextMenuModelItem {
  return {
    type: "checkbox",
    label,
    payload,
    checked,
    ...options,
  };
}

export function contextMenuCaption(label: string): ContextMenuModelItem {
  return { type: "caption", label };
}

export function contextMenuSeparator(): ContextMenuModelItem {
  return { type: "separator" };
}
