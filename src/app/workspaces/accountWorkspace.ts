import type { AccountContactCardPreviewDto, AccountSnapshotDto } from "../../api/types";

export type AccountWorkspaceSnapshot = Readonly<AccountSnapshotDto & {
  visible: boolean;
  busy: boolean;
  notice: string;
  contactCardPreview: AccountContactCardPreviewDto | null;
  pendingEnrollment: boolean;
  enrollmentResult: string | null;
}>;

export type AccountWorkspace = Readonly<{
  getSnapshot(): AccountWorkspaceSnapshot;
  open(): AccountWorkspaceSnapshot;
  close(): AccountWorkspaceSnapshot;
  setBusy(value: boolean): AccountWorkspaceSnapshot;
  setNotice(value: string): AccountWorkspaceSnapshot;
  setContactCardPreview(value: AccountContactCardPreviewDto | null): AccountWorkspaceSnapshot;
  setPendingEnrollment(value: boolean): AccountWorkspaceSnapshot;
  setEnrollmentResult(value: string | null): AccountWorkspaceSnapshot;
  replace(value: AccountSnapshotDto): AccountWorkspaceSnapshot;
}>;

const EMPTY: AccountSnapshotDto = {
  authStatus: "signedOut",
  pendingState: null,
  defaultSigningIdentityId: null,
  capabilities: {
    auth: "launch_only",
    enrollment: "unavailable",
    status: "offline_cache_only",
    accountManagement: "external_browser",
  },
  certificates: [],
  recipientKeys: [],
  contacts: [],
  displayName: null,
  publicSignerId: null,
  assuranceLevel: null,
  sessionExpiresAtUnixSeconds: null,
};

export function createAccountWorkspace(): AccountWorkspace {
  let visible = false;
  let busy = false;
  let notice = "";
  let contactCardPreview: AccountContactCardPreviewDto | null = null;
  let pendingEnrollment = false;
  let enrollmentResult: string | null = null;
  let value = EMPTY;

  function getSnapshot(): AccountWorkspaceSnapshot {
    return Object.freeze({
      ...value,
      certificates: Object.freeze([...value.certificates]) as unknown as AccountSnapshotDto["certificates"],
      recipientKeys: Object.freeze([...value.recipientKeys]) as unknown as AccountSnapshotDto["recipientKeys"],
      contacts: Object.freeze([...value.contacts]) as unknown as AccountSnapshotDto["contacts"],
      contactCardPreview,
      visible,
      busy,
      notice,
      pendingEnrollment,
      enrollmentResult,
    });
  }

  return {
    getSnapshot,
    open() { visible = true; return getSnapshot(); },
    close() { visible = false; return getSnapshot(); },
    setBusy(next) { busy = next; return getSnapshot(); },
    setNotice(next) { notice = next; return getSnapshot(); },
    setContactCardPreview(next) { contactCardPreview = next; return getSnapshot(); },
    setPendingEnrollment(next) { pendingEnrollment = next; return getSnapshot(); },
    setEnrollmentResult(next) { enrollmentResult = next; return getSnapshot(); },
    replace(next) { value = next; return getSnapshot(); },
  };
}
