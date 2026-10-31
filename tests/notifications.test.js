import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { deliveryFeedback, fetchLineQuota, normalizeLineQuota, sendConfiguredReport,
  sendLineMessage, sendTelegramMessage, splitTelegramText } from "../src/utils/notificationTransport.js";

const { reportSettings } = vi.hoisted(() => ({ reportSettings: {} }));
vi.mock("../src/data/store.js", () => ({ getSettings: () => reportSettings }));
import { sendDailySummary, sendShiftReport, sendShiftOpenNotification, sendSupplyCheckNotification } from "../src/utils/lineNotify.js";
import { buildShiftReportData } from "../src/utils/shiftReport.js";

const line = { enabled: true, channelAccessToken: "synthetic-line-token", targetId: "synthetic-target", notifications: { dailySummary: true } };
const telegram = { enabled: true, botToken: "12345:synthetic-token", chatId: "-10012345", notifications: { dailySummary: true } };
const quota = { ok: true, quota: { type: "limited", value: 300 }, consumption: { totalUsage: 250 }, month: "2026-10", fetchedAt: "2026-10-31T10:00:00Z" };
const response = (body, ok = true) => ({ ok, status: ok ? 200 : 401, json: async () => body });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("independent report delivery", () => {
  it("still sends Telegram when LINE fails and reports partial success accurately", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("synthetic failure")).mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const result = await sendConfiguredReport({ line, telegram }, "dailySummary", "ยอดขาย ฿220");
    expect(result).toEqual({ line: "failed", telegram: "sent" });
    expect(deliveryFeedback(result)).toEqual({ text: "ส่งสำเร็จ: Telegram · ส่งไม่สำเร็จ: LINE — ตรวจการตั้งค่า / การเชื่อมต่อ", type: "warning" });
    expect(fetch.mock.calls[1][0]).toBe("https://api.telegram.org/bot12345:synthetic-token/sendMessage");
    expect(fetch.mock.calls[1][1].body.get("chat_id")).toBe("-10012345");
    expect(fetch.mock.calls[1][1].body.get("text")).toBe("ยอดขาย ฿220");
  });
  it("honors each provider's switch and never falls back to an unconfigured recipient", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    expect(await sendConfiguredReport({ line: { ...line, enabled: false }, telegram: { ...telegram, notifications: {} } }, "dailySummary", "test"))
      .toEqual({ line: "disabled", telegram: "skipped" });
    expect(await sendConfiguredReport({ telegram: { ...telegram, chatId: null } }, "dailySummary", "test"))
      .toEqual({ line: "disabled", telegram: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("manual summary bypasses event switches, while retaining provider enable switches", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: true })));
    expect(await sendConfiguredReport({ telegram: { ...telegram, notifications: {} } }, "dailySummary", "test", { manual: true }))
      .toEqual({ line: "disabled", telegram: "sent" });
  });
  it("rejects upstream failure even on HTTP 200; keeps old LINE push body compatible", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ok: false })); vi.stubGlobal("fetch", fetch);
    expect(await sendLineMessage(line, "ข้อความ")).toBe(false);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ token: line.channelAccessToken, to: line.targetId, messages: [{ type: "text", text: "ข้อความ" }] });
    expect(await sendTelegramMessage(telegram, "test")).toBe(false);
  });
  it("splits long Unicode messages without losing characters or adding paid broadcast options", async () => {
    const text = "🛒สินค้า\n".repeat(1000);
    const parts = splitTelegramText(text);
    expect(parts.join("")).toBe(text);
    expect(parts.every(p => p.length <= 4000 && !/[\uD800-\uDBFF]$/.test(p))).toBe(true);
    const fetch = vi.fn().mockResolvedValue(response({ ok: true })); vi.stubGlobal("fetch", fetch);
    expect(await sendTelegramMessage(telegram, text)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(parts.length);
    expect(fetch.mock.calls[0][1].body.has("allow_paid_broadcast")).toBe(false);
    expect(fetch.mock.calls[0][1].body.has("parse_mode")).toBe(false);
  });
});

