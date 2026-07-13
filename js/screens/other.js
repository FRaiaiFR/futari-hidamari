// =====================================================================
// その他タブ: プロフィール(称号) / ショップ準備中 / 設定
// =====================================================================
import { S, me, personOf } from "../core/state.js";
import { esc, toast, modal, confirmDlg, applyTheme, fmtDateJP } from "../core/ui.js";
import { TITLES } from "../data/masters.js";
import { renamePet } from "../pet/pet.js";
import { r, set, update, signOut, auth } from "../core/firebase.js";
import { APP } from "../config.js";

export function render(el) {
  const u = me();
  if (!u) { el.innerHTML = ""; return; }
  const meDef = personOf(S.uid);
  const myTitles = Object.keys(u.titles || {});
  const themePref = localStorage.getItem("hdm_theme") || "auto";
  const anniv = S.config?.anniversary || "";

  el.innerHTML = `
  <div class="other">
    <h2 class="page-title">⚙️ その他</h2>

    <section class="card prof-card" style="--pc:${meDef.color}">
      <div class="prof-head">
        <span class="prof-emoji">${meDef.emoji}</span>
        <div class="prof-txt">
          <b>${esc(u.name)}</b>
          <small>${u.equippedTitle && TITLES[u.equippedTitle] ? `「${esc(TITLES[u.equippedTitle].name)}」` : "称号なし"}</small>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-title">称号をえらぶ</button>
    </section>

    <section class="card shop-card">
      <div class="shop-head">🛍️ ショップ <span class="chip">じゅんびちゅう</span></div>
      <p class="dim">あたらしいスキンや家具は、これからのアップデートでとどくよ。<br>
      (きせかえの購入はホームの「きせかえ」からできます)</p>
    </section>

    <section class="card">
      <h3>せってい</h3>
      <div class="set-row">
        <span>🐣 ペットの名前</span>
        <button class="btn btn-ghost btn-sm" id="btn-rename">${esc(S.pet?.name || "")} をかえる</button>
      </div>
      <div class="set-row">
        <span>🎂 記念日</span>
        <button class="btn btn-ghost btn-sm" id="btn-anniv">${anniv ? esc(anniv) : "みせってい"}</button>
      </div>
      <div class="set-row">
        <span>🌙 よるのテーマ</span>
        <select id="sel-theme" class="sel">
          <option value="auto" ${themePref === "auto" ? "selected" : ""}>じどう(20時〜)</option>
          <option value="night" ${themePref === "night" ? "selected" : ""}>いつも夜</option>
          <option value="day" ${themePref === "day" ? "selected" : ""}>いつも昼</option>
        </select>
      </div>
      <div class="set-row">
        <span>🔔 バイブ</span>
        <select id="sel-vib" class="sel">
          <option value="on" ${localStorage.getItem("hdm_vib") !== "off" ? "selected" : ""}>オン</option>
          <option value="off" ${localStorage.getItem("hdm_vib") === "off" ? "selected" : ""}>オフ</option>
        </select>
      </div>
      <button class="btn btn-ghost" id="btn-logout">ログアウト</button>
    </section>

    <p class="dim center small-note">ふたりのひだまり v${APP.version}<br>
    ${S.config?.anniversary ? `記念日: ${esc(S.config.anniversary)}(この日は経験値2倍!)` : ""}</p>
  </div>`;

  // ---- 称号 ----
  el.querySelector("#btn-title").onclick = () => {
    const body = document.createElement("div");
    if (!myTitles.length) {
      body.innerHTML = `<p class="dim center">まだ称号を持っていないよ。<br>じっせきを解除するともらえる!</p>`;
    } else {
      body.innerHTML = `
        <div class="title-list">
          <button class="title-item ${!u.equippedTitle ? "on" : ""}" data-t="">つけない</button>
          ${myTitles.map((t) => `
            <button class="title-item ${u.equippedTitle === t ? "on" : ""}" data-t="${t}">
              🏅 ${esc(TITLES[t]?.name || t)}
            </button>`).join("")}
        </div>`;
    }
    const m = modal({ title: "🏅 称号をえらぶ", body, actions: [{ label: "とじる", cls: "btn-ghost", onClick: (c) => c() }] });
    body.querySelectorAll(".title-item").forEach((b) => {
      b.onclick = async () => {
        await update(r(`users/${S.uid}`), { equippedTitle: b.dataset.t || null });
        toast(b.dataset.t ? "称号をつけた!" : "称号をはずした", "🏅");
        m.close();
        render(el);
      };
    });
  };

  // ---- ペット名変更 ----
  el.querySelector("#btn-rename").onclick = () => {
    const body = document.createElement("div");
    body.innerHTML = `<input type="text" class="txt-input" id="in-name" maxlength="10"
      value="${esc(S.pet?.name || "")}" placeholder="10文字まで">`;
    const m = modal({
      title: "📛 ペットの名前", body,
      actions: [
        { label: "やめる", cls: "btn-ghost", onClick: (c) => c() },
        { label: "きめる!", cls: "btn-primary", onClick: async (c) => {
            const ok = await renamePet(body.querySelector("#in-name").value);
            if (ok) { toast("名前をかえたよ", "📛"); c(); render(el); }
            else toast("名前をいれてね", "✏️");
          } },
      ],
    });
    setTimeout(() => body.querySelector("#in-name")?.focus(), 50);
  };

  // ---- 記念日 ----
  el.querySelector("#btn-anniv").onclick = () => {
    const body = document.createElement("div");
    body.innerHTML = `
      <p class="dim small">ふたりの記念日をいれてね。まいとし この日は経験値2倍になるよ。</p>
      <input type="date" class="txt-input" id="in-anniv" value="${esc(S.config?.anniversary || "")}">`;
    modal({
      title: "🎂 記念日せってい", body,
      actions: [
        { label: "やめる", cls: "btn-ghost", onClick: (c) => c() },
        { label: "ほぞん", cls: "btn-primary", onClick: async (c) => {
            const v = body.querySelector("#in-anniv").value;
            if (!v) { toast("日付をえらんでね", "📅"); return; }
            await set(r("config/anniversary"), v);
            toast(`記念日を ${fmtDateJP(new Date(v).getTime())} にしたよ`, "🎂");
            c(); render(el);
          } },
      ],
    });
  };

  // ---- テーマ / バイブ ----
  el.querySelector("#sel-theme").onchange = (e) => {
    localStorage.setItem("hdm_theme", e.target.value);
    applyTheme();
    toast("テーマをかえたよ", "🌙");
  };
  el.querySelector("#sel-vib").onchange = (e) => {
    localStorage.setItem("hdm_vib", e.target.value);
  };

  // ---- ログアウト ----
  el.querySelector("#btn-logout").onclick = async () => {
    if (await confirmDlg("ログアウトする？", "ログアウト")) {
      sessionStorage.removeItem("hdm_key");
      await signOut(auth);
      location.reload();
    }
  };
}
