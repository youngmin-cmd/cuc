# MongoDB 설치 및 연결 가이드

## 🎯 개요
이 가이드는 Cuckoo 견적서 시스템의 백엔드 서버에서 MongoDB를 사용하는 방법을 설명합니다.

## 📥 MongoDB 설치

### 1. Windows에서 MongoDB 설치

#### 1.1 MongoDB Community Server 설치
1. **MongoDB 공식 사이트 방문**: https://www.mongodb.com/try/download/community
2. **다운로드 옵션 선택**:
   - Version: 최신 버전 (현재 7.0.x)
   - Platform: Windows
   - Package: MSI
3. **설치 파일 실행**:
   ```bash
   # 다운로드한 .msi 파일을 관리자 권한으로 실행
   ```

#### 1.2 설치 과정
1. **라이선스 동의**: MongoDB Server Side Public License 동의
2. **설치 유형 선택**: "Complete" 선택 (권장)
3. **설치 경로**: 기본 경로 사용 (C:\Program Files\MongoDB\Server\7.0\)
4. **MongoDB Compass 설치**: GUI 도구 설치 여부 선택 (권장)
5. **설치 완료**: "Install MongoDB as a Service" 체크 확인

#### 1.3 설치 확인
```bash
# 명령 프롬프트에서 확인
mongod --version
mongo --version
```

### 2. Docker를 사용한 MongoDB 설치 (권장)

#### 2.1 Docker 설치
1. **Docker Desktop 다운로드**: https://www.docker.com/products/docker-desktop
2. **설치 및 실행**: Docker Desktop 실행
3. **설치 확인**:
   ```bash
   docker --version
   docker-compose --version
   ```

#### 2.2 MongoDB 컨테이너 실행
```bash
# MongoDB 컨테이너 실행
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  -v mongodb_data:/data/db \
  mongo:latest

# 컨테이너 상태 확인
docker ps

# MongoDB 로그 확인
docker logs mongodb
```

#### 2.3 Docker Compose 사용 (권장)
`docker-compose.yml` 파일 생성:
```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:latest
    container_name: cuckoo_mongodb
    restart: always
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: cuckoo_quotes
    volumes:
      - mongodb_data:/data/db
      - ./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro

volumes:
  mongodb_data:
```

실행:
```bash
docker-compose up -d
```

## 🔗 MongoDB 연결 설정

### 1. 환경 변수 설정

#### 1.1 .env 파일 생성
프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가:

```env
# MongoDB 연결 설정
MONGODB_URI=mongodb://localhost:27017/cuckoo_quotes

# Docker 사용 시 (인증 포함)
MONGODB_URI=mongodb://admin:password123@localhost:27017/cuckoo_quotes?authSource=admin

# MongoDB Atlas 사용 시 (클라우드)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/cuckoo_quotes?retryWrites=true&w=majority

# 연결 옵션
MONGODB_OPTIONS={
  "useNewUrlParser": true,
  "useUnifiedTopology": true,
  "maxPoolSize": 10,
  "serverSelectionTimeoutMS": 5000,
  "socketTimeoutMS": 45000
}
```

### 2. 백엔드 서버에서 MongoDB 연결

#### 2.1 config/database.js 확인
```javascript
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB 연결 성공: ${conn.connection.host}`);
    
    // 연결 이벤트 리스너
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB 연결 오류:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB 연결 해제됨');
    });

    // 프로세스 종료 시 연결 정리
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB 연결이 정상적으로 종료되었습니다.');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
```

#### 2.2 server.js에서 연결 호출
```javascript
const connectDB = require('./config/database');

// 서버 시작 전 MongoDB 연결
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
    });
  })
  .catch((error) => {
    console.error('❌ 서버 시작 실패:', error);
    process.exit(1);
  });
```

## 🛠️ MongoDB 관리 도구

### 1. MongoDB Compass (GUI 도구)
1. **설치**: MongoDB 설치 시 함께 설치되거나 별도 다운로드
2. **연결**: `mongodb://localhost:27017` 입력
3. **데이터베이스 생성**: `cuckoo_quotes` 데이터베이스 생성
4. **컬렉션 관리**: 사용자, 견적서 등 컬렉션 생성 및 관리

### 2. MongoDB Shell (명령줄 도구)
```bash
# MongoDB Shell 실행
mongosh

# 데이터베이스 목록 확인
show dbs

# 데이터베이스 선택
use cuckoo_quotes

# 컬렉션 목록 확인
show collections

# 데이터 조회
db.users.find()
db.quotes.find()

# 데이터베이스 통계
db.stats()
```

