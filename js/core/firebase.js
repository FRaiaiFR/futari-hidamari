// =====================================================================
// Firebase 初期化と、アプリ全体で使う関数の再エクスポート
// SDK は CDN(ES Modules)から直接読み込む。ビルド不要。
// =====================================================================
import { firebaseConfig } from "../config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// ---- 起動前チェック --------------------------------------------------
// config.js が未設定(「ここに貼る」のまま)や databaseURL 欠けだと、
// 以前は無言でロード画面のまま止まっていた。原因を画面に表示して止める。
(function validateConfig() {
  const problems = [];
  for (const [k, v] of Object.entries(firebaseConfig)) {
    if (!v || String(v).includes("ここに")) problems.push(k);
  }
  if (!firebaseConfig.databaseURL || !/^https:\/\/.+firebase(io\.com|database\.app)/.test(firebaseConfig.databaseURL)) {
    if (!problems.includes("databaseURL")) problems.push("databaseURL");
  }
  if (problems.length) {
    throw new Error(
      `config.js が未設定です(${problems.join(", ")})。` +
      `js/config.js を開いて、Firebaseの設定値を貼ってください(SETUP.md 6-6章)。`
    );
  }
})();
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, get,
  set as _set, update as _update, push as _push, remove as _remove,
  onValue, off, runTransaction, onDisconnect, query, limitToLast,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

/** パス文字列から参照を作るショートカット */
export const r = (path) => ref(db, path);

/** オフライン閲覧モード: 通信が無い/見るだけモード中は書き込みを止めて閲覧のみ許可 */
export const isOffline = () =>
  globalThis.__hdmOffline === true ||
  (typeof navigator !== "undefined" && navigator.onLine === false);
let offlineToastAt = 0;
function blockIfOffline() {
  if (!isOffline()) return false;
  if (Date.now() - offlineToastAt > 4000) {
    offlineToastAt = Date.now();
    import("./ui.js").then((u) => u.toast("オフラインです。いまは閲覧だけできるよ", "📡"));
  }
  return true;
}

/**
 * 安全なトランザクションヘルパー。
 * fn(現在値のコピー) が false を返すと中断、それ以外は変更後の値を書き込む。
 * 共有データ(ペット・コイン等)の更新は必ずこれを使うこと。
 */
export async function tx(path, fn) {
  if (blockIfOffline()) return { committed: false, snapshot: null };
  const res = await runTransaction(r(path), (cur) => {
    const draft = cur === null ? null : structuredClone(cur);
    const out = fn(draft);
    if (out === false) return undefined; // 中断
    return out === undefined ? draft : out;
  });
  return res;
}

// 書き込み系はオフライン時に何もしない安全ラッパーで再エクスポート
// (SDKのset等はimport時に _set 等へリネーム済み)
const safeSet = (...a) => (blockIfOffline() ? Promise.resolve() : _set(...a));
const safeUpdate = (...a) => (blockIfOffline() ? Promise.resolve() : _update(...a));
const safePush = (...a) => (blockIfOffline() ? Promise.resolve({ key: null }) : _push(...a));
const safeRemove = (...a) => (blockIfOffline() ? Promise.resolve() : _remove(...a));
export {
  ref, get,
  safeSet as set, safeUpdate as update, safePush as push, safeRemove as remove,
  onValue, off, runTransaction, onDisconnect, query, limitToLast,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
};
