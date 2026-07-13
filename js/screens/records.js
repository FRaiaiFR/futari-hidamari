// =====================================================================
// きろく画面: 履歴 / じっせき / ごほうび券 / ペットの年表
// =====================================================================
import { S, me, personOf } from "../core/state.js";
import { esc, fmtDateTimeJP, confirmDlg } from "../core/ui.js";
import { fetchHistory, fetchPetLog } from "../core/history.js";
import { ACHIEVEMENTS, REWARDS } from "../data/masters.js";
import { useReward } from "../core/achievements.js";

let sub = "log";

export function render(el) {
  const u = me() || {};
  const st = u.stats || {};
  el.innerHTML = `
  <div class="records">
    <h2 class="page-title">📖 きろく</h2>
    <div class="stats-strip">
      <div><b>${st.wins || 0}</b><small>勝利</small></div>
      <div><b>${u.loginStreak || 0}</b><small>連続日</small></div>
      <div><b>💗${S.shared?.heartsTotal || 0}</b><small>かけら累計</small></div>
      <div><b>Lv${S.pet?.level || 1}</b><small>ペット</small></div>
    </div>
    <div class="lv-chips">
      ${[["log", "📜 履歴"], ["ach", "🏆 じっせき"], ["rw", "🎟️ ごほうび"], ["tl", "🐾 ねんぴょう"]]
        .map(([id, lb]) => `<button class="lv-chip ${sub === id ? "on" : ""}" data-s="${id}">${lb}</button>`).join("")}
    </div>
    <div id="rec-body"><div class="loading-inline">よみこみ中…</div></div>
  </div>`;
  el.querySelectorAll("[data-s]").forEach((b) => {
    b.onclick = () => { sub = b.dataset.s; render(el); };
  });
  const body = el.querySelector("#rec-body");
  if (sub === "log") paintLog(body);
  else if (sub === "ach") paintAch(body);
  else if (sub === "rw") paintRewards(body, el);
  else paintTimeline(body);
}

const H_LABEL = {
  login: (h) => "あそびに来た",
  feed: () => "ごはんをあげた 🍚",
  pet: () => "なでた 🫶",
  talk: () => "質問にこたえた 💬",
  game: (h) => h.gameId === "coin" ? `コイン対決(${h.win ? "勝ち🏆" : "まけ"})` : `ことばあわせ(💞×${h.matches ?? 0})`,
  achievement: (h) => `じっせき「${h.name}」を解除 🏆`,
  reward_get: (h) => `ごほうび券「${h.name}」をゲット 🎟️`,
  reward_use: (h) => `ごほうび券「${h.name}」を使った ✅`,
  dress: (h) => `「${h.name}」を買った 🎀`,
  invite: () => "対戦にさそった 🎮",
  abort: () => "対戦を中止した",
};

async function paintLog(body) {
  const items = await fetchHistory(60);
  if (!items.length) { body.innerHTML = `<p class="dim center">まだ記録がないよ。きょうから始めよう!</p>`; return; }
  body.innerHTML = `<div class="h-list">
    ${items.map((h) => {
      const p = personOf(h.uid);
      const label = (H_LABEL[h.type] || (() => h.type))(h);
      return `<div class="h-item" style="--pc:${p.color}">
        <span class="h-who">${p.emoji}</span>
        <span class="h-txt"><b>${esc(p.name)}</b> ${label}</span>
        <small>${fmtDateTimeJP(h.ts)}</small></div>`;
    }).join("")}
  </div>`;
}

function paintAch(body) {
  const got = me()?.achievements || {};
  body.innerHTML = `<div class="ach-grid">
    ${ACHIEVEMENTS.map((a) => `
      <div class="ach ${got[a.id] ? "on" : ""}">
        <span class="a-ico">${got[a.id] ? a.icon : "🔒"}</span>
        <b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
      </div>`).join("")}
  </div>
  <p class="dim center">${Object.keys(got).length} / ${ACHIEVEMENTS.length} 解除</p>`;
}

function paintRewards(body, screenEl) {
  const mine = me()?.rewards || {};
  const owned = REWARDS.filter((r) => mine[r.id] && !mine[r.id].usedAt);
  const used = REWARDS.filter((r) => mine[r.id]?.usedAt);
  const locked = REWARDS.filter((r) => !mine[r.id]);
  body.innerHTML = `
    <h4>つかえる券</h4>
    ${owned.length ? owned.map((rw) => `
      <div class="rw-item">
        <span class="rw-ico">${rw.icon}</span>
        <div class="rw-txt"><b>${esc(rw.name)}</b><small>${esc(rw.desc)}</small></div>
        <button class="btn btn-primary btn-sm" data-use="${rw.id}">使う</button>
      </div>`).join("") : `<p class="dim">いまは持っていないよ</p>`}
    <h4>これからの券</h4>
    ${locked.map((rw) => `
      <div class="rw-item locked">
        <span class="rw-ico">🔒</span>
        <div class="rw-txt"><b>${esc(rw.name)}</b><small>条件: ${esc(rw.condDesc)}</small></div>
      </div>`).join("")}
    ${used.length ? `<h4>つかった券</h4>` + used.map((rw) => `
      <div class="rw-item used">
        <span class="rw-ico">${rw.icon}</span>
        <div class="rw-txt"><b>${esc(rw.name)}</b><small>${fmtDateTimeJP(mine[rw.id].usedAt)} に使用</small></div>
      </div>`).join("") : ""}
    <p class="dim center small-note">「使う」を押して、あいてに画面を見せてね。現実のごほうびと交換!</p>`;
  body.querySelectorAll("[data-use]").forEach((b) => {
    b.onclick = async () => {
      const rw = REWARDS.find((x) => x.id === b.dataset.use);
      if (await confirmDlg(`「${rw.name}」を使う?あいてがそばにいるときに使ってね`, "使う!")) {
        await useReward(rw.id);
        render(screenEl);
      }
    };
  });
}

async function paintTimeline(body) {
  const items = await fetchPetLog(60);
  if (!items.length) { body.innerHTML = `<p class="dim center">まだ年表は空っぽ</p>`; return; }
  body.innerHTML = `<div class="tl">
    ${items.map((t) => `
      <div class="tl-item">
        <span class="tl-ico">${t.icon || "🐾"}</span>
        <div class="tl-txt">${esc(t.text)}<small>${fmtDateTimeJP(t.ts)}</small></div>
      </div>`).join("")}
  </div>`;
}
