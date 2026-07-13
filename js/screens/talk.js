// =====================================================================
// はなす画面: 質問トークデッキ
// 2人とも答えると、おたがいの答えが見られる。答えるとごはん+経験値。
// =====================================================================
import { S, me, partner, partnerUid, personOf } from "../core/state.js";
import { esc, dailyPick, fmtDateTimeJP, toast, modal } from "../core/ui.js";
import { QUESTIONS, LEVEL_NAMES, LEVEL_ICONS } from "../data/questions.js";
import { r, get, set } from "../core/firebase.js";
import { addFood, bumpStat } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { checkAll } from "../core/achievements.js";
import { refresh } from "../core/router.js";

let answers = {};   // qid -> {uid: {a, ts}} のキャッシュ
let loaded = false;
let curLevel = 1;

export async function render(el) {
  if (!loaded) {
    el.innerHTML = `<div class="loading-inline">よみこみ中…</div>`;
    const snap = await get(r("talk"));
    answers = snap.val() || {};
    loaded = true;
  }
  const daily = dailyPick(QUESTIONS, 3);
  const pu = partnerUid();

  const statusOf = (q) => {
    const a = answers[q.id] || {};
    const mine = !!a[S.uid];
    const theirs = !!(pu && a[pu]);
    if (mine && theirs) return "open";
    if (mine) return "wait";
    return "todo";
  };
  const chip = { open: `<span class="chip ok">みられる</span>`, wait: `<span class="chip">あいて待ち</span>`, todo: `<span class="chip todo">こたえる</span>` };

  el.innerHTML = `
  <div class="talk">
    <h2 class="page-title">💬 はなす</h2>

    <button class="card daily-q" data-q="${daily.id}">
      <small>きょうの1問 ${LEVEL_ICONS[daily.level]}</small>
      <b>${esc(daily.text)}</b>
      ${chip[statusOf(daily)]}
    </button>

    <div class="lv-chips">
      ${[1, 2, 3].map((l) => `
        <button class="lv-chip ${curLevel === l ? "on" : ""}" data-lv="${l}">
          ${LEVEL_ICONS[l]} ${LEVEL_NAMES[l]}
        </button>`).join("")}
    </div>

    <div class="q-list">
      ${QUESTIONS.filter((q) => q.level === curLevel).map((q) => `
        <button class="q-item" data-q="${q.id}">
          <span class="q-text">${esc(q.text)}</span>${chip[statusOf(q)]}
        </button>`).join("")}
    </div>
    <p class="dim center small-note">こたえると 🍚+1・ペットに✨+10。<br>2人ともこたえると、おたがいの答えが見られるよ。</p>
  </div>`;

  el.querySelectorAll(".lv-chip").forEach((b) => {
    b.onclick = () => { curLevel = +b.dataset.lv; render(el); };
  });
  el.querySelectorAll("[data-q]").forEach((b) => {
    b.onclick = () => openQuestion(QUESTIONS.find((q) => q.id === b.dataset.q), el);
  });
}

function openQuestion(q, screenEl) {
  const a = answers[q.id] || {};
  const mine = a[S.uid];
  const pu = partnerUid();
  const theirs = pu ? a[pu] : null;

  // 両方回答ずみ → 見せ合い
  if (mine && theirs) {
    const meP = personOf(S.uid), paP = personOf(pu);
    modal({
      title: `${LEVEL_ICONS[q.level]} ${esc(q.text)}`,
      body: `
        <div class="ans-view" style="--pc:${meP.color}">
          <small>${meP.emoji} ${esc(meP.name)}・${fmtDateTimeJP(mine.ts)}</small>
          <p>${esc(mine.a)}</p></div>
        <div class="ans-view" style="--pc:${paP.color}">
          <small>${paP.emoji} ${esc(paP.name)}・${fmtDateTimeJP(theirs.ts)}</small>
          <p>${esc(theirs.a)}</p></div>`,
      actions: [{ label: "とじる", cls: "btn-primary" }],
    });
    return;
  }
  // 自分は回答ずみ → 相手待ち
  if (mine) {
    modal({
      title: `${LEVEL_ICONS[q.level]} ${esc(q.text)}`,
      body: `<div class="ans-view"><small>あなたの答え</small><p>${esc(mine.a)}</p></div>
             <p class="dim center">あいてがこたえたら見せ合えるよ</p>`,
      actions: [{ label: "とじる", cls: "btn-primary" }],
    });
    return;
  }
  // 未回答 → 回答フォーム
  const body = document.createElement("div");
  body.innerHTML = `
    <textarea class="ans-input" rows="4" maxlength="200" placeholder="すなおな気持ちでどうぞ"></textarea>
    <p class="dim">そうしんすると変更できないよ。${theirs ? "あいてはもう答えてる!" : ""}</p>`;
  const m = modal({
    title: `${LEVEL_ICONS[q.level]} ${esc(q.text)}`,
    body,
    actions: [
      { label: "やめる", cls: "btn-ghost" },
      { label: "こたえる", cls: "btn-primary", onClick: async (close) => {
          const text = body.querySelector(".ans-input").value.trim();
          if (!text) { toast("なにか書いてみて", "✏️"); return; }
          const ans = { a: text, ts: Date.now() };
          await set(r(`talk/${q.id}/${S.uid}`), ans);
          answers[q.id] = { ...(answers[q.id] || {}), [S.uid]: ans };
          await addFood(1);
          await gainExp(10, "おしゃべり");
          await addPersonality("monoshiri", 2);
          await bumpStat("talkCount");
          logH("talk", { qid: q.id });
          toast("こたえた! 🍚+1", "💬");
          checkAll();
          close();
          refresh();
        } },
    ],
  });
  body.querySelector(".ans-input").focus();
}
