# Backoffice Foundation

## 1. Repo này là gì

Nền tảng để dựng backoffice cho **nhiều dự án khác nhau**.

Nó không phải sản phẩm của một công ty. Nó là phần nền mà mọi backoffice đều
cần — danh tính, đăng nhập, phiên làm việc, khung điều hướng, hệ thống UI,
hợp đồng token — cộng với những ranh giới giữ cho phần nền đó **không bị nghiệp
vụ của khách hàng đầu tiên làm hỏng**.

Cách dùng: fork repo, thêm module nghiệp vụ của dự án vào đúng chỗ, đổi bản sắc
thương hiệu. Không sửa phần nền.

Repo chứa hai tiến trình độc lập:

```bash
cd frontend && npm start      # :4200   Angular 20
cd backend  && npm run dev    # :3000   NestJS 11 + PostgreSQL 17
```

---

## 2. Mô hình triển khai

```
Dự án A  →  deployment A  →  database A
Dự án B  →  deployment B  →  database B
```

Một deployment phục vụ **một** tổ chức. Database chính là ranh giới cô lập.

Đây không phải SaaS multi-tenant. Không có `tenant_id`, không có tenant
resolver, không có cross-tenant routing. Khi bạn thiết kế bảng cho dự án của
mình, đừng thêm cột "thuộc công ty nào" — nó luôn thừa, và một câu `WHERE` quên
mất nó là một vụ rò rỉ dữ liệu.

---

## 3. Cái gì thuộc về Foundation

Thứ gì **mọi** backoffice đều cần và **không** doanh nghiệp nào sở hữu riêng.

Phép thử: *"Dự án tiếp theo, ở một ngành hoàn toàn khác, có dùng lại nguyên si
thứ này không?"* Có ⇒ Foundation. Không ⇒ Project.

Phía backend, Foundation là `core/` (platform primitive) và `infrastructure/`
(adapter công nghệ: database, hạ tầng xác thực, health). Phía frontend là
`components/`, `services/`, `store/`, `styles/tokens/`, và khung `app/` — shell,
routing, điều hướng.

Phân quyền thuộc nhóm này. Nó là cơ chế nền tảng, không phải nghiệp vụ.

---

## 4. Cái gì thuộc về một Project

Mọi thứ mang tên, quy tắc, hay từ vựng của một khách hàng cụ thể.

Phía backend là `capabilities/` — module nghiệp vụ tự chứa. Phía frontend là
`features/` — màn hình và logic nghiệp vụ, cộng với `app/tenant/` (khách này là
ai) và `app/theme/` (khách này trông thế nào).

Ranh giới quan trọng nhất trong toàn bộ repo: **Foundation không chứa logic
nghiệp vụ của một Project cụ thể. Project được phép sử dụng và compose
Foundation.** Nếu `core/` biết tên một capability, foundation đã hết dùng lại
được cho dự án sau — và có script canh đúng điều đó.

### Quy tắc quyết định nhanh

Code trả lời câu hỏi nào?

- *"Mọi Backoffice đều cần điều này?"* → **Foundation**
- *"Project này cần điều này?"* → **Project**
- *"Khách hàng này muốn hành xử khác?"* → **cấu hình** của project hoặc của capability
- Code chứa tên hoặc nghiệp vụ cụ thể của khách hàng → **không được vào Foundation**

---

## 5. Đặt code mới ở đâu

**Module nghiệp vụ backend** → `backend/src/capabilities/<tên>/`

Một module NestJS tự chứa: controller, service, repository, migration riêng. Nó
được phép import `core/` và `common/`. Đấu dây tại `src/app.module.ts` — file
duy nhất biết toàn hệ thống.

**Feature nghiệp vụ frontend** → `frontend/features/<tên>/`

Bốn thư mục con, và ranh giới giữa chúng là thứ giữ cho feature test được:

```
domain/        model + quy tắc nghiệp vụ — không Angular, không UI
data-access/   nơi DUY NHẤT chạm backend
ui/            component câm của riêng feature này
feature/       trang smart theo persona
```

Feature không được import feature khác. Cần dùng chung thì đẩy xuống
`components/` nếu là UI thuần, hoặc `services/` nếu là cơ chế.

**Cấu hình dự án** → `frontend/app/tenant/`

`branding.ts` cho tên và monogram, `navigation.ts` cho sidebar chứa gì. Locale
và tiền tệ khai trong `app/app.config.ts`.

Thư mục mang tên `tenant/` là di sản. Đây **không** phải multi-tenant (§2) — nó
là cấu hình của một dự án. Tên nên đổi thành `project/`; chưa đổi.

**Bản sắc thị giác** → `frontend/app/theme/`

`_palette.scss` cho màu, `_type.scss` cho font và thang chữ. Component đọc
token, không đọc màu — nên đổi toàn bộ diện mạo không cần chạm một component
nào. Nếu bạn thấy mình phải sửa `components/`, tức là một giá trị thị giác đã
lọt vào chỗ không thuộc về nó.

**Nối vào API thật** → `frontend/app/app.config.ts`

Mọi repository đang bind vào fixture. Đổi `useClass` sang implementation gọi
HTTP là xong; không component nào bị sửa, vì không component nào biết nó đang
cầm implementation gì.

---

## 6. Cái gì KHÔNG BAO GIỜ được vào Foundation

**Từ vựng nghiệp vụ.** Không `customer`, `invoice`, `shipment`, `warehouse`.
Foundation nói bằng ngôn ngữ nền tảng: user, session, unit, record, scope.

