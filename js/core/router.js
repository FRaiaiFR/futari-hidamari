// =====================================================================
// タブルーター(Lazy Load対応)
// 画面モジュールは初めて開くときに読み込む(⑲初回起動の高速化)。
// 画面モジュールは render(el) を実装するだけ。データ更新時は refresh() が
// 現在の画面だけを描き直す(入力はすべてモーダル内なので消えない)。
// =====================================================================
import { S } from "./state.js";

// 遅延読み込みテーブル(ホームだけは起動直後に必要なので先読みする)
const LOADERS = {
  home: () => import("../screens/home.js"),
  play: () => import("../screens/play.js"),
  talk: () => import("../screens/talk.js"),
  records: () => import("../screens/records.js"),
  other: () => import("../screens/other.js"),
};
const LOADED = {};
async function load(id) {
  if (!LOADED[id]) LOADED[id] = await LOADERS[id]();
  return LOADED[id];
}

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
  // 裏でよく使う画面を先読み(体感速度を上げつつ初回表示は妨げない)
  show("home").then(() => { load("play"); load("talk"); });
}

export async function show(id) {
  if (!LOADERS[id]) return;
  S.tab = id;
  document.querySelectorAll("#tabbar .tab").forEach((b) =>
    b.classList.toggle("on", b.dataset.id === id));
  const mod = await load(id);
  if (S.tab !== id) return;           // 読み込み中に別タブへ移動した場合
  // 画面は動かさず内容だけ差し替える(レイアウトシフト・アニメなし)。
  // スクロール位置は先頭へ戻すが、これは描画前に行うので視覚的な揺れは出ない。
  mod.render(screenEl);
  window.scrollTo(0, 0);
}

let t = null;
/** データ更新時の再描画(200msデバウンス) */
export function refresh() {
  clearTimeout(t);
  t = setTimeout(() => {
    if (screenEl && S.ready && LOADED[S.tab]) LOADED[S.tab].render(screenEl);
  }, 200);
}
