# Backoffice Foundation — Frontend

Angular 20, zoneless, signals. Đọc [`../README.md`](../README.md) trước — file
đó nói cái gì thuộc Foundation, cái gì thuộc Project, và đặt code mới ở đâu.
File này chỉ nói những thứ riêng của frontend.

```bash
npm start           # dev server :4200
npm run build
npm test            # cần Chrome
npm run check       # 8 ranh giới kiến trúc
```

---

## Hai ý tưởng mọi thứ khác đi ra từ đó

**1. Đơn vị tổ chức là dữ liệu, capability là code.**

```
Đơn vị              bản ghi runtime   (fixture hôm nay, API ngày mai — không hardcode)
Capability          module dùng lại   (đăng ký qua DI)
Đơn vị × Capability cấu hình
```

Không chỗ nào trong nền tảng biết tên một phòng ban cụ thể. Thêm một đơn vị vào
nguồn dữ liệu thì nó xuất hiện ở điều hướng, routing, danh bạ và dashboard —
không sửa component nào.

**2. Vai trò *chọn* workspace, không *ẩn* nút.**

Mỗi persona được resolve sang một component riêng sau cùng một URL, do
`WorkspaceHost` quyết định. Một member không có nút "Phân công" để ẩn, vì không
có bề mặt phân công nào được đăng ký cho persona đó ngay từ đầu.

Đây là khác biệt đáng giữ: ẩn nút là bảo mật bằng CSS. Không đăng ký bề mặt thì
không có gì để ẩn.

---

## Hai tầng truy cập, cố ý không gộp

**L1 — đơn vị.** Người này vào được đơn vị nào? Trả lời bởi `AccessService`.

**L2 — bản ghi.** Trong một đơn vị, đọc được dòng nào? Trả lời bởi
`canSeeRecord()`, áp dụng trong repository.

Gộp hai tầng thành một "scope" xếp hạng chính là đường dẫn tới lỗi kinh điển:
dashboard dùng chung cho mọi người rồi lọc bằng UI. Chúng ở lại là hai hàm
riêng, test riêng.

Luật viết dưới dạng **hàm thuần** trong `services/access/rules/` — không
Angular, không rxjs, có script canh (R3). Backend **chép lại** logic này, không
import; hai bên tự sở hữu phần thi hành của mình.

`SUPERADMIN | DEPARTMENT_HEAD | MEMBER` là lựa chọn của ứng dụng mẫu, không phải
bất biến của Foundation. Chúng mô tả **bán kính dữ liệu**, không phải chức danh —
nhiều chức danh có thể ánh xạ vào cùng một bán kính. Nhãn hiển thị thuộc về dự án.

---

## Bố cục

```
frontend/
├── app/                 khung ứng dụng
│   ├── app.config.ts        COMPOSITION ROOT — bind repository, đăng ký capability
│   ├── app.routes.ts
│   ├── layout/              shell · topbar · page-title · persona-switcher · viewport
│   ├── navigation/          dựng NavigationModel từ quyền + capability + config
│   ├── routing/             workspace-host · capability-outlet · capability-routes
│   ├── tenant/              branding · navigation · fixtures     ← cấu hình dự án
│   └── theme/               _palette · _type                     ← bản sắc dự án
│
├── components/          UI thuần — ui/ feedback/ navigation/ pipes/
├── services/            access/{rules/} · composition/ · branding
├── store/               session · organization · workspace-context
├── styles/tokens/       HỢP ĐỒNG token — nơi DUY NHẤT có màu thô
├── types/ utils/ constants/ assets/
│
├── features/            NGHIỆP VỤ — organization · worklist · leads
└── scripts/             check-architecture.sh · check-imports.mjs
```

Path alias: `@bo/components` `@bo/services` `@bo/store` `@bo/types` `@bo/utils`
`@bo/constants`. Chúng trỏ thẳng vào source, không có bước đóng gói.

Ba feature trong `features/` là **ví dụ tham khảo**. Fork cho dự án mới thì xoá
chúng đi; nền tảng vẫn boot — `WorkspaceHost` render empty-state khi không có
dashboard nào đăng ký.

