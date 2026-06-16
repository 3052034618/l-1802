const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, roleMiddleware(['customer']), orderController.createOrder);
router.get('/', authMiddleware, orderController.getOrderList);
router.get('/:id', authMiddleware, orderController.getOrderDetail);
router.put('/:id/status', authMiddleware, orderController.updateOrderStatus);
router.get('/designers/list', authMiddleware, orderController.getDesignerList);

module.exports = router;
