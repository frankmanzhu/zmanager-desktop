const { readFileSync, writeFileSync } = require("fs");
let script = readFileSync("scripts/generate-native-contracts.mjs", "utf8");

const importLine = `const macosFfi = readJson("manifests/macos-ffi-operations.json");`;
script = script.replace('const appCommands = readJson("manifests/application-commands.json");', 'const appCommands = readJson("manifests/application-commands.json");\n' + importLine);

const generatorCode = `
// macOS FFI generator
{
  let rust = \`// GENERATED FILE - DO NOT EDIT\\n\\nuse std::ffi::c_void;\\n\\nextern "C" {\\n\`;
  let swift = \`// GENERATED FILE - DO NOT EDIT\\n\\nimport Foundation\\n\\n\`;

  for (const op of macosFfi.operations) {
    if (op.type === "async-json") {
      rust += \`    pub fn \${op.name}(\\n        bytes: *const u8,\\n        length: usize,\\n        callback: Option<extern "C" fn(*const u8, usize, *mut c_void)>,\\n        context: *mut c_void,\\n    ) -> i32;\\n\`;
    } else if (op.type === "lifecycle") {
      if (op.name === "zmanager_macos_host_start") {
        rust += \`    pub fn \${op.name}(\\n        callback: Option<extern "C" fn(*const u8, usize, *mut c_void)>,\\n        context: *mut c_void,\\n    ) -> i32;\\n\`;
      } else if (op.name === "zmanager_macos_host_is_running") {
        rust += \`    pub fn \${op.name}() -> i32;\\n\`;
      } else {
        rust += \`    pub fn \${op.name}();\\n\`;
      }
    } else if (op.type === "async-drag") {
      rust += \`    pub fn \${op.name}(\\n        view: *mut c_void,\\n        session_bytes: *const u8,\\n        session_length: usize,\\n        item_bytes: *const u8,\\n        item_length: usize,\\n        write: Option<extern "C" fn(*const u8, usize, *const u8, usize, *mut c_void) -> i32>,\\n        outcome: Option<extern "C" fn(i32, *mut c_void)>,\\n        release: Option<extern "C" fn(*mut c_void)>,\\n        context: *mut c_void,\\n    ) -> i32;\\n\`;
    }
  }
  rust += \`}\\n\`;
  
  swift += \`public enum MacOSFFILimits {\\n\`;
  swift += \`    public static let maxRequestBytes = \${macosFfi.limits.maxRequestBytes}\\n\`;
  swift += \`    public static let maxResponseBytes = \${macosFfi.limits.maxResponseBytes}\\n\`;
  swift += \`    public static let maxDragItems = \${macosFfi.limits.maxDragItems}\\n\`;
  swift += \`}\\n\\n\`;

  swift += \`public enum MacOSFFIErrorMapping {\\n\`;
  for (const [key, val] of Object.entries(macosFfi.errorMapping)) {
    swift += \`    public static let \${key}: Int32 = \${val}\\n\`;
  }
  swift += \`}\\n\`;
  
  put("src-tauri/src/generated/macos_ffi.generated.rs", rust);
  put("native/macos/Sources/ZManagerGenerated/MacOSFFI.generated.swift", swift);
}
`;

script = script.replace('const drift = [];', generatorCode + '\nconst drift = [];');
writeFileSync("scripts/generate-native-contracts.mjs", script);
