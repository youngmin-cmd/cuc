const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '제품군은 필수입니다.'],
    trim: true
  },
  model: {
    type: String,
    required: [true, '모델명은 필수입니다.'],
    trim: true
  },
  rentalFee: {
    type: Number,
    required: [true, '렌탈료는 필수입니다.'],
    min: [0, '렌탈료는 0 이상이어야 합니다.']
  },
  usagePeriod: {
    type: Number,
    required: [true, '의무기간은 필수입니다.'],
    min: [1, '의무기간은 1개월 이상이어야 합니다.']
  },
  contractPeriod: {
    type: Number,
    required: [true, '계약기간은 필수입니다.'],
    min: [1, '계약기간은 1개월 이상이어야 합니다.']
  },
  quantity: {
    type: Number,
    required: [true, '수량은 필수입니다.'],
    min: [1, '수량은 1개 이상이어야 합니다.']
  },
  total: {
    type: Number,
    required: true
  }
});

const quoteSchema = new mongoose.Schema({
  quoteNumber: {
    type: String,
    unique: true,
    required: true
  },
  customer: {
    name: {
      type: String,
      required: [true, '고객명은 필수입니다.'],
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  salesPerson: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, '담당자는 필수입니다.']
  },
  salesPhone: {
    type: String,
    required: [true, '담당자 연락처는 필수입니다.'],
    trim: true
  },
  quoteDate: {
    type: Date,
    required: [true, '견적일자는 필수입니다.'],
    default: Date.now
  },
  validUntil: {
    type: Date,
    required: [true, '견적유효기간은 필수입니다.']
  },
  description: {
    type: String,
    trim: true,
    default: '제품 설명 및 혜택이 입력되지 않았습니다.'
  },
  products: [productSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: [0, '총 금액은 0 이상이어야 합니다.']
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'rejected', 'expired'],
    default: 'draft'
  },
  notes: {
    type: String,
    trim: true
  },
  pdfUrl: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// 견적서 번호 자동 생성
quoteSchema.pre('save', async function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // 오늘 생성된 견적서 수 조회
    const todayQuotes = await this.constructor.countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });
    
    const sequence = String(todayQuotes + 1).padStart(3, '0');
    this.quoteNumber = `CQ-${year}${month}${day}-${sequence}`;
  }
  
  // 총 금액 계산
  if (this.products && this.products.length > 0) {
    this.totalAmount = this.products.reduce((sum, product) => sum + product.total, 0);
  }
  
  next();
});

// 견적서 만료 확인
quoteSchema.methods.isExpired = function() {
  return new Date() > this.validUntil;
};

// 견적서 상태 업데이트
quoteSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  if (newStatus === 'expired' && !this.isExpired()) {
    this.status = 'sent'; // 아직 유효한 경우 sent로 유지
  }
  return this.save();
};

// 검색 인덱스
quoteSchema.index({ 
  'customer.name': 'text', 
  'customer.email': 'text',
  quoteNumber: 'text',
  description: 'text'
});

// 복합 인덱스
quoteSchema.index({ salesPerson: 1, createdAt: -1 });
quoteSchema.index({ status: 1, validUntil: 1 });
quoteSchema.index({ quoteDate: -1 });

module.exports = mongoose.model('Quote', quoteSchema); 