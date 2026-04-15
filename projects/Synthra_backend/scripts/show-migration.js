const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260416_init_supabase.sql');

if (!fs.existsSync(migrationPath)) {
  console.error(`[Migration] File not found: ${migrationPath}`);
  process.exit(1);
}

const content = fs.readFileSync(migrationPath, 'utf-8');

console.log('=== Synthra Supabase Migration SQL ===');
console.log(content);
console.log('=== End Migration SQL ===');
