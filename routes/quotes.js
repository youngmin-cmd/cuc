const express = require('express');
const Joi = require('joi');
const Quote = require('../models/Quote');
const { authenticateToken, requireSales, checkOwnership } = require('../middleware/auth');

const router = express.Router();

// 입력 검증 스키마
const quoteSchema = Joi.object({
  customer: Joi.object({
    name: Joi.string().required().messages({
      'any.required': '고객명은 필수입니다.'
    }),
    phone: Joi.string().allow(''),
    email: Joi.string().email().allow(''),
    address: Joi.string().allow('')
  }).required(),
  salesPhone: Joi.string().required().messages({
    'any.required': '담당자 연락처는 필수입니다.'
  }),
  quoteDate: Joi.date().default(Date.now),
  validUntil: Joi.date().required().messages({
    'any.required': '견적유효기간은 필수입니다.'
  }),
  description: Joi.string().allow(''),
  products: Joi.array().items(
    Joi.object({
      name: Joi.string().required().messages({
        'any.required': '제품군은 필수입니다.'
      }),
      model: Joi.string().required().messages({
        'any.required': '모델명은 필수입니다.'
      }),
      rentalFee: Joi.number().min(0).required().messages({
        'number.min': '렌탈료는 0 이상이어야 합니다.',
        'any.required': '렌탈료는 필수입니다.'
      }),
      usagePeriod: Joi.number().min(1).required().messages({
        'number.min': '의무기간은 1개월 이상이어야 합니다.',
        'any.required': '의무기간은 필수입니다.'
      }),
      contractPeriod: Joi.number().min(1).required().messages({
        'number.min': '계약기간은 1개월 이상이어야 합니다.',
        'any.required': '계약기간은 필수입니다.'
      }),
      quantity: Joi.number().min(1).required().messages({
        'number.min': '수량은 1개 이상이어야 합니다.',
        'any.required': '수량은 필수입니다.'
      })
    })
  ).min(1).required().messages({
    'array.min': '최소 1개 이상의 제품이 필요합니다.',
    'any.required': '제품 정보는 필수입니다.'
  }),
  notes: Joi.string().allow('')
});

// 견적서 생성
router.post('/', authenticateToken, requireSales, async (req, res) => {
  try {
    // 입력 검증
    const { error, value } = quoteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    // 제품별 총액 계산
    const productsWithTotal = value.products.map(product => ({
      ...product,
      total: product.rentalFee * product.quantity
    }));

    // 총 금액 계산
    const totalAmount = productsWithTotal.reduce((sum, product) => sum + product.total, 0);

    // 견적서 생성
    const quote = new Quote({
      ...value,
      products: productsWithTotal,
      totalAmount,
      salesPerson: req.user._id
    });

    await quote.save();

    // 생성된 견적서 조회 (populate 포함)
    const savedQuote = await Quote.findById(quote._id)
      .populate('salesPerson', 'username profile.name profile.phone');

    res.status(201).json({
      message: '견적서가 성공적으로 생성되었습니다.',
      quote: savedQuote
    });

  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '견적서 생성 중 오류가 발생했습니다.'
    });
  }
});

// 견적서 목록 조회
router.get('/', authenticateToken, requireSales, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // 필터 조건 구성
    const filter = { isActive: true };
    
    // 사용자별 필터 (관리자가 아닌 경우)
    if (req.user.role !== 'admin') {
      filter.salesPerson = req.user._id;
    }

    // 상태 필터
    if (status) {
      filter.status = status;
    }

    // 날짜 범위 필터
    if (startDate || endDate) {
      filter.quoteDate = {};
      if (startDate) filter.quoteDate.$gte = new Date(startDate);
      if (endDate) filter.quoteDate.$lte = new Date(endDate);
    }

    // 검색 필터
    if (search) {
      filter.$or = [
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } },
        { quoteNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    // 정렬 조건
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // 페이지네이션
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // 견적서 조회
    const quotes = await Quote.find(filter)
      .populate('salesPerson', 'username profile.name profile.phone')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // 전체 개수 조회
    const total = await Quote.countDocuments(filter);

    res.json({
      quotes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '견적서 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// 견적서 상세 조회
router.get('/:id', authenticateToken, requireSales, checkOwnership(Quote), async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id)
      .populate('salesPerson', 'username profile.name profile.phone profile.department profile.position');

    if (!quote) {
      return res.status(404).json({
        error: 'Not Found',
        message: '견적서를 찾을 수 없습니다.'
      });
    }

    res.json({
      quote
    });

  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '견적서 조회 중 오류가 발생했습니다.'
    });
  }
});

// 견적서 수정
router.put('/:id', authenticateToken, requireSales, checkOwnership(Quote), async (req, res) => {
  try {
    // 입력 검증
    const { error, value } = quoteSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    // 제품별 총액 계산
    const productsWithTotal = value.products.map(product => ({
      ...product,
      total: product.rentalFee * product.quantity
    }));

    // 총 금액 계산
    const totalAmount = productsWithTotal.reduce((sum, product) => sum + product.total, 0);

    // 견적서 업데이트
    const updatedQuote = await Quote.findByIdAndUpdate(
      req.params.id,
      {
        ...value,
        products: productsWithTotal,
        totalAmount
      },
      { new: true, runValidators: true }
    ).populate('salesPerson', 'username profile.name profile.phone');

    if (!updatedQuote) {
      return res.status(404).json({
        error: 'Not Found',
        message: '견적서를 찾을 수 없습니다.'
      });
    }

    res.json({
      message: '견적서가 성공적으로 수정되었습니다.',
      quote: updatedQuote
    });

  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '견적서 수정 중 오류가 발생했습니다.'
    });
  }
});

// 견적서 상태 변경
router.patch('/:id/status', authenticateToken, requireSales, checkOwnership(Quote), async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['draft', 'sent', 'accepted', 'rejected', 'expired'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid Status',
        message: '유효하지 않은 상태입니다.'
      });
    }

    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({
        error: 'Not Found',
        message: '견적서를 찾을 수 없습니다.'
      });
    }

    await quote.updateStatus(status);

    res.json({
      message: '견적서 상태가 성공적으로 변경되었습니다.',
      status: quote.status
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '견적서 상태 변경 중 오류가 발생했습니다.'
    });
  }
});

// 견적서 삭제 (소프트 삭제)
router.delete('/:id', authenticateToken, requireSales, checkOwnership(Quote), async (req, res) => {
  try {
    const quote = await Quote.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!quote) {
      return res.status(404).json({
        error: 'Not Found',
        message: '견적서를 찾을 수 없습니다.'
      });
    }

    res.json({
      message: '견적서가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '견적서 삭제 중 오류가 발생했습니다.'
    });
  }
});

// 견적서 통계
router.get('/stats/overview', authenticateToken, requireSales, async (req, res) => {
  try {
    const filter = { isActive: true };
    
    // 사용자별 필터 (관리자가 아닌 경우)
    if (req.user.role !== 'admin') {
      filter.salesPerson = req.user._id;
    }

    // 전체 견적서 수
    const totalQuotes = await Quote.countDocuments(filter);

    // 상태별 견적서 수
    const statusStats = await Quote.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 월별 견적서 생성 수 (최근 6개월)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Quote.aggregate([
      { $match: { ...filter, createdAt: { $gte: sixMonthsAgo } } },
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

    // 총 견적 금액
    const totalAmount = await Quote.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    res.json({
      totalQuotes,
      statusStats: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      monthlyStats,
      totalAmount: totalAmount[0]?.total || 0
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '통계 조회 중 오류가 발생했습니다.'
    });
  }
});

module.exports = router; 