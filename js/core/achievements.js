// =====================================================================
// 実績・ごほうび券エンジン
// マスターデータ(masters.js)の cond を宣言的に評価し、
// 未解除のものが条件を満たしたら自動で解除・付与する。
// =====================================================================
import { tx } from "./firebase.js";
import { S, me } from "./state.js";
import { ACHIEVEMENTS, REWARDS, TITLES } from "../data/masters.js";
import { addCoins, addFood, addHearts } from "./economy.js";
import { toast, confetti } from "./ui.js";
import { logH } from "./history.js";

let checking = false;

/** 主要イベント後とデータ更新時に呼ぶ。何度呼んでも安全(冪等)。 */
export async function checkAll() {
  const u = me();
  if (!u || checking) return;
  checking = true;
  try {
    const ctx = { u, pet: S.pet || {}, shared: S.shared || {}, users: S.users };

    // ---- 実績 ----
    for (const def of ACHIEVEMENTS) {
      if (u.achievements?.[def.id]) continue;
      let ok = false;
      try { ok = !!def.cond(ctx); } catch { ok = false; }
      if (!ok) continue;
      // 二重解除防止: すでに書かれていたら中断
      const res = await tx(`users/${S.uid}/achievements/${def.id}`, (cur) =>
        cur ? false : Date.now());
      if (!res.committed) continue;
      await grant(def.reward || {});
      toast(`じっせき解除「${def.name}」`, def.icon);
      confetti(18);
      logH("achievement", { id: def.id, name: def.name });
    }

    // ---- ごほうび券 ----
    for (const rw of REWARDS) {
      if (u.rewards?.[rw.id]) continue;
      let ok = false;
      try { ok = !!rw.cond(ctx); } catch { ok = false; }
      if (!ok) continue;
      const res = await tx(`users/${S.uid}/rewards/${rw.id}`, (cur) =>
        cur ? false : { gotAt: Date.now(), usedAt: null });
      if (!res.committed) continue;
      toast(`ごほうび券ゲット「${rw.name}」`, rw.icon);
      confetti(18);
      logH("reward_get", { id: rw.id, name: rw.name });
    }
  } finally {
    checking = false;
  }
}

/** 実績報酬の付与 */
async function grant(reward) {
  if (reward.coins) await addCoins(reward.coins);
  if (reward.food) await addFood(reward.food);
  if (reward.hearts) await addHearts(reward.hearts);
  if (reward.title && TITLES[reward.title]) {
    await tx(`users/${S.uid}/titles/${reward.title}`, () => Date.now());
    toast(`しょうごう獲得「${TITLES[reward.title].name}」`, "🏅");
  }
}

/** ごほうび券を使う(使用日時を記録) */
export async function useReward(id) {
  const res = await tx(`users/${S.uid}/rewards/${id}`, (cur) => {
    if (!cur || cur.usedAt) return false;
    cur.usedAt = Date.now();
    return cur;
  });
  if (res.committed) {
    const def = REWARDS.find((x) => x.id === id);
    toast(`「${def?.name}」を使いました。あいてに見せてね！`, "✅");
    logH("reward_use", { id, name: def?.name });
  }
  return res.committed;
}
