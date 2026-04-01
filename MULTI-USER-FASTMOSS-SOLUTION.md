# 🔐 Giải Pháp Multi-User FastMoss

## 📋 Tình Huống Hiện Tại

- **Users:** 30-50 người
- **Đồng thời:** 10-20 người
- **Tài khoản FastMoss:** 2 premium
- **Vấn đề:** FastMoss kick user khi detect "thiết bị khác" đăng nhập

---

## 🧪 Test Cần Thực Hiện Trước

Trước khi implement giải pháp phức tạp, Phong cần test:

### Test 1: Shared Cookies từ nhiều IP

1. Máy A (IP 1): Mở app với cookies FastMoss → Dùng bình thường
2. Máy B (IP 2): Mở app với **cùng cookies** → Kiểm tra:
   - [ ] Cả 2 đều hoạt động bình thường?
   - [ ] Máy A bị kick ngay lập tức?
   - [ ] Máy A bị kick sau vài phút?
   - [ ] Không ai bị kick?

### Test 2: Cùng mạng LAN

1. 2 máy trong cùng office (cùng IP công cộng)
2. Dùng cùng cookies
3. Kiểm tra có bị kick không?

**Kết quả test sẽ quyết định giải pháp:**
- Nếu **không bị kick** → Single Window Mode hiện tại đã đủ
- Nếu **bị kick** → Cần implement proxy server

---

## 💡 Giải Pháp Đề Xuất

### Giải Pháp A: VPS Forward Proxy (Nếu bị kick)

```
┌─────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User 1 ─┐                                                  │
│   User 2 ─┼──► VPS Proxy ──► FastMoss                       │
│   ...     │    (1 IP)         (thấy 1 "thiết bị")           │
│   User 50─┘                                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Yêu cầu:**
- VPS với static IP (DigitalOcean/Vultr ~$5/tháng)
- Puppeteer/Playwright chạy trên VPS
- API server trả về data cho Electron app

**Ưu điểm:**
- Chắc chắn hoạt động
- FastMoss chỉ thấy 1 IP

**Nhược điểm:**
- Không có full FastMoss UI trong app
- Cần maintain server
- Chỉ có data, không có interaction

### Giải Pháp B: Browser Automation Server

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER SERVER                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   VPS chạy headless Chrome với FastMoss                     │
│   ├── Puppeteer control                                     │
│   ├── Screenshot/streaming UI                               │
│   └── Forward user actions                                  │
│                                                              │
│   Electron app hiển thị screenshots/stream từ VPS           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Đây là approach của:**
- Browserless.io
- Nstbrowser
- Remote browser services

**Ưu điểm:**
- Full UI experience
- 1 IP cho tất cả

**Nhược điểm:**
- Phức tạp implement
- Latency cao
- Resource intensive

### Giải Pháp C: Queue System (Đơn giản)

```
┌─────────────────────────────────────────────────────────────┐
│                    QUEUE SYSTEM                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User request FastMoss → Check queue → Grant/Deny          │
│                                                              │
│   Rules:                                                     │
│   - Max 2 concurrent users (= 2 TK premium)                 │
│   - Auto-release sau 10 phút idle                           │
│   - Notify khi đến lượt                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Implement:**
- Lark bot để quản lý queue
- Hoặc simple server với Redis

---

## 🚀 Roadmap Đề Xuất

### Phase 1: Test (Bây giờ)
- Test shared cookies từ nhiều IP
- Xác định FastMoss detect gì

### Phase 2: Dựa vào kết quả test
- **Không bị kick:** Deploy Single Window Mode (đã có)
- **Bị kick:** Implement Queue System (đơn giản nhất)

### Phase 3: Scale (Nếu cần)
- Upgrade lên VPS Proxy nếu queue system không đủ

---

## 📌 Action Items

1. [ ] Phong test shared cookies từ 2 máy khác IP
2. [ ] Report kết quả
3. [ ] Quyết định giải pháp

---

## 🔧 Code Sẵn Có

### Single Window Mode
Đã implement trong v1.2.0:
- `electron/main.ts`: Shared session partition
- `FASTMOSS_PARTITION = 'persist:fastmoss-shared'`

### Queue System (Mẫu)
```typescript
// Có thể implement trong main.ts
const fastmossQueue = new Map<string, { userId: string; startTime: number }>();
const MAX_CONCURRENT = 2;

function canUseFastMoss(userId: string): boolean {
  // Clean expired sessions (10 min idle)
  const now = Date.now();
  for (const [id, session] of fastmossQueue) {
    if (now - session.startTime > 10 * 60 * 1000) {
      fastmossQueue.delete(id);
    }
  }
  
  // Check if user already has session
  if (fastmossQueue.has(userId)) return true;
  
  // Check if slot available
  if (fastmossQueue.size < MAX_CONCURRENT) {
    fastmossQueue.set(userId, { userId, startTime: now });
    return true;
  }
  
  return false;
}
```

---

Sau khi có kết quả test, tôi sẽ implement giải pháp cụ thể!
