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
  // 1) Bảng "User" đã tồn tại chưa (deploy lần đầu tuyệt đối, DB trống hoàn
  //    toàn thì bảng cũng chưa có -> không cần làm gì, để prisma db push tạo
  //    toàn bộ từ đầu, lúc đó không có row nào nên field bắt buộc không sao).
  const tableExists: { to_regclass: string | null }[] = await prisma.$queryRawUnsafe(
    `SELECT to_regclass('public."User"')::text AS to_regclass`
  );
  if (!tableExists[0]?.to_regclass) {
    console.log("[migrate] Bảng User chưa tồn tại (DB trống) — để prisma db push tạo mới từ đầu.");
    return;
  }

  // 2) Cột "referralCode" đã tồn tại trong bảng chưa?
  const columnExists: { column_name: string }[] = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'referralCode'`
  );

  if (columnExists.length === 0) {
    // Cột CHƯA từng tồn tại. Nếu bảng đang có sẵn user cũ, `prisma db push`
    // sẽ từ chối thêm cột bắt buộc này thẳng luôn (đúng lỗi bạn đang gặp).
    // -> Tự thêm cột này dạng CHO PHÉP NULL bằng SQL thô trước, để có chỗ
    //    ghi mã referral cho từng user cũ, RỒI mới để prisma db push chuyển
    //    nó thành bắt buộc (lúc đó mọi row đã có giá trị nên sẽ thành công).
    console.log("[migrate] Cột referralCode chưa tồn tại — tự thêm dạng optional để chuẩn bị backfill...");
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN "referralCode" TEXT`);
  }

  // 3) Tìm các user (cũ hoặc vừa thêm cột) đang có referralCode NULL
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
