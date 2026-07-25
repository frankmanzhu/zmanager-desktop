const runtimePromise = import("./runtime/zmanagerRuntimeAdapter");
export async function getZManagerRuntimeAdapter() {
  const runtime = await runtimePromise;
  return runtime.getZManagerRuntimeAdapter;
}
