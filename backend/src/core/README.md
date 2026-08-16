# `core/` — Backoffice Foundation

Thứ **mọi** Backoffice cần, không phụ thuộc doanh nghiệp nào.

```
core/
├── identity/        ai đang gọi · session · current context
├── users/           user là một identity trong deployment
├── organization/    organizational unit + membership (một aggregate)
├── authorization/   permission registry · role · scope · guard
└── capabilities/    CƠ CHẾ đăng ký/bật-tắt capability — không phải capability nào cả
```

## Ba luật

**1. `core/` không bao giờ import `capabilities/`.**
Chiều ngược lại thì được. Core mà biết tên một capability là core đã hỏng.

**2. `core/` không bao giờ import `infrastructure/`.**
Core định nghĩa **port** (interface); `infrastructure/` viết **adapter**; `app.module.ts`
đấu dây. Nếu `core/identity` import `infrastructure/auth`, thì đổi từ mật khẩu sang
OIDC phải mổ vào foundation — đúng thứ ranh giới này sinh ra để ngăn.

**3. Không từ vựng nghiệp vụ.**
Không customer, order, product, invoice, shipment. Không tên phòng ban. Không tên
vai trò của một công ty cụ thể. Những thứ đó là dữ liệu hoặc capability.

## Chưa có gì ở đây

Phase 0 chỉ dựng hạ tầng. Module đầu tiên xuất hiện ở Phase 1 (identity).
Thư mục này tồn tại để ranh giới nhìn thấy được từ commit đầu, không phải để lấp chỗ.
