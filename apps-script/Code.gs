// LINE Proxy: retain legacy push requests and add read-only monthly quota requests.
function proxyJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function quotaMonth() {
  return Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM');
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    if (typeof payload.token !== 'string' || !payload.token.trim() || /[\r\n]/.test(payload.token)) {
      return proxyJson({ ok: false, error: 'TOKEN_REQUIRED' });
    }
    if (payload.action === 'quota') {
      var month = quotaMonth();
      var options = { method: 'get', headers: { 'Authorization': 'Bearer ' + payload.token }, muteHttpExceptions: true };
      var quota = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/quota', options);
      var consumption = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/quota/consumption', options);
      if (quota.getResponseCode() !== 200 || consumption.getResponseCode() !== 200) {
        return proxyJson({ ok: false, error: 'QUOTA_REQUEST_FAILED' });
      }
      if (quotaMonth() !== month) return proxyJson({ ok: false, error: 'MONTH_CHANGED' });
      return proxyJson({ ok: true, quota: JSON.parse(quota.getContentText()),
        consumption: JSON.parse(consumption.getContentText()), month: month, fetchedAt: new Date().toISOString() });
    }
    if (payload.action) return proxyJson({ ok: false, error: 'UNKNOWN_ACTION' });
    var response = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post', contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + payload.token },
      payload: JSON.stringify({ to: payload.to, messages: payload.messages }), muteHttpExceptions: true
    });
    return proxyJson({ ok: response.getResponseCode() === 200 });
  } catch (err) {
    // Never return an upstream exception that could include a credential or request URL.
    return proxyJson({ ok: false, error: 'PROXY_REQUEST_FAILED' });
  }
}

function doGet(e) {
  return proxyJson({ ok: true, msg: 'LINE Proxy OK', version: '2026-10-31', capabilities: ['push', 'quota'] });
}
