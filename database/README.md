# Banco de dados — Zync

PostgreSQL via Supabase. Para aplicar localmente (usando a `DATABASE_URL` do projeto Supabase):

```
psql "$DATABASE_URL" -f schema.sql
psql "$DATABASE_URL" -f seeds/seed.sql
```

- `schema.sql` — estrutura das tabelas (fonte da verdade, idempotente — seguro rodar de novo)
- `migrations/` — histórico de alterações da época do MySQL; não são reaplicadas no Postgres (o `schema.sql` já reflete o estado atual). Novas mudanças de schema a partir daqui devem ser arquivos novos em sintaxe Postgres.
- `seeds/` — dados de exemplo para desenvolvimento
