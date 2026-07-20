// =====================================================================
// シーンルーター(ワンシーン主義)
// タブUIは廃止。土台は常に「へや」(home)。他画面は部屋のモノに触れると
// 下からせり上がる「シート」として開く。既存画面の render(el) 契約は不変。
// 互換API: initRouter / show(id) / refresh は維持(呼び出し元を壊さない)。
// =====================================================================
import { S } from "./state.js";
import { SE } from "./sound.js";

const LOADERS = {
  home: () => import("../screens/home.js"),
  play: () => import("../screens/play.js"),
  talk: () => import("../screens/talk.js"),
  records: () => import("../screens/records.js"),
  other: () => import("../screens/other.js"),
};
const TITLES = { play: "🧸 あそびばこ", talk: "📮 ポスト", records: "📔 きろくのたな", other: "🚪 おへやのそと" };
const LOADED = {};
async function load(id) {
  if (!LOADED[id]) LOADED[id] = await LOADERS[id]();
  return LOADED[id];
}

let screenEl = null;   // へや(常設)
let sheetEl = null;    // シート本体
let sheetBody = null;
let openId = null;     // 開いているシートid(null=へやのみ)

export function initRouter(root) {
  root.innerHTML = `
    <main id="screen"></main>
    <div id="sheet" class="sheet" hidden>
      <div class="sheet-scrim"></div>
      <section class="sheet-panel" role="dialog">
        <header class="sheet-head">
          <span class="sheet-title"></span>
          <button class="sheet-close" aria-label="とじる">✕</button>
        </header>
        <div class="sheet-body"></div>
      </section>
    </div>`;
  screenEl = root.querySelector("#screen");
  sheetEl = root.querySelector("#sheet");
  sheetBody = sheetEl.querySelector(".sheet-body");
  sheetEl.querySelector(".sheet-close").onclick = closeSheet;
  sheetEl.querySelector(".sheet-scrim").onclick = closeSheet;
  S.tab = "home";
  show("home");
  // よく使うシートを裏で先読み(初回タップの体感を上げる)
  load("talk"); load("play");
}

export function closeSheet() {
  if (!openId) return;
  openId = null;
  S.tab = "home";
  sheetEl.classList.remove("in");
  setTimeout(() => { sheetEl.hidden = true; sheetBody.innerHTML = ""; }, 240);
  SE("tap");
}

export async function show(id) {
  if (id === "home" || !LOADERS[id]) {   // へやへ戻る
    closeSheet();
    const mod = await load("home");
    screenEl.scrollTop = 0;
    mod.render(screenEl);
    return;
  }
  const mod = await load(id);
  openId = id;
  S.tab = id;
  sheetEl.querySelector(".sheet-title").textContent = TITLES[id] || "";
  sheetEl.hidden = false;
  void sheetEl.offsetWidth;
  sheetEl.classList.add("in");
  sheetBody.scrollTop = 0;
  mod.render(sheetBody);
}

let t = null;
/** データ更新時の再描画: へやは常に、シートは開いていれば追随(200msデバウンス) */
export function refresh() {
  clearTimeout(t);
  t = setTimeout(async () => {
    if (!screenEl || !S.ready) return;
    if (LOADED.home) LOADED.home.render(screenEl);
    if (openId && LOADED[openId]) LOADED[openId].render(sheetBody);
  }, 200);
}
