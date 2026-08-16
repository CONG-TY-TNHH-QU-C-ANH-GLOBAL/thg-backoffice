#!/usr/bin/env bash
#
# Canh ranh giới kiến trúc. 0 dependency — chỉ grep.
#
# Chạy: bash scripts/check-architecture.sh
# Thoát != 0 nếu có vi phạm, nên cắm thẳng vào CI được.
#
# Vì sao không phải ESLint: bốn quy tắc dưới đây là quy tắc VỀ ĐƯỜNG DẪN,
# không phải về cú pháp. grep diễn đạt chúng trực tiếp và không tốn một
# dependency nào. Thêm ESLint khi cần cảnh báo ngay lúc gõ trong editor —
# lúc đó chép đúng bốn pattern này sang `no-restricted-imports`.

cd "$(dirname "$0")/.." || exit 2

fail=0
report() { # $1 = tên rule, $2 = kết quả grep
  if [ -n "$2" ]; then
    printf '\n\033[31m✘ %s\033[0m\n' "$1"
    printf '%s\n' "$2" | sed 's/^/    /'
    fail=1
  else
    printf '\033[32m✔\033[0m %s\n' "$1"
  fi
}

# --- R1 ── features không với tới chrome, cũng không với feature khác -------
# Feature phải sống được mà không biết ứng dụng bọc quanh nó trông thế nào.
report "R1  features ↛ shell" \
  "$(grep -rn "@bo/shell" --include=*.ts apps/*/src/app/features 2>/dev/null)"

# --- R2 ── components là leaf tuyệt đối --------------------------------------
# Thuộc tính quý nhất của foundation: component không biết gì ngoài chính nó.
# Mất thuộc tính này là mất khả năng tái sử dụng sang khách khác.
# Chỉ soi dòng `import`, không soi comment.
report "R2  components ↛ mọi lib khác" \
  "$(grep -rn "^import .*'@bo/\|from '@bo/" --include=*.ts libs/components 2>/dev/null)"

# --- R2b ── components không ĐIỀU KHIỂN điều hướng ---------------------------
# Phân biệt có chủ đích: `RouterLink` là điều hướng KHAI BÁO — một card trỏ
# tới đâu đó là chuyện bình thường, cấm nó chỉ ép API thành gượng gạo.
# `inject(Router)` là ĐIỀU KHIỂN LUỒNG — đó mới là thứ biến component thành
# một mảnh của ứng dụng cụ thể, và là lý do `Shell` không nằm ở đây.
report "R2b components ↛ inject(Router)" \
  "$(grep -rn "inject(Router)\|: Router\b" --include=*.ts libs/components 2>/dev/null)"

# --- R3 ── luật phân quyền phải sạch để backend chép lại ---------------------
# Chỉ áp dụng khi libs/core/access/rules/ đã tồn tại (phase 4).
if [ -d libs/core/access/rules ]; then
  report "R3  access/rules ↛ Angular · rxjs" \
    "$(grep -rn "@angular/\|from 'rxjs" --include=*.ts libs/core/access/rules 2>/dev/null)"
else
  printf '\033[33m–\033[0m R3  access/rules chưa tồn tại (phase 4)\n'
fi

# --- R4 ── foundation không được biết tên khách nào --------------------------
# Phép thử THG portability, dạng kiểm tra được bằng máy.
# `\bTHG\b` phân biệt hoa thường, nếu không `authGuard` cũng dính vì chứa "thG".
report "R4  libs ↛ tenant · theme · tên khách" \
  "$(grep -rnE "from '.*(tenant|/theme)/|\bTHG\b" --include=*.ts --include=*.scss libs 2>/dev/null)"

# --- R5 ── không màu thô trong component và chrome ---------------------------
# Đây là ranh giới component ⟂ visual language. Màu phải đi qua token, nếu
# không thì khách đổi theme sẽ đổi được mọi thứ TRỪ chỗ hardcode.
report "R5  components ↛ màu hex thô" \
  "$(grep -rn "#[0-9a-fA-F]\{3,8\}\b" --include=*.scss --include=*.ts libs/components 2>/dev/null \
     | grep -v "icon.paths" | grep -v "tokens")"

report "R5b shell ↛ màu hex thô" \
  "$(grep -rn "#[0-9a-fA-F]\{3,8\}\b" --include=*.scss --include=*.ts libs/shell 2>/dev/null)"

# --- R6 ── libs không bao giờ ngó sang apps ---------------------------------
report "R6  libs ↛ apps" \
  "$(grep -rn "apps/" --include=*.ts --include=*.scss libs 2>/dev/null)"

echo
if [ $fail -eq 0 ]; then
  printf '\033[32mTất cả ranh giới đều sạch.\033[0m\n'
else
  printf '\033[31mCó vi phạm ranh giới — xem ở trên.\033[0m\n'
fi
exit $fail
