// =====================================================================
// はなす画面: 質問トークデッキ
// ・毎日0時に、150問のプールから日替わりでお題を自動抽選(2人の画面で同じ)
// ・回答は S.talk(main.jsでリアルタイム購読)から描画 → 相手の回答が即反映
// ・「あいて待ち」表示中に相手が答えたら、自動で見せ合い画面に切り替わる
// =====================================================================
import { S, me, partnerUid, personOf, on, off } from "../core/state.js";
import { esc, dailyPick, todayStr, fmtDateTimeJP, toast, modal } from "../core/ui.js";
import { QUESTIONS, LEVEL_NAMES, LEVEL_ICONS } from "../data/questions.js";
import { r, set } from "../core/firebase.js";
import { addFood, bumpStat } from "../core/economy.js";
import { gainExp, addPersonality } from "../pet/pet.js";
import { logH } from "../core/history.js";
import { bumpMission } from "../core/missions.js";
import { checkAll } from "../core/achievements.js";
import { refresh } from "../core/router.js";

let curLevel = 1;
const PER_DAY = 6;        // 1レベルあたりの日替わり出題数
const RECENT_OPEN = 10;   // 「みせあったもの」の表示件数

// ---- 日替わり抽選(日付から決定的に選ぶ → 2人の画面で必ず同じお題になる) ----
function seedOf(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** きょうのお題(レベル別に PER_DAY 問)。過去との重複は許容(プールが大きいので毎日新鮮) */
export function todaysQuestions(level) {
  const pool = QUESTIONS.filter((q) => q.level === level);
  const rnd = mulberry32(seedOf(`${todayStr()}|hdm-talk|${level}`));
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, PER_DAY);
}

const A = () => S.talk || {};   // 回答データ(リアルタイム購読済み)

function statusOf(q) {
  const a = A()[q.id] || {};
  const pu = partnerUid();
  const mine = !!a[S.uid];
  const theirs = !!(pu && a[pu]);
  if (mine && theirs) return "open";
  if (mine) return "wait";
  return "todo";
}
const CHIP = {
  open: `<span class="chip ok">みられる</span>`,
  wait: `<span class="chip">あいて待ち</span>`,
  todo: `<span class="chip todo">こたえる</span>`,
};

export function render(el) {
  const daily = dailyPick(QUESTIONS, 3);
  const todays = todaysQuestions(curLevel);
  const shown = new Set([daily.id, ...[1, 2, 3].flatMap((l) => todaysQuestions(l).map((q) => q.id))]);

  // つづきのおはなし: 片方だけ回答済みで、きょうの出題に入っていないもの(取り残し防止)
  const pu = partnerUid();
  const partial = QUESTIONS.filter((q) => {
    if (shown.has(q.id)) return false;
    const a = A()[q.id] || {};
    const mine = !!a[S.uid], theirs = !!(pu && a[pu]);
    return (mine || theirs) && !(mine && theirs);
  });

  // みせあったもの: 両方回答済みを新しい順に少しだけ(読み返し用)
  const opened = QUESTIONS.filter((q) => {
    if (shown.has(q.id)) return false;
    const a = A()[q.id] || {};
    return a[S.uid] && pu && a[pu];
  }).sort((x, y) => {
    const t = (q) => Math.max(...Object.values(A()[q.id]).map((v) => v.ts || 0));
    return t(y) - t(x);
  }).slice(0, RECENT_OPEN);

  const item = (q) => `
    <button class="q-item" data-q="${q.id}">
      <span class="q-text">${esc(q.text)}</span>${CHIP[statusOf(q)]}
    </button>`;

  el.innerHTML = `
  <div class="talk">
    <h2 class="page-title">💬 はなす</h2>

    <button class="card daily-q" data-q="${daily.id}">
      <small>きょうの1問 ${LEVEL_ICONS[daily.level]}</small>
      <b>${esc(daily.text)}</b>
      ${CHIP[statusOf(daily)]}
    </button>

    <div class="lv-chips">
      ${[1, 2, 3].map((l) => `
        <button class="lv-chip ${curLevel === l ? "on" : ""}" data-lv="${l}">
          ${LEVEL_ICONS[l]} ${LEVEL_NAMES[l]}
        </button>`).join("")}
    </div>

    <div class="q-list">${todays.map(item).join("")}</div>
    <p class="dim center small-note">お題は毎日0時に自動で入れかわるよ。<br>こたえると 🍚+1・ペットに✨+10。2人ともこたえると見せ合える。</p>

    ${partial.length ? `<h4>つづきのおはなし(どちらかが回答ずみ)</h4>
      <div class="q-list">${partial.map(item).join("")}</div>` : ""}

    ${opened.length ? `<h4>みせあったもの(さいきん)</h4>
      <div class="q-list">${opened.map(item).join("")}</div>` : ""}
  </div>`;

  el.querySelectorAll(".lv-chip").forEach((b) => {
    b.onclick = () => { curLevel = +b.dataset.lv; render(el); };
  });
  el.querySelectorAll("[data-q]").forEach((b) => {
    b.onclick = () => openQuestion(QUESTIONS.find((q) => q.id === b.dataset.q));
  });
}

