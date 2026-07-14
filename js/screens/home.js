// =====================================================================
// ホーム画面 = ペットの部屋(このアプリの中心)
// =====================================================================
import { S, me, partner, partnerUid, personOf } from "../core/state.js";
import { esc, isNight, agoJP, toast, modal } from "../core/ui.js";
import { renderPetSVG } from "../pet/petView.js";
import { feed, petPet, effHunger, moodOf, MOOD_ICONS, expNeed, stageForLevel, STAGE_NAMES, equip, PETS_PER_DAY } from "../pet/pet.js";
import { speak, todaysWish } from "../pet/dialogue.js";
import { boostToday, pay, bumpStat } from "../core/economy.js";
import { ACCESSORIES, SLOT_NAMES } from "../data/masters.js";
import { FORMS } from "../data/dialogues.js";
import { tx } from "../core/firebase.js";
import { show } from "../core/router.js";
import { logH } from "../core/history.js";
import { checkAll } from "../core/achievements.js";
import { MATCH_GAMES } from "../core/match.js";
import { todayStr } from "../core/ui.js";
import { feedFly } from "../core/fx.js";
import { SE } from "../core/sound.js";
import { cachedWeather } from "../core/weather.js";
import { aiLine } from "../pet/dialogue.js";
import { FURNITURE, FURN_SLOTS } from "../data/furniture.js";

let lastTickle = 0;

// 吹き出しは20秒キャッシュ(データ更新のたびに変わるとうるさいため)
let bubble = { text: "", at: 0 };
let aiAsked = 0;
function line(force = null) {
  if (force) { bubble = { text: speak(force), at: Date.now() }; return bubble.text; }
  if (Date.now() - bubble.at > 20000) {
    bubble = { text: speak(), at: Date.now() };
    // ㉒ AIセリフ: 設定されていれば裏で取得して差し替え(失敗時はそのまま)
    if (Date.now() - aiAsked > 60000) {
      aiAsked = Date.now();
      aiLine("idle").then((t) => {
        if (!t) return;
        bubble = { text: t, at: Date.now() };
        const b = document.querySelector("#pet-bubble");
        if (b) { b.textContent = t; b.classList.add("pop"); }
      });
    }
  }
  return bubble.text;
}

// ---- ペットいちらん(世代管理画面) ----
export function openPetList() {
  const cur = S.pet;
  const alumni = Object.values(S.alumni || {}).sort((a, b) => a.gen - b.gen);
  const body = document.createElement("div");
  body.innerHTML = `
    <div class="pl-list">
      <div class="pl-item now">
        <span class="pl-svg">${renderPetSVG(cur)}</span>
        <span class="pl-txt"><b>${esc(cur?.name || "")}</b> <i class="chip todo">そだてちゅう</i><br>
          <small>第${cur?.gen || 1}世代・Lv${cur?.level || 1}・${STAGE_NAMES[stageForLevel(cur?.level || 1)]}${cur?.form ? `・${FORMS[cur.form].name}` : ""}<br>
          ${new Date(cur?.bornAt || Date.now()).toLocaleDateString("ja-JP")} うまれ</small></span>
      </div>
      ${alumni.map((a) => `
        <div class="pl-item">
          <span class="pl-svg">${renderPetSVG({ ...a, level: 100, equipped: {} })}</span>
          <span class="pl-txt"><b>${esc(a.name)}</b> 🎓<br>
            <small>第${a.gen}世代・Lv100・${a.form ? FORMS[a.form].name : "とくべつ"}<br>
            ${new Date(a.bornAt).toLocaleDateString("ja-JP")}〜${new Date(a.graduatedAt).toLocaleDateString("ja-JP")} 卒業</small></span>
          <button class="pl-fav ${a.fav ? "on" : ""}" data-gen="${a.gen}">${a.fav ? "⭐" : "☆"}</button>
        </div>`).join("")}
    </div>
    ${alumni.length ? `<p class="dim center small">卒業生は へやで のんびり くらしています</p>`
      : `<p class="dim center small">Lv100までそだてると、卒業生としてここにならぶよ</p>`}`;
  modal({ title: "🐾 ペットいちらん", body, cls: "m-wide",
    actions: [{ label: "とじる", cls: "btn-ghost" }] });
  body.querySelectorAll(".pl-fav").forEach((b) => {
    b.onclick = async () => {
      await tx(`petAlumni/gen${b.dataset.gen}/fav`, (v) => !v);
      b.classList.toggle("on");
      b.textContent = b.classList.contains("on") ? "⭐" : "☆";
    };
  });
}

