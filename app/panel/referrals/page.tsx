"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PanelGuard from "@/components/PanelGuard";

interface Referrer {
  id: string;
  username?: string;
  firstName?: string;
  telegramId: string;
  referralLocked: boolean;
  lastTaskCompletedAt: string | null;
  totalInvited: number;
  totalEarned: number;
}

export default function PanelReferralsPage() {
  const router = useRouter();
  const [totalPaidOut, setTotalPaidOut] = useState(0);
  const [referrers, setReferrers] = useState<Referrer[]>([]);

  function load(initData: string) {
    fetch(`/api/panel/referrals?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => {
        setTotalPaidOut(d.totalPaidOut || 0);
        setReferrers(d.referrers || []);
      });
  }

  return (
    <PanelGuard>
      {(initData) => <Inner initData={initData} totalPaidOut={totalPaidOut} referrers={referrers} load={load} router={router} />}
    </PanelGuard>
  );
}

function Inner({ initData, totalPaidOut, referrers, load, router }: any) {
  useEffect(() => {
    load(initData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.push("/panel")} className="text-sm text-gray-400 mb-3">← Quay lại</button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-4">Referral</h1>

      <div className="card p-4 mb-4">
        <p className="text-xs text-gray-500 mb-1">Tổng đã chi cho referral (mốc + hoa hồng)</p>
        <p className="text-xl font-semibold text-charcoal">{totalPaidOut.toLocaleString("vi-VN")}đ</p>
      </div>

      <p className="text-sm font-semibold text-charcoal mb-2">Xếp hạng theo tổng thưởng đã nhận</p>
      <div className="flex flex-col gap-2">
        {referrers.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Chưa có ai mời thành công.</p>}
        {referrers.map((r: Referrer) => (
          <div key={r.id} className="card p-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-charcoal">
                {r.firstName || r.username || r.telegramId}
                {r.referralLocked && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-red-50 text-red-500 text-[10px] align-middle">
                    ⚠ đang khoá hoa hồng
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-400">{r.totalInvited} người đã mời</p>
            </div>
            <p className="text-sm font-semibold text-charcoal">+{r.totalEarned.toLocaleString("vi-VN")}đ</p>
          </div>
        ))}
      </div>
    </main>
  );
}
