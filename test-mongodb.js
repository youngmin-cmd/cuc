// MongoDB 연결 테스트 스크립트
const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB 연결 함수
async function testMongoDBConnection() {
  console.log('🔍 MongoDB 연결 테스트 시작...\n');

  try {
    // MongoDB 연결
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cuckoo_quotes', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB 연결 성공!');
    console.log(`📍 호스트: ${conn.connection.host}`);
    console.log(`📊 데이터베이스: ${conn.connection.name}`);
    console.log(`🔌 포트: ${conn.connection.port}\n`);

    // 데이터베이스 정보 조회
    const dbStats = await conn.connection.db.stats();
    console.log('📈 데이터베이스 통계:');
    console.log(`   - 컬렉션 수: ${dbStats.collections}`);
    console.log(`   - 데이터 크기: ${(dbStats.dataSize / 1024).toFixed(2)} KB`);
    console.log(`   - 저장소 크기: ${(dbStats.storageSize / 1024).toFixed(2)} KB\n`);

    // 컬렉션 목록 조회
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('📋 컬렉션 목록:');
    collections.forEach(collection => {
      console.log(`   - ${collection.name}`);
    });
    console.log('');

    // 연결 종료
    await mongoose.connection.close();
    console.log('🔌 MongoDB 연결이 정상적으로 종료되었습니다.');

  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    
    if (error.name === 'MongoNetworkError') {
      console.log('\n💡 해결 방법:');
      console.log('   1. MongoDB 서비스가 실행 중인지 확인하세요');
      console.log('   2. Docker를 사용하는 경우: docker-compose up -d');
      console.log('   3. 포트 27017이 사용 가능한지 확인하세요');
    }
    
    if (error.name === 'MongoServerSelectionError') {
      console.log('\n💡 해결 방법:');
      console.log('   1. MongoDB 서버가 실행 중인지 확인하세요');
      console.log('   2. 방화벽 설정을 확인하세요');
      console.log('   3. 연결 문자열을 확인하세요');
    }

    process.exit(1);
  }
}

// 스크립트 실행
if (require.main === module) {
  testMongoDBConnection();
}

module.exports = testMongoDBConnection; 