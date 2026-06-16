const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/pay', authMiddleware, roleMiddleware(['customer']), paymentController.processPayment);
router.get('/:orderId', authMiddleware, paymentController.getPaymentRecord);

module.exports = router;
