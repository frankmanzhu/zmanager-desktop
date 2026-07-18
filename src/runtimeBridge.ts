import { runReplacementMigrationBeforeRuntime } from "./desktop/replacementMigration";
await runReplacementMigrationBeforeRuntime();
const runtime = await import("./runtime/zmanagerRuntimeAdapter");
export const getZManagerRuntimeAdapter = runtime.getZManagerRuntimeAdapter;
