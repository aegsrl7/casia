#!/usr/bin/env node
// Genera SQL di seed dalle traduzioni JSON
// Uso: node seed-translations.js > seed-translations.sql

const fs = require('fs');
const path = require('path');

const langs = ['it', 'en', 'fr', 'de'];
const langDir = path.join(__dirname, '..', 'lang');

function escapeSql(str) {
  return str.replace(/'/g, "''");
}

let sql = '-- Auto-generated translation seed\n';
sql += '-- Generated: ' + new Date().toISOString() + '\n\n';

for (const lang of langs) {
  const filePath = path.join(langDir, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const [page, keys] of Object.entries(data)) {
    if (typeof keys !== 'object' || keys === null) continue;

    for (const [key, value] of Object.entries(keys)) {
      const strValue = typeof value === 'string' ? value
        : Array.isArray(value) ? JSON.stringify(value)
        : String(value);

      sql += `INSERT INTO translations (lang, page, key, value) VALUES ('${escapeSql(lang)}', '${escapeSql(page)}', '${escapeSql(key)}', '${escapeSql(strValue)}') ON CONFLICT(lang, page, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now');\n`;
    }
  }

  sql += '\n';
}

process.stdout.write(sql);
