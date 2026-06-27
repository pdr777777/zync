const { Pool } = require('pg');
require('dotenv').config();

const schema = process.env.PG_SCHEMA || (process.env.NODE_ENV === 'test' ? 'zync_test' : undefined);

// Por padrao a conexao SSL nao valida o certificado do Supabase
// (rejectUnauthorized: false) - criptografa o trafego mas fica vulneravel
// a um MITM que apresente qualquer certificado. Se DATABASE_CA_CERT
// estiver configurada (o certificado CA do Supabase, em PEM), passa a
// validar de verdade. Sem essa env var, o comportamento atual nao muda -
// so habilita quem testar e confirmar que a conexao continua funcionando.
const ssl = process.env.DATABASE_CA_CERT
  ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA_CERT }
  : process.env.DATABASE_URL && process.env.DATABASE_URL.includes('supabase.co')
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
  options: schema ? `-c search_path=${schema}` : undefined,
});

module.exports = pool;
