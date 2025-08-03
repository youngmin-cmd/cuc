# Cuckoo 견적서 백엔드 API 서버

쿠쿠 견적서 애플리케이션을 위한 RESTful API 백엔드 서버입니다.

## 🚀 주요 기능

- **사용자 인증 및 권한 관리**
  - JWT 기반 인증
  - 역할 기반 접근 제어 (관리자, 판매자, 일반 사용자)
  - 계정 잠금 기능

- **견적서 관리**
  - 견적서 생성, 조회, 수정, 삭제
  - 다중 제품 견적서 지원
  - 견적서 상태 관리 (초안, 발송, 승인, 거절, 만료)
  - 견적서 번호 자동 생성

- **데이터 검증 및 보안**
  - 입력 데이터 검증 (Joi)
  - 비밀번호 해싱 (bcrypt)
  - 요청 속도 제한
  - CORS 설정

- **통계 및 분석**
  - 견적서 통계 대시보드
  - 월별/상태별 분석
  - 사용자별 성과 추적

## 📋 기술 스택

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose ODM)
- **Authentication**: JWT
- **Validation**: Joi
- **Security**: Helmet, bcryptjs
- **Logging**: Morgan

## 🛠️ 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp env.example .env
```

`.env` 파일을 편집하여 필요한 설정을 입력하세요:

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/cuckoo_quotes
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:5500
```

### 3. 데이터베이스 설정

MongoDB가 설치되어 있어야 합니다. 로컬 MongoDB 또는 MongoDB Atlas를 사용할 수 있습니다.

### 4. 서버 실행

**개발 모드:**
```bash
npm run dev
```

**프로덕션 모드:**
```bash
npm start
```

서버가 `http://localhost:3000`에서 실행됩니다.

## 📚 API 문서

### 인증 API

#### 회원가입
```
POST /api/auth/register
Content-Type: application/json

{
  "username": "salesperson1",
  "email": "sales@cuckoo.com",
  "password": "password123",
  "profile": {
    "name": "김판매",
    "phone": "010-1234-5678",
    "department": "영업팀",
    "position": "대리"
  }
}
```

#### 로그인
```
POST /api/auth/login
Content-Type: application/json

{
  "username": "salesperson1",
  "password": "password123"
}
```

### 견적서 API

#### 견적서 생성
```
POST /api/quotes
Authorization: Bearer <token>
Content-Type: application/json

{
  "customer": {
    "name": "홍길동",
    "phone": "010-9876-5432",
    "email": "hong@example.com"
  },
  "salesPhone": "010-1234-5678",
  "validUntil": "2024-02-15",
  "description": "정수기 및 공기청정기 패키지",
  "products": [
    {
      "name": "정수기",
      "model": "CUCKOO CHP-242R",
      "rentalFee": 50000,
      "usagePeriod": 24,
      "contractPeriod": 36,
      "quantity": 1
    }
  ]
}
```

#### 견적서 목록 조회
```
GET /api/quotes?page=1&limit=10&status=sent&search=홍길동
Authorization: Bearer <token>
```

#### 견적서 상세 조회
```
GET /api/quotes/:id
Authorization: Bearer <token>
```

#### 견적서 수정
```
PUT /api/quotes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  // 견적서 데이터
}
```

#### 견적서 상태 변경
```
PATCH /api/quotes/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "sent"
}
```

#### 견적서 삭제
```
DELETE /api/quotes/:id
Authorization: Bearer <token>
```

#### 견적서 통계
```
GET /api/quotes/stats/overview
Authorization: Bearer <token>
```

## 🔐 권한 시스템

### 사용자 역할

- **admin**: 모든 기능 접근 가능
- **sales**: 견적서 생성/관리 가능
- **user**: 기본 사용자 권한

### API 권한

- 인증이 필요한 API: `Authorization: Bearer <token>` 헤더 필요
- 관리자 전용 API: `admin` 역할 필요
- 판매자 API: `admin` 또는 `sales` 역할 필요

## 📊 데이터 모델

### User (사용자)
```javascript
{
  username: String,        // 사용자명 (고유)
  email: String,          // 이메일 (고유)
  password: String,       // 해시된 비밀번호
  role: String,           // 역할 (user, sales, admin)
  profile: {
    name: String,         // 이름
    phone: String,        // 연락처
    department: String,   // 부서
    position: String      // 직급
  },
  isActive: Boolean,      // 활성 상태
  lastLogin: Date,        // 마지막 로그인
  loginAttempts: Number,  // 로그인 시도 횟수
  lockUntil: Date         // 계정 잠금 시간
}
```

### Quote (견적서)
```javascript
{
  quoteNumber: String,    // 견적서 번호 (자동 생성)
  customer: {
    name: String,         // 고객명
    phone: String,        // 고객 연락처
    email: String,        // 고객 이메일
    address: String       // 고객 주소
  },
  salesPerson: ObjectId,  // 담당자 (User 참조)
  salesPhone: String,     // 담당자 연락처
  quoteDate: Date,        // 견적일자
  validUntil: Date,       // 견적유효기간
  description: String,    // 제품 설명
  products: [{
    name: String,         // 제품군
    model: String,        // 모델명
    rentalFee: Number,    // 렌탈료
    usagePeriod: Number,  // 의무기간
    contractPeriod: Number, // 계약기간
    quantity: Number,     // 수량
    total: Number         // 소계
  }],
  totalAmount: Number,    // 총 금액
  status: String,         // 상태 (draft, sent, accepted, rejected, expired)
  notes: String,          // 비고
  pdfUrl: String,         // PDF 파일 URL
  isActive: Boolean       // 활성 상태
}
```

## 🧪 테스트

```bash
npm test
```

## 📝 로그

서버 로그는 다음 위치에서 확인할 수 있습니다:
- 개발 모드: 콘솔 출력
- 프로덕션 모드: `./logs/app.log`

## 🔧 개발 가이드

### 새로운 라우터 추가

1. `routes/` 디렉토리에 새 라우터 파일 생성
2. `server.js`에 라우터 등록
3. 필요한 미들웨어 및 권한 설정

### 새로운 모델 추가

1. `models/` 디렉토리에 새 모델 파일 생성
2. 스키마 정의 및 인덱스 설정
3. 필요한 메서드 추가

### 환경별 설정

- **개발**: `NODE_ENV=development`
- **테스트**: `NODE_ENV=test`
- **프로덕션**: `NODE_ENV=production`

## 🚀 배포

### Docker 사용

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### 클라우드 배포

- **Heroku**: `git push heroku main`
- **AWS**: Elastic Beanstalk 또는 EC2
- **Google Cloud**: App Engine 또는 Compute Engine
- **Azure**: App Service

## 📞 지원

문제가 발생하거나 질문이 있으시면 이슈를 생성해주세요.

## 📄 라이선스

MIT License
