const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authMiddleware } = require('../middleware/auth');

router.post('/:type', authMiddleware, uploadController.upload.single('file'), uploadController.uploadFile);
router.post('/multiple/:type', authMiddleware, uploadController.upload.array('files', 10), uploadController.uploadMultipleFiles);
router.get('/download/*', authMiddleware, uploadController.downloadFile);
router.get('/download', authMiddleware, uploadController.downloadFile);
router.get('/preview/*', authMiddleware, uploadController.previewFile);
router.get('/preview', authMiddleware, uploadController.previewFile);

module.exports = router;
