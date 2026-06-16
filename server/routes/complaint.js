const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, roleMiddleware(['customer']), complaintController.createComplaint);
router.get('/', authMiddleware, complaintController.getComplaintList);
router.get('/:id', authMiddleware, complaintController.getComplaintDetail);
router.put('/:id/handle', authMiddleware, roleMiddleware(['production_supervisor', 'quality_inspector', 'finance']), complaintController.handleComplaint);

module.exports = router;
