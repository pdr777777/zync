jest.mock('../src/services/campanhaService', () => ({ disparar: jest.fn() }));
jest.mock('../src/config/sentry', () => ({ captureException: jest.fn() }));

const db = require('../src/config/db');
const jobModel = require('../src/models/jobModel');
const jobWorker = require('../src/jobs/jobWorker');
const campanhaService = require('../src/services/campanhaService');
const Sentry = require('../src/config/sentry');

afterAll(async () => {
  await db.end();
});

afterEach(async () => {
  await db.query('DELETE FROM jobs');
  campanhaService.disparar.mockReset();
  Sentry.captureException.mockReset();
});

describe('jobModel', () => {
  test('enfileirar cria um job pendente com o payload serializado', async () => {
    const id = await jobModel.enfileirar('tipo_teste', { foo: 'bar' });
    const { rows } = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);

    expect(rows[0].status).toBe('pendente');
    expect(rows[0].tentativas).toBe(0);
    expect(rows[0].payload).toEqual({ foo: 'bar' });
  });

  test('reivindicarProximo pega o job mais antigo pendente e marca como processando', async () => {
    const id = await jobModel.enfileirar('tipo_teste', { ordem: 1 });

    const job = await jobModel.reivindicarProximo();

    expect(job.id).toBe(id);
    expect(job.status).toBe('processando');
    expect(job.tentativas).toBe(1);
  });

  test('reivindicarProximo nao pega job ja processando nem agendado pro futuro', async () => {
    await db.query(
      "INSERT INTO jobs (tipo, payload, status) VALUES ('tipo_teste', '{}', 'processando')"
    );
    await db.query(
      "INSERT INTO jobs (tipo, payload, agendado_para) VALUES ('tipo_teste', '{}', NOW() + INTERVAL '1 hour')"
    );

    const job = await jobModel.reivindicarProximo();
    expect(job).toBeUndefined();
  });

  test('reivindicarProximo retorna undefined quando nao ha job pendente', async () => {
    const job = await jobModel.reivindicarProximo();
    expect(job).toBeUndefined();
  });

  test('marcarConcluido marca status e processado_em', async () => {
    const id = await jobModel.enfileirar('tipo_teste', {});
    await jobModel.marcarConcluido(id);

    const { rows } = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
    expect(rows[0].status).toBe('concluido');
    expect(rows[0].processado_em).not.toBeNull();
  });

  test('marcarFalhaOuReagendar reagenda quando ainda nao bateu o limite de tentativas', async () => {
    const id = await jobModel.enfileirar('tipo_teste', {});
    const job = await jobModel.reivindicarProximo();

    await jobModel.marcarFalhaOuReagendar(job, 'erro temporario');

    const { rows } = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
    expect(rows[0].status).toBe('pendente');
    expect(rows[0].erro).toBe('erro temporario');
    expect(new Date(rows[0].agendado_para).getTime()).toBeGreaterThan(Date.now());
  });

  test('marcarFalhaOuReagendar desiste quando bate o limite de tentativas', async () => {
    const id = await jobModel.enfileirar('tipo_teste', {});
    await db.query('UPDATE jobs SET tentativas = 2, max_tentativas = 3 WHERE id = $1', [id]);
    const job = await jobModel.reivindicarProximo();
    expect(job.tentativas).toBe(3);

    await jobModel.marcarFalhaOuReagendar(job, 'erro definitivo');

    const { rows } = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
    expect(rows[0].status).toBe('falhou');
    expect(rows[0].erro).toBe('erro definitivo');
  });
});

describe('jobWorker', () => {
  test('processarProximoJob processa um disparar_campanha e marca concluido', async () => {
    campanhaService.disparar.mockResolvedValue();
    const id = await jobModel.enfileirar('disparar_campanha', { tagId: 1 });

    const processou = await jobWorker.processarProximoJob();

    expect(processou).toBe(true);
    expect(campanhaService.disparar).toHaveBeenCalledWith({ tagId: 1 });

    const { rows } = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
    expect(rows[0].status).toBe('concluido');
  });

  test('processarProximoJob retorna false quando nao ha job', async () => {
    const processou = await jobWorker.processarProximoJob();
    expect(processou).toBe(false);
  });

  test('processarProximoJob reagenda e reporta no Sentry quando o handler lanca erro', async () => {
    campanhaService.disparar.mockRejectedValue(new Error('falha no envio'));
    const id = await jobModel.enfileirar('disparar_campanha', {});

    await jobWorker.processarProximoJob();

    expect(Sentry.captureException).toHaveBeenCalled();
    const { rows } = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
    expect(rows[0].status).toBe('pendente');
    expect(rows[0].erro).toBe('falha no envio');
  });

  test('job de tipo desconhecido falha sem derrubar o worker', async () => {
    const id = await jobModel.enfileirar('tipo_que_nao_existe', {});

    await jobWorker.processarProximoJob();

    const { rows } = await db.query('SELECT * FROM jobs WHERE id = $1', [id]);
    expect(rows[0].erro).toMatch(/tipo de job desconhecido/);
  });

  test('processarFilaCompleta processa todos os jobs pendentes em sequencia', async () => {
    campanhaService.disparar.mockResolvedValue();
    await jobModel.enfileirar('disparar_campanha', { n: 1 });
    await jobModel.enfileirar('disparar_campanha', { n: 2 });
    await jobModel.enfileirar('disparar_campanha', { n: 3 });

    await jobWorker.processarFilaCompleta();

    expect(campanhaService.disparar).toHaveBeenCalledTimes(3);
    const { rows } = await db.query("SELECT * FROM jobs WHERE status != 'concluido'");
    expect(rows).toHaveLength(0);
  });
});
