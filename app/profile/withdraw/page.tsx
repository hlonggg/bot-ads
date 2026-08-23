"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTelegram } from "@/lib/useTelegram";
import { VN_BANKS } from "@/lib/banks";

export default function WithdrawPage() {
  const { initData, ready } = useTelegram();
  const router = useRouter();
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [showBankList, setShowBankList] = useState(false);
  const [amount, setAmount] = useState("");
  const [balance, setBalance] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !initData) return;
    fetch(`/api/me?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => {
        setBalance(d.user?.balance ?? 0);
        setAccountName(d.user?.bankAccountName || "");
        setAccountNumber(d.user?.bankAccountNumber || "");
        setBankName(d.user?.bankName || "");
      });
  }, [ready, initData]);

  async function submit() {
    setMessage("");
    if (!accountName || !accountNumber || !bankName || !amount) {
      setMessage("Vui lòng điền đầy đủ thông tin");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/withdrawals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData,
        amount: Number(amount),
        bankAccountName: accountName,
        bankAccountNumber: accountNumber,
        bankName,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      if (data.error === "below_min") setMessage(`Số tiền tối thiểu là ${data.minWithdraw.toLocaleString("vi-VN")}đ`);
      else if (data.error === "insufficient_balance") setMessage("Số dư không đủ");
      else setMessage("Có lỗi xảy ra, thử lại sau");
      return;
    }
    router.push("/profile");
  }

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4">
        ← Quay lại
      </button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-1">Rút tiền</h1>
      <p className="text-gray-500 text-sm mb-6">
        Số dư khả dụng: <span className="font-semibold text-charcoal">{balance.toLocaleString("vi-VN")}đ</span>
      </p>

      <div className="card p-5 flex flex-col gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tên chủ tài khoản</label>
          <input
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
            placeholder="NGUYEN VAN A"
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Số tài khoản</label>
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ""))}
            inputMode="numeric"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
            placeholder="0123456789"
          />
        </div>

        <div className="relative">
          <label className="text-xs text-gray-500 mb-1 block">Ngân hàng</label>
          <button
            onClick={() => setShowBankList((s) => !s)}
            className="w-full text-left border border-gray-200 rounded-xl px-3 py-2 text-sm flex justify-between items-center"
          >
            <span className={bankName ? "text-charcoal" : "text-gray-400"}>{bankName || "Chọn ngân hàng"}</span>
            <span>▾</span>
          </button>
          {showBankList && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-gold">
              {VN_BANKS.map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setBankName(b);
                    setShowBankList(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-ivory"
                >
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-gray-500 mb-1 block">Số tiền cần rút</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
            placeholder="0"
          />
        </div>

        {message && <p className="text-red-500 text-xs">{message}</p>}

        <button onClick={submit} disabled={submitting} className="btn-gold py-3 text-sm mt-2">
          {submitting ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
        </button>
      </div>
    </main>
  );
}
