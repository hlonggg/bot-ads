import { prisma } from "./prisma";

/**
 * CƠ CHẾ REFERRAL (mời bạn bè) — tóm tắt để dễ bảo trì:
 *
 * 1. Mốc thưởng 1 LẦN cho referrer, tính theo số người mời "thành công" (referee
 *    hoàn thành nhiệm vụ Monetag đầu tiên — click link không tính, phải thực sự
 *    kiếm được tiền mới tính):
 *      người thứ 3  -> +1.000đ
 *      người thứ 6  -> +2.000đ
 *      người thứ 15 -> +5.000đ
 *    Từ người thứ 16 trở đi: KHÔNG còn thưởng mốc.
 *
 * 2. Hoa hồng thụ động: CHỈ 5 người kế tiếp ngay sau mốc 15 (tức người thứ
 *    #16 -> #20) mới tạo ra hoa hồng cho referrer — mỗi người 2%, tối đa
 *    2%×5 = 10% tổng thu nhập thụ động cộng thêm. Người thứ #21 trở đi KHÔNG
 *    tạo thêm hoa hồng nào nữa (đã dùng hết 5 "suất").
 *    Hoa hồng = 2% × số tiền referee THỰC NHẬN mỗi lượt xem Monetag — khoản
 *    này do ADMIN gánh (trích từ phần margin của admin), referee không bị trừ
 *    gì cả, vẫn nhận đủ 100% phần % của họ như bình thường.
 *
 * 3. Trần an toàn 70%: tổng (% referee nhận + % hoa hồng referrer) của MỘT
 *    lượt xem không bao giờ vượt quá 70% giá trị gốc lượt xem đó — đảm bảo
 *    admin luôn còn tối thiểu 30% lợi nhuận dù cấu hình margin cao.
 *
 * 4. Referrer bị TẠM KHOÁ (referralLocked=true) nếu chính họ không tự hoàn
 *    thành nhiệm vụ nào trong 7 ngày gần nhất — hoa hồng dừng lại nhưng dữ
 *    liệu/mốc đã đạt được giữ nguyên, không xoá gì. Tự động MỞ KHOÁ ngay khi
 *    họ tự làm 1 nhiệm vụ bất kỳ trở lại.
 *    Lưu ý: việc khoá được kiểm tra "lười" (lazy) — chỉ tính toán lại đúng lúc
 *    có 1 người họ mời kiếm được tiền, không chạy nền định kỳ 24/7. Nếu referrer
 *    không có downline nào hoạt động, trạng thái khoá có thể không cập nhật
 *    đúng ngay tại mốc 7 ngày — chỉ ảnh hưởng hiển thị, không ảnh hưởng tiền
 *    vì hoa hồng chỉ tính khi có lượt xem thật xảy ra (lúc đó sẽ tự check lại).
 */

const MILESTONES: { rank: number; bonus: number }[] = [
  { rank: 3, bonus: 1000 },
  { rank: 6, bonus: 2000 },
  { rank: 15, bonus: 5000 },
];

const COMMISSION_PERCENT = 2;
const COMMISSION_MIN_RANK = 16;
const COMMISSION_MAX_RANK = 20; // 5 người (16,17,18,19,20) — đúng "2+2+2+2+2 = tối đa 10%"

const MAX_TOTAL_PAYOUT_PERCENT = 70;
const INACTIVITY_LOCK_DAYS = 7;

