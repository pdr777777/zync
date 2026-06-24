const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.co')
      ? { rejectUnauthorized: false }
      : false,
  });
  await client.connect();

  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  await client.query(`
    DROP SCHEMA IF EXISTS zync_test CASCADE;
    CREATE SCHEMA zync_test;
    SET search_path TO zync_test;
    ${schemaSql}
    INSERT INTO planos (nome, preco, intervalo_dias) VALUES ('Básico', 49.90, 30), ('Pro', 99.90, 30);
  `);

  await client.end();
};
