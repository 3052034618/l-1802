const express = require('express');
const router = express.Router();
const dimensionController = require('../controllers/dimensionController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.get('/:orderId', authMiddleware, dimensionController.getDesignDimensions);
router.post('/', authMiddleware, roleMiddleware(['designer']), dimensionController.addDesignDimensions);

module.exports = router;
