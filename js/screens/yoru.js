// =====================================================================
// よるのとい(21時の同時開封)
// 1日1問。昼のあいだに各自こっそり回答 → 21時をすぎて2人そろっていたら
// 「同時開封」の儀式モーダルで見せあう。日付から決定的に出題(2人で同じ問)。
// データ: daily/{date}/yoru = { answers: {uid: text}, opened: true }
// =====================================================================
import { S, personOf, partnerUid } from "../core/state.js";
import { tx } from "../core/firebase.js";
import { esc, modal, toast, todayStr, confetti } from "../core/ui.js";
import { QUESTIONS } from "../data/questions.js";
import { learnWord } from "../core/memory.js";
import { SE } from "../core/sound.js";
import { logH } from "../core/history.js";
import { addHearts } from "../core/economy.js";

const OPEN_HOUR = 21;

function seedOf(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** きょうのとい(日付から決定的=2人とも同じ) */
export function todaysYoruQ() {
  const pool = QUESTIONS.filter((q) => q.level >= 2);
  return pool[seedOf(todayStr() + "|yoru") % pool.length];
}
export const yoruData = () => S.dailyToday?.yoru || {};
export const isOpenTime = () => new Date().getHours() >= OPEN_HOUR;

/** へやのキャンドルに出すバッジ状態 */
export function yoruState() {
  const d = yoruData();
  const mine = d.answers?.[S.uid] != null;
  const theirs = d.answers?.[partnerUid()] != null;
  if (isOpenTime() && mine && theirs) return d.opened ? "opened" : "ready"; // 開封できる!
  if (mine) return "waiting";
  return "todo";
}

export function openYoru() {
  const q = todaysYoruQ();
  const d = yoruData();
  const st = yoruState();
  const pu = partnerUid();
  const meP = personOf(S.uid), paP = personOf(pu);

  // ---- 開封の儀式 ----
  if (st === "ready" || st === "opened") {
    SE("level");
    confetti(30);
    tx(`daily/${todayStr()}/yoru/opened`, () => true).catch(() => {});
    if (st === "ready") { addHearts(1).catch(() => {}); logH("yoru", { q: q.text }); }
    modal({
      title: "🕯 よるのとい ─ 開封",
      cls: "m-wide",
      body: `
        <p class="yoru-q">${esc(q.text)}</p>
        <div class="wm-reveal hit">
          <div class="wm-ans" style="--pc:${meP.color}"><span>${meP.emoji} ${esc(meP.name)}</span><b>${esc(d.answers[S.uid])}</b></div>
          <div class="wm-vs">🌙</div>
          <div class="wm-ans" style="--pc:${paP.color}"><span>${paP.emoji} ${esc(paP.name)}</span><b>${esc(d.answers[pu])}</b></div>
        </div>
        <p class="dim center small">${st === "ready" ? "💗+1 ふたりのよるに かんぱい" : "きょうの開封ずみ"}</p>`,
      actions: [{ label: "おやすみ", cls: "btn-primary" }],
    });
    return;
  }

  // ---- 回答ずみ・まち ----
  if (st === "waiting") {
    const untilMsg = isOpenTime()
      ? `${esc(paP.name)}の回答をまっています`
      : `よる${OPEN_HOUR}時に、ふたりの答えが同時にひらくよ`;
    modal({
      title: "🕯 よるのとい",
      body: `<p class="yoru-q">${esc(q.text)}</p>
        <p class="center">あなたの答え: <b>${esc(d.answers[S.uid])}</b></p>
        <p class="center waiting-dots">${untilMsg}</p>`,
      actions: [{ label: "たのしみ", cls: "btn-ghost" }],
    });
    return;
  }

  // ---- 回答フォーム ----
  const body = document.createElement("div");
  body.innerHTML = `
    <p class="yoru-q">${esc(q.text)}</p>
    <p class="dim small center">答えは よる${OPEN_HOUR}時、ふたりそろって同時にひらくよ。それまでヒミツ🤫</p>
    <input class="txt-input" id="yoru-in" maxlength="40" placeholder="こっそり かいておく">`;
  modal({
    title: "🕯 よるのとい", body,
    actions: [
      { label: "あとで", cls: "btn-ghost" },
      { label: "ふうをする", cls: "btn-primary", onClick: async (close) => {
          const v = body.querySelector("#yoru-in").value.trim();
          if (!v) { toast("なにか かいてね", "🖋"); return; }
          const res = await tx(`daily/${todayStr()}/yoru/answers/${S.uid}`, (cur) => (cur != null ? false : v));
          if (res.committed) { learnWord(v); toast("ふうをした。よるが たのしみ", "🕯"); SE("tap"); }
          close();
        } },
    ],
  });
}
