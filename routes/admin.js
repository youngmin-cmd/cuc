const express = require('express');
const User = require('../models/User');
const Quote = require('../models/Quote');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 대시보드 통계 (관리자 전용)
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // 전체 통계
    const totalUsers = await User.countDocuments();
    const totalQuotes = await Quote.countDocuments({ isActive: true });
    const totalAmount = await Quote.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    // 최근 활동
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username profile.name role createdAt');

    const recentQuotes = await Quote.find({ isActive: true })
      .populate('salesPerson', 'username profile.name')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('quoteNumber customer.name totalAmount status createdAt');

    // 월별 통계 (최근 6개월)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Quote.aggregate([
      { $match: { isActive: true, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // 상태별 견적서 통계
    const statusStats = await Quote.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 역할별 사용자 통계
    const roleStats = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]);

    // 판매자별 성과 (상위 5명)
    const topSalespeople = await Quote.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$salesPerson',
          totalQuotes: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          username: '$user.username',
          name: '$user.profile.name',
          totalQuotes: 1,
          totalAmount: 1
        }
      }
    ]);

    res.json({
      overview: {
        totalUsers,
        totalQuotes,
        totalAmount: totalAmount[0]?.total || 0
      },
      recentActivity: {
        users: recentUsers,
        quotes: recentQuotes
      },
      monthlyStats,
      statusStats: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      roleStats: roleStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      topSalespeople
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '대시보드 데이터 조회 중 오류가 발생했습니다.'
    });
  }
});

// 시스템 상태 확인
router.get('/system-status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = {
      database: 'connected',
      server: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    };

    // 데이터베이스 연결 상태 확인
    try {
      await User.findOne().limit(1);
      status.database = 'connected';
    } catch (error) {
      status.database = 'disconnected';
    }

    res.json(status);

  } catch (error) {
    console.error('Get system status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '시스템 상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// 데이터 백업 정보 (실제 백업은 별도 스크립트로 구현)
router.get('/backup-info', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const backupInfo = {
      lastBackup: null,
      nextBackup: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24시간 후
      backupSize: '0 MB',
      collections: ['users', 'quotes'],
      autoBackup: true,
      retentionDays: 30
    };

    res.json(backupInfo);

  } catch (error) {
    console.error('Get backup info error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '백업 정보 조회 중 오류가 발생했습니다.'
    });
  }
});

// 시스템 로그 (간단한 버전)
router.get('/logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { level = 'info', limit = 100 } = req.query;

    // 실제 구현에서는 로그 파일을 읽거나 로그 데이터베이스를 조회
    const logs = [
      {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: '서버가 정상적으로 시작되었습니다.',
        source: 'server'
      },
      {
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'info',
        message: '새로운 견적서가 생성되었습니다.',
        source: 'quotes'
      }
    ];

    res.json({
      logs: logs.slice(0, parseInt(limit)),
      total: logs.length
    });

  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '로그 조회 중 오류가 발생했습니다.'
    });
  }
});

// 관리자 설정 조회
router.get('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = {
      system: {
        maintenanceMode: false,
        allowRegistration: true,
        maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
        sessionTimeout: '24h'
      },
      email: {
        enabled: !!process.env.SMTP_HOST,
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT || 587
      },
      security: {
        passwordMinLength: 6,
        maxLoginAttempts: 5,
        lockoutDuration: '2h',
        requireEmailVerification: false
      },
      quotes: {
        defaultValidityDays: 30,
        autoExpire: true,
        allowMultipleProducts: true
      }
    };

    res.json(settings);

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '설정 조회 중 오류가 발생했습니다.'
    });
  }
});

// 관리자 설정 업데이트
router.put('/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { system, email, security, quotes } = req.body;

    // 실제 구현에서는 설정을 데이터베이스에 저장
    const updatedSettings = {
      system: { ...system },
      email: { ...email },
      security: { ...security },
      quotes: { ...quotes },
      updatedAt: new Date(),
      updatedBy: req.user._id
    };

    res.json({
      message: '설정이 성공적으로 업데이트되었습니다.',
      settings: updatedSettings
    });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '설정 업데이트 중 오류가 발생했습니다.'
    });
  }
});

// 데이터 내보내기 (견적서 데이터)
router.get('/export/quotes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;

    const filter = { isActive: true };
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const quotes = await Quote.find(filter)
      .populate('salesPerson', 'username profile.name')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      // CSV 형식으로 변환
      const csvData = quotes.map(quote => ({
        '견적서번호': quote.quoteNumber,
        '고객명': quote.customer.name,
        '담당자': quote.salesPerson?.profile?.name || '',
        '총금액': quote.totalAmount,
        '상태': quote.status,
        '견적일자': quote.quoteDate,
        '유효기간': quote.validUntil
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=quotes.csv');
      
      // CSV 헤더
      const headers = Object.keys(csvData[0]).join(',');
      const rows = csvData.map(row => Object.values(row).join(','));
      
      res.send([headers, ...rows].join('\n'));
    } else {
      // JSON 형식
      res.json({
        exportDate: new Date().toISOString(),
        totalRecords: quotes.length,
        data: quotes
      });
    }

  } catch (error) {
    console.error('Export quotes error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '데이터 내보내기 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 