// =====================================================================
// タブルーター
// 画面モジュールは render(el) を実装するだけ。データ更新時は refresh() が
// 現在の画面だけを描き直す(入力はすべてモーダル内なので消えない)。
// =====================================================================
import { S } from "./state.js";
import * as home from "../screens/home.js";
import * as play from "../screens/play.js";
import * as talk from "../screens/talk.js";
import * as records from "../screens/records.js";
import * as other from "../screens/other.js";

const SCREENS = { home, play, talk, records, other };
const TABS = [
  { id: "home", icon: "🏠", label: "ホーム" },
  { id: "play", icon: "🎮", label: "あそぶ" },
  { id: "talk", icon: "💬", label: "はなす" },
  { id: "records", icon: "📖", label: "きろく" },
  { id: "other", icon: "⚙️", label: "その他" },
];

let screenEl = null;

export function initRouter(root) {
  root.innerHTML = `
    <main id="screen"></main>
    <nav id="tabbar">
      ${TABS.map((t) => `
        <button class="tab" data-id="${t.id}">
          <span class="tab-ico">${t.icon}</span><span class="tab-lb">${t.label}</span>
        </button>`).join("")}
    </nav>`;
  screenEl = root.querySelector("#screen");
  root.querySelector("#tabbar").addEventListener("click", (e) => {
    const b = e.target.closest(".tab");
    if (b) show(b.dataset.id);
  });
  show("home");
}

export function show(id) {
  if (!SCREENS[id]) return;
  S.tab = id;
  document.querySelectorAll("#tabbar .tab").forEach((b) =>
    b.classList.toggle("on", b.dataset.id === id));
  screenEl.scrollTop = 0;
  SCREENS[id].render(screenEl);
}

let t = null;
/** データ更新時の再描画(200msデバウンス) */
export function refresh() {
  clearTimeout(t);
  t = setTimeout(() => { if (screenEl && S.ready) SCREENS[S.tab]?.render(screenEl); }, 200);
}
