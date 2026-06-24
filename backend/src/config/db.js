const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : false,
  options: process.env.NODE_ENV === 'test' ? '-c search_path=zync_test' : undefined,
});

module.exports = pool;