describe("Telegram explicit rate-limit rejections", () => {
  const rejection = (seconds, httpStatus = 429) => ({
    ...response({ ok: false, error_code: 429, parameters: { retry_after: seconds } }, httpStatus === 200),
    status: httpStatus,
  });
  it.each([429, 200])("waits retry_after and retries once for an explicit rejection (HTTP %s)", async (status) => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(rejection(1, status)).mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const delivery = sendTelegramMessage(telegram, "สรุปกะ");
    await vi.advanceTimersByTimeAsync(999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(await delivery).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not retry ambiguous network failures, authentication failures, or invalid/excessive waits", async () => {
    for (const seconds of [undefined, 0, -1, "1", 11]) {
      const fetch = vi.fn().mockResolvedValue(rejection(seconds)); vi.stubGlobal("fetch", fetch);
      expect(await sendTelegramMessage(telegram, "test")).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);
    }
    const network = vi.fn().mockRejectedValue(new Error("synthetic timeout")); vi.stubGlobal("fetch", network);
    expect(await sendTelegramMessage(telegram, "test")).toBe(false);
    expect(network).toHaveBeenCalledTimes(1);
    const unauthorized = vi.fn().mockResolvedValue(response({ ok: false }, false)); vi.stubGlobal("fetch", unauthorized);
    expect(await sendTelegramMessage(telegram, "test")).toBe(false);
    expect(unauthorized).toHaveBeenCalledTimes(1);
  });
  it("stops after one retry when Telegram continues rejecting", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValue(rejection(1)); vi.stubGlobal("fetch", fetch);
    const delivery = sendTelegramMessage(telegram, "test");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await delivery).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("retries only the rejected chunk without duplicating earlier accepted chunks", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce(response({ ok: true }))
      .mockResolvedValueOnce(rejection(1)).mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const delivery = sendTelegramMessage(telegram, "A".repeat(4000) + "B");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await delivery).toBe(true);
    expect(fetch.mock.calls.map(([, options]) => options.body.get("text")))
      .toEqual(["A".repeat(4000), "B", "B"]);
  });
});

describe("monthly LINE quota", () => {
  it("uses provider totals, clamps exhausted quota to zero, and handles no configured limit", () => {
    expect(normalizeLineQuota(quota)).toMatchObject({ remaining: 50, usage: 250, limit: 300, month: "2026-10" });
    expect(normalizeLineQuota({ ...quota, consumption: { totalUsage: 400 } }).remaining).toBe(0);
    expect(normalizeLineQuota({ ...quota, quota: { type: "none" } })).toMatchObject({ limit: null, remaining: null });
  });
  it("never interprets an unsupported proxy, invalid token, or missing data as zero remaining", async () => {
    for (const data of [{ ok: true }, { ...quota, ok: false }, { ...quota, consumption: {} }, { ...quota, quota: { type: "limited" } }]) {
      expect(() => normalizeLineQuota(data)).toThrow("LINE_QUOTA_UNAVAILABLE");
    }
    const fetch = vi.fn().mockResolvedValue(response(quota)); vi.stubGlobal("fetch", fetch);
    await expect(fetchLineQuota("")).rejects.toThrow("LINE_TOKEN_REQUIRED");
    expect(fetch).not.toHaveBeenCalled();
    expect((await fetchLineQuota("synthetic-token")).remaining).toBe(50);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ action: "quota", token: "synthetic-token" });
  });
});

