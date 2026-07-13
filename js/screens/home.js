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

// 吹き出しは20秒キャッシュ(データ更新のたびに変わるとうるさいため)
let bubble = { text: "", at: 0 };
function line(force = null) {
  if (force) { bubble = { text: speak(force), at: Date.now() }; return bubble.text; }
  if (Date.now() - bubble.at > 20000) bubble = { text: speak(), at: Date.now() };
  return bubble.text;
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

    <section class="room ${isNight() ? "night" : ""}">
      <div class="win"><span class="sky-icon">${isNight() ? "🌙" : "☀️"}</span></div>
      <div class="shelf">🪴</div>
      <div class="bubble" id="pet-bubble">${esc(line())}</div>
      <div class="pet-hit" id="pet-hit">${renderPetSVG(pet)}</div>
      <div class="rug"></div>
    </section>

    <section class="card gauges">
      <div class="g-head">
        <span class="g-name">${esc(pet.name)} <small>Lv${pet.level}・${STAGE_NAMES[stage]}${pet.form ? `・${FORMS[pet.form].icon}${FORMS[pet.form].name}` : ""}</small></span>
        <span class="g-mood">${MOOD_ICONS[mood]}</span>
      </div>
      <div class="g-row"><label>せいちょう</label>
        <div class="bar"><i style="width:${Math.min(100, Math.round((pet.exp / need) * 100))}%"></i></div>
        <small>${pet.exp}/${need}</small></div>
      <div class="g-row"><label>おなか</label>
        <div class="bar hun"><i style="width:${h}%"></i></div>
        <small>${h}</small></div>
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
  el.querySelector("#act-feed").onclick = async () => {
    await feed();
    setBubble(el, effHunger() >= 100 ? null : "fed");
  };
  const doPet = async () => {
    const { capped } = await petPet();
    setBubble(el, capped ? "pettedMax" : "petted");
    const hit = el.querySelector("#pet-hit");
    hit?.classList.remove("pop"); void hit?.offsetWidth; hit?.classList.add("pop");
  };
  el.querySelector("#act-pet").onclick = doPet;
  el.querySelector("#pet-hit").onclick = doPet;
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
