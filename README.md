# THG Backoffice

Nền tảng vận hành nội bộ. Repo chứa **hai tiến trình độc lập**:

```bash
# terminal 1 — frontend
cd frontend && npm start        # :4200

# terminal 2 — backend
# chưa tồn tại, xem backend/README.md
```

```
├── frontend/     Angular 20 · toàn bộ giao diện
├── backend/      chưa có code — chỉ ghi contract phải hiện thực
└── vercel.json   deploy frontend dạng static SPA
```

---

## Đang tái cấu trúc

Nhánh `refactor/foundation-architecture` đang biến `frontend/` từ một app riêng
cho THG thành một **foundation tái sử dụng được** cho nhiều khách hàng.

Bốn điều kiện nghiệm thu đã khoá:

1. `frontend/libs/` chỉ giữ thứ có **bằng chứng** dùng chung ngoài một khách —
   nghiệp vụ chưa có bằng chứng thì nằm trong app của khách.
2. `ORG / UNIT / SELF` là primitive về **phạm vi truy cập**, không phải mô hình
   vai trò cố định; policy mở rộng được mà không sửa component.
3. Xoá hẳn `frontend/apps/backoffice/` thì `frontend/libs/` vẫn build và test xanh.
4. Có ít nhất một app khách thứ hai chạy được với theme, vai trò và điều hướng
   khác hẳn THG — chứng minh foundation không phụ thuộc THG.

Tài liệu kiến trúc đầy đủ: `frontend/README.md`.

Trong lúc chưa xong, `main` vẫn là bản chạy được.
