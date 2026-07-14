// =====================================================================
// オフライン閲覧(⑳) と 自動バックアップ(㉑)
// ・オンライン中、主要データを端末に自動保存(ログイン時/変更のたび/画面を閉じる時)
// ・起動時に通信できなければ、その保存データで「見るだけモード」に入る
// ・見るだけモード中の書き込みは firebase.js 側で全ブロック(データ破損防止)
// ・設定画面から JSONファイルとして書き出しも可能
// =====================================================================
import { S } from "./state.js";
import { toast } from "./ui.js";

const KEY = "hdm_backup_v1";
let saveTimer = null;
let lastHash = "";

/** いまの状態を端末に保存(10秒デバウンス+内容が同じならスキップ=重複防止) */
export function scheduleBackup() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 10_000);
}

export function saveNow() {
  if (!S.ready || S.offline) return;
  try {
    const snap = {
      at: Date.now(),
      users: S.users, pet: S.pet, alumni: S.alumni || {},
      shared: S.shared, config: S.config, talk: S.talk || {},
      dailyToday: S.dailyToday || {},
    };
    const body = JSON.stringify(snap);
    const hash = `${body.length}:${S.pet?.exp}:${S.pet?.level}`;
    if (hash === lastHash) return;              // 変化なし → 保存しない
    localStorage.setItem(KEY, body);
    lastHash = hash;
  } catch (e) {
    // 容量オーバー等でも本体動作には影響させない。次回は再試行される
    console.warn("backup失敗(再試行されます)", e);
  }
}

/** 保存データを読む(なければ null) */
export function loadBackup() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); }
  catch { return null; }
}

/** オフライン閲覧モードに入る(S に流し込むだけ。書込は firebase.js が拒否) */
export function enterOfflineMode(snap) {
  S.offline = true;
  globalThis.__hdmOffline = true;
  Object.assign(S, {
    users: snap.users || {}, pet: snap.pet, alumni: snap.alumni || {},
    shared: snap.shared || {}, config: snap.config || {},
    talk: snap.talk || {}, dailyToday: snap.dailyToday || {},
    presence: {}, match: null, ready: true,
  });
  // 電波がもどったら自動でふつうモードへ
  addEventListener("online", () => location.reload(), { once: true });
}

/** バックアップをファイルとして書き出す(設定画面から) */
export function exportBackup() {
  const snap = loadBackup();
  if (!snap) { toast("まだバックアップがありません", "📦"); return; }
  const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `hidamari-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast("バックアップを書き出しました", "📦");
}
