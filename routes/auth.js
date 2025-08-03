const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// 입력 검증 스키마
const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(20).required()
    .messages({
      'string.alphanum': '사용자명은 영문자와 숫자만 사용 가능합니다.',
      'string.min': '사용자명은 최소 3자 이상이어야 합니다.',
      'string.max': '사용자명은 최대 20자까지 가능합니다.',
      'any.required': '사용자명은 필수입니다.'
    }),
  email: Joi.string().email().required()
    .messages({
      'string.email': '유효한 이메일 주소를 입력해주세요.',
      'any.required': '이메일은 필수입니다.'
    }),
  password: Joi.string().min(6).required()
    .messages({
      'string.min': '비밀번호는 최소 6자 이상이어야 합니다.',
      'any.required': '비밀번호는 필수입니다.'
    }),
  profile: Joi.object({
    name: Joi.string().required()
      .messages({
        'any.required': '이름은 필수입니다.'
      }),
    phone: Joi.string().allow(''),
    department: Joi.string().allow(''),
    position: Joi.string().allow('')
  }).required()
});

const loginSchema = Joi.object({
  username: Joi.string().required()
    .messages({
      'any.required': '사용자명은 필수입니다.'
    }),
  password: Joi.string().required()
    .messages({
      'any.required': '비밀번호는 필수입니다.'
    })
});

// 회원가입
router.post('/register', async (req, res) => {
  try {
    // 입력 검증
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const { username, email, password, profile } = value;

    // 중복 사용자 확인
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Duplicate User',
        message: '이미 존재하는 사용자명 또는 이메일입니다.'
      });
    }

    // 새 사용자 생성
    const user = new User({
      username,
      email,
      password,
      profile
    });

    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Duplicate User',
        message: '이미 존재하는 사용자명 또는 이메일입니다.'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: '회원가입 중 오류가 발생했습니다.'
    });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    // 입력 검증
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const { username, password } = value;

    // 사용자 찾기
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: '사용자명 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 계정 잠금 확인
    if (user.isLocked()) {
      return res.status(423).json({
        error: 'Account Locked',
        message: '계정이 잠겨있습니다. 잠시 후 다시 시도해주세요.'
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      return res.status(401).json({
        error: 'Invalid Credentials',
        message: '사용자명 또는 비밀번호가 올바르지 않습니다.'
      });
    }

    // 로그인 성공 시 시도 횟수 리셋
    await user.resetLoginAttempts();
    
    // 마지막 로그인 시간 업데이트
    user.lastLogin = new Date();
    await user.save();

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: '로그인이 완료되었습니다.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '로그인 중 오류가 발생했습니다.'
    });
  }
});

// 현재 사용자 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

// 비밀번호 변경
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: 'Missing Fields',
        message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: 'Invalid Password',
        message: '새 비밀번호는 최소 6자 이상이어야 합니다.'
      });
    }

    const user = await User.findById(req.user._id);
    
    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        error: 'Invalid Password',
        message: '현재 비밀번호가 올바르지 않습니다.'
      });
    }

    // 새 비밀번호 설정
    user.password = newPassword;
    await user.save();

    res.json({
      message: '비밀번호가 성공적으로 변경되었습니다.'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '비밀번호 변경 중 오류가 발생했습니다.'
    });
  }
});

// 로그아웃 (클라이언트에서 토큰 삭제)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    message: '로그아웃되었습니다.'
  });
});

module.exports = router; 