export function render(el) {
  const pet = S.pet;
  const u = me();
  if (!pet || !u) { el.innerHTML = ""; return; }

  const h = effHunger(pet);
  const mood = moodOf(pet);
  const need = expNeed(pet.level);
  const stage = stageForLevel(pet.level);
  const pu = partnerUid();
  const pa = partner();
  const paDef = pu ? personOf(pu) : null;
  const paOn = pu && S.presence[pu]?.online;
  const boost = boostToday() > 1;

  const wish = todaysWish();
  const wishDef = wish === "talk"
    ? { icon: "💬", name: "きょうの質問", tab: "talk" }
    : { icon: MATCH_GAMES[wish]?.icon, name: MATCH_GAMES[wish]?.name, tab: "play" };

  // 季節(⑤): 端末の日時で判定
  const mon = new Date().getMonth() + 1;
  const season = mon >= 3 && mon <= 5 ? "spring" : mon >= 6 && mon <= 8 ? "summer"
    : mon >= 9 && mon <= 11 ? "autumn" : "winter";
  // 天気(④): キャッシュから即時反映(取得はmain.jsが裏でやる)
  const weather = cachedWeather();
  // 誕生日(⑫)
  const mmdd = todayStr().slice(5);
  const bdayKey = Object.entries(S.config?.birthdays || {}).find(([, d]) => d && d.slice(5) === mmdd)?.[0];
  const bdayName = bdayKey ? personOf(Object.keys(S.users).find((u) => S.users[u]?.profileKey === bdayKey) || "")?.name : null;
  // 卒業生(過去ペット): 部屋でのんびり歩く(表示は4匹まで)
  const alumni = Object.values(S.alumni || {}).sort((a, b) => a.gen - b.gen).slice(-4);
  // 家具(⑨)
  const room = S.config?.room || {};
  const furnOf = (slot) => FURNITURE.find((f) => f.id === room[slot]);
  const rugItem = furnOf("rug");

  const meDone = !!S.dailyToday?.[S.uid];
  const paDone = !!(pu && S.dailyToday?.[pu]);
  const heartDone = !!S.dailyToday?.heartGranted;

  el.innerHTML = `
  <div class="home">
    <header class="topbar">
      <div class="wallet">
        <span title="コイン">🪙${u.coins || 0}</span>
        <span title="ごはん">🍚${u.food || 0}</span>
        <span title="ハートのかけら">💗${S.shared?.hearts || 0}</span>
      </div>
      ${paDef ? `
        <div class="p-chip" style="--pc:${paDef.color}">
          <i class="dot ${paOn ? "on" : ""}"></i>${esc(paDef.name)}
          <small>${paOn ? "オンライン" : agoJP(S.presence[pu]?.last)}</small>
        </div>` : `<div class="p-chip"><small>あいての初ログイン待ち</small></div>`}
    </header>

    ${boost ? `<div class="anniv-banner">🎂 きょうは記念日! 経験値2倍デー!</div>` : ""}
    ${bdayName ? `<div class="anniv-banner bday">🎉 きょうは${esc(bdayName)}のたんじょうび!</div>` : ""}

    <section class="room ${isNight() ? "night" : ""} season-${season}" id="room">
      <div class="win w-${weather}">
        <span class="sky-icon">${isNight() ? "🌙" : weather === "rain" ? "🌧" : weather === "snow" ? "🌨" : weather === "cloud" ? "☁️" : "☀️"}</span>
        ${weather === "rain" ? `<i class="wfx rain"></i>` : weather === "snow" ? `<i class="wfx snowf"></i>` : ""}
        ${furnOf("window") ? `<span class="furn" style="${FURN_SLOTS.window.pos}">${furnOf("window").icon}</span>` : ""}
      </div>
      <div class="shelf">${furnOf("plant")?.icon || "🪴"}</div>
      ${furnOf("bed") ? `<span class="furn" style="${FURN_SLOTS.bed.pos}">${furnOf("bed").icon}</span>` : ""}
      ${furnOf("clock") ? `<span class="furn" style="${FURN_SLOTS.clock.pos}">${furnOf("clock").icon}</span>` : ""}
      ${furnOf("shelfd") ? `<span class="furn" style="${FURN_SLOTS.shelfd.pos}">${furnOf("shelfd").icon}</span>` : ""}
      ${furnOf("poster") ? `<span class="furn furn-poster" style="${FURN_SLOTS.poster.pos}">${furnOf("poster").icon}</span>` : ""}
      <div class="lamp"></div>
      ${season !== "summer" ? `<div class="season-fx">${"<i></i>".repeat(6)}</div>` : ""}
      <div class="bubble" id="pet-bubble">${esc(line())}</div>
      ${alumni.map((a, i) => `
        <div class="walker walker-${i}" title="${esc(a.name)}(第${a.gen}世代)">
          ${renderPetSVG({ ...a, level: 100, equipped: {} })}
          <span class="walker-z">💤</span>
        </div>`).join("")}
      <div class="pet-hit mood-${mood}" id="pet-hit">${renderPetSVG(pet)}</div>
      <div class="rug" ${rugItem?.rug ? `style="background:radial-gradient(ellipse at 50% 40%, ${rugItem.rug}, transparent 75%)"` : ""}></div>
    </section>

    <section class="card gauges">
      <div class="g-head">
        <span class="g-name">${esc(pet.name)} <small>Lv${pet.level}・${STAGE_NAMES[stage]}${pet.form ? `・${FORMS[pet.form].icon}${FORMS[pet.form].name}` : ""}</small></span>
        <span class="g-side"><button class="btn btn-ghost btn-sm" id="btn-pets">🐾 みんな</button>
        <span class="g-mood">${MOOD_ICONS[mood]}</span></span>
      </div>
      <div class="g-row"><label>せいちょう</label>
        <div class="bar"><i style="width:${Math.min(100, Math.round((pet.exp / need) * 100))}%"></i></div>
        <small>${pet.exp}/${need}</small></div>
      <div class="g-row"><label>おなか</label>
        <div class="bar hun"><i style="width:${h}%"></i></div>
        <small>${h}</small></div>
    </section>

    <section class="card todo-card">
      <div class="hc-title">🌱 きょうのおせわ</div>
      <div class="todo-row">
        <span class="todo ${meDone ? "ok" : ""}">${meDone ? "✓" : "1"} 会いにくる</span>
        <span class="todo ${h >= 60 ? "ok" : ""}">${h >= 60 ? "✓" : "2"} おなかを満たす</span>
        <span class="todo ${(pet.petsToday?.date === todayStr() && (pet.petsToday?.[S.uid] || 0) > 0) ? "ok" : ""}">${(pet.petsToday?.date === todayStr() && (pet.petsToday?.[S.uid] || 0) > 0) ? "✓" : "3"} なでる</span>
        <span class="todo ${heartDone ? "ok" : ""}">${heartDone ? "✓" : "4"} ふたりそろう</span>
      </div>
    </section>

    <section class="actions">
      <button class="act" id="act-feed">🍚<span>ごはん<b>×${u.food || 0}</b></span></button>
      <button class="act" id="act-pet">🫶<span>なでる<b>${Math.max(0, PETS_PER_DAY - (pet.petsToday?.date === todayStr() ? pet.petsToday?.[S.uid] || 0 : 0))}</b></span></button>
      <button class="act" id="act-dress">🎀<span>きせかえ</span></button>
    </section>

    <section class="card heart-card ${heartDone ? "done" : ""}">
      <div class="hc-title">💗 きょうのふたり</div>
      <div class="hc-row">
        <span class="hc-p ${meDone ? "ok" : ""}">${personOf(S.uid).emoji} ${esc(u.name)} ${meDone ? "✓" : "…"}</span>
        <span class="hc-p ${paDone ? "ok" : ""}">${paDef ? `${paDef.emoji} ${esc(paDef.name)}` : "？"} ${paDone ? "✓" : "…"}</span>
      </div>
      <p class="hc-msg">${heartDone ? "きょうは2人そろった! 💗+1 ゲットずみ" : "2人が同じ日にあそぶと 💗のかけら+1"}</p>
    </section>

    <button class="card wish-card" id="wish-card">
      <span class="wc-ico">${wishDef.icon}</span>
      <span class="wc-txt"><b>${esc(pet.name)}のおねだり</b><br>「${esc(wishDef.name)}が見たいな!」</span>
      <span class="wc-go">→</span>
    </button>
  </div>`;

  // ---- 操作 ----
  el.querySelector("#act-feed").onclick = async (e) => {
    if ((me()?.food || 0) < 1 || effHunger() >= 100) { await feed(); return; } // 在庫なし等はfeed内のトーストに任せる
    const hit = el.querySelector("#pet-hit");
    feedFly(e.currentTarget, hit, () => setBubble(el, "fed")); // ①放物線→もぐもぐ
    await feed();
  };
  el.querySelector("#btn-pets").onclick = openPetList;
  const doPet = async () => {
    const { capped } = await petPet();
    setBubble(el, capped ? "pettedMax" : "petted");
    const hit = el.querySelector("#pet-hit");
    hit?.classList.remove("pop"); void hit?.offsetWidth; hit?.classList.add("pop");
  };
  el.querySelector("#act-pet").onclick = doPet;
  // ⑥ 長押しくすぐり(550ms押しっぱなし)。連打防止3秒。タップ(なでる)とは両立
  const hitEl = el.querySelector("#pet-hit");
  let pressTimer = null, tickled = false;
  hitEl.addEventListener("pointerdown", () => {
    tickled = false;
    pressTimer = setTimeout(() => {
      tickled = true;
      if (Date.now() - lastTickle < 3000) return;   // 連打防止
      lastTickle = Date.now();
      SE("tickle");
      hitEl.classList.remove("tickle"); void hitEl.offsetWidth; hitEl.classList.add("tickle");
      setBubble(el, "tickled");
    }, 550);
  });
  const cancelPress = () => clearTimeout(pressTimer);
  hitEl.addEventListener("pointerup", cancelPress);
  hitEl.addEventListener("pointerleave", cancelPress);
  hitEl.addEventListener("click", () => { if (!tickled) doPet(); });
  el.querySelector("#act-dress").onclick = openDressup;
  el.querySelector("#wish-card").onclick = () => show(wishDef.tab);
}

