# Backend — chưa tồn tại

Thư mục này cố ý còn trống. Chưa có một dòng code backend nào, và chưa chọn stack.

Nó tồn tại để đánh dấu ranh giới: **frontend chạy ở terminal 1, backend chạy ở
terminal 2**, hai tiến trình độc lập, không chia sẻ build.

```bash
# terminal 1
cd frontend && npm start        # :4200

# terminal 2 — khi backend tồn tại
cd backend  && npm run dev
```

---

## 1. Điểm đấu nối duy nhất

Frontend chưa gọi HTTP một lần nào. Mọi dữ liệu đi qua abstract repository được
bind vào fixture tại **một file duy nhất**:

```
frontend/projects/backoffice/src/app/app.config.ts
```

Lên API thật = đổi `useClass: Fixture*` → `Http*` trong file đó. Không một
component nào bị sửa, vì không component nào biết nó đang cầm implementation gì.

## 2. Năm contract backend phải hiện thực

| Contract | Method | Vị trí |
|---|---|---|
| `SessionRepository` | `current()` · `personas()` · `switchPersona(userId)` | `platform/domain/src/lib/session/` |
| `DepartmentRepository` | `list()` · `members(departmentId)` | `platform/domain/src/lib/org/` |
| `OverviewRepository` | `organizationMetrics(user)` · `departmentMetrics(user, id)` · `approvals(user)` · `activity(user)` · `suggestions(user, id?)` | `capabilities/workspace/src/lib/data-access/` |
| `WorkItemRepository` | `list(user, query)` | `capabilities/worklist/src/lib/data-access/` |
| `PotentialCustomerRepository` | `list(user, query)` · `pool(user, deptId)` · `workload(user, deptId)` · `assign(user, customerId, assigneeId)` | `capabilities/potential-customers/src/lib/data-access/` |

*(Đường dẫn tính từ `frontend/projects/`. Chúng sẽ đổi trong quá trình tái cấu
trúc — xem plan; tên contract thì không đổi.)*

**Mọi method đều nhận `user: UserContext` làm tham số đầu tiên.** Đây không phải
tình cờ — chữ ký được thiết kế sẵn để server tự scope dữ liệu theo người gọi.

## 3. Luật phân quyền server BẮT BUỘC thi hành lại

Frontend có bản sao các luật này, nhưng **chỉ để không render ra rồi phải giấu
đi**. Server mới là nơi chốt. Client không bao giờ là điểm thực thi.

| Tầng | Câu hỏi | Luật |
|---|---|---|
| **L1 — đơn vị** | Người này vào được đơn vị nào? | `ORG` → tất cả · `UNIT`/`SELF` → chỉ đơn vị của mình |
| **L2 — bản ghi** | Trong một đơn vị, đọc được dòng nào? | `ORG` → mọi bản ghi · `UNIT` → mọi bản ghi của đơn vị · `SELF` → chỉ bản ghi gán cho mình |
| **Ghi** | Ai được gán việc cho người khác? | chỉ `ORG` và `UNIT` |

Luật viết dưới dạng hàm thuần, không phụ thuộc Angular, tại:

```
frontend/libs/core/access/rules/        (sau tái cấu trúc)
```

**Nếu backend viết bằng TypeScript: import thẳng thư mục đó, không chép tay.**
Chép tay là cách chắc chắn nhất để hai bên lệch nhau sau vài tháng.

Nếu backend dùng ngôn ngữ khác, thư mục đó là đặc tả tham chiếu — mỗi thay đổi
luật phải sửa cả hai phía trong cùng một PR.

## 4. Chưa quyết định

Stack, cách xác thực, schema. Ba việc đó chỉ nên chốt khi bắt đầu viết backend
thật, không phải bây giờ.

Một điều đã chốt: **Backoffice không đăng nhập ai cả** — gateway/SSO làm việc đó,
`SessionRepository.current()` là ranh giới. Xem `session.repository.ts:4-7`.
