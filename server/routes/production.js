const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/schedule', authMiddleware, roleMiddleware(['production_supervisor']), productionController.scheduleProduction);
router.put('/:id/progress', authMiddleware, roleMiddleware(['production_supervisor']), productionController.updateProductionProgress);
router.get('/', authMiddleware, productionController.getProductionOrderList);
router.get('/:id', authMiddleware, productionController.getProductionOrderDetail);
router.get('/workshop/capacity', authMiddleware, roleMiddleware(['production_supervisor']), productionController.getWorkshopCapacity);

router.post('/quality', authMiddleware, roleMiddleware(['quality_inspector']), productionController.createQualityInspection);
router.get('/quality/list', authMiddleware, productionController.getQualityInspectionList);

module.exports = router;
