#!/usr/bin/env bash
#
# Canh ranh giới kiến trúc backend. 0 dependency — chỉ grep.
#
# Chạy: npm run check      Thoát != 0 khi vi phạm, cắm thẳng vào CI được.
#
# Vì sao không phải ESLint: các quy tắc dưới đây là quy tắc VỀ ĐƯỜNG DẪN, không
# phải về cú pháp. grep diễn đạt chúng trực tiếp. Thêm ESLint khi cần cảnh báo
# ngay trong editor — lúc đó chép đúng các pattern này sang no-restricted-imports.
#
#   config/          môi trường đã validate
#   infrastructure/  adapter công nghệ — database, health, sau này auth/storage
#   common/          primitive cross-cutting, KHÔNG phải sọt rác
#   core/            Backoffice Foundation
#   capabilities/    module nghiệp vụ, tuỳ chọn

cd "$(dirname "$0")/.." || exit 2

# Bốn rule B1-B4 chỉ soi CÂU LỆNH IMPORT, không soi toàn văn file. Comment
# giải thích ranh giới đương nhiên phải nhắc tên các tầng — một checker vấp vào
# chính tài liệu của nó là checker sẽ bị tắt.

fail=0
report() {
  if [ -n "$2" ]; then
    printf '\n\033[31m✘ %s\033[0m\n' "$1"
    printf '%s\n' "$2" | sed 's/^/    /'
    fail=1
  else
    printf '\033[32m✔\033[0m %s\n' "$1"
  fi
}

# --- B1 ── core không bao giờ biết capability nào tồn tại -------------------
# Quy tắc quan trọng nhất. Core biết tên một capability là core đã hỏng, và
# foundation hết tái sử dụng được cho project tiếp theo.
report "B1  core ↛ capabilities" \
  "$(grep -rn "capabilities/" --include=*.ts src/core 2>/dev/null | grep -v "^src/core/capabilities/")"

# --- B2 ── core định nghĩa PORT, infrastructure viết ADAPTER ----------------
# Nếu core import infrastructure thì đổi provider auth phải mổ vào foundation.
# Đấu dây là việc của app.module.ts, không phải của core.
report "B2  core ↛ infrastructure" \
  "$(grep -rnE "^\s*(import|export).*from '[^']*infrastructure/" --include=*.ts src/core 2>/dev/null)"

# --- B3 ── common là primitive, không phải sọt rác --------------------------
# common/ mà biết core hay capability thì nó không còn cross-cutting nữa.
report "B3  common ↛ core · capabilities · infrastructure" \
  "$(grep -rnE "^\s*(import|export).*from '[^']*(core|capabilities|infrastructure)/" --include=*.ts src/common 2>/dev/null)"

# --- B4 ── infrastructure là công nghệ, không phải nghiệp vụ ----------------
report "B4  infrastructure ↛ capabilities" \
  "$(grep -rn "capabilities/" --include=*.ts src/infrastructure 2>/dev/null)"

# --- B5 ── cắt theo trách nhiệm, không theo loại file -----------------------
# Không có top-level controllers/ services/ repositories/ entities/ dto/.
# Chúng nằm TRONG module của chúng.
report "B5  không có thư mục top-level theo loại file" \
  "$(ls -d src/controllers src/services src/repositories src/entities src/dto src/models 2>/dev/null)"

# --- B6 ── không đọc biến môi trường mà không qua validate -----------------
# Thứ đáng cấm là `process.env.SOMETHING` — đọc thẳng một biến, bỏ qua schema.
# Truyền cả `process.env` cho envSchema thì HỢP LỆ: vẫn là một cửa duy nhất, và
# CLI migrate chạy ngoài DI container nên buộc phải làm vậy.
report "B6  không đọc process.env.X ngoài validate" \
  "$(grep -rn "process\.env\.[A-Za-z_]" --include=*.ts src 2>/dev/null)"

# --- B7 ── foundation không mang từ vựng nghiệp vụ -------------------------
# Danh sách này là ví dụ, không phải giới hạn: nếu một domain mới rò rỉ vào
# foundation, thêm nó vào đây.
# Chỉ soi CODE, không soi comment — "in filename order" là văn xuôi tiếng Anh,
# không phải entity Order. Một checker hay báo nhầm là một checker bị tắt.
report "B7  foundation ↛ từ vựng nghiệp vụ" \
  "$(grep -rnE "\b(customer|invoice|shipment|warehouse|recruitment|crm)\b" \
       --include=*.ts src/core src/common src/infrastructure src/config 2>/dev/null \
     | grep -vE ':[0-9]+: *(\*|//|/\*)')"

echo
if [ $fail -eq 0 ]; then
  printf '\033[32mTất cả ranh giới đều sạch.\033[0m\n'
else
  printf '\033[31mCó vi phạm ranh giới — xem ở trên.\033[0m\n'
fi
exit $fail