Mỗi feature có bốn tầng:

```
features/<tên>/
├── domain/        model + quy tắc nghiệp vụ — không Angular, không UI
├── data-access/   repository contract + implementation
├── ui/            component câm của riêng feature này
└── feature/       trang smart theo persona
```

Head và member **dùng chung** model và repository; chỉ `feature/` khác nhau.

---

## Capability lắp vào bằng cách nào

Feature export một manifest, `app.config.ts` gom các manifest lại, shell đọc kết
quả. Không gì import thẳng một page, nên mọi bề mặt đều lazy-load.

```ts
export const potentialCustomerCapabilities: CapabilityDescriptor[] = [{
  key: 'potential-customers',
  title: '…',
  presentations: {
    // Cùng capability, cùng repository — khác page theo persona.
    DEPARTMENT_HEAD: { title: '…', load: () => import('…/head/…') },
    MEMBER:          { title: '…', load: () => import('…/member/…') },
  },
}];
```

Thiếu một vai trò trong `presentations` nghĩa là persona đó **không bao giờ**
thấy capability — không ở điều hướng, không ở tab, và route guard từ chối.

Widget dashboard đi cùng cơ chế: chỉ render nếu capability của nó đang bật cho
đơn vị đang xem.

Shell hỏi đúng bốn câu và không hơn: ai đang đăng nhập, họ vào được đơn vị nào,
capability nào đã đóng góp điều hướng, persona này nhận workspace nào. Nó
**không thể** chứa `if (đơn vị === …)` vì nó không nhìn thấy capability nào cả.

---

## Truy cập dữ liệu

Chưa gọi HTTP. Mọi feature nói chuyện với một repository trừu tượng;
`app.config.ts` bind nó vào fixture:

```ts
{ provide: PotentialCustomerRepository, useClass: FixturePotentialCustomerRepository },
```

Nối vào backend thật = đổi `useClass` sang implementation gọi HTTP. Không
component nào bị sửa, vì không component nào biết nó đang cầm implementation gì.

Mọi method nhận `user: UserContext` làm tham số đầu tiên — chữ ký thiết kế sẵn
để server tự scope dữ liệu theo người gọi. Fixture thi hành đúng luật sở hữu mà
server sẽ thi hành, nên thứ nhìn thấy khi demo là thứ người dùng thật sẽ thấy.

Xác thực thuộc backend (`backend/src/core/identity/`). Phiên đăng nhập đi bằng
cookie `HttpOnly`, nên frontend **không** cầm token và không cất gì vào
`localStorage`. `store/session/` là ranh giới.

---

## Ghi chú design system

Độ nổi khai một lần: card dùng viền tóc và **không** đổ bóng, để thang shadow
còn giữ nghĩa "thứ này nổi lên" khi menu hay drawer dùng tới.

Accent đi theo cặp solid/soft (`--c-teal` / `--c-teal-soft`); component đọc qua
`accentVars()` thay vì rẽ nhánh theo tên màu. Control lấy chiều cao từ
`--control-h`, con trỏ thô tự nâng lên 40px.

Dưới 900px mọi bảng dữ liệu bỏ header và thành khối có nhãn — điện thoại thấy
**đủ** số cột desktop thấy, thay vì giấu bớt cột phụ.

Màu thô chỉ được sống trong `styles/tokens/` (R5), và nền tảng không được đặt
tên một webfont cụ thể (R6). Đổi toàn bộ diện mạo = sửa `app/theme/`, không chạm
component nào.

---

## Ranh giới được canh bằng máy

```bash
npm run check
```

```
R1  nền tảng ↛ features · app        R5  hex chỉ ở styles/tokens
R2  components ↛ từ vựng tổ chức     R6  nền tảng ↛ webfont cụ thể
R3  access/rules ↛ Angular · rxjs    R7  utils ↛ Angular DI
R4  nền tảng ↛ tên khách hàng        R8  feature ↛ feature khác
```

Khi một rule báo đỏ, thứ hỏng gần như luôn là **vị trí** của file mới, không
phải bản thân đoạn code.
