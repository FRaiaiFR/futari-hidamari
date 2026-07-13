// =====================================================================
// UI ユーティリティ(トースト / モーダル / 紙吹雪 / 日付 / テーマ)
// =====================================================================

/** XSS対策: ユーザー入力を描画する時は必ずこれを通す */
export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---- 日付 ------------------------------------------------------------
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1); return todayStr(d);
}
export const hourNow = () => new Date().getHours();
export const isNight = () => hourNow() >= 20 || hourNow() < 6;
export const isSleepTime = () => hourNow() >= 0 && hourNow() < 6;

export function fmtDateJP(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
export function fmtDateTimeJP(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function agoJP(ts) {
  if (!ts) return "しばらく前";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

/** 日付から決定的に選ぶ(毎日変わるが、2人の画面では同じになる) */
export function dailyPick(arr, salt = 0) {
  const t = todayStr();
  let h = salt;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

// ---- テーマ(昼 / 夜) --------------------------------------------------
export function applyTheme() {
  const pref = localStorage.getItem("hdm_theme") || "auto";
  const night = pref === "night" || (pref === "auto" && isNight());
  document.documentElement.dataset.theme = night ? "night" : "day";
}

// ---- トースト ---------------------------------------------------------
let toastTimer = null;
export function toast(msg, icon = "") {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    document.body.appendChild(el);
  }
  el.innerHTML = `${icon ? `<span class="t-ico">${icon}</span>` : ""}<span>${esc(msg)}</span>`;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---- モーダル ---------------------------------------------------------
/**
 * modal({ title, body, actions:[{label, cls, onClick}] , dismissable })
 * body は HTML文字列 か HTMLElement。戻り値 {el, close}
 */
export function modal({ title = "", body = "", actions = [], dismissable = true, cls = "" }) {
  const ovl = document.createElement("div");
  ovl.className = "m-ovl";
  const box = document.createElement("div");
  box.className = `m-box ${cls}`;
  box.innerHTML = `
    ${title ? `<div class="m-title">${title}</div>` : ""}
    <div class="m-body"></div>
    <div class="m-actions"></div>`;
  const bodyEl = box.querySelector(".m-body");
  if (typeof body === "string") bodyEl.innerHTML = body;
  else bodyEl.appendChild(body);

  const close = () => {
    ovl.classList.remove("in");
    setTimeout(() => ovl.remove(), 180);
  };
  const actEl = box.querySelector(".m-actions");
  for (const a of actions) {
    const b = document.createElement("button");
    b.className = `btn ${a.cls || ""}`;
    b.textContent = a.label;
    b.onclick = () => a.onClick ? a.onClick(close) : close();
    actEl.appendChild(b);
  }
  if (!actions.length) actEl.remove();
  if (dismissable) ovl.addEventListener("click", (e) => { if (e.target === ovl) close(); });

  ovl.appendChild(box);
  document.body.appendChild(ovl);
  requestAnimationFrame(() => ovl.classList.add("in"));
  return { el: box, close };
}

export function confirmDlg(msg, okLabel = "OK") {
  return new Promise((res) => {
    modal({
      body: `<p class="confirm-msg">${esc(msg)}</p>`,
      dismissable: false,
      actions: [
        { label: "やめる", cls: "btn-ghost", onClick: (c) => { c(); res(false); } },
        { label: okLabel, cls: "btn-primary", onClick: (c) => { c(); res(true); } },
      ],
    });
  });
}

// ---- 紙吹雪 -----------------------------------------------------------
export function confetti(n = 36) {
  const colors = ["#EF8E7D", "#6D9BC3", "#C9A548", "#8FBF88", "#F6C9D2"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.className = "confetti";
    p.style.left = `${Math.random() * 100}vw`;
    p.style.background = rand(colors);
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
    p.style.setProperty("--rot", `${Math.random() * 720 - 360}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 2600);
  }
}

export function vibrate(ms = 15) {
  if (localStorage.getItem("hdm_vib") === "off") return; // 設定でオフにできる
  try { navigator.vibrate?.(ms); } catch { /* 非対応端末は無視 */ }
}
