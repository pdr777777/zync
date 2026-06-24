const fs = require('fs');
const { Client } = require('pg');

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('Uso: node restore.js <arquivo-backup.json>');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL não definida');
    process.exit(1);
  }

  const dump = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  // Desliga checagem de FK temporariamente pra poder restaurar em
  // qualquer ordem, sem se preocupar com dependencia entre tabelas.
  await client.query('SET session_replication_role = replica');

  try {
    for (const [tabela, linhas] of Object.entries(dump)) {
      await client.query(`TRUNCATE TABLE "${tabela}" CASCADE`);

      for (const linha of linhas) {
        const colunas = Object.keys(linha);
        const valores = colunas.map((c) => linha[c]);
        const placeholders = colunas.map((_, i) => `$${i + 1}`).join(', ');
        const colunasSql = colunas.map((c) => `"${c}"`).join(', ');

        await client.query(
          `INSERT INTO "${tabela}" (${colunasSql}) VALUES (${placeholders})`,
          valores
        );
      }

      // Realinha a sequence (id SERIAL) com o maior id restaurado.
      await client.query(
        `SELECT setval(pg_get_serial_sequence('"${tabela}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tabela}"), 1))`
      ).catch(() => {
        // tabelas sem coluna "id" (ex: lead_tags) nao tem sequence pra ajustar
      });

      console.log(`${tabela}: ${linhas.length} linhas restauradas`);
    }
  } finally {
    await client.query('SET session_replication_role = origin');
  }

  await client.end();
  console.log('Restore concluído.');
}

main().catch((err) => {
  console.error('Erro no restore:', err.message);
  process.exit(1);
});