function setBubble(el, event) {
  const b = el.querySelector("#pet-bubble");
  if (!b) return;
  bubble = { text: speak(event || undefined), at: Date.now() };
  b.textContent = bubble.text;
  b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop");
}

// ---- きせかえモーダル ----------------------------------------------------
function openDressup() {
  const body = document.createElement("div");
  const m = modal({ title: "🎀 きせかえ", body, cls: "m-wide" });
  const paint = () => {
    const inv = S.shared?.inventory || {};
    const eq = S.pet?.equipped || {};
    const owned = ACCESSORIES.filter((a) => inv[a.id]);
    const shop = ACCESSORIES.filter((a) => !inv[a.id]);
    body.innerHTML = `
      <div class="dress-pre">${renderPetSVG(S.pet)}</div>
      <h4>もっているもの</h4>
      ${owned.length ? `<div class="dress-grid">
        ${owned.map((a) => `
          <button class="dress-item ${eq[a.slot] === a.id ? "on" : ""}" data-id="${a.id}">
            <span>${a.icon}</span><b>${esc(a.name)}</b><small>${SLOT_NAMES[a.slot]}</small>
          </button>`).join("")}
      </div>` : `<p class="dim">まだ何ももっていないみたい</p>`}
      <h4>おみせ</h4>
      <div class="dress-grid">
        ${shop.map((a) => `
          <button class="dress-item buy" data-buy="${a.id}">
            <span>${a.icon}</span><b>${esc(a.name)}</b>
            <small>${a.price.coins ? `🪙${a.price.coins}` : `💗${a.price.hearts}`}</small>
          </button>`).join("")}
      </div>`;
    body.querySelectorAll("[data-id]").forEach((b) => {
      b.onclick = async () => {
        const acc = ACCESSORIES.find((x) => x.id === b.dataset.id);
        const cur = S.pet?.equipped?.[acc.slot];
        await equip(acc.slot, cur === acc.id ? null : acc.id);
        setTimeout(paint, 250);
      };
    });
    body.querySelectorAll("[data-buy]").forEach((b) => {
      b.onclick = async () => {
        const acc = ACCESSORIES.find((x) => x.id === b.dataset.buy);
        const ok = await pay(acc.price);
        if (!ok) { toast("ざんねん、ざんだかが足りない…", "💸"); return; }
        await tx(`shared/inventory/${acc.id}`, () => Date.now());
        await equip(acc.slot, acc.id);
        await bumpStat("buyCount");
        logH("dress", { id: acc.id, name: acc.name });
        toast(`「${acc.name}」を買った!`, acc.icon);
        checkAll();
        setTimeout(paint, 250);
      };
    });
  };
  paint();
}
