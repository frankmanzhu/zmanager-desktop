import { useState } from "react";
import { UserRound, ShieldCheck, KeyRound, FileSignature, Laptop2, X, AlertCircle } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  if (!snapshot.visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-6 backdrop-blur-sm transition-opacity"
      role="presentation"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          actions.handleAccountIntent({ type: "close" });
        }
      }}
    >
      <section
        className="flex h-[620px] max-h-[calc(100vh-64px)] w-[min(920px,calc(100vw-48px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        tabIndex={-1}
        autoFocus
      >
        {/* Header */}
        <header className="flex items-center gap-3.5 border-b border-slate-200/80 bg-slate-50/50 px-6 py-4 backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/40">
          <div className="grid size-9 place-items-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <UserRound className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="account-title" className="text-base font-semibold tracking-tight">
              Identity &amp; Contacts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Local identities, recipient keys, verified contacts, and secure-store capabilities
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close account"
            onClick={() => actions.handleAccountIntent({ type: "close" })}
          >
            <X className="size-4" />
          </Button>
        </header>

        {/* Workspace Body */}
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          {snapshot.notice ? (
            <div
              className="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
              role="status"
            >
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{snapshot.notice}</span>
            </div>
          ) : null}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0">
            <div className="border-b border-slate-200/80 px-6 pt-3 dark:border-slate-800/80">
              <TabsList className="h-10 w-fit justify-start gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                <TabsTrigger
                  value="session"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                >
                  <UserRound className="size-3.5" />
                  Session
                </TabsTrigger>
                <TabsTrigger
                  value="certificates"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                >
                  <ShieldCheck className="size-3.5" />
                  Certificates
                </TabsTrigger>
                <TabsTrigger
                  value="contacts"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                >
                  <KeyRound className="size-3.5" />
                  Contacts &amp; Keys
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                >
                  <FileSignature className="size-3.5" />
                  Documents
                </TabsTrigger>
                <TabsTrigger
                  value="device"
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100"
                >
                  <Laptop2 className="size-3.5" />
                  Device
                </TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto p-6">
              {activeTab === "session" ? (
                <TabsContent value="session" className="m-0 border-none p-0 outline-none">
                  <SessionStatus />
                </TabsContent>
              ) : null}
              
              {activeTab === "certificates" ? (
                <TabsContent value="certificates" className="m-0 border-none p-0 outline-none">
                  <CertificatesTab />
                </TabsContent>
              ) : null}
              
              {activeTab === "contacts" ? (
                <TabsContent value="contacts" className="m-0 border-none p-0 outline-none">
                  <ContactsTab />
                </TabsContent>
              ) : null}
              
              {activeTab === "documents" ? (
                <TabsContent value="documents" className="m-0 border-none p-0 outline-none">
                  <DocumentsTab />
                </TabsContent>
              ) : null}
              
              {activeTab === "device" ? (
                <TabsContent value="device" className="m-0 border-none p-0 outline-none">
                  <DeviceTab />
                </TabsContent>
              ) : null}
            </div>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
