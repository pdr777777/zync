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

  await client.query('DROP SCHEMA IF EXISTS zync_test CASCADE');

  await client.end();
};
