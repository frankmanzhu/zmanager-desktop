import { UserRound, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useZManagerActions, useZManagerSnapshot } from "../AppProviders";
import { SessionStatus } from "./SessionStatus";
import { CertificatesTab } from "./CertificatesTab";
import { ContactsTab } from "./ContactsTab";
import { DocumentsTab } from "./DocumentsTab";
import { DeviceTab } from "./DeviceTab";

export type AccountWorkspaceProps = {
  defaultTab?: string;
};

export function AccountWorkspace({ defaultTab = "session" }: AccountWorkspaceProps = {}) {
  const fullSnapshot = useZManagerSnapshot();
  const snapshot = fullSnapshot.account;
  const actions = useZManagerActions();
  
  if (!snapshot.visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-6"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          actions.handleAccountIntent({ type: "close" });
        }
      }}
    >
      <section
        className="grid max-h-[calc(100vh-48px)] w-[min(920px,calc(100vw-48px))] grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        tabIndex={-1}
        autoFocus
      >
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <UserRound className="size-5" />
          <div className="min-w-0 flex-1">
            <h2 id="account-title" className="font-semibold">
              Identity &amp; Contacts
            </h2>
            <p className="text-xs opacity-65">
              Local identities, recipient keys, verified contacts, and secure-store capabilities
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close account"
            onClick={() => actions.handleAccountIntent({ type: "close" })}
          >
            <X className="size-4" />
          </Button>
        </header>
        <div className="overflow-y-auto p-5">
          {snapshot.notice ? (
            <p
              className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-900"
              role="status"
            >
              {snapshot.notice}
            </p>
          ) : null}
          
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="mb-4 w-full justify-start overflow-x-auto">
              <TabsTrigger value="session">Session</TabsTrigger>
              <TabsTrigger value="certificates">Certificates</TabsTrigger>
              <TabsTrigger value="contacts">Contacts</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="device">Device</TabsTrigger>
            </TabsList>
            
            <TabsContent value="session" className="m-0 border-none p-0 outline-none">
              <SessionStatus />
            </TabsContent>
            
            <TabsContent value="certificates" className="m-0 border-none p-0 outline-none">
              <CertificatesTab />
            </TabsContent>
            
            <TabsContent value="contacts" className="m-0 border-none p-0 outline-none">
              <ContactsTab />
            </TabsContent>
            
            <TabsContent value="documents" className="m-0 border-none p-0 outline-none">
              <DocumentsTab />
            </TabsContent>
            
            <TabsContent value="device" className="m-0 border-none p-0 outline-none">
              <DeviceTab />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
