// login.js — Login Page
import { getUsers, getSettings } from '../data/store.js';
import { login } from '../utils/auth.js';

export function renderLogin(onSuccess) {
  const app = document.getElementById('app');
  const s = getSettings();

  app.innerHTML = `
    <div class="login-page">
      <div class="login-bg-circles">
        <div class="login-circle c1"></div>
        <div class="login-circle c2"></div>
        <div class="login-circle c3"></div>
      </div>
      <div class="login-card">
        <div class="login-logo">
          ${s.companyLogo
            ? `<img src="${s.companyLogo}" alt="logo" class="login-logo-img">`
            : `<div class="login-logo-placeholder">🏨</div>`
          }
        </div>
        <h1 class="login-title">${s.companyName || 'Chomdoi Goods'}</h1>
        <p class="login-subtitle">Hotel Counter POS</p>

        <div class="login-form">
          <div class="form-group">
            <label class="form-label">👤 Username</label>
            <input class="form-input" id="login-username" type="text"
              placeholder="กรอก username" autocomplete="username" autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">🔒 Password</label>
            <div style="position:relative">
              <input class="form-input" id="login-password" type="password"
                placeholder="กรอก password" autocomplete="current-password"
                style="padding-right:3rem">
              <button id="login-toggle-pw" style="position:absolute;right:0.75rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1.1rem;color:var(--text-muted)">👁️</button>
            </div>
          </div>
          <div id="login-error" class="login-error" style="display:none"></div>
          <button class="btn btn-primary btn-lg btn-block" id="login-btn" style="margin-top:1rem">
            🔐 เข้าสู่ระบบ
          </button>
        </div>

        <div class="login-footer">Chomdoi Goods POS v2.1</div>
      </div>
    </div>
  `;

  // Toggle password visibility
  document.getElementById('login-toggle-pw').onclick = () => {
    const pw = document.getElementById('login-password');
    pw.type = pw.type === 'password' ? 'text' : 'password';
  };

  // Login handler
  const doLogin = async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (!username || !password) {
      errorEl.textContent = '⚠️ กรุณากรอก username และ password';
      errorEl.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ กำลังตรวจสอบ...';

    const users = getUsers();
    const user = await login(users, username, password);
    if (user) {
      onSuccess(user);
    } else {
      errorEl.textContent = '❌ Username หรือ Password ไม่ถูกต้อง (หรือยังไม่เปิดใช้งาน)';
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = '🔐 เข้าสู่ระบบ';
      document.getElementById('login-password').value = '';
    }
  };

  document.getElementById('login-btn').onclick = doLogin;
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('login-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-password').focus();
  });
}
