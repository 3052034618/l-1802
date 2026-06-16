const { verifyToken } = require('../utils/auth');
const { error } = require('../utils/response');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json(error('请先登录', 401));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json(error('登录已过期，请重新登录', 401));
  }

  req.user = decoded;
  next();
};

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json(error('权限不足', 403));
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  roleMiddleware
};
