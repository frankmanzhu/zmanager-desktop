export type RuntimeStartupOptions = Readonly<{
  bindWindowLifecycleHandlers(): void;
  refreshDisplayFromPreferences(): void;
  loadPathHistory(): void;
  applyCreatePreferenceDefaults(): void;
  setInitialBrowseState(): void;
  installRuntimeDevTools(): void;
  bindFileDrop(): void | Promise<void>;
  isDesktopRuntime(): boolean;
  initializeDesktopRuntime(): Promise<void>;
  renderNormalWorkspaceOnce(): void;
  loadLocalDevFixtureFromUrl(): void;
  loadBootstrapState(): void | Promise<void>;
}>;

export function startZManagerRuntime(options: RuntimeStartupOptions): void {
  options.bindWindowLifecycleHandlers();
  options.refreshDisplayFromPreferences();
  options.loadPathHistory();
  options.applyCreatePreferenceDefaults();
  options.setInitialBrowseState();
  options.installRuntimeDevTools();
  void options.bindFileDrop();

  if (options.isDesktopRuntime()) {
    void Promise.resolve(options.loadBootstrapState()).finally(() => {
      void options.initializeDesktopRuntime().finally(() => {
        options.loadLocalDevFixtureFromUrl();
      });
    });
    return;
  }

  options.renderNormalWorkspaceOnce();
  options.loadLocalDevFixtureFromUrl();
  void options.loadBootstrapState();
}
