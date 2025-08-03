const express = require('express');
const Joi = require('joi');
const { authenticateToken, requireSales } = require('../middleware/auth');

const router = express.Router();

// 제품 카테고리 및 모델 정보 (실제로는 데이터베이스에서 관리)
const productCategories = [
  {
    id: 'water-purifier',
    name: '정수기',
    models: [
      { id: 'chp-242r', name: 'CHP-242R', basePrice: 50000 },
      { id: 'chp-242l', name: 'CHP-242L', basePrice: 45000 },
      { id: 'chp-242n', name: 'CHP-242N', basePrice: 48000 }
    ]
  },
  {
    id: 'air-purifier',
    name: '공기청정기',
    models: [
      { id: 'ap-1220r', name: 'AP-1220R', basePrice: 35000 },
      { id: 'ap-1220l', name: 'AP-1220L', basePrice: 32000 },
      { id: 'ap-1220n', name: 'AP-1220N', basePrice: 33000 }
    ]
  },
  {
    id: 'rice-cooker',
    name: '압력밥솥',
    models: [
      { id: 'crp-htr0609f', name: 'CRP-HTR0609F', basePrice: 25000 },
      { id: 'crp-htr0610f', name: 'CRP-HTR0610F', basePrice: 28000 },
      { id: 'crp-htr0611f', name: 'CRP-HTR0611F', basePrice: 30000 }
    ]
  },
  {
    id: 'steamer',
    name: '스팀오븐',
    models: [
      { id: 'cs-1001f', name: 'CS-1001F', basePrice: 40000 },
      { id: 'cs-1002f', name: 'CS-1002F', basePrice: 45000 },
      { id: 'cs-1003f', name: 'CS-1003F', basePrice: 50000 }
    ]
  }
];

// 제품 카테고리 목록 조회
router.get('/categories', authenticateToken, async (req, res) => {
  try {
    res.json({
      categories: productCategories.map(category => ({
        id: category.id,
        name: category.name,
        modelCount: category.models.length
      }))
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '제품 카테고리 조회 중 오류가 발생했습니다.'
    });
  }
});

// 특정 카테고리의 제품 모델 조회
router.get('/categories/:categoryId/models', authenticateToken, async (req, res) => {
  try {
    const { categoryId } = req.params;
    const category = productCategories.find(cat => cat.id === categoryId);

    if (!category) {
      return res.status(404).json({
        error: 'Not Found',
        message: '제품 카테고리를 찾을 수 없습니다.'
      });
    }

    res.json({
      category: {
        id: category.id,
        name: category.name
      },
      models: category.models
    });

  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '제품 모델 조회 중 오류가 발생했습니다.'
    });
  }
});

// 제품 검색
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, category } = req.query;

    let results = [];

    // 모든 제품 모델을 평면화
    productCategories.forEach(category => {
      category.models.forEach(model => {
        results.push({
          categoryId: category.id,
          categoryName: category.name,
          modelId: model.id,
          modelName: model.name,
          basePrice: model.basePrice
        });
      });
    });

    // 카테고리 필터
    if (category) {
      results = results.filter(product => product.categoryId === category);
    }

    // 검색어 필터
    if (q) {
      const searchTerm = q.toLowerCase();
      results = results.filter(product => 
        product.categoryName.toLowerCase().includes(searchTerm) ||
        product.modelName.toLowerCase().includes(searchTerm)
      );
    }

    res.json({
      query: { q, category },
      total: results.length,
      results
    });

  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '제품 검색 중 오류가 발생했습니다.'
    });
  }
});