function proxy(responses, months = ["2026-10", "2026-10"]) {
  const fetch = vi.fn().mockImplementation(() => {
    const item = responses.shift();
    if (item instanceof Error) throw item;
    return { getResponseCode: () => item.status || 200, getContentText: () => JSON.stringify(item.body) };
  });
  const context = { UrlFetchApp: { fetch }, Utilities: { formatDate: vi.fn(() => months.shift()) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (value) => ({ setMimeType: () => JSON.parse(value) }) } };
  runInNewContext(readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8"), context);
  return { fetch, post: (payload) => context.doPost({ postData: { contents: JSON.stringify(payload) } }), get: () => context.doGet() };
}

describe("Apps Script proxy compatibility and read-only quota", () => {
  it("uses GET quota endpoints only and retains legacy push", () => {
    const api = proxy([{ body: quota.quota }, { body: quota.consumption }]);
    const data = api.post({ action: "quota", token: line.channelAccessToken });
    expect(normalizeLineQuota(data).remaining).toBe(50);
    expect(api.fetch.mock.calls.map(c => c[0])).toEqual(["https://api.line.me/v2/bot/message/quota", "https://api.line.me/v2/bot/message/quota/consumption"]);
    expect(api.fetch.mock.calls.every(c => c[1].method === "get")).toBe(true);
    const old = proxy([{ body: {} }]);
    expect(old.post({ token: line.channelAccessToken, to: line.targetId, messages: [{ type: "text", text: "test" }] })).toEqual({ ok: true });
    expect(old.fetch.mock.calls[0][0]).toBe("https://api.line.me/v2/bot/message/push");
  });
  it("rejects malformed and unknown requests without making any send request", () => {
    const api = proxy([]);
    expect(api.post({ action: "quota" }).ok).toBe(false);
    expect(api.post({ action: "arbitrary-url", token: "test" }).ok).toBe(false);
    expect(api.fetch).not.toHaveBeenCalled();
  });
  it("does not leak upstream exceptions or report a mixed month's data", () => {
    const api = proxy([new Error("URL includes synthetic-secret")]);
    expect(api.post({ action: "quota", token: "test" })).toEqual({ ok: false, error: "PROXY_REQUEST_FAILED" });
    const rollover = proxy([{ body: quota.quota }, { body: quota.consumption }], ["2026-10", "2026-11"]);
    expect(rollover.post({ action: "quota", token: "test" })).toEqual({ ok: false, error: "MONTH_CHANGED" });
  });
});


describe("shared report content with Telegram only", () => {
  it("sends closing, opening, daily and supply reports even with LINE disabled", async () => {
    Object.assign(reportSettings, { currency: "฿", line: { ...line, enabled: false },
      telegram: { ...telegram, notifications: { dailySummary: true, onShiftClose: true } } });
    const fetch = vi.fn().mockResolvedValue(response({ ok: true })); vi.stubGlobal("fetch", fetch);
    const data = { name: "กะบ่าย", date: "31 ตุลาคม", startTime: "17:00", endTime: "00:00",
      totalSales: 220, cash: 80, transfer: 140, free: 20, totalBills: 6, totalShifts: 3 };
    expect((await sendShiftReport(data)).telegram).toBe("sent");
    expect((await sendShiftOpenNotification(data)).telegram).toBe("sent");
    expect((await sendDailySummary(data)).telegram).toBe("sent");
    expect((await sendSupplyCheckNotification({ date: "31 ตุลาคม", checkedBy: "Demo", items: [] })).telegram).toBe("sent");
    expect(fetch).toHaveBeenCalledTimes(4);
    const text = fetch.mock.calls[0][1].body.get("text");
    expect(text).toContain("ยอดรวม: ฿220");
    expect(text).toContain("เงินสด: ฿80");
    expect(text).toContain("โอน: ฿140");
    expect(text).toContain("ฟรี: ฿20");
  });
});

describe("closing report recovery without business mutations", () => {
  const state = {
    settings: { businessDayStartHour: 8 },
    shifts: [{ id: "closed", name: "กะบ่าย", status: "closed", businessDate: "2026-10-31",
      startTime: "2026-10-31T10:14:00Z", endTime: "2026-10-31T17:00:00Z", closedBy: { displayName: "Wan" } },
      { id: "active", name: "กะดึก", status: "active" }],
    transactions: [
      { shiftId: "closed", total: 120, items: [{ name: "น้ำดื่ม", qty: 12 }] },
      { shiftId: "closed", total: 100, paymentMethod: "transfer", items: [{ name: "น้ำดื่ม", qty: 10 }] },
      { shiftId: "closed", total: 80, paymentMethod: "free", items: [{ name: "น้ำดื่ม", qty: 8 }] },
      { shiftId: "other", total: 999, items: [{ name: "อื่น", qty: 1 }] },
    ],
    products: [{ name: "น้ำดื่ม", stock: 3, lowStockThreshold: 5 }],
  };
  it("uses only the selected shift, preserves business date across midnight and never changes stock or bills", () => {
    const original = structuredClone(state);
    const report = buildShiftReportData(state, "closed");
    expect(report).toMatchObject({ totalSales: 220, cash: 120, transfer: 100, free: 80,
      totalBills: 3, closedBy: "Wan", topProduct: "น้ำดื่ม (30 ชิ้น)", lowStockItems: state.products });
    expect(report.date).toContain("31 ตุลาคม");
    expect(buildShiftReportData(state, "active")).toBeNull();
    expect(buildShiftReportData(state, "deleted")).toBeNull();
    expect(state).toEqual(original);
  });
  it("does not misrepresent current stock as a historical closing count", () => {
    const report = buildShiftReportData(state, "closed", { resend: true });
    expect(report.lowStockItems).toEqual([]);
    expect(report.note).toContain("ไม่รวมสต็อกย้อนหลัง");
    expect(report.totalSales).toBe(220);
  });
  it("delivers identical closing report text to LINE and Telegram", async () => {
    Object.assign(reportSettings, {
      line: { ...line, notifications: { onShiftClose: true } },
      telegram: { ...telegram, notifications: { onShiftClose: true } },
    });
    const fetch = vi.fn().mockResolvedValue(response({ ok: true })); vi.stubGlobal("fetch", fetch);
    expect(await sendShiftReport(buildShiftReportData(state, "closed")))
      .toEqual({ line: "sent", telegram: "sent" });
    const lineText = JSON.parse(fetch.mock.calls[0][1].body).messages[0].text;
    expect(fetch.mock.calls[1][1].body.get("text")).toBe(lineText);
    expect(lineText).toContain("📊 สรุปกะ: กะบ่าย");
    expect(lineText).toContain("ยอดรวม: ฿220");
    expect(lineText).toContain("ฟรี: ฿80");
  });
  it("resends only to Telegram on request, bypasses auto-event flags and does not also resend LINE", async () => {
    Object.assign(reportSettings, { line, telegram: { ...telegram, notifications: { onShiftClose: false } } });
    const fetch = vi.fn().mockResolvedValue(response({ ok: true })); vi.stubGlobal("fetch", fetch);
    expect(await sendShiftReport(buildShiftReportData(state, "closed", { resend: true }), { manual: true, channels: ["telegram"] }))
      .toEqual({ line: "skipped", telegram: "sent" });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toContain("api.telegram.org");
    expect(fetch.mock.calls[0][1].body.get("text")).toContain("ส่งย้อนหลัง");
    expect(await sendConfiguredReport({ line, telegram: { ...telegram, enabled: false } }, "onShiftClose", "test", { manual: true, channels: ["telegram"] }))
      .toEqual({ line: "skipped", telegram: "disabled" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
