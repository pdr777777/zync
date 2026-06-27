const app = require('./src/app');
const db = require('./src/config/db');
const { enviarLembretesPendentes } = require('./src/jobs/lembreteAgendamentoJob');
const { verificarAssinaturasExpiradas } = require('./src/jobs/verificarExpiracaoJob');
const { processarFilaCompleta } = require('./src/jobs/jobWorker');
const logger = require('./src/utils/logger');

if (process.env.NODE_ENV !== 'test' && (process.env.JWT_SECRET || '').length < 32) {
  logger.warn('JWT_SECRET ausente ou fraco (menos de 32 caracteres) — gere um valor forte e aleatório em produção');
}

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  logger.info('Zync API rodando', { porta: PORT });
});

const INTERVALO_LEMBRETES_MS = 15 * 60 * 1000;
function executarJobLembretes() {
  enviarLembretesPendentes().catch((err) => logger.error('Erro ao enviar lembretes de agendamento', err));
}
executarJobLembretes();
const lembreteIntervalId = setInterval(executarJobLembretes, INTERVALO_LEMBRETES_MS);

const INTERVALO_EXPIRACAO_MS = 60 * 60 * 1000;
function executarJobExpiracao() {
  verificarAssinaturasExpiradas().catch((err) => logger.error('Erro ao verificar assinaturas expiradas', err));
}
executarJobExpiracao();
const expiracaoIntervalId = setInterval(executarJobExpiracao, INTERVALO_EXPIRACAO_MS);

const INTERVALO_JOBS_MS = 5 * 1000;
function executarFilaDeJobs() {
  processarFilaCompleta().catch((err) => logger.error('Erro no worker de jobs', err));
}
executarFilaDeJobs();
const jobsIntervalId = setInterval(executarFilaDeJobs, INTERVALO_JOBS_MS);

function encerrarGraciosamente(sinal) {
  logger.info('Sinal recebido, encerrando requisições em andamento', { sinal });
  clearInterval(lembreteIntervalId);
  clearInterval(expiracaoIntervalId);
  clearInterval(jobsIntervalId);

  server.close(async () => {
    await db.end();
    logger.info('Encerrado');
    process.exit(0);
  });

  // Se alguma requisição travar e não terminar a tempo, força o encerramento
  // pra nao deixar o processo zumbi quando o Railway tentar matar de qualquer jeito.
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => encerrarGraciosamente('SIGTERM'));
process.on('SIGINT', () => encerrarGraciosamente('SIGINT'));
