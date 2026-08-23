import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyInitData } from "@/lib/verifyInitData";
import { handleTaskConfirmedForReferral } from "@/lib/referral";

/**
 * PHƯƠNG ÁN DỰ PHÒNG — client tự xác nhận đã xem xong quảng cáo (dựa vào
 * show_XXX().then() của Monetag SDK resolve), KHÔNG đợi postback server-side
 * từ Monetag nữa.
 *
 * Monetag tài liệu chính thức cảnh báo: dùng Frontend Callback để cộng thưởng
 * là "Risky" — vì Promise chỉ xác nhận SDK đã CHẠY xong logic hiển thị, không
 * đảm bảo quảng cáo thực sự được tính tiền/không gian lận. Bất kỳ ai rành kỹ
 * thuật đều có thể tự gọi thẳng route này giả lập đã xem xong.
 *
 * Dùng route này CHỈ vì lý do thực tế: Monetag postback đang không gửi về
 * (xem lịch sử trao đổi/ticket support), cần có cách cộng thưởng tạm trong
 * lúc chờ. Khi Monetag khắc phục xong, nên cân nhắc tắt route này
 * (hoặc chỉ giữ làm fallback) và quay lại dùng postback làm nguồn xác nhận
 * chính — an toàn hơn nhiều vì có estimated_price thật + xác nhận từ bên thứ 3.
 *
 * Giảm rủi ro gian lận ở mức tối thiểu có thể trong route này:
 * - Bắt buộc xác thực initData thật (không cộng tiền cho ai không đăng nhập qua Telegram)
 * - Completion phải đúng thuộc về user đang gọi (không thể lấy requestId của người khác)
 * - Completion phải đang PENDING và ĐÃ TỒN TẠI ĐỦ LÂU (>= thời lượng quảng cáo tối
 *   thiểu hợp lý, ví dụ 8 giây) — chặn kiểu gọi confirm ngay tức khắc sau claim,
 *   dấu hiệu rõ ràng của việc gọi thẳng API mà không thật sự xem quảng cáo
 * - Đánh dấu confirmedVia="client" để admin lọc riêng, dễ phát hiện bất thường
 *   ở trang panel Lượt xem (VD: 1 user có quá nhiều lượt confirmedVia=client
 *   liên tục, đều sát ngưỡng 8s — rất đáng ngờ)
 */
const MIN_AD_DURATION_SEC = 8;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const initData = body.initData || "";
  const requestId = body.requestId || "";
  const verified = verifyInitData(initData, process.env.BOT_TOKEN || "");
  if (!verified || !requestId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { telegramId: String(verified.id) } });
  if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  const completion = await prisma.taskCompletion.findUnique({
    where: { requestId },
    include: { task: true },
  });
  if (!completion || completion.taskId !== params.id || completion.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (completion.status !== "PENDING") {
    // Có thể postback thật của Monetag đã tới trước và cộng tiền rồi — đừng cộng đè.
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  const elapsedSec = (Date.now() - completion.createdAt.getTime()) / 1000;
  if (elapsedSec < MIN_AD_DURATION_SEC) {
    return NextResponse.json({ error: "too_fast" }, { status: 429 });
  }

  // Không có estimated_price thật ở đường này (chỉ postback mới có) — dùng số
  // ước tính tĩnh của task làm thưởng, giống nhiệm vụ không phải Monetag.
  const finalReward = completion.task.reward;

  await prisma.$transaction([
    prisma.taskCompletion.update({
      where: { id: completion.id },
      data: { status: "CONFIRMED", confirmedAt: new Date(), reward: finalReward, confirmedVia: "client" },
    }),
    prisma.user.update({
      where: { id: completion.userId },
      data: { balance: { increment: finalReward } },
    }),
  ]);

  // Không có estimated_price thật ở đường này -> marginPercent=0, khiến hàm bên
  // dưới bỏ qua việc suy ngược trần an toàn 70% (coi như không giới hạn thêm ở
  // bước này) — chấp nhận được vì finalReward ở đây vốn đã nhỏ (số ước tính tĩnh).
  try {
    await handleTaskConfirmedForReferral({
      userId: completion.userId,
      completionId: completion.id,
      rewardVnd: finalReward,
      marginPercent: 0,
      adNetwork: completion.task.adNetwork,
    });
  } catch (e) {
    console.error("[tasks:confirm] referral handling failed", e);
  }

  return NextResponse.json({ ok: true, reward: finalReward });
}
