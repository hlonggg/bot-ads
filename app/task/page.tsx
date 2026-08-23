"use client";
import { useEffect, useState } from "react";
import { useTelegram } from "@/lib/useTelegram";
import BottomNav from "@/components/BottomNav";
import { loadMonetagZoneScript, showMonetagRewardedInterstitial, showMonetagRewardedPopup, extractMonetagZoneId } from "@/lib/monetagSdk";

interface Task {
  id: string;
  name: string;
  reward: number;
  adNetwork: string;
  adFormat: string;
  cooldownSec: number;
  dailyLimit: number | null;
}

interface ClaimResult {
  requestId: string;
  adNetwork: string;
  adFormat: string;
  adScript: string | null; // only populated for non-monetag networks
}

export default function TaskPage() {
  const { initData, ready } = useTelegram();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [monetagZoneId, setMonetagZoneId] = useState<string | null>(null);
  const [monetagReady, setMonetagReady] = useState(false);

  // Load task list + the ONE global Monetag zone script for the whole page,
  // exactly once — per Monetag docs, loading the SDK per-task/multiple times
  // is an explicitly documented mistake.
  useEffect(() => {
    if (!ready || !initData) return;
    fetch(`/api/tasks?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .finally(() => setLoading(false));

    fetch(`/api/settings?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then(async (d) => {
        const scriptHtml = d.settings?.monetagZoneScript;
        // Zone ID nằm sẵn trong chính script Monetag đưa — không cần admin
        // nhập/lưu riêng, tự tách ra từ đây để tránh lệch số giữa 2 nơi.
        const zoneId = scriptHtml ? extractMonetagZoneId(scriptHtml) : null;
        if (zoneId && scriptHtml) {
          setMonetagZoneId(zoneId);
          try {
            await loadMonetagZoneScript(zoneId, scriptHtml);
            setMonetagReady(true);
          } catch {
            setMonetagReady(false);
          }
        }
      });
  }, [ready, initData]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function startTask(task: Task) {
    if (pendingTaskId) return; // avoid double-trigger while one ad flow is in progress

    if (task.adNetwork === "monetag" && !monetagReady) {
      showToast("Quảng cáo đang tải, thử lại sau vài giây");
      return;
    }

    setPendingTaskId(task.id);

    try {
      const res = await fetch(`/api/tasks/${task.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const data: ClaimResult & { error?: string; retryAfterSec?: number } = await res.json();

      if (!res.ok) {
        if (data.error === "cooldown") showToast(`Vui lòng chờ ${data.retryAfterSec}s`);
        else if (data.error === "already_completed") showToast("Nhiệm vụ này đã hoàn thành");
        else if (data.error === "daily_limit_reached") showToast("Đã đạt giới hạn hôm nay");
        else showToast("Không thể bắt đầu nhiệm vụ");
        return;
      }

      if (data.adNetwork === "monetag" && monetagZoneId) {
        try {
          // preload -> show chain (interstitial) or direct pop, tied by ymid=requestId
          if (data.adFormat === "popup") {
            await showMonetagRewardedPopup(monetagZoneId, data.requestId);
          } else {
            await showMonetagRewardedInterstitial(monetagZoneId, data.requestId);
          }
          // Monetag postback (server-side, đáng tin cậy) có thể tới sau vài giây/phút.
          // Trong lúc chờ Monetag khắc phục việc gửi postback, tự xác nhận tạm qua
          // client ngay khi SDK báo đã chạy xong — xem cảnh báo rủi ro chi tiết trong
          // app/api/tasks/[id]/confirm/route.ts. Nếu postback thật tới trước/sau, route
          // đó tự bỏ qua (idempotent), không cộng tiền 2 lần.
          const confirmRes = await fetch(`/api/tasks/${task.id}/confirm`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData, requestId: data.requestId }),
          });
          if (confirmRes.ok) {
            showToast("Đã cộng thưởng!");
            fetch(`/api/tasks?initData=${encodeURIComponent(initData)}`)
              .then((r) => r.json())
              .then((d) => setTasks(d.tasks || []));
          } else {
            showToast("Đang chờ xác nhận thưởng...");
          }
        } catch {
          // Ad failed/skipped client-side — free up the cooldown/daily-limit slot
          await fetch(`/api/tasks/${task.id}/cancel`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData, requestId: data.requestId }),
          });
          showToast("Quảng cáo không khả dụng, thử lại sau");
        }
      } else {
        // Non-Monetag networks: adScript is a custom embed you're responsible for
        // triggering per that network's own docs — hook it up here when ready.
        showToast("Định dạng quảng cáo này chưa được hỗ trợ trên giao diện");
      }
    } finally {
      setPendingTaskId(null);
    }
  }

  return (
    <main className="pb-24 px-4 pt-6 max-w-md mx-auto">
      <h1 className="font-display text-3xl font-semibold gold-text mb-1">Nhiệm vụ</h1>
      <p className="text-gray-500 text-sm mb-6">Hoàn thành nhiệm vụ để nhận thưởng</p>

      {loading && <p className="text-gray-400 text-sm">Đang tải...</p>}
      {!loading && tasks.length === 0 && (
        <div className="card p-6 text-center text-gray-400">Chưa có nhiệm vụ nào</div>
      )}

      <div className="flex flex-col gap-3">
        {tasks.map((task) => (
          <div key={task.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-charcoal">{task.name}</p>
              <p className="text-gold-dark text-sm font-medium">
                +{task.reward.toLocaleString("vi-VN")}đ
              </p>
            </div>
            <button
              onClick={() => startTask(task)}
              disabled={pendingTaskId === task.id}
              className="btn-gold px-4 py-2 text-sm disabled:opacity-50"
            >
              {pendingTaskId === task.id ? "Đang tải..." : "Bắt đầu"}
            </button>
          </div>
        ))}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-charcoal text-white text-sm px-4 py-2 rounded-full z-50">
          {toast}
        </div>
      )}

      <BottomNav />
    </main>
  );
}