**Quy tắc riêng của một khách hàng.** "Đơn trên 50 triệu phải giám đốc duyệt" là
quy tắc của một công ty, không phải của một nền tảng. Nó thuộc capability.

**`tenant_id`.** Xem §2. Một cột như vậy nghĩa là mô hình triển khai đã bị hiểu
sai, và nó sẽ lan ra mọi bảng, mọi truy vấn.

**Generic record engine.** Không `EntityTable<T>`, không `BusinessEntity`, không
workflow engine vạn năng. Những thứ đó ra đời từ phỏng đoán về nhu cầu tương
lai, và chúng luôn vừa quá phức tạp cho hôm nay vừa sai cho ngày mai. Foundation
chỉ nhận thứ đã có bằng chứng dùng chung.

---

## 7. Hiện đã dựng tới đâu

**Foundation hiện tại** — identity, authentication, users, sessions. Đăng nhập
bằng mật khẩu, phiên phía server, thu hồi được, có chống dò mật khẩu.

**Core roadmap** — organization, authorization, capability registry, và các
platform primitive tái sử dụng khác. Chúng là **module của Core**, sẽ nằm trong
`core/` khi được dựng.

Điểm này đáng nói rõ vì rất hay bị hiểu nhầm: **authorization không phải business
feature, cũng không phải phần customize của khách.** Cơ chế phân quyền — ai thấy
được bán kính dữ liệu nào — là thứ mọi backoffice đều cần và dùng lại nguyên si
giữa các dự án. Cái thuộc về khách hàng chỉ là *chính sách*: họ đặt tên vai trò
là gì, vai trò nào được cấp capability nào.

**Business modules** — không bao giờ thuộc Core. Chúng sống trong `capabilities/`
và `features/`, kể cả khi trông có vẻ dùng chung được.

Frontend hiện có shell hoàn chỉnh, bộ component, hợp đồng token, và ba feature
mẫu (organization, worklist, leads) chạy trên fixture. Ba feature đó là **ví dụ
tham khảo**, không phải phần bắt buộc — fork cho dự án mới thì xoá chúng đi.

---

## 8. Ranh giới bảo mật

Server là nơi thực thi. Client chỉ để không hiển thị ra thứ rồi phải giấu đi.
Luật phân quyền có mặt ở cả hai phía vì hai lý do khác nhau — và backend **không
import code từ frontend**; mỗi bên tự sở hữu phần thi hành của mình.

Phiên đăng nhập là token mờ phía server, không phải JWT. Database chỉ lưu băm
của token; token thô chỉ tồn tại trong cookie `HttpOnly`, `Secure` ở production,
`SameSite=Strict`. Không client nào có thể cất nó vào `localStorage`, vì không
client nào được cầm nó.

Mật khẩu băm bằng scrypt với tham số ghi kèm trong digest. Mọi lý do đăng nhập
hỏng đều trả về cùng một thông báo, nên endpoint không trở thành công cụ dò xem
tài khoản nào tồn tại. CORS **tắt mặc định** — deployment nào cần thì khai
origin cụ thể, và cấu hình từ chối `*` ngay lúc khởi động.

Khi bạn thêm capability: mọi endpoint đều phải tự khai guard. Không có guard
toàn cục âm thầm bảo vệ hộ bạn — sự vắng mặt của guard phải nhìn thấy được ngay
trên dòng phía trên handler, chỗ mà review nhìn vào.

---

## 9. Chạy cục bộ

```bash
cd backend
cp .env.example .env
npm run db:up          # PostgreSQL qua docker compose
npm run migrate
npm run dev
```

`db:up` chỉ là đường tiện nhất. Bất kỳ PostgreSQL 17 nào cũng chạy được, chỉ cần
`DATABASE_URL` trỏ đúng.

Tạo người dùng đầu tiên — không có endpoint tạo user, vì tạo user qua HTTP đòi
hỏi trả lời "ai được phép", mà đó chính là authorization:

```bash
npm run user:create -- --email a@b.c --name "A B"
```

Frontend dev chạy `:4200` gọi backend `:3000`, nên `.env` cần
`CORS_ORIGINS=http://localhost:4200`.

Migration là forward-only. Sửa sai bằng một file mới, không sửa file đã chạy —
runner lưu checksum và sẽ từ chối khởi động nếu file cũ bị đổi.

---

## 10. Kiểm tra kiến trúc

```bash
cd backend  && npm run check     # 7 ranh giới
cd frontend && npm run check     # 8 ranh giới
```

Hai script grep, không dependency, cắm thẳng vào CI. Chúng canh đúng những ranh
giới ở §3, §4 và §6: core không biết capability, core khai port còn
infrastructure viết adapter, foundation không mang từ vựng nghiệp vụ hay tên
khách hàng, màu thô chỉ sống trong token, feature không với sang feature khác.

Chạy chúng trước mỗi PR. Khi một trong hai báo đỏ, thứ hỏng gần như luôn là vị
trí của file mới — không phải bản thân đoạn code.

---

| Layer | Vai trò | Dùng lại? |
|---|---|:--:|
| `core/` | platform primitive | ✅ |
| `infrastructure/` | adapter công nghệ | ✅ |
| `components/` | UI dùng chung | ✅ |
| `capabilities/` | module nghiệp vụ của dự án | ❌ |
| `features/` | UI/nghiệp vụ của dự án | ❌ |
| `app/tenant/` | cấu hình khách hàng | ❌ |
| `app/theme/` | bản sắc thị giác của khách | ❌ |
