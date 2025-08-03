const express = require('express');
const Joi = require('joi');
const User = require('../models/User');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 입력 검증 스키마
const updateUserSchema = Joi.object({
  profile: Joi.object({
    name: Joi.string().trim(),
    phone: Joi.string().trim(),
    department: Joi.string().trim(),
    position: Joi.string().trim()
  }),
  role: Joi.string().valid('user', 'sales', 'admin'),
  isActive: Joi.boolean()
});

// 사용자 목록 조회 (관리자 전용)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      role,
      search,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // 필터 조건 구성
    const filter = {};
    
    if (role) {
      filter.role = role;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // 검색 필터
    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { 'profile.name': { $regex: search, $options: 'i' } },
        { 'profile.department': { $regex: search, $options: 'i' } }
      ];
    }

    // 정렬 조건
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // 페이지네이션
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 사용자 조회
    const users = await User.find(filter)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // 전체 개수 조회
    const total = await User.countDocuments(filter);

    res.json({
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 상세 조회
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 조회 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 정보 수정 (관리자 전용)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // 입력 검증
    const { error, value } = updateUserSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      value,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      message: '사용자 정보가 성공적으로 수정되었습니다.',
      user
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 정보 수정 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 비활성화/활성화 (관리자 전용)
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 자기 자신을 비활성화할 수 없음
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Invalid Operation',
        message: '자기 자신을 비활성화할 수 없습니다.'
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      message: `사용자가 성공적으로 ${user.isActive ? '활성화' : '비활성화'}되었습니다.`,
      isActive: user.isActive
    });

  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 역할 변경 (관리자 전용)
router.patch('/:id/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !['user', 'sales', 'admin'].includes(role)) {
      return res.status(400).json({
        error: 'Invalid Role',
        message: '유효하지 않은 역할입니다.'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    // 자기 자신의 역할을 변경할 수 없음
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        error: 'Invalid Operation',
        message: '자기 자신의 역할을 변경할 수 없습니다.'
      });
    }

    user.role = role;
    await user.save();

    res.json({
      message: '사용자 역할이 성공적으로 변경되었습니다.',
      role: user.role
    });

  } catch (error) {
    console.error('Change user role error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 역할 변경 중 오류가 발생했습니다.'
    });
  }
});

// 사용자 통계 (관리자 전용)
router.get('/stats/overview', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // 전체 사용자 수
    const totalUsers = await User.countDocuments();

    // 역할별 사용자 수
    const roleStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // 활성/비활성 사용자 수
    const activeUsers = await User.countDocuments({ isActive: true });
    const inactiveUsers = totalUsers - activeUsers;

    // 최근 가입자 수 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentUsers = await User.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // 마지막 로그인 통계
    const lastLoginStats = await User.aggregate([
      { $match: { lastLogin: { $exists: true } } },
      {
        $group: {
          _id: {
            year: { $year: '$lastLogin' },
            month: { $month: '$lastLogin' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 6 }
    ]);

    res.json({
      totalUsers,
      roleStats: roleStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      activeUsers,
      inactiveUsers,
      recentUsers,
      lastLoginStats
    });

  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 통계 조회 중 오류가 발생했습니다.'
    });
  }
});

// 내 정보 수정 (자신의 정보만)
router.put('/me/profile', authenticateToken, async (req, res) => {
  try {
    const { profile } = req.body;

    // 프로필 정보만 수정 가능
    const updateData = {};
    if (profile) {
      if (profile.name) updateData['profile.name'] = profile.name;
      if (profile.phone) updateData['profile.phone'] = profile.phone;
      if (profile.department) updateData['profile.department'] = profile.department;
      if (profile.position) updateData['profile.position'] = profile.position;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      message: '프로필 정보가 성공적으로 수정되었습니다.',
      user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '프로필 정보 수정 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 