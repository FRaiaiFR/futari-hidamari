// =====================================================================
// アプリ全体の状態(S)と、超軽量イベントバス(on / emit)
// onValue リスナーが S を更新 → emit → 画面が再描画、という一方向の流れ。
// =====================================================================
import { PARTNERS } from "../config.js";

export const S = {
  uid: null,          // 自分の Firebase Auth UID
  meKey: null,        // "p1" / "p2"
  users: {},          // users ノード全体 (uid -> データ)
  pet: null,          // 共有ペット
  shared: null,       // 共有財布(ハート・きせかえ在庫)
  config: null,       // 記念日など
  presence: {},       // uid -> {online, last}
  match: null,        // 対戦状態機械
  dailyToday: null,   // 今日の daily ノード
  tab: "home",        // 現在のタブ
  ready: false,       // 初期データ受信済みか
};

/** 自分のユーザーデータ */
export const me = () => (S.uid ? S.users[S.uid] : null) || null;

/** 相手の UID(まだ相手が一度もログインしていなければ null) */
export const partnerUid = () =>
  Object.keys(S.users || {}).find((u) => u !== S.uid) || null;

/** 相手のユーザーデータ */
export const partner = () => {
  const p = partnerUid();
  return p ? S.users[p] : null;
};

/** profileKey から PARTNERS 定義(名前・色)を引く */
export const partnerDef = (key) => PARTNERS.find((p) => p.key === key) || PARTNERS[0];

/** uid から表示用の {name, color, emoji} を引く */
export function personOf(uid) {
  const u = S.users[uid];
  if (u) {
    const def = partnerDef(u.profileKey);
    return { name: u.name || def.name, color: def.color, emoji: def.emoji };
  }
  return { name: "？", color: "#999", emoji: "❔" };
}

// ---- イベントバス ----------------------------------------------------
const subs = {};
export function on(ev, fn) {
  (subs[ev] ||= []).push(fn);
}
export function emit(ev, data) {
  (subs[ev] || []).forEach((f) => {
    try { f(data); } catch (e) { console.error(`[emit:${ev}]`, e); }
  });
}
