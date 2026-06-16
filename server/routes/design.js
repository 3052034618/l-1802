const express = require('express');
const router = express.Router();
const designController = require('../controllers/designController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, roleMiddleware(['designer']), designController.submitDesignPlan);
router.get('/', authMiddleware, designController.getDesignPlans);
router.get('/:id', authMiddleware, designController.getDesignPlanDetail);
router.put('/:id/confirm', authMiddleware, roleMiddleware(['customer']), designController.confirmDesignPlan);

module.exports = router;
