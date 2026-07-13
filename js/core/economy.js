// =====================================================================
// 経済システム(コイン / ごはん / ハートのかけら / 統計)
// 共有資源・自分の財布の増減はすべてこのモジュール経由で行う。
// =====================================================================
import { tx } from "./firebase.js";
import { S } from "./state.js";
import { todayStr } from "./ui.js";

/** きょうが記念日なら経験値2倍 */
export function boostToday() {
  const a = S.config?.anniversary; // "YYYY-MM-DD"
  if (!a) return 1;
  return todayStr().slice(5) === a.slice(5) ? 2 : 1;
}

/** コインを増やす(自分 or 指定uid) */
export function addCoins(n, uid = S.uid) {
  return tx(`users/${uid}/coins`, (c) => Math.max(0, (c || 0) + n));
}

/** ごはんを増やす */
export function addFood(n, uid = S.uid) {
  return tx(`users/${uid}/food`, (c) => Math.max(0, (c || 0) + n));
}

/** ハートのかけら(共有)を増やす。累計 heartsTotal も同時に加算 */
export function addHearts(n) {
  return tx("shared", (s) => {
    s = s || {};
    s.hearts = Math.max(0, (s.hearts || 0) + n);
    if (n > 0) s.heartsTotal = (s.heartsTotal || 0) + n;
    return s;
  });
}

/**
 * 支払い。price = {coins} または {hearts}。
 * 残高不足なら false を返し、何も引かない。
 */
export async function pay(price) {
  if (price.coins) {
    const res = await tx(`users/${S.uid}/coins`, (c) =>
      (c || 0) >= price.coins ? (c || 0) - price.coins : false);
    return res.committed;
  }
  if (price.hearts) {
    const res = await tx("shared", (s) => {
      s = s || {};
      if ((s.hearts || 0) < price.hearts) return false;
      s.hearts -= price.hearts;
      return s;
    });
    return res.committed;
  }
  return false;
}

/**
 * 統計カウンタを増やす。path は "wins" や "byGame/coin/played" のようなスラッシュ区切り。
 */
export function bumpStat(path, n = 1, uid = S.uid) {
  return tx(`users/${uid}/stats`, (st) => {
    st = st || {};
    const keys = path.split("/");
    let o = st;
    for (let i = 0; i < keys.length - 1; i++) o = (o[keys[i]] ||= {});
    const last = keys[keys.length - 1];
    o[last] = (o[last] || 0) + n;
    return st;
  });
}

/** 勝敗を記録(連勝カウント込み) */
export function recordResult(gameId, result /* 'win'|'lose'|'draw' */) {
  return tx(`users/${S.uid}/stats`, (st) => {
    st = st || {};
    st.byGame ||= {};
    st.byGame[gameId] ||= {};
    st.byGame[gameId].played = (st.byGame[gameId].played || 0) + 1;
    if (result === "win") {
      st.wins = (st.wins || 0) + 1;
      st.byGame[gameId].wins = (st.byGame[gameId].wins || 0) + 1;
      st.winStreak = (st.winStreak || 0) + 1;
      st.maxWinStreak = Math.max(st.maxWinStreak || 0, st.winStreak);
    } else if (result === "lose") {
      st.losses = (st.losses || 0) + 1;
      st.winStreak = 0;
    } else {
      st.draws = (st.draws || 0) + 1;
    }
    return st;
  });
}