// ---------------------------------------------------------------------
// 質問モーダル
// ---------------------------------------------------------------------
function openQuestion(q) {
  const a = A()[q.id] || {};
  const mine = a[S.uid];
  const pu = partnerUid();
  const theirs = pu ? a[pu] : null;

  if (mine && theirs) return openReveal(q);
  if (mine) return openWaiting(q);
  return openForm(q, theirs);
}

/** 両方回答ずみ → 見せ合い */
function openReveal(q) {
  const a = A()[q.id];
  const pu = partnerUid();
  const meP = personOf(S.uid), paP = personOf(pu);
  modal({
    title: `${LEVEL_ICONS[q.level]} ${esc(q.text)}`,
    body: `
      <div class="ans-view" style="--pc:${meP.color}">
        <small>${meP.emoji} ${esc(meP.name)}・${fmtDateTimeJP(a[S.uid].ts)}</small>
        <p>${esc(a[S.uid].a)}</p></div>
      <div class="ans-view" style="--pc:${paP.color}">
        <small>${paP.emoji} ${esc(paP.name)}・${fmtDateTimeJP(a[pu].ts)}</small>
        <p>${esc(a[pu].a)}</p></div>`,
    actions: [{ label: "とじる", cls: "btn-primary" }],
  });
}

/** 自分だけ回答ずみ → 相手待ち。相手が答えた瞬間、自動で見せ合いに切り替わる */
function openWaiting(q) {
  const m = modal({
    title: `${LEVEL_ICONS[q.level]} ${esc(q.text)}`,
    body: `<div class="ans-view"><small>あなたの答え</small><p>${esc(A()[q.id][S.uid].a)}</p></div>
           <p class="dim center waiting-dots">あいてがこたえたら、自動でひらくよ</p>`,
    actions: [{ label: "とじる", cls: "btn-primary", onClick: (c) => { unhook(); c(); } }],
  });
  const handler = () => {
    if (!document.body.contains(m.el)) { unhook(); return; } // 既に閉じられていたら解除
    const a = A()[q.id] || {};
    const pu = partnerUid();
    if (a[S.uid] && pu && a[pu]) {   // 両方そろった → 自動で結果へ
      unhook();
      m.close();
      openReveal(q);
    }
  };
  const unhook = () => off("talk:change", handler);
  on("talk:change", handler);
}

/** 未回答 → 回答フォーム */
function openForm(q, theirs) {
  const body = document.createElement("div");
  body.innerHTML = `
    <textarea class="ans-input" rows="4" maxlength="200" placeholder="すなおな気持ちでどうぞ"></textarea>
    <p class="dim">そうしんすると変更できないよ。${theirs ? "あいてはもう答えてる!" : ""}</p>`;
  modal({
    title: `${LEVEL_ICONS[q.level]} ${esc(q.text)}`,
    body,
    actions: [
      { label: "やめる", cls: "btn-ghost" },
      { label: "こたえる", cls: "btn-primary", onClick: async (close) => {
          const text = body.querySelector(".ans-input").value.trim();
          if (!text) { toast("なにか書いてみて", "✏️"); return; }
          const ans = { a: text, ts: Date.now() };
          await set(r(`talk/${q.id}/${S.uid}`), ans);
          // リスナー反映前でも正しく遷移できるよう、手元のデータを先に更新
          S.talk = { ...(S.talk || {}), [q.id]: { ...((S.talk || {})[q.id] || {}), [S.uid]: ans } };
          await addFood(1);
          await gainExp(10, "おしゃべり");
          await addPersonality("monoshiri", 2);
          await bumpStat("talkCount");
    bumpMission("talk");
          logH("talk", { qid: q.id });
          toast("こたえた! 🍚+1", "💬");
          checkAll();
          close();
          refresh();
          openQuestion(q);  // 相手も回答ずみなら即見せ合い、まだなら自動切替つきの待機へ
        } },
    ],
  });
  body.querySelector(".ans-input").focus();
}
