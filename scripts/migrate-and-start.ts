// Chạy khi container start (thay cho lệnh "prisma db push && next start" cũ).
//
// Lý do cần file này: field `referralCode` trong User là bắt buộc (String @unique)
// nhưng database production đã có sẵn user cũ trước khi field này tồn tại.
// `prisma db push` sẽ luôn từ chối chạy trong trường hợp đó (không tự biết
// điền giá trị gì cho các dòng cũ). Script này tự phát hiện và điền
// (backfill) referralCode cho các user cũ TRƯỚC khi gọi `prisma db push`,
// nên `db push` sau đó luôn chạy được — không cần thao tác tay, không cần
// deploy 2 lần.
//
// An toàn để chạy lại nhiều lần (kể cả khi cột đã tồn tại và mọi user đã có
// mã) — lúc đó nó chỉ chạy 2 câu SELECT rồi bỏ qua ngay, không tốn gì.

import { execSync } from "child_process";
import { prisma } from "../lib/prisma";
import { generateReferralCode } from "../lib/referral";

async function backfillReferralCodesIfNeeded() {
  // 1) Cột "referralCode" đã tồn tại trong DB thật (từ lần push trước) chưa?
  //    Nếu CHƯA tồn tại -> đây là lần đầu tiên field này được thêm vào và
  //    bảng User đang trống (dự án mới) hoặc cột sẽ được tạo lần đầu bởi
  //    chính `prisma db push` chạy ngay sau script này -> không cần backfill.
  const columnExists: { column_name: string }[] = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'referralCode'`
  );
  if (columnExists.length === 0) {
    console.log("[migrate] Cột referralCode chưa tồn tại — bỏ qua backfill, để prisma db push tạo mới.");
    return;
  }

  // 2) Cột đã tồn tại -> tìm các user cũ đang có referralCode NULL
  const usersWithoutCode: { id: string }[] = await prisma.$queryRawUnsafe(
    `SELECT id FROM "User" WHERE "referralCode" IS NULL`
  );

  if (usersWithoutCode.length === 0) {
    console.log("[migrate] Mọi user đã có referralCode — không cần backfill.");
    return;
  }

  console.log(`[migrate] Đang backfill referralCode cho ${usersWithoutCode.length} user cũ...`);

  for (const user of usersWithoutCode) {
    let code = generateReferralCode();

    // Tránh trùng mã (unique) — cực hiếm nhưng vẫn kiểm tra lại
    for (let attempt = 0; attempt < 5; attempt++) {
      const dup: { id: string }[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "User" WHERE "referralCode" = $1`,
        code
      );
      if (dup.length === 0) break;
      code = generateReferralCode();
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "User" SET "referralCode" = $1 WHERE id = $2`,
      code,
      user.id
    );
    console.log(`[migrate]   -> user ${user.id}: ${code}`);
  }

  console.log("[migrate] Backfill xong.");
}

async function main() {
  try {
    await backfillReferralCodesIfNeeded();
  } catch (err) {
    // Không chặn start nếu backfill lỗi vì lý do khác (vd cột nào đó chưa có) —
    // để prisma db push tự báo lỗi rõ ràng hơn nếu thực sự có vấn đề schema.
    console.error("[migrate] Backfill gặp lỗi (sẽ vẫn thử prisma db push):", err);
  } finally {
    await prisma.$disconnect();
  }

  console.log("[migrate] Chạy prisma db push...");
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });

  console.log("[migrate] Khởi động Next.js...");
  execSync(`npx next start -p ${process.env.PORT || 3000}`, { stdio: "inherit" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
