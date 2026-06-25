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
| `GET /health` | Não | Health check (testa conexão com o banco) — usado por uptime monitor |

## Integrações externas

| Serviço | Status |
|---|---|
| E-mail (`src/services/emailService.js`) | Real via SendGrid — precisa de `SENDGRID_API_KEY` e `EMAIL_FROM` (e-mail verificado em Single Sender Verification). Sem essas variáveis, cai no mock (`console.log`) — é o que acontece localmente/nos testes. |
| Pagamento (`src/services/syncpayService.js`) | Real, já configurado em produção (`SYNCPAY_*`). |
| WhatsApp (`src/services/whatsappService.js`) | Mock — webhook recebe mensagens reais, mas o envio ainda não chama nenhuma API real (Meta Cloud API/Twilio). |
| IA de atendimento (`src/services/iaService.js`) | Mock — resposta por palavra-chave, não é um LLM real. |
| Alerta push (`src/services/ntfyService.js`) | Real via [ntfy.sh](https://ntfy.sh) — manda notificação (sem dado pessoal) em cadastro, login e pagamento confirmado. Precisa de `NTFY_TOPIC`. O tópico funciona como uma "senha" fraca (quem souber o nome recebe as notificações também) — por isso a mensagem nunca inclui e-mail, nome ou valor. |

## Monitoramento

- **Erros**: `@sentry/node` captura exceções não tratadas e erros 500/503
  automaticamente (ver `src/middleware/errorMiddleware.js` e
  `src/config/sentry.js`). Só ativa se a env var `SENTRY_DSN` estiver
  configurada — sem ela, fica desligado (padrão em dev/teste). Pra ativar em
  produção: cria um projeto Node/Express grátis em sentry.io, pega o DSN, e
  configura `SENTRY_DSN` no Railway (`railway variables --set "SENTRY_DSN=..."`).
  Configura os alertas de e-mail/Slack direto no painel do Sentry.
- **Uptime**: `GET /health` retorna `200 {"status":"ok"}` se a API e o banco
  estiverem respondendo (ou `503` se o banco estiver fora). Pra monitorar:
  cria uma conta grátis no UptimeRobot (ou similar), aponta um monitor HTTP
  pra `https://zync-backend-production.up.railway.app/health` a cada 5 min,
  e configura o contato de alerta (e-mail/Discord/Slack).

## Produção (Railway)

API hospedada em: **https://zync-backend-production.up.railway.app**

Projeto Railway: `zync-backend` (conta `pdrgranps`). O banco é o Postgres do
Supabase (fora do Railway), via variável `DATABASE_URL`.

O deploy **não é automático** (o serviço não está conectado ao GitHub) — pra subir uma alteração nova:

```
railway login        (uma vez, abre o navegador)
railway link         (uma vez, conecta esta pasta ao projeto zync-backend)
cd backend
railway up
```

Atenção: a conta está no plano trial (30 dias ou $5 de crédito). Depois disso é preciso assinar um plano pago pra manter os serviços no ar.

### Staging

Staging usa o mesmo projeto Railway e o mesmo Supabase de produção, só que
num schema separado (`zync_staging` — ver `database/README.md`). Pra criar
o ambiente staging no Railway (ainda não criado, faz quando for usar):

```
cd backend
railway environment create staging --duplicate production
railway variables --set "PG_SCHEMA=zync_staging" --environment staging
railway up --environment staging --detach
```

Isso duplica as variáveis de produção (incluindo a mesma `DATABASE_URL`) e
soma um serviço rodando 24/7 a mais — consome crédito/horas do Railway além
da produção. Pra desligar quando não precisar mais:

```
railway environment delete staging --yes
```
