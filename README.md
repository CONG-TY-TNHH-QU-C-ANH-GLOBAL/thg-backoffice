# Backoffice Foundation

Nền tảng backoffice dùng lại được cho nhiều dự án. Repo chứa **hai tiến trình
độc lập**:

```bash
# terminal 1 — frontend
cd frontend && npm start        # :4200

# terminal 2 — backend
cd backend  && npm run dev      # :3000
```

```
├── frontend/     Angular 20 · giao diện · FROZEN
├── backend/      NestJS 11 + PostgreSQL 17 · FROZEN
└── vercel.json   deploy frontend dạng static SPA
```

Hai bên không chia sẻ build, và **backend không import source code từ
frontend**. Luật phân quyền có mặt ở cả hai phía vì hai lý do khác nhau: phía
client để không render ra thứ rồi phải giấu đi, phía server để thực thi. Server
mới là nơi chốt.

---

## Một deployment = một database

```
Công ty A  →  deployment A  →  database A
Công ty B  →  deployment B  →  database B
```

**Không phải SaaS multi-tenant.** Không có `tenant_id` ở bất kỳ đâu. Database là
ranh giới cô lập.

## Trạng thái

Cả hai phía đã đóng băng ở mức foundation. Chưa có module nghiệp vụ nào, và đó
là kết quả đúng — foundation phải dùng được khi chưa cài capability nào.

| | Có gì | Chưa có |
|---|---|---|
| **frontend** | component, token contract, navigation, access scope, ba feature mẫu | — |
| **backend** | identity, user, session, migration, health | phân quyền, đơn vị tổ chức, vai trò, audit, file, thông báo |

`backend/src/capabilities/` rỗng có chủ đích: đó là chỗ module nghiệp vụ của
từng dự án sẽ nằm, và nó chỉ nhận thứ đã có bằng chứng dùng chung, không nhận
abstraction đoán trước.

Chi tiết: [`backend/README.md`](backend/README.md) ·
[`frontend/README.md`](frontend/README.md)

## Ranh giới được canh bằng máy

```bash
cd backend && npm run check      # 7 ranh giới kiến trúc, 0 dependency
```

Quan trọng nhất trong đó: `core` không bao giờ được biết tên một capability, và
`core` khai *port* còn `infrastructure` viết *adapter*. Foundation biết tên một
module nghiệp vụ là foundation hết dùng lại được cho dự án sau.

Frontend có checker riêng: `frontend/scripts/check-architecture.sh`.
