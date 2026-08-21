"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PanelGuard from "@/components/PanelGuard";

interface Task {
  id: string;
  name: string;
  reward: number;
  adNetwork: string;
  adFormat: string;
  isActive: boolean;
  marginPercent: number | null;
}

export default function PanelTasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [name, setName] = useState("");
  const [reward, setReward] = useState("");
  const [adNetwork, setAdNetwork] = useState("monetag");
  const [adFormat, setAdFormat] = useState("interstitial");
  const [adScript, setAdScript] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [cooldownSec, setCooldownSec] = useState("0");
  const [dailyLimit, setDailyLimit] = useState("");
  const [marginPercent, setMarginPercent] = useState("");
  const [creating, setCreating] = useState(false);

  function loadTasks(initData: string) {
    fetch(`/api/panel/tasks?initData=${encodeURIComponent(initData)}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []));
  }

  async function createTask(initData: string) {
    if (!name || !reward) return;
    if (adNetwork !== "monetag" && !adScript) return; // monetag uses global SDK, no per-task script needed
    setCreating(true);
    const res = await fetch("/api/panel/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        initData,
        name,
        reward,
        adScript: adNetwork === "monetag" ? "" : adScript,
        adNetwork,
        adFormat,
        cooldownSec,
        dailyLimit: dailyLimit || null,
        marginPercent: marginPercent || null,
      }),
    });
    setCreating(false);
    if (res.ok) {
      setName("");
      setReward("");
      setAdScript("");
      setAdFormat("interstitial");
      setCooldownSec("0");
      setDailyLimit("");
      setMarginPercent("");
      loadTasks(initData);
    }
  }

  async function toggleTask(initData: string, id: string) {
    await fetch(`/api/panel/tasks/${id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    loadTasks(initData);
  }

  return (
    <PanelGuard>
      {(initData) => (
        <TasksInner
          initData={initData}
          tasks={tasks}
          loadTasks={loadTasks}
          name={name}
          setName={setName}
          reward={reward}
          setReward={setReward}
          adNetwork={adNetwork}
          setAdNetwork={setAdNetwork}
          adFormat={adFormat}
          setAdFormat={setAdFormat}
          adScript={adScript}
          setAdScript={setAdScript}
          zoneId={zoneId}
          setZoneId={setZoneId}
          cooldownSec={cooldownSec}
          setCooldownSec={setCooldownSec}
          dailyLimit={dailyLimit}
          setDailyLimit={setDailyLimit}
          marginPercent={marginPercent}
          setMarginPercent={setMarginPercent}
          creating={creating}
          createTask={createTask}
          toggleTask={toggleTask}
          router={router}
        />
      )}
    </PanelGuard>
  );
}

function TasksInner(props: any) {
  const {
    initData, tasks, loadTasks, name, setName, reward, setReward,
    adNetwork, setAdNetwork, adFormat, setAdFormat, adScript, setAdScript, zoneId, setZoneId,
    cooldownSec, setCooldownSec, dailyLimit, setDailyLimit,
    marginPercent, setMarginPercent,
    creating, createTask, toggleTask, router,
  } = props;

  useEffect(() => {
    loadTasks(initData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData]);

  return (
    <main className="px-4 pt-6 pb-10 max-w-md mx-auto">
      <button onClick={() => router.back()} className="text-gray-400 text-sm mb-4">
        ← Quay lại
      </button>
      <h1 className="font-display text-2xl font-semibold gold-text mb-4">Nhiệm vụ</h1>

      <div className="card p-5 flex flex-col gap-3 mb-6">
        <p className="text-sm font-semibold text-charcoal mb-1">Tạo nhiệm vụ mới</p>
        <input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Tên nhiệm vụ"
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        <select value={adNetwork} onChange={(e: any) => setAdNetwork(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <option value="monetag">Monetag</option>
          <option value="adsterra">Adsterra</option>
          <option value="custom">Khác</option>
        </select>

        {adNetwork === "monetag" ? (
          <>
            <p className="text-xs text-gray-400 bg-ivory rounded-xl px-3 py-2">
              Monetag dùng chung 1 zone cấu hình ở "Cài đặt &amp; Hướng dẫn" — không cần Zone ID/script riêng cho từng nhiệm vụ.
            </p>
            <select value={adFormat} onChange={(e: any) => setAdFormat(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
              <option value="interstitial">Rewarded Interstitial (toàn màn hình)</option>
              <option value="popup">Rewarded Popup (mở trang offer)</option>
            </select>
          </>
        ) : (
          <>
            <input value={zoneId} onChange={(e: any) => setZoneId(e.target.value)} placeholder="Zone ID (nếu có)"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            <textarea value={adScript} onChange={(e: any) => setAdScript(e.target.value)} rows={4}
              placeholder="Dán script bên thứ 3 vào đây"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono" />
          </>
        )}

        <input value={reward} onChange={(e: any) => setReward(e.target.value)} type="number"
          placeholder={adNetwork === "monetag" ? "Số tiền ước tính hiển thị cho user" : "Số tiền nhận được"}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />

        {adNetwork === "monetag" && (
          <>
            <p className="text-xs text-gray-400 bg-ivory rounded-xl px-3 py-2">
              Số tiền thực tế được cộng tính ngay theo giá trị thật của từng lượt xem
              (estimated_price Monetag gửi kèm postback) × tỷ lệ % bên dưới — số ở ô trên
              chỉ là ước tính hiển thị cho user, không phải số tiền chính xác sẽ trả.
            </p>
            <input value={marginPercent} onChange={(e: any) => setMarginPercent(e.target.value)} type="number"
              placeholder="Tỷ lệ trả user (%) — để trống dùng mặc định hệ thống"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </>
        )}

        <div className="flex gap-2">
          <input value={cooldownSec} onChange={(e: any) => setCooldownSec(e.target.value)} type="number"
            placeholder="Cooldown (giây)" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          <input value={dailyLimit} onChange={(e: any) => setDailyLimit(e.target.value)} type="number"
            placeholder="Giới hạn/ngày" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <button onClick={() => createTask(initData)} disabled={creating} className="btn-gold py-3 text-sm mt-1">
          {creating ? "Đang tạo..." : "Tạo nhiệm vụ"}
        </button>
      </div>

      <p className="text-sm font-semibold text-charcoal mb-3">Danh sách nhiệm vụ</p>
      <div className="flex flex-col gap-3">
        {tasks.map((t: Task) => (
          <div key={t.id} className="card p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-charcoal">{t.name}</p>
              <p className="text-xs text-gray-400">
                +{t.reward.toLocaleString("vi-VN")}đ · {t.adNetwork}
                {t.adNetwork === "monetag" && ` · ${t.adFormat === "popup" ? "Popup" : "Interstitial"}`}
                {t.adNetwork === "monetag" && t.marginPercent != null && ` · margin ${t.marginPercent}%`}
              </p>
            </div>
            <button
              onClick={() => toggleTask(initData, t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                t.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}
            >
              {t.isActive ? "Đang bật" : "Đã tắt"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
