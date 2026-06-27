const express = require('express');
const multer = require('multer');
const router = express.Router({ mergeParams: true });
const autenticar = require('../middleware/authMiddleware');
const whatsappController = require('../controllers/whatsappController');

const TIPOS_MIDIA_PERMITIDOS = [
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_MIDIA_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error('Tipo de arquivo não suportado'));
    }
    cb(null, true);
  },
});

router.use(autenticar);

router.post('/enviar', whatsappController.enviarManual);
router.post('/enviar-midia', upload.single('arquivo'), whatsappController.enviarMidiaManual);
router.get('/midia/:mensagemId', whatsappController.baixarMidia);

module.exports = router;
