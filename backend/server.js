const app = require('./src/app');
const db = require('./src/config/db');
const { enviarLembretesPendentes } = require('./src/jobs/lembreteAgendamentoJob');
const { verificarAssinaturasExpiradas } = require('./src/jobs/verificarExpiracaoJob');

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`Zync API rodando na porta ${PORT}`);
});

const INTERVALO_LEMBRETES_MS = 15 * 60 * 1000;
function executarJobLembretes() {
  enviarLembretesPendentes().catch((err) => console.error('Erro ao enviar lembretes de agendamento:', err.message));
}
executarJobLembretes();
const lembreteIntervalId = setInterval(executarJobLembretes, INTERVALO_LEMBRETES_MS);

const INTERVALO_EXPIRACAO_MS = 60 * 60 * 1000;
function executarJobExpiracao() {
  verificarAssinaturasExpiradas().catch((err) => console.error('Erro ao verificar assinaturas expiradas:', err.message));
}
executarJobExpiracao();
const expiracaoIntervalId = setInterval(executarJobExpiracao, INTERVALO_EXPIRACAO_MS);

function encerrarGraciosamente(sinal) {
  console.log(`${sinal} recebido, encerrando requisições em andamento...`);
  clearInterval(lembreteIntervalId);
  clearInterval(expiracaoIntervalId);

  server.close(async () => {
    await db.end();
    console.log('Encerrado.');
    process.exit(0);
  });

  // Se alguma requisição travar e não terminar a tempo, força o encerramento
  // pra nao deixar o processo zumbi quando o Railway tentar matar de qualquer jeito.
  setTimeout(() => process.exit(1), 10000);
}

process.on('SIGTERM', () => encerrarGraciosamente('SIGTERM'));
process.on('SIGINT', () => encerrarGraciosamente('SIGINT'));
