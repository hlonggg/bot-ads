"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/lib/useTelegram";

interface Milestone {
  rank: number;
  bonus: number;
  achieved: boolean;
}

interface ReferralData {
  referralCode: string;
  totalInvited: number;
  successfulInvited: number;
  milestones: Milestone[];
  commissionEligibleCount: number;
  commissionSlotsMax: number;
  totalMilestoneEarnings: number;
  totalCommissionEarnings: number;
  isLocked: boolean;
}

export default function ReferralPage() {
  const { initData, ready, webApp } = useTelegram();
  const router = useRouter();
  const [data, setData] = useState<ReferralData | null>(null);
  const [botUsername, setBotUsername] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready || !initData) return;
    fetch(`/api/referral?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setData(d));
    fetch(`/api/settings?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setBotUsername(d.settings?.botUsername || ""));
  }, [ready, initData]);

  const link = botUsername && data ? `https://t.me/${botUsername}?start=ref_${data.referralCode}` : "";

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function shareLink() {
    if (!link) return;
    const text = "Cùng kiếm tiền với tôi trên EarnPlay 💰";
    webApp?.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
  }

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4">
        ← Quay lại
      </button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-1">Mời bạn bè</h1>
      <p className="text-gray-500 text-sm mb-6">
        Mời càng nhiều, thưởng càng lớn — và có cơ hội nhận thêm thu nhập thụ động lâu dài.
      </p>

      {!data ? (
        <p className="text-sm text-gray-400 text-center py-8">Đang tải...</p>
      ) : (
        <>
          <div className="card p-5 mb-4">
            <label className="text-xs text-gray-500 mb-1 block">Link mời của bạn</label>
            <div className="bg-ivory rounded-xl px-3 py-2 text-xs text-charcoal break-all mb-3">
              {link || "Đang tạo link..."}
            </div>
            <div className="flex gap-2">
              <button onClick={copyLink} className="flex-1 border border-gold text-gold-dark text-sm py-2 rounded-xl font-medium">
                {copied ? "Đã chép" : "Sao chép"}
              </button>
              <button onClick={shareLink} className="flex-1 btn-gold text-sm py-2">
                Chia sẻ
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-semibold text-charcoal">{data.successfulInvited}</p>
              <p className="text-xs text-gray-400">Mời thành công</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-semibold text-gold-dark">
                {(data.totalMilestoneEarnings + data.totalCommissionEarnings).toLocaleString("vi-VN")}đ
              </p>
              <p className="text-xs text-gray-400">Tổng thưởng đã nhận</p>
            </div>
          </div>

          <p className="text-sm font-semibold text-charcoal mb-2">Mốc thưởng mời bạn</p>
          <div className="flex flex-col gap-2 mb-4">
            {data.milestones.map((m) => (
              <div key={m.rank} className="card p-3 flex items-center justify-between">
                <span className={`text-sm ${m.achieved ? "text-charcoal font-medium" : "text-gray-400"}`}>
                  Mời đủ {m.rank} người
                </span>
                <span className={`text-sm font-semibold ${m.achieved ? "text-green-600" : "text-gray-300"}`}>
                  {m.achieved ? "✓ " : ""}+{m.bonus.toLocaleString("vi-VN")}đ
                </span>
              </div>
            ))}
          </div>

          {data.successfulInvited > 15 && (
            <>
              <p className="text-sm font-semibold text-charcoal mb-2">Thu nhập thụ động</p>
              <div className="card p-4 mb-4">
                <p className="text-sm text-charcoal mb-1">
                  {data.commissionEligibleCount}/{data.commissionSlotsMax} người đang tạo hoa hồng cho bạn
                </p>
                <p className="text-xs text-gray-400 mb-2">
                  5 người kế tiếp ngay sau mốc 15 (người thứ #16–#20) sẽ tự động trích 2%/người từ mỗi lượt
                  xem quảng cáo họ hoàn thành — không trừ vào phần thưởng của họ, tối đa 10% thu nhập cộng
                  thêm cho bạn, hoàn toàn thụ động.
                </p>
                {data.isLocked && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                    ⚠ Hoa hồng đang tạm dừng vì bạn chưa tự làm nhiệm vụ nào trong 7 ngày gần đây. Làm 1
                    nhiệm vụ bất kỳ để mở lại ngay.
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