export function generateReferralCode(): string {
  // Ngắn gọn, đủ khó đoán, dùng an toàn trong URL (?start=ref_xxx của Telegram
  // chỉ chấp nhận [A-Za-z0-9_], không dùng ký tự đặc biệt).
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Gọi ngay sau khi 1 user (userId) được CỘNG TIỀN THẬT từ 1 lượt hoàn thành
 * nhiệm vụ (rewardVnd = số tiền vừa cộng cho chính họ). An toàn để gọi nhiều
 * lần cho cùng completionId — tự chặn cộng hoa hồng đôi.
 *
 * marginPercent: % đã dùng để tính ra rewardVnd đó (vd 50) — dùng để suy ngược
 * lại tổng giá trị gốc của lượt xem, phục vụ tính trần an toàn 70%.
 * adNetwork: mốc/hoa hồng CHỈ áp dụng cho lượt xem Monetag thật — nhưng việc
 * cập nhật "còn hoạt động" (mở khoá referral) áp dụng cho MỌI network.
 */
export async function handleTaskConfirmedForReferral(params: {
  userId: string;
  completionId: string;
  rewardVnd: number;
  marginPercent: number;
  adNetwork: string;
}) {
  const { userId, completionId, rewardVnd, marginPercent, adNetwork } = params;

  // Luôn cập nhật hoạt động + tự mở khoá referral của CHÍNH user này, bất kể
  // network nào — đây chính là điều kiện "không làm nhiệm vụ 1 tuần".
  await prisma.user.update({
    where: { id: userId },
    data: { lastTaskCompletedAt: new Date(), referralLocked: false },
  });

  if (adNetwork !== "monetag") return; // mốc/hoa hồng chỉ áp dụng lượt xem Monetag thật

  const referee = await prisma.user.findUnique({ where: { id: userId } });
  if (!referee?.referredById) return; // không qua ref, không có gì để xử lý thêm

  // 1) Nếu đây là lượt hoàn thành ĐẦU TIÊN của referee -> xác định rank, có thể
  //    trả thưởng mốc cho referrer. Chỉ chạy đúng 1 lần nhờ check referralCountedAt.
  if (!referee.referralCountedAt) {
    try {
      await prisma.$transaction(async (tx) => {
        const fresh = await tx.user.findUnique({ where: { id: userId } });
        if (!fresh || fresh.referralCountedAt) return; // nhánh khác đã xử lý trước

        const priorCount = await tx.user.count({
          where: { referredById: referee.referredById!, referralCountedAt: { not: null } },
        });
        const rank = priorCount + 1;

        await tx.user.update({
          where: { id: userId },
          data: { referralRank: rank, referralCountedAt: new Date() },
        });

        const milestone = MILESTONES.find((m) => m.rank === rank);
        if (milestone) {
          await tx.user.update({
            where: { id: referee.referredById! },
            data: { balance: { increment: milestone.bonus } },
          });
          await tx.referralEarning.create({
            data: {
              referrerId: referee.referredById!,
              refereeId: userId,
              type: "MILESTONE",
              amount: milestone.bonus,
              note: `Mốc mời thành công người thứ ${rank}`,
            },
          });
        }
      });
    } catch {
      // Va chạm hiếm gặp (2 referee của cùng referrer hoàn thành cùng lúc, trùng
      // rank) — @@unique([referredById, referralRank]) sẽ chặn, bỏ qua an toàn
      // thay vì cộng đè; lượt sau vẫn tính bình thường.
    }
  }

  // 2) Hoa hồng thụ động — CHỈ áp dụng nếu referee đang ở đúng rank 16-20
  const freshReferee = await prisma.user.findUnique({ where: { id: userId } });
  const rank = freshReferee?.referralRank;
  if (!rank || rank < COMMISSION_MIN_RANK || rank > COMMISSION_MAX_RANK) return;

  const referrer = await prisma.user.findUnique({ where: { id: referee.referredById } });
  if (!referrer) return;

  const inactiveCutoff = Date.now() - INACTIVITY_LOCK_DAYS * 24 * 60 * 60 * 1000;
  const referrerActive =
    referrer.lastTaskCompletedAt && referrer.lastTaskCompletedAt.getTime() >= inactiveCutoff;
  if (!referrerActive) {
    if (!referrer.referralLocked) {
      await prisma.user.update({ where: { id: referrer.id }, data: { referralLocked: true } });
    }
    return; // referrer đang bị khoá do không hoạt động -> không cộng hoa hồng
  }

  const completion = await prisma.taskCompletion.findUnique({ where: { id: completionId } });
  if (!completion || completion.referralCommissionApplied) return; // chặn cộng đôi

  let commission = Math.round(rewardVnd * (COMMISSION_PERCENT / 100));
  if (commission <= 0) return;

  // Trần an toàn 70%: suy ngược tổng giá trị gốc lượt xem từ rewardVnd/marginPercent,
  // đảm bảo (rewardVnd + commission) không vượt quá 70% giá trị đó.
  if (marginPercent > 0) {
    const impliedTaskValue = rewardVnd / (marginPercent / 100);
    const maxTotalPayout = Math.floor(impliedTaskValue * (MAX_TOTAL_PAYOUT_PERCENT / 100));
    const maxCommission = Math.max(0, maxTotalPayout - rewardVnd);
    commission = Math.min(commission, maxCommission);
  }
  if (commission <= 0) return;

  await prisma.$transaction([
    prisma.taskCompletion.update({
      where: { id: completionId },
      data: { referralCommissionApplied: true },
    }),
    prisma.user.update({
      where: { id: referrer.id },
      data: { balance: { increment: commission } },
    }),
    prisma.referralEarning.create({
      data: {
        referrerId: referrer.id,
        refereeId: userId,
        type: "COMMISSION",
        amount: commission,
        completionId,
        note: `Hoa hồng ${COMMISSION_PERCENT}% từ lượt xem của người được mời thứ ${rank}`,
      },
    }),
  ]);
}
