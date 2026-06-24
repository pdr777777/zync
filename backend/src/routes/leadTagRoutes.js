const express = require('express');
const router = express.Router({ mergeParams: true });
const autenticar = require('../middleware/authMiddleware');
const tagController = require('../controllers/tagController');

router.use(autenticar);

router.get('/', tagController.listarDoLead);
router.post('/', tagController.associarAoLead);
router.delete('/:tagId', tagController.desassociarDoLead);

module.exports = router;
