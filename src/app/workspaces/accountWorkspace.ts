import type { AccountSnapshotDto } from "../../api/types";

export type AccountWorkspaceSnapshot = Readonly<AccountSnapshotDto & {
  visible: boolean;
  busy: boolean;
  notice: string;
}>;

export type AccountWorkspace = Readonly<{
  getSnapshot(): AccountWorkspaceSnapshot;
  open(): AccountWorkspaceSnapshot;
  close(): AccountWorkspaceSnapshot;
  setBusy(value: boolean): AccountWorkspaceSnapshot;
  setNotice(value: string): AccountWorkspaceSnapshot;
  replace(value: AccountSnapshotDto): AccountWorkspaceSnapshot;
}>;

const EMPTY: AccountSnapshotDto = {
  authStatus: "signedOut",
  pendingState: null,
  certificates: [],
  recipientKeys: [],
  contacts: [],
};

export function createAccountWorkspace(): AccountWorkspace {
  let visible = false;
  let busy = false;
  let notice = "";
  let value = EMPTY;

  function getSnapshot(): AccountWorkspaceSnapshot {
    return Object.freeze({
      ...value,
      certificates: Object.freeze([...value.certificates]) as unknown as AccountSnapshotDto["certificates"],
      recipientKeys: Object.freeze([...value.recipientKeys]) as unknown as AccountSnapshotDto["recipientKeys"],
      contacts: Object.freeze([...value.contacts]) as unknown as AccountSnapshotDto["contacts"],
      visible,
      busy,
      notice,
    });
  }

  return {
    getSnapshot,
    open() { visible = true; return getSnapshot(); },
    close() { visible = false; return getSnapshot(); },
    setBusy(next) { busy = next; return getSnapshot(); },
    setNotice(next) { notice = next; return getSnapshot(); },
    replace(next) { value = next; return getSnapshot(); },
  };
}
