const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, notificationController.getNotificationList);
router.put('/:id/read', authMiddleware, notificationController.markAsRead);
router.put('/read/all', authMiddleware, notificationController.markAllAsRead);

module.exports = router;
