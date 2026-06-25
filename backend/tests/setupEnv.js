process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-teste-jwt';
process.env.WHATSAPP_WEBHOOK_TOKEN = process.env.WHATSAPP_WEBHOOK_TOKEN || 'token-teste-whatsapp';
process.env.SYNCPAY_WEBHOOK_TOKEN = process.env.SYNCPAY_WEBHOOK_TOKEN || 'token-teste-syncpay';

// Integrações reais (disparam chamada externa de verdade) ficam sempre
// desligadas nos testes, mesmo que o .env local tenha valor configurado —
// dotenv não sobrescreve uma env var que já existe, então isso "vence".
process.env.SENTRY_DSN = '';
process.env.SENDGRID_API_KEY = '';
process.env.NTFY_TOPIC = '';
process.env.ANTHROPIC_API_KEY = '';
process.env.WHATSAPP_ACCESS_TOKEN = '';
process.env.WHATSAPP_PHONE_NUMBER_ID = '';
process.env.WHATSAPP_VERIFY_TOKEN = '';
process.env.WHATSAPP_APP_SECRET = '';
