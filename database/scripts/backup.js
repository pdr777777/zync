const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const { rows: tabelas } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  const dump = {};
  for (const { tablename } of tabelas) {
    const { rows } = await client.query(`SELECT * FROM "${tablename}"`);
    dump[tablename] = rows;
  }

  await client.end();

  const outDir = process.env.BACKUP_DIR || path.resolve(__dirname, '../../backups');
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(outDir, `backup-${timestamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify(dump, null, 2));

  const totalLinhas = Object.values(dump).reduce((soma, linhas) => soma + linhas.length, 0);
  console.log(`Backup salvo em ${outFile} (${Object.keys(dump).length} tabelas, ${totalLinhas} linhas)`);
}

main().catch((err) => {
  console.error('Erro no backup:', err.message);
  process.exit(1);
});
