# Ads Bot — Telegram Mini App kiếm tiền

Stack: Next.js 14 (App Router) · Prisma + PostgreSQL · Telegraf (webhook mode) · Tailwind

## Cấu trúc quyền quan trọng — đọc kỹ trước khi deploy

- **Không có API nào tin `telegramId` gửi thẳng từ client.** Mọi request đến từ Mini App đều
  mang theo `initData` (chuỗi Telegram Mini App cấp), server tự verify bằng HMAC với `BOT_TOKEN`
  (`lib/verifyInitData.ts`). Đây là điểm bắt buộc — nếu bỏ qua bước này, ai cũng có thể tự xưng
  là user bất kỳ và cộng tiền cho chính họ.
- **Nhiệm vụ không được cộng tiền khi client báo "đã xem xong".** Client chỉ gọi
  `/api/tasks/[id]/claim` để mở đơn `PENDING` + nhận script quảng cáo. Tiền chỉ được cộng khi
  Monetag/Adsterra gọi ngược **postback server-to-server** vào `/api/postback/monetag`
  (có `secret` riêng, không dùng chung với initData). Đây là chỗ chống gian lận cốt lõi bạn nhắc
  tới — thiếu bước này thì user F5 liên tục là fake được nhiệm vụ vô hạn.
- **Rút tiền trừ balance ngay khi tạo lệnh** (chuyển sang `pendingBalance`), tránh việc user bấm
  rút 2 lần cùng lúc rút được gấp đôi số dư trước khi admin kịp duyệt lệnh đầu.

## Cấu hình Postback trong Monetag SSP (bắt buộc, quyết định việc cộng tiền có đúng hay không)

Vào SSP dashboard → chọn zone → mục Postbacks → ô **"Your backend URL"** (đúng màn hình bạn thấy khi
bấm "+"), dán **nguyên văn** dòng sau (không sửa phần trong dấu `{}`, Monetag tự thay bằng giá trị thật):

```
https://<APP_URL>/api/postback/monetag?ymid={ymid}&event_type={event_type}&reward_event_type={reward_event_type}&estimated_price={estimated_price}&secret=<POSTBACK_SECRET_của_bạn>
```

Thay `<APP_URL>` bằng domain Railway thật, `<POSTBACK_SECRET_của_bạn>` bằng đúng giá trị bạn đặt ở biến `POSTBACK_SECRET`.

Hệ thống chỉ cộng tiền khi **`reward_event_type=valued`** (Monetag xác nhận sự kiện đã được tính
tiền) **và** `event_type=impression` (không cộng khi chỉ là `click`, tránh cộng đúp cho 1 lượt xem).
Nếu `reward_event_type=not_valued` (bị lọc do spam/gian lận), hệ thống tự đánh dấu REJECTED — không cộng.

## Cơ chế tính thưởng Monetag (theo giá trị thực từng lượt xem)

- **Monetag dùng 1 main zone duy nhất cho toàn app** (đúng theo tài liệu chính thức — sub-zone chỉ
  dùng nội bộ, không cấu hình riêng cho từng nhiệm vụ). Cấu hình `Monetag Main Zone ID` và
  `Script embed Monetag` (dán nguyên từ dashboard) ở panel **Cài đặt & Hướng dẫn**, dùng chung cho
  mọi nhiệm vụ Monetag.
- Trang Task nạp SDK này **đúng 1 lần** khi mở app (không nạp lại theo từng nhiệm vụ — nạp nhiều
  lần là lỗi phổ biến theo doc Monetag). Khi user bấm "Bắt đầu", client gọi
  `show_<zoneId>({ ymid: requestId })`, `requestId` chính là ID nội bộ để nối lại đúng
  `TaskCompletion` khi postback về.
- **Không dùng CPM trung bình theo zone nữa** (đã bỏ `lib/monetagCpm.ts` + cron `sync-cpm`) — vì
  Monetag không cấp API key công khai để lấy số này, và ngay cả khi lấy được thì CPM trung bình
  cập nhật trễ hàng giờ, không phản ánh đúng giá trị của từng lượt xem cụ thể, dễ gây lệch/lỗ.
- Thay vào đó, mỗi khi Monetag gọi postback xác nhận (`event_type=impression` &
  `reward_event_type=valued`), route `/api/postback/monetag` tính thưởng **ngay lập tức** từ
  `estimated_price` — giá trị doanh thu ước tính của ĐÚNG lượt xem đó, Monetag gửi kèm sẵn trong
  postback, không cần API/cron nào cả:
  ```
  reward (VND) = estimated_price (USD) * tỷ_giá_USD_VND * (marginPercent / 100)
  ```
  `marginPercent` lấy theo từng Task (`task.marginPercent`), nếu để trống thì dùng
  `Setting("defaultMarginPercent")`.
  Ví dụ lượt xem đó `estimated_price=0.002`, tỷ giá 26.000đ, margin 40% →
  `0.002 * 26000 * 0.4 ≈ 21đ` cộng ngay cho user.
- Số `reward` nhập khi tạo Task (Monetag) chỉ là **số ước tính hiển thị** trong danh sách nhiệm vụ
  cho user tham khảo — số tiền thực tế cộng vào ví luôn được tính lại theo `estimated_price` thật
  ở bước trên.
