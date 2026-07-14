// =====================================================================
// 週間ミッション
// 週キー(その週の月曜の日付)ごとにカウンタを持つ → 週が変われば自動で白紙。
// 進捗は users/{uid}/weekly/{weekKey}/ に保存。
// ★ ミッション追加は MISSIONS に1オブジェクト足すだけ。
// =====================================================================
import { tx } from "./firebase.js";
import { S, me } from "./state.js";
import { toast, confetti, todayStr } from "./ui.js";
import { addCoins, addFood } from "./economy.js";
import { logH } from "./history.js";

/** 今週のキー(月曜はじまり) */
export function weekKey(d = new Date()) {
  const day = (d.getDay() + 6) % 7;            // 月=0 … 日=6
  const mon = new Date(d);
  mon.setDate(d.getDate() - day);
  return `w${todayStr(mon)}`;
}

export const MISSIONS = [
  { id: "m_feed",  stat: "feed",  target: 10, icon: "🍚", name: "ごはんを10回あげる",   reward: { coins: 60 } },
  { id: "m_pet",   stat: "pet",   target: 20, icon: "🫶", name: "20回なでる",           reward: { coins: 60 } },
  { id: "m_game",  stat: "game",  target: 5,  icon: "🎮", name: "対決を5回あそぶ",      reward: { coins: 80, food: 2 } },
  { id: "m_login", stat: "login", target: 5,  icon: "📅", name: "5日ログインする",      reward: { coins: 100 } },
  { id: "m_talk",  stat: "talk",  target: 5,  icon: "💬", name: "質問に5回こたえる",    reward: { food: 3 } },
];

/** ミッション進捗を進める(feed / pet / game / login / talk) */
export function bumpMission(stat, n = 1) {
  if (!S.uid) return;
  return tx(`users/${S.uid}/weekly/${weekKey()}/${stat}`, (v) => (v || 0) + n)
    .catch((e) => console.error("bumpMission", e));
}

/** 今週の進捗(表示用) */
export function weeklyProgress() {
  return me()?.weekly?.[weekKey()] || {};
}

/** 達成したミッションの報酬を受け取る(1週1回・二重防止) */
export async function claimMission(id) {
  const def = MISSIONS.find((x) => x.id === id);
  if (!def) return false;
  const wk = weekKey();
  const prog = weeklyProgress();
  if ((prog[def.stat] || 0) < def.target) return false;
  const res = await tx(`users/${S.uid}/weekly/${wk}/claimed_${id}`, (v) => (v ? false : Date.now()));
  if (!res.committed) return false;
  if (def.reward.coins) await addCoins(def.reward.coins);
  if (def.reward.food) await addFood(def.reward.food);
  toast(`ミッション達成「${def.name}」!`, def.icon);
  confetti(20);
  logH("mission", { id, name: def.name });
  return true;
}