### 3. Docker 컨테이너 내부 접속
```bash
# MongoDB 컨테이너에 접속
docker exec -it mongodb mongosh

# 또는 특정 데이터베이스로 직접 접속
docker exec -it mongodb mongosh cuckoo_quotes
```

## 📊 데이터 모델 확인

### 1. 사용자 모델 (User)
```javascript
// models/User.js
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin', 'sales'], default: 'user' },
  profile: {
    name: String,
    phone: String,
    address: String
  },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date
}, {
  timestamps: true
});
```

### 2. 견적서 모델 (Quote)
```javascript
// models/Quote.js
const quoteSchema = new mongoose.Schema({
  quoteNumber: { type: String, unique: true },
  customer: {
    name: { type: String, required: true },
    phone: String,
    address: String
  },
  salesPerson: { type: String, required: true },
  salesPhone: String,
  quoteDate: { type: Date, default: Date.now },
  validUntil: { type: Date, required: true },
  description: String,
  products: [{
    name: { type: String, required: true },
    model: String,
    rentalFee: { type: Number, required: true },
    usagePeriod: { type: Number, required: true },
    contractPeriod: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    total: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['draft', 'sent', 'accepted', 'rejected'], default: 'draft' },
  notes: String,
  pdfUrl: String,
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});
```

## 🔍 데이터베이스 쿼리 예제

### 1. 사용자 관련 쿼리
```javascript
// 모든 사용자 조회
const users = await User.find();

// 활성 사용자만 조회
const activeUsers = await User.find({ isActive: true });

// 관리자 사용자 조회
const admins = await User.find({ role: 'admin' });

// 특정 사용자 조회
const user = await User.findOne({ username: 'testuser' });

// 사용자 생성
const newUser = new User({
  username: 'newuser',
  email: 'newuser@example.com',
  password: 'hashedPassword',
  role: 'user'
});
await newUser.save();
```

### 2. 견적서 관련 쿼리
```javascript
// 모든 견적서 조회
const quotes = await Quote.find();

// 최근 견적서 조회 (최신 10개)
const recentQuotes = await Quote.find()
  .sort({ createdAt: -1 })
  .limit(10);

// 특정 고객의 견적서 조회
const customerQuotes = await Quote.find({
  'customer.name': '홍길동'
});

// 대기 중인 견적서 조회
const pendingQuotes = await Quote.find({ status: 'draft' });

// 금액별 견적서 조회 (100만원 이상)
const expensiveQuotes = await Quote.find({
  totalAmount: { $gte: 1000000 }
});
```

## 🚨 문제 해결

### 1. 연결 오류 해결
```bash
# MongoDB 서비스 상태 확인 (Windows)
services.msc
# MongoDB 서비스 찾아서 시작

# Docker 컨테이너 상태 확인
docker ps -a
docker logs mongodb

# 포트 사용 확인
netstat -an | findstr 27017
```

### 2. 권한 오류 해결
```javascript
// MongoDB 연결 문자열에 인증 정보 추가
const MONGODB_URI = 'mongodb://username:password@localhost:27017/database?authSource=admin';
```

### 3. 성능 최적화
```javascript
// 인덱스 생성
await User.createIndex({ username: 1 });
await User.createIndex({ email: 1 });
await Quote.createIndex({ quoteNumber: 1 });
await Quote.createIndex({ 'customer.name': 1 });
await Quote.createIndex({ createdAt: -1 });
```

## 📈 모니터링 및 백업

### 1. 데이터베이스 모니터링
```javascript
// 연결 상태 모니터링
mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB 연결됨');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB 오류:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ MongoDB 연결 해제됨');
});
```

### 2. 데이터 백업 (Docker)
```bash
# MongoDB 데이터 백업
docker exec mongodb mongodump --out /data/backup

# 백업 파일 복사
docker cp mongodb:/data/backup ./backup

# 데이터 복원
docker exec mongodb mongorestore /data/backup
```

## 🎯 다음 단계

1. **데이터베이스 초기화**: `npm run dev`로 서버 실행
2. **API 테스트**: `API_테스트.html`에서 기능 테스트
3. **데이터 확인**: MongoDB Compass에서 실제 데이터 확인
4. **성능 모니터링**: 쿼리 성능 및 연결 상태 모니터링

이제 MongoDB가 완전히 설정되어 Cuckoo 견적서 시스템의 데이터를 안전하게 저장하고 관리할 수 있습니다! 