- Tỷ giá USD→VND lấy tự động từ API tỷ giá công khai (cache 1h), có fallback thủ công ở
  `Setting("usdVndRateManual")` nếu API tỷ giá lỗi.
- Với các nhiệm vụ **không phải Monetag** (Adsterra/khác), `reward` là số tiền cố định thật, được
  snapshot lúc claim và cộng nguyên số đó — các network này không gửi `estimated_price` qua
  postback này nên không áp dụng công thức trên.

### ⚠️ Fallback tạm: xác nhận qua client khi Monetag chưa gửi postback

Trong lúc chờ Monetag xử lý việc gửi postback (đã liên hệ support, xác nhận backend hoàn toàn
đúng bằng cách tự gọi tay `GET /api/postback/monetag?...` và cộng tiền thành công — vấn đề nằm ở
phía Monetag không gửi request), đã thêm route dự phòng `POST /api/tasks/[id]/confirm`:

- Client tự gọi route này ngay sau khi `show_<zoneId>().then()` resolve (SDK báo đã chạy xong),
  **không cần đợi postback** — cộng thưởng dùng số `task.reward` tĩnh (không có `estimated_price`
  thật ở đường này).
- **Đây là hướng đi kém tin cậy hơn** — Monetag chính thức cảnh báo dùng Frontend Callback để
  cộng thưởng là "Risky" vì Promise chỉ xác nhận SDK chạy xong, không đảm bảo quảng cáo thật sự
  được tính tiền/không gian lận. Ai rành kỹ thuật đều có thể tự gọi thẳng route này.
- Giảm rủi ro ở mức tối thiểu: bắt buộc xác thực Telegram initData thật, completion phải đúng
  thuộc về user gọi, và phải đã tồn tại đủ lâu (`MIN_AD_DURATION_SEC = 8` giây) mới cho confirm —
  chặn kiểu gọi ngay tức khắc sau claim.
- Mọi lượt xác nhận qua đường này được đánh dấu `confirmedVia: "client"`, hiện badge cảnh báo
  riêng ở panel **Lượt xem** để admin dễ soi bất thường (VD: 1 user confirm liên tục sát đúng
  ngưỡng 8s là dấu hiệu gọi thẳng API, không thật sự xem quảng cáo).
- Nếu postback thật của Monetag tới sau đó (dù completion đã CONFIRMED qua client), route
  postback tự bỏ qua (idempotent theo `requestId`), **không cộng tiền 2 lần**.
- **Khi Monetag xác nhận đã khắc phục việc gửi postback**, nên cân nhắc bỏ đoạn gọi `/confirm` ở
  `app/task/page.tsx` (giữ nguyên route để dự phòng, chỉ ngừng gọi từ client) và quay lại hoàn
  toàn dựa vào postback — an toàn hơn nhiều vì có xác nhận từ bên thứ 3 + `estimated_price` thật.

## Việc cần làm tiếp (chưa xong 100%, cần bạn hoàn thiện theo network thật)

1. **Adsterra không có postback chuẩn như Monetag** — Adsterra chủ yếu là revenue theo
   impression/CPM, không có "hoàn thành nhiệm vụ" per-user. Nếu dùng Adsterra cho task thưởng cố
   định, cách phổ biến là dùng **rewarded interstitial** của họ + đo qua callback JS `onAdView`
   phía client, kết hợp giới hạn IP/device để giảm gian lận — nhưng đây **không đủ an toàn bằng
   Monetag postback**. Tôi để `adNetwork: "custom"` fallback: nếu chọn "custom"/"adsterra", claim
   route hiện vẫn tạo `PENDING`, bạn cần thêm route xác nhận riêng tương ứng cách network đó cấp
   (search tài liệu network cụ thể bạn được cấp, vì mỗi affiliate có endpoint khác nhau).
2. **Chưa có cron dọn các `TaskCompletion` PENDING quá hạn** (ví dụ Monetag không gọi postback do
   user thoát ngang) — nên thêm 1 route chạy định kỳ (Railway Cron hoặc Vercel Cron) đánh dấu
   `REJECTED` sau X phút không nhận được postback.
3. **Rate limit cho `/api/tasks/[id]/claim`** ở tầng IP chưa có — hiện chỉ chặn theo cooldown/task,
   nên cân nhắc thêm middleware giới hạn request/phút để chặn bot spam claim hàng loạt task.

## Deploy lên Railway

1. Push code lên GitHub.
2. Railway → New Project → Deploy from GitHub → chọn repo.
3. Add plugin PostgreSQL (Railway tự set `DATABASE_URL`).
4. Vào Variables, thêm theo `.env.example` (BOT_TOKEN, APP_URL, ADMIN_IDS, POSTBACK_SECRET).
5. Build command mặc định `npm run build` (`prisma generate && next build` — không chạy
   `prisma db push` ở đây vì mạng nội bộ Railway `*.railway.internal` chỉ khả dụng ở runtime,
   không khả dụng lúc build; `prisma db push` được chuyển sang chạy trong `npm start`).
6. Sau khi deploy xong, gọi 1 lần `GET https://<APP_URL>/api/telegram/webhook` để đăng ký webhook.
7. Vào Telegram, `/start` bot, admin thì `/panel`.
