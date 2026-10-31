import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { deliveryFeedback, fetchLineQuota, normalizeLineQuota, sendConfiguredReport,
  sendLineMessage, sendTelegramMessage, splitTelegramText } from "../src/utils/notificationTransport.js";

const { reportSettings } = vi.hoisted(() => ({ reportSettings: {} }));
vi.mock("../src/data/store.js", () => ({ getSettings: () => reportSettings }));
import { sendDailySummary, sendShiftReport, sendShiftOpenNotification, sendSupplyCheckNotification } from "../src/utils/lineNotify.js";

const line = { enabled: true, channelAccessToken: "synthetic-line-token", targetId: "synthetic-target", notifications: { dailySummary: true } };
const telegram = { enabled: true, botToken: "12345:synthetic-token", chatId: "-10012345", notifications: { dailySummary: true } };
const quota = { ok: true, quota: { type: "limited", value: 300 }, consumption: { totalUsage: 250 }, month: "2026-10", fetchedAt: "2026-10-31T10:00:00Z" };
const response = (body, ok = true) => ({ ok, status: ok ? 200 : 401, json: async () => body });
afterEach(() => { vi.unstubAllGlobals(); });

describe("independent report delivery", () => {
  it("still sends Telegram when LINE fails and reports partial success accurately", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error("synthetic failure")).mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    const result = await sendConfiguredReport({ line, telegram }, "dailySummary", "ยอดขาย ฿220");
    expect(result).toEqual({ line: "failed", telegram: "sent" });
    expect(deliveryFeedback(result)).toEqual({ text: "ส่งสำเร็จ: Telegram · ส่งไม่สำเร็จ: LINE — ตรวจการตั้งค่า", type: "warning" });
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
