const express = require('express');
const router = express.Router();
const autenticar = require('../middleware/authMiddleware');
const exigirAdmin = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

router.use(autenticar, exigirAdmin);

router.get('/usuarios', adminController.listarUsuarios);
router.patch('/usuarios/:id/admin', adminController.definirAdmin);
router.get('/metricas', adminController.metricas);
router.get('/planos', adminController.listarPlanos);
router.post('/planos', adminController.criarPlano);
router.put('/planos/:id', adminController.atualizarPlano);
router.get('/suporte', adminController.listarSuporte);
router.patch('/suporte/:id/respondida', adminController.responderSuporte);

module.exports = router;
