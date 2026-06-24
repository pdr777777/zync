const express = require('express');
const router = express.Router({ mergeParams: true });
const whatsappController = require('../controllers/whatsappController');

router.post('/', whatsappController.receberMensagem);

module.exports = router;
