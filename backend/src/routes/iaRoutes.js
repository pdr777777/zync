const express = require('express');
const router = express.Router({ mergeParams: true });
const autenticar = require('../middleware/authMiddleware');
const iaController = require('../controllers/iaController');

router.use(autenticar);

router.post('/responder', iaController.responder);

module.exports = router;
