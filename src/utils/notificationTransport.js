// Provider requests are independent: a failed LINE request must not stop Telegram.
export const LINE_PROXY_URL = "https://script.google.com/macros/s/AKfycbyN65QtU8E_BlLJNx8RdXX7SLcmwPX7GbOI0v2u7mkvcOL17QALVRutlbNKxe3_vhpi0g/exec";

async function requestJson(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, credentials: "omit" });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(`PROVIDER_HTTP_${response.status}`);
      error.status = response.status;
      if (response.status === 429) error.retryAfter = body.parameters?.retry_after;
      throw error;
    }
    return body;
  } finally { clearTimeout(timer); }
}

export async function sendLineMessage(config, text) {
  if (!config?.enabled || !config.channelAccessToken || !config.targetId) return false;
  try {
    const data = await requestJson(LINE_PROXY_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ token: config.channelAccessToken, to: config.targetId,
        messages: [{ type: "text", text }] }),
    });
    return data.ok === true;
  } catch { return false; }
}

export function splitTelegramText(text) {
  const chunks = [];
  let chunk = "";
  for (const char of text) {
    if (chunk.length + char.length > 4000) { chunks.push(chunk); chunk = ""; }
    chunk += char;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export async function sendTelegramMessage(config, text) {
  if (!config?.enabled || !/^\d+:[A-Za-z0-9_-]+$/.test(config.botToken || "") || !config.chatId) return false;
  try {
    for (const chunk of splitTelegramText(text)) {
      if (!await sendTelegramChunk(config, chunk)) return false;
    }
    return text.length > 0;
  } catch { return false; }
}

async function sendTelegramChunk(config, text) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let data;
    try {
      data = await requestJson(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
        method: "POST", body: new URLSearchParams({ chat_id: config.chatId, text }),
      });
    } catch (error) {
      // Never retry a timeout or connection failure: the message may have arrived.
      if (error.status !== 429) return false;
      data = { ok: false, error_code: 429, parameters: { retry_after: error.retryAfter } };
    }
    if (data.ok === true) return true;
    const seconds = data.error_code === 429 ? data.parameters?.retry_after : null;
    // Retry only an explicit rejection, once, with a bounded provider-specified wait.
    if (attempt > 0 || !Number.isSafeInteger(seconds) || seconds < 1 || seconds > 10) return false;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
  return false;
}

export async function sendConfiguredReport(settings, event, text, { manual = false, channels = ["line", "telegram"] } = {}) {
  const entries = await Promise.all([ ["line", sendLineMessage], ["telegram", sendTelegramMessage] ]
    .map(async ([name, send]) => {
      if (!channels.includes(name)) return [name, "skipped"];
      const config = settings[name];
      if (!config?.enabled) return [name, "disabled"];
      if (!manual && event && config.notifications?.[event] !== true) return [name, "skipped"];
      const ready = name === "line" ? config.channelAccessToken && config.targetId : config.botToken && config.chatId;
      if (!ready) return [name, "not_configured"];
      return [name, await send(config, text) ? "sent" : "failed"];
    }));
  return Object.fromEntries(entries);
}

export function deliveryFeedback(result) {
  const names = { line: "LINE", telegram: "Telegram" };
  const sent = Object.keys(names).filter(key => result?.[key] === "sent").map(key => names[key]);
  const failed = Object.keys(names).filter(key => ["failed", "not_configured"].includes(result?.[key])).map(key => names[key]);
  const skipped = Object.keys(names).filter(key => result?.[key] === "skipped").map(key => names[key]);
  return {
    text: [sent.length ? `ส่งสำเร็จ: ${sent.join(", ")}` : "", failed.length ? `ส่งไม่สำเร็จ: ${failed.join(", ")} — ตรวจการตั้งค่า / การเชื่อมต่อ` : ""].filter(Boolean).join(" · ") ||
      (skipped.length ? `ไม่ได้ส่งรายงาน: ${skipped.join(", ")} — ตรวจตัวเลือกรายงาน` : "ยังไม่มีช่องทางที่เปิดใช้งาน"),
    type: failed.length || !sent.length ? "warning" : "success",
  };
}

export function normalizeLineQuota(data) {
  const { quota, consumption, month, fetchedAt } = data || {};
  if (data?.ok !== true || !["limited", "none"].includes(quota?.type)
    || !Number.isSafeInteger(consumption?.totalUsage) || consumption.totalUsage < 0
    || !/^\d{4}-\d{2}$/.test(month || "") || !Number.isFinite(Date.parse(fetchedAt))) {
    throw new Error("LINE_QUOTA_UNAVAILABLE");
  }
  if (quota.type === "limited" && (!Number.isSafeInteger(quota.value) || quota.value < 0)) {
    throw new Error("LINE_QUOTA_UNAVAILABLE");
  }
  return { month, fetchedAt, usage: consumption.totalUsage,
    limit: quota.type === "limited" ? quota.value : null,
    remaining: quota.type === "limited" ? Math.max(0, quota.value - consumption.totalUsage) : null };
}

export async function fetchLineQuota(token) {
  if (!token) throw new Error("LINE_TOKEN_REQUIRED");
  const data = await requestJson(LINE_PROXY_URL, {
    method: "POST", headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action: "quota", token }),
  });
  return normalizeLineQuota(data);
}
