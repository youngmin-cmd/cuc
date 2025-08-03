const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT 토큰 검증 미들웨어
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access Denied',
        message: '액세스 토큰이 필요합니다.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: '유효하지 않은 토큰입니다.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Account Disabled',
        message: '비활성화된 계정입니다.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid Token',
        message: '유효하지 않은 토큰입니다.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token Expired',
        message: '토큰이 만료되었습니다.'
      });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '서버 오류가 발생했습니다.'
    });
  }
};

// 역할 기반 권한 확인 미들웨어
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '인증이 필요합니다.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: '이 작업을 수행할 권한이 없습니다.'
      });
    }

    next();
  };
};

// 관리자 권한 확인
const requireAdmin = authorizeRoles('admin');

// 판매자 권한 확인
const requireSales = authorizeRoles('admin', 'sales');

// 자원 소유자 확인 미들웨어
const checkOwnership = (model) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const resource = await model.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          error: 'Not Found',
          message: '요청하신 자원을 찾을 수 없습니다.'
        });
      }

      // 관리자는 모든 자원에 접근 가능
      if (req.user.role === 'admin') {
        req.resource = resource;
        return next();
      }

      // 자원 소유자 확인
      const ownerField = resource.salesPerson ? 'salesPerson' : 'user';
      if (resource[ownerField].toString() !== req.user._id.toString()) {
        return res.status(403).json({
          error: 'Forbidden',
          message: '이 자원에 접근할 권한이 없습니다.'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: '서버 오류가 발생했습니다.'
      });
    }
  };
};

// 요청 속도 제한 미들웨어
const rateLimiter = {
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100개 요청
  message: {
    error: 'Too Many Requests',
    message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  requireAdmin,
  requireSales,
  checkOwnership,
  rateLimiter
}; 