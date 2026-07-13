// =====================================================================
// 履歴(history)と ペットの成長記録(petLog)
// 「いつ・誰が・何を」の記録はすべてここを通す。
// =====================================================================
import { r, push, get, query, limitToLast } from "./firebase.js";
import { S } from "./state.js";

/** 履歴を1件記録する。type: login / feed / pet / talk / game / achievement / reward_use / dress など */
export function logH(type, data = {}) {
  return push(r("history"), { ts: Date.now(), uid: S.uid, type, ...data })
    .catch((e) => console.error("logH", e));
}

/** ペットの成長記録(年表)を1件記録 */
export function petLog(text, icon = "🐾") {
  return push(r("petLog"), { ts: Date.now(), icon, text })
    .catch((e) => console.error("petLog", e));
}

/** 履歴の最新 n 件を新しい順で取得 */
export async function fetchHistory(n = 80) {
  const snap = await get(query(r("history"), limitToLast(n)));
  const v = snap.val() || {};
  return Object.values(v).sort((a, b) => b.ts - a.ts);
}

/** 年表の最新 n 件を新しい順で取得 */
export async function fetchPetLog(n = 60) {
  const snap = await get(query(r("petLog"), limitToLast(n)));
  const v = snap.val() || {};
  return Object.values(v).sort((a, b) => b.ts - a.ts);
}
