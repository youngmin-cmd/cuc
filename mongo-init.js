// MongoDB 초기화 스크립트
// 이 파일은 MongoDB 컨테이너가 처음 시작될 때 실행됩니다.

// cuckoo_quotes 데이터베이스 선택
db = db.getSiblingDB('cuckoo_quotes');

// 기본 관리자 사용자 생성
db.createUser({
  user: 'cuckoo_admin',
  pwd: 'cuckoo_admin_password',
  roles: [
    { role: 'readWrite', db: 'cuckoo_quotes' },
    { role: 'dbAdmin', db: 'cuckoo_quotes' }
  ]
});

// 기본 컬렉션 생성
db.createCollection('users');
db.createCollection('quotes');
db.createCollection('products');

// 인덱스 생성
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "role": 1 });

db.quotes.createIndex({ "quoteNumber": 1 }, { unique: true });
db.quotes.createIndex({ "customer.name": 1 });
db.quotes.createIndex({ "salesPerson": 1 });
db.quotes.createIndex({ "status": 1 });
db.quotes.createIndex({ "createdAt": -1 });

// 기본 관리자 계정 생성 (선택사항)
db.users.insertOne({
  username: 'admin',
  email: 'admin@cuckoo.com',
  password: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8i', // 'admin123'
  role: 'admin',
  profile: {
    name: '시스템 관리자',
    phone: '010-0000-0000'
  },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

// 기본 제품 데이터 생성 (선택사항)
db.products.insertMany([
  {
    name: '정수기',
    category: 'water-purifier',
    models: [
      { name: 'CUCKOO-001', rentalFee: 50000, usagePeriod: 24 },
      { name: 'CUCKOO-002', rentalFee: 60000, usagePeriod: 24 },
      { name: 'CUCKOO-003', rentalFee: 70000, usagePeriod: 24 }
    ],
    description: 'CUCKOO 정수기 제품군',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    name: '공기청정기',
    category: 'air-purifier',
    models: [
      { name: 'CUCKOO-AIR-001', rentalFee: 40000, usagePeriod: 24 },
      { name: 'CUCKOO-AIR-002', rentalFee: 50000, usagePeriod: 24 }
    ],
    description: 'CUCKOO 공기청정기 제품군',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

print('✅ MongoDB 초기화 완료!');
print('📊 데이터베이스: cuckoo_quotes');
print('👤 관리자 계정: admin / admin123');
print('🔗 연결 URL: mongodb://admin:password123@localhost:27017/cuckoo_quotes?authSource=admin'); 