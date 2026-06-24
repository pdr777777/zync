# Backend — Zync

API em Node/Express + PostgreSQL via Supabase (sem ORM, queries diretas via `pg`).

## Rodando localmente

```
npm install
copy .env.example .env   (e ajustar com a DATABASE_URL do Supabase)
npm run dev
```

A API sobe em `http://localhost:3001`.

## Testes

```
npm test
```

Usa Jest + Supertest contra um schema Postgres separado (`zync_test`), criado e destruído automaticamente a partir do `database/schema.sql` a cada execução — não toca nos dados em `public`. Usa a mesma `DATABASE_URL` do `.env` (conecta na mesma instância Supabase, só isola via `search_path`).

## Rotas

| Rota | Auth | Descrição |
|---|---|---|
| `POST /api/auth/register` / `/login` | Não | Cadastro e login (JWT) |
| `GET/POST /api/leads`, `GET/PUT/DELETE /api/leads/:id` | Sim | CRUD de leads |
| `GET/POST /api/leads/:leadId/mensagens` | Sim | Histórico de conversa do lead |
| `GET /api/dashboard` | Sim | Métricas (leads, conversões, mensagens, % IA) |
| `POST /api/leads/:leadId/ia/responder` | Sim | IA de atendimento (mock, ver `src/services/iaService.js`) |
| `POST /api/leads/:leadId/whatsapp/enviar` | Sim | Envio manual de mensagem (mock, ver `src/services/whatsappService.js`) |
| `POST /api/webhooks/whatsapp/:usuarioId` | Não | Webhook público para receber mensagens do WhatsApp |

## Produção (Railway)

API hospedada em: **https://zync-backend-production.up.railway.app**

Projeto Railway: `zync-backend` (conta `pdrgranps`). O banco passou a ser o Postgres do Supabase (fora do Railway) — é preciso configurar a variável `DATABASE_URL` no Railway apontando pra connection string do Supabase antes do próximo deploy (o serviço de MySQL antigo do Railway fica obsoleto após a migração).

O deploy **não é automático** (o serviço não está conectado ao GitHub) — pra subir uma alteração nova:

```
railway login        (uma vez, abre o navegador)
railway link         (uma vez, conecta esta pasta ao projeto zync-backend)
cd backend
railway up
```

Atenção: a conta está no plano trial (30 dias ou $5 de crédito). Depois disso é preciso assinar um plano pago pra manter os serviços no ar.
