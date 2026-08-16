# Migrations

Chạy bằng `npm run migrate`. Runner: `src/infrastructure/database/migration-runner.ts`.

## Quy ước

```
0001_snake_case_description.sql
0002_...
```

Thứ tự là thứ tự sắp xếp tên file — nên số phải có padding.

## Ba ràng buộc

1. **Forward-only.** Không rollback script. Sửa sai bằng một migration mới.
2. **Idempotent hoặc có guard.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`.
   Một migration vỡ khi chạy lần hai là một migration không chạy tự động được.
3. **Không seed dữ liệu nghiệp vụ.** Migration tạo cấu trúc. Phòng ban, vai trò,
   người dùng là dữ liệu do admin nhập lúc chạy — hardcode chúng vào migration là
   cách biến dữ liệu thành code.

Mỗi file chạy trong một transaction; hỏng thì rollback file đó và dừng.
`schema_migrations` do runner tự tạo, không phải bằng migration.

Rỗng ở Phase 0: chưa có bảng nghiệp vụ nào.