// 제품 가격 계산기
router.post('/calculate-price', authenticateToken, requireSales, async (req, res) => {
  try {
    const { categoryId, modelId, quantity = 1, contractPeriod = 24 } = req.body;

    // 입력 검증
    const schema = Joi.object({
      categoryId: Joi.string().required(),
      modelId: Joi.string().required(),
      quantity: Joi.number().min(1).max(10),
      contractPeriod: Joi.number().min(12).max(60)
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    // 제품 정보 찾기
    const category = productCategories.find(cat => cat.id === categoryId);
    if (!category) {
      return res.status(404).json({
        error: 'Not Found',
        message: '제품 카테고리를 찾을 수 없습니다.'
      });
    }

    const model = category.models.find(m => m.id === modelId);
    if (!model) {
      return res.status(404).json({
        error: 'Not Found',
        message: '제품 모델을 찾을 수 없습니다.'
      });
    }

    // 가격 계산 로직
    let basePrice = model.basePrice;
    
    // 계약 기간에 따른 할인율
    let discountRate = 0;
    if (contractPeriod >= 36) {
      discountRate = 0.15; // 15% 할인
    } else if (contractPeriod >= 24) {
      discountRate = 0.10; // 10% 할인
    } else if (contractPeriod >= 18) {
      discountRate = 0.05; // 5% 할인
    }

    // 수량에 따른 할인율
    if (quantity >= 3) {
      discountRate += 0.05; // 추가 5% 할인
    } else if (quantity >= 2) {
      discountRate += 0.03; // 추가 3% 할인
    }

    const discountedPrice = Math.round(basePrice * (1 - discountRate));
    const totalPrice = discountedPrice * quantity;

    res.json({
      product: {
        categoryId: category.id,
        categoryName: category.name,
        modelId: model.id,
        modelName: model.name,
        basePrice: model.basePrice
      },
      calculation: {
        quantity,
        contractPeriod,
        discountRate: Math.round(discountRate * 100),
        discountedPrice,
        totalPrice
      },
      breakdown: {
        originalTotal: basePrice * quantity,
        discountAmount: (basePrice * quantity) - totalPrice,
        finalTotal: totalPrice
      }
    });

  } catch (error) {
    console.error('Calculate price error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '가격 계산 중 오류가 발생했습니다.'
    });
  }
});

// 제품 추천 (고객 정보 기반)
router.post('/recommendations', authenticateToken, requireSales, async (req, res) => {
  try {
    const { customerType, budget, preferences } = req.body;

    // 입력 검증
    const schema = Joi.object({
      customerType: Joi.string().valid('individual', 'family', 'business').required(),
      budget: Joi.number().min(20000).max(200000),
      preferences: Joi.array().items(Joi.string())
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    let recommendations = [];

    // 고객 유형별 추천 로직
    switch (customerType) {
      case 'individual':
        recommendations = [
          {
            categoryId: 'water-purifier',
            modelId: 'chp-242l',
            reason: '개인 사용자에게 적합한 컴팩트한 정수기',
            priority: 1
          },
          {
            categoryId: 'air-purifier',
            modelId: 'ap-1220l',
            reason: '개인 공간에 최적화된 공기청정기',
            priority: 2
          }
        ];
        break;

      case 'family':
        recommendations = [
          {
            categoryId: 'water-purifier',
            modelId: 'chp-242r',
            reason: '가족 사용에 적합한 대용량 정수기',
            priority: 1
          },
          {
            categoryId: 'rice-cooker',
            modelId: 'crp-htr0610f',
            reason: '가족을 위한 다기능 압력밥솥',
            priority: 2
          },
          {
            categoryId: 'air-purifier',
            modelId: 'ap-1220r',
            reason: '가족 공간에 적합한 대용량 공기청정기',
            priority: 3
          }
        ];
        break;

      case 'business':
        recommendations = [
          {
            categoryId: 'water-purifier',
            modelId: 'chp-242n',
            reason: '사무실 환경에 적합한 정수기',
            priority: 1
          },
          {
            categoryId: 'steamer',
            modelId: 'cs-1002f',
            reason: '업무용 다기능 스팀오븐',
            priority: 2
          }
        ];
        break;
    }

    // 예산 필터링
    if (budget) {
      recommendations = recommendations.filter(rec => {
        const model = productCategories
          .find(cat => cat.id === rec.categoryId)
          ?.models.find(m => m.id === rec.modelId);
        return model && model.basePrice <= budget;
      });
    }

    // 선호도 필터링
    if (preferences && preferences.length > 0) {
      recommendations = recommendations.filter(rec => 
        preferences.includes(rec.categoryId)
      );
    }

    // 제품 정보 추가
    const detailedRecommendations = recommendations.map(rec => {
      const category = productCategories.find(cat => cat.id === rec.categoryId);
      const model = category?.models.find(m => m.id === rec.modelId);
      
      return {
        ...rec,
        categoryName: category?.name,
        modelName: model?.name,
        basePrice: model?.basePrice
      };
    });

    res.json({
      customerType,
      budget,
      preferences,
      recommendations: detailedRecommendations
    });

  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '제품 추천 중 오류가 발생했습니다.'
    });
  }
});

// 제품 비교
router.post('/compare', authenticateToken, async (req, res) => {
  try {
    const { products } = req.body;

    // 입력 검증
    const schema = Joi.object({
      products: Joi.array().items(
        Joi.object({
          categoryId: Joi.string().required(),
          modelId: Joi.string().required()
        })
      ).min(2).max(4).required()
    });

    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.details[0].message
      });
    }

    const comparison = products.map(product => {
      const category = productCategories.find(cat => cat.id === product.categoryId);
      const model = category?.models.find(m => m.id === product.modelId);
      
      if (!category || !model) {
        return null;
      }

      return {
        categoryId: category.id,
        categoryName: category.name,
        modelId: model.id,
        modelName: model.name,
        basePrice: model.basePrice,
        features: getProductFeatures(category.id, model.id)
      };
    }).filter(Boolean);

    if (comparison.length !== products.length) {
      return res.status(400).json({
        error: 'Invalid Products',
        message: '일부 제품 정보를 찾을 수 없습니다.'
      });
    }

    res.json({
      comparison,
      summary: {
        priceRange: {
          min: Math.min(...comparison.map(p => p.basePrice)),
          max: Math.max(...comparison.map(p => p.basePrice))
        },
        categories: [...new Set(comparison.map(p => p.categoryName))]
      }
    });

  } catch (error) {
    console.error('Compare products error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '제품 비교 중 오류가 발생했습니다.'
    });
  }
});

// 제품 특징 정보 (실제로는 데이터베이스에서 관리)
function getProductFeatures(categoryId, modelId) {
  const features = {
    'water-purifier': {
      'chp-242r': ['대용량', 'UV 살균', '스마트 필터 교체 알림'],
      'chp-242l': ['컴팩트', '절전 모드', '간편한 필터 교체'],
      'chp-242n': ['사무실용', '고성능 필터', '자동 세척']
    },
    'air-purifier': {
      'ap-1220r': ['대용량', 'HEPA 필터', '스마트 센서'],
      'ap-1220l': ['컴팩트', '초음파 가습', '야간 모드'],
      'ap-1220n': ['사무실용', '정전기 필터', '조용한 운전']
    },
    'rice-cooker': {
      'crp-htr0609f': ['기본형', '압력 조리', '보온 기능'],
      'crp-htr0610f': ['다기능', '스팀 조리', '타이머'],
      'crp-htr0611f': ['프리미엄', 'IH 가열', '스마트 조리']
    },
    'steamer': {
      'cs-1001f': ['기본형', '스팀 조리', '타이머'],
      'cs-1002f': ['다기능', '오븐 기능', '디지털 제어'],
      'cs-1003f': ['프리미엄', '스마트 조리', 'WiFi 연결']
    }
  };

  return features[categoryId]?.[modelId] || [];
}

module.exports = router; 