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

Roda automaticamente no CI (`.github/workflows/test.yml`) em todo push/PR pra `main`, usando o secret `DATABASE_URL` do GitHub.

## Rotas

| Rota | Auth | Descrição |
|---|---|---|
| `POST /api/auth/register` / `/login` | Não | Cadastro e login (JWT) |
| `GET/POST /api/leads`, `GET/PUT/DELETE /api/leads/:id` | Sim | CRUD de leads |
| `GET/POST /api/leads/:leadId/mensagens` | Sim | Histórico de conversa do lead |
| `GET /api/dashboard` | Sim | Métricas (leads, conversões, mensagens, % IA) |
| `POST /api/leads/:leadId/ia/responder` | Sim | IA de atendimento (ver `src/services/iaService.js`) |
| `POST /api/leads/:leadId/whatsapp/enviar` | Sim | Envio manual de mensagem (ver `src/services/whatsappService.js`) |
| `POST /api/webhooks/whatsapp/:usuarioId` | Bearer token (`WHATSAPP_WEBHOOK_TOKEN`) | Webhook genérico p/ receber mensagem já normalizada (`{telefone, nome, mensagem}`) — uso interno/teste |
| `GET/POST /api/webhooks/whatsapp-meta` | Verify token / assinatura HMAC | Webhook real do WhatsApp Cloud API (Meta) — ver seção própria abaixo |
| `GET /health` | Não | Health check (testa conexão com o banco) — usado por uptime monitor |

## Integrações externas

| Serviço | Status |
|---|---|
| E-mail (`src/services/emailService.js`) | Real via SendGrid — precisa de `SENDGRID_API_KEY` e `EMAIL_FROM` (e-mail verificado em Single Sender Verification). Sem essas variáveis, cai no mock (`console.log`) — é o que acontece localmente/nos testes. |
| Pagamento (`src/services/syncpayService.js`) | Real, já configurado em produção (`SYNCPAY_*`). |
| WhatsApp (`src/services/whatsappService.js`) | Real via WhatsApp Cloud API (Meta) — precisa de `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID` (envio) e `WHATSAPP_VERIFY_TOKEN`/`WHATSAPP_APP_SECRET` (recebimento, ver seção abaixo). Sem essas variáveis, cai no mock (`console.log`/webhook bloqueado) — é o que acontece localmente/nos testes. |
| IA de atendimento (`src/services/iaService.js`) | Real via Claude (Anthropic) — precisa de `ANTHROPIC_API_KEY` (console.anthropic.com). Sem ela, cai no mock por palavra-chave — é o que acontece localmente/nos testes. Se a chamada à API falhar por qualquer motivo, também cai no mock em vez de quebrar o atendimento. |

### Webhook de recebimento do WhatsApp (Meta Cloud API)

Pra mensagens de cliente chegarem de verdade no Zync (não só o envio), precisa
cadastrar o webhook no painel da Meta:

1. **Meta for Developers** → seu app → **WhatsApp** → **Configuration**
2. **Callback URL**: `https://<seu-backend>/api/webhooks/whatsapp-meta`
3. **Verify token**: o mesmo valor que você colocar em `WHATSAPP_VERIFY_TOKEN`
4. Clica em **Verify and save** (a Meta faz uma chamada `GET` nesse momento — é
   o handshake de verificação, ver `whatsappMetaWebhookController.verificar`)
5. Assina o campo (`field`) **messages**

Cada mensagem recebida depois disso vem assinada com `X-Hub-Signature-256`
(HMAC-SHA256 usando o **App Secret** do app — `WHATSAPP_APP_SECRET`), validado
em `whatsappMetaWebhookController.receber` antes de processar qualquer coisa.

Como a Meta chama essa mesma URL pra todos os números/tenants (não tem
`usuarioId` na URL), cada usuário precisa ter o próprio
`whatsapp_phone_number_id` (o "Phone number ID" da Meta, não o número de
telefone) salvo na tabela `usuarios` — é assim que o webhook descobre de qual
conta é a mensagem recebida.

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
- **Atividade do negócio**: novo cadastro, login e pagamento aprovado disparam
  um push via [ntfy.sh](https://ntfy.sh) (ver `src/utils/ntfy.js`, chamado em
  `authController.js` e `syncpayWebhookController.js`). Só ativa se a env var
  `NTFY_TOPIC` estiver configurada. Pra receber no celular: instala o app
  ntfy (iOS/Android), assina o mesmo tópico configurado em `NTFY_TOPIC` — sem
  precisar criar conta. É um serviço público por tópico (quem souber o nome
  do tópico recebe as mensagens), por isso o nome deve ser longo e aleatório,
  nunca algo previsível como `zync` ou `alertas`.

## CORS

A API só aceita requisições de origens na variável `FRONTEND_URL` (separadas
por vírgula se for mais de um domínio) + `localhost:5500`/`127.0.0.1:5500`
pra desenvolvimento local. Origem fora da lista recebe `403`. Pra liberar um
novo domínio (ex: deploy alternativo do Vercel), adiciona ele na lista do
Railway:

```
railway variables --set "FRONTEND_URL=https://dominio-1.vercel.app,https://dominio-2.vercel.app" --environment production
```

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
