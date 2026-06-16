const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { success, error } = require('../utils/response');
const config = require('../config');

const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const qualityDir = path.join(uploadDir, 'quality');
const voucherDir = path.join(uploadDir, 'vouchers');
const designDir = path.join(uploadDir, 'designs');
[qualityDir, voucherDir, designDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const type = req.params.type || 'general';
    let dir = uploadDir;
    if (type === 'quality') dir = qualityDir;
    else if (type === 'voucher') dir = voucherDir;
    else if (type === 'design') dir = designDir;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}_${random}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.json(error('请上传文件'));
    }

    const type = req.params.type || 'general';
    const fileUrl = `/uploads/${type}/${req.file.filename}`;
    const fullUrl = `${req.protocol}://${req.get('host')}${fileUrl}`;

    res.json(success({
      filename: req.file.filename,
      originalName: req.file.originalname,
      url: fileUrl,
      fullUrl,
      size: req.file.size,
      mimetype: req.file.mimetype
    }, '文件上传成功'));
  } catch (err) {
    console.error('文件上传错误:', err);
    res.json(error(err.message || '文件上传失败'));
  }
};

const uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json(error('请上传文件'));
    }

    const type = req.params.type || 'general';
    const files = req.files.map(file => {
      const fileUrl = `/uploads/${type}/${file.filename}`;
      return {
        filename: file.filename,
        originalName: file.originalname,
        url: fileUrl,
        fullUrl: `${req.protocol}://${req.get('host')}${fileUrl}`,
        size: file.size,
        mimetype: file.mimetype
      };
    });

    res.json(success(files, '文件上传成功'));
  } catch (err) {
    console.error('多文件上传错误:', err);
    res.json(error(err.message || '文件上传失败'));
  }
};

module.exports = {
  upload,
  uploadFile,
  uploadMultipleFiles
};
