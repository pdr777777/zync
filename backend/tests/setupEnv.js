process.env.NODE_ENV = 'test';
process.env.WHATSAPP_WEBHOOK_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || 'token-teste-whatsapp';
process.env.SYNCPAY_WEBHOOK_TOKEN = process.env.SYNCPAY_WEBHOOK_TOKEN || 'token-teste-syncpay';

// Integrações reais (disparam chamada externa de verdade) ficam sempre
// desligadas nos testes, mesmo que o .env local tenha valor configurado —
// dotenv não sobrescreve uma env var que já existe, então isso "vence".
process.env.SENTRY_DSN = '';
process.env.SENDGRID_API_KEY = '';
process.env.NTFY_TOPIC = '';
