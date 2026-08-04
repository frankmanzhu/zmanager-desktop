const fs = require('fs');
let code = fs.readFileSync('src/api/commands.ts', 'utf8');
code = code.replace(/\s*\{\s*command:\s*"replacement_migration_prepare",[\s\S]*?\},/g, '');
code = code.replace(/\s*\{\s*command:\s*"replacement_migration_complete",[\s\S]*?\},/g, '');
fs.writeFileSync('src/api/commands.ts', code);
