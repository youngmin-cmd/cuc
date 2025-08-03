// API 설정 파일
const API_CONFIG = {
    // 로컬 개발 서버 URL (개발용)
    BASE_URL: 'http://localhost:3000/api',
    
    // 클라우드 서버 URL (프로덕션용) - 주석 처리
    // BASE_URL: 'https://api.cloudtype.io/api',
    
    // API 키 (JWT 토큰) - 로컬에서는 사용하지 않음
    // API_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJtZHV5dmg2cDE1OGY3OTYzIiwiaWF0IjoxNzU0MTgzMDU5fQ.6qG_RQyQa4CaINZib7G3RCQD75PZ9x_i6jRgZZQ5ds0',
    
    // API 엔드포인트
    ENDPOINTS: {
        // 인증 관련
        AUTH: {
            LOGIN: '/auth/login',
            REGISTER: '/auth/register',
            LOGOUT: '/auth/logout',
            ME: '/auth/me',
            CHANGE_PASSWORD: '/auth/change-password'
        },
        
        // 견적서 관련
        QUOTES: {
            CREATE: '/quotes',
            LIST: '/quotes',
            GET: '/quotes/:id',
            UPDATE: '/quotes/:id',
            DELETE: '/quotes/:id',
            STATS: '/quotes/stats/overview'
        },
        
        // 사용자 관리
        USERS: {
            LIST: '/users',
            GET: '/users/:id',
            UPDATE: '/users/:id',
            TOGGLE_STATUS: '/users/:id/toggle-status',
            CHANGE_ROLE: '/users/:id/role',
            STATS: '/users/stats/overview'
        },
        
        // 관리자 기능
        ADMIN: {
            DASHBOARD: '/admin/dashboard',
            SYSTEM_STATUS: '/admin/system-status',
            BACKUP_INFO: '/admin/backup-info',
            LOGS: '/admin/logs',
            SETTINGS: '/admin/settings'
        },
        
        // 제품 정보
        PRODUCTS: {
            CATEGORIES: '/products/categories',
            MODELS: '/products/categories/:categoryId/models',
            SEARCH: '/products/search',
            CALCULATE_PRICE: '/products/calculate-price',
            RECOMMENDATIONS: '/products/recommendations',
            COMPARE: '/products/compare'
        }
    },
    
    // HTTP 헤더 설정
    HEADERS: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

// API 요청 헬퍼 함수들
class ApiService {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.headers = { 
            ...API_CONFIG.HEADERS
            // 로컬 개발에서는 API 키를 사용하지 않음
            // 'Authorization': `Bearer ${API_CONFIG.API_KEY}`
        };
    }
    
    // JWT 토큰 설정 (사용자 로그인용)
    setAuthToken(token) {
        if (token) {
            // 로컬 개발에서는 사용자 토큰만 사용
            this.headers['Authorization'] = `Bearer ${token}`;
            localStorage.setItem('authToken', token);
        } else {
            // 토큰 제거
            delete this.headers['Authorization'];
            localStorage.removeItem('authToken');
        }
    }
    
    // 저장된 토큰 불러오기
    loadAuthToken() {
        const token = localStorage.getItem('authToken');
        if (token) {
            // 로컬 개발에서는 사용자 토큰만 사용
            this.headers['Authorization'] = `Bearer ${token}`;
        }
        return token;
    }
    
    // API 요청 실행
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.headers,
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            
            // 응답이 JSON이 아닌 경우 처리
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || `HTTP ${response.status}`);
                }
                
                return data;
            } else {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                return await response.text();
            }
        } catch (error) {
            console.error('API 요청 오류:', error);
            throw error;
        }
    }
    
    // GET 요청
    async get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }
    
    // POST 요청
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    // PUT 요청
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    // PATCH 요청
    async patch(endpoint, data) {
        return this.request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }
    
    // DELETE 요청
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

// 전역 API 서비스 인스턴스 생성
const apiService = new ApiService();

// 페이지 로드 시 저장된 토큰 불러오기
document.addEventListener('DOMContentLoaded', () => {
    apiService.loadAuthToken();
});

// 전역으로 사용할 수 있도록 window 객체에 추가
window.API_CONFIG = API_CONFIG;
window.apiService = apiService; 