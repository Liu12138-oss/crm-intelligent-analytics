import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationDirectory = join(__dirname, 'migrations');
const sql = readdirSync(migrationDirectory)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort((left, right) => left.localeCompare(right))
  .map((fileName) => readFileSync(join(migrationDirectory, fileName), 'utf8').trim())
  .join('\n\n');

console.log('准备执行应用库初始化脚本。');
console.log(sql);
