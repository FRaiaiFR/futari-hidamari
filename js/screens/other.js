// =====================================================================
// その他タブ: プロフィール(称号) / ショップ準備中 / 設定
// =====================================================================
import { S, me, personOf } from "../core/state.js";
import { esc, toast, modal, confirmDlg, applyTheme, fmtDateJP } from "../core/ui.js";
import { TITLES } from "../data/masters.js";
import { renamePet } from "../pet/pet.js";
import { r, set, update, tx, signOut, auth } from "../core/firebase.js";
import { APP } from "../config.js";
import { seOn, bgmOn, applySoundSettings, SE } from "../core/sound.js";
import { FURNITURE, FURN_SLOTS } from "../data/furniture.js";
import { pay, bumpStat } from "../core/economy.js";
import { logH } from "../core/history.js";
import { exportBackup } from "../core/backup.js";
import { openPetList } from "./home.js";
import { checkAll } from "../core/achievements.js";

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
      <div class="shop-head">🛍️ かぐショップ</div>
      <p class="dim small">買ったかぐは2人共有。へやに かざって もようがえしよう(きせかえはホームの🎀から)</p>
      <div id="furn-shop"></div>
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
        <span>🎵 BGM</span>
        <select id="sel-bgm" class="sel">
          <option value="on" ${bgmOn() ? "selected" : ""}>オン</option>
          <option value="off" ${!bgmOn() ? "selected" : ""}>オフ</option>
        </select>
      </div>
      <div class="set-row">
        <span>🔊 こうかおん</span>
        <select id="sel-se" class="sel">
          <option value="on" ${seOn() ? "selected" : ""}>オン</option>
          <option value="off" ${!seOn() ? "selected" : ""}>オフ</option>
        </select>
      </div>
      <div class="set-row">
        <span>🎂 ${esc(meDef.name)}の誕生日</span>
        <button class="btn btn-ghost btn-sm" id="btn-bday">${esc(S.config?.birthdays?.[S.meKey || u.profileKey] || "みせってい")}</button>
      </div>
      <div class="set-row">
        <span>🐾 ペットいちらん</span>
        <button class="btn btn-ghost btn-sm" id="btn-petlist">ひらく</button>
      </div>
      <div class="set-row">
        <span>📦 バックアップ書き出し</span>
        <button class="btn btn-ghost btn-sm" id="btn-backup">保存する</button>
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

  // ---- サウンド(⑦) ----
  el.querySelector("#sel-bgm").onchange = (e) => {
    localStorage.setItem("hdm_bgm", e.target.value);
    applySoundSettings();
  };
  el.querySelector("#sel-se").onchange = (e) => {
    localStorage.setItem("hdm_se", e.target.value);
    if (e.target.value === "on") SE("tap");
  };

  // ---- 誕生日(⑫) ----
  el.querySelector("#btn-bday").onclick = () => {
    const key = S.meKey || u.profileKey;
    const body = document.createElement("div");
    body.innerHTML = `<p class="dim small">当日はお祝い+プレゼント(年1回)がとどくよ</p>
      <input type="date" class="txt-input" id="in-bday" value="${esc(S.config?.birthdays?.[key] || "")}">`;
    modal({ title: "🎂 たんじょうび", body,
      actions: [
        { label: "やめる", cls: "btn-ghost" },
        { label: "ほぞん", cls: "btn-primary", onClick: async (c) => {
            const v = body.querySelector("#in-bday").value;
            if (!v) { toast("日付をえらんでね", "📅"); return; }
            await set(r(`config/birthdays/${key}`), v);
            toast("たんじょうびを登録したよ", "🎂"); c(); render(el);
          } },
      ] });
  };

  // ---- ペットいちらん / バックアップ ----
  el.querySelector("#btn-petlist").onclick = openPetList;
  el.querySelector("#btn-backup").onclick = exportBackup;

  // ---- かぐショップ(⑨) ----
  renderShop(el.querySelector("#furn-shop"), () => render(el));

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


// =====================================================================
// かぐショップ(⑨): スロットごとに1つ装備。買う→かざる→はずす
// =====================================================================
function renderShop(root, rerender) {
  const inv = S.shared?.furniture || {};
  const room = S.config?.room || {};
  const bySlot = {};
  for (const f of FURNITURE) (bySlot[f.slot] ||= []).push(f);

  root.innerHTML = Object.entries(bySlot).map(([slot, items]) => `
    <h4>${FURN_SLOTS[slot].name}</h4>
    <div class="dress-grid">
      ${items.map((f) => {
        const owned = !!inv[f.id];
        const on = room[slot] === f.id;
        const price = f.price.coins ? `🪙${f.price.coins}` : `💗${f.price.hearts}`;
        return `<button class="dress-item ${on ? "on" : ""} ${owned ? "" : "buy"}" data-id="${f.id}">
          ${f.icon}<b>${esc(f.name)}</b><small>${owned ? (on ? "かざってる" : "もってる") : price}</small>
        </button>`;
      }).join("")}
    </div>`).join("");

  root.querySelectorAll(".dress-item").forEach((b) => {
    b.onclick = async () => {
      const f = FURNITURE.find((x) => x.id === b.dataset.id);
      const owned = !!(S.shared?.furniture || {})[f.id];
      if (!owned) {
        const label = f.price.coins ? `🪙${f.price.coins}` : `💗${f.price.hearts}`;
        if (!(await confirmDlg(`「${f.name}」を ${label} で買う？(2人共有になるよ)`, "買う!"))) return;
        if (!(await pay(f.price))) { toast("ざんだかが たりない…", "🥲"); return; }
        await tx(`shared/furniture/${f.id}`, () => true);
        await bumpStat("buyCount");
        toast(`「${f.name}」を買った!`, f.icon);
        logH("furniture", { id: f.id, name: f.name });
        checkAll();
      } else {
        // かざる / はずす(部屋は2人共有なので config/room に保存)
        const cur = S.config?.room?.[f.slot];
        await tx(`config/room/${f.slot}`, () => (cur === f.id ? null : f.id));
        toast(cur === f.id ? "はずしたよ" : "かざったよ!", f.icon);
      }
      rerender();
    };
  });
}