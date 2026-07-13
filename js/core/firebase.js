// =====================================================================
// Firebase 初期化と、アプリ全体で使う関数の再エクスポート
// SDK は CDN(ES Modules)から直接読み込む。ビルド不要。
// =====================================================================
import { firebaseConfig } from "../config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getDatabase, ref, get, set, update, push, remove,
  onValue, off, runTransaction, onDisconnect, query, limitToLast,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

/** パス文字列から参照を作るショートカット */
export const r = (path) => ref(db, path);

/**
 * 安全なトランザクションヘルパー。
 * fn(現在値のコピー) が false を返すと中断、それ以外は変更後の値を書き込む。
 * 共有データ(ペット・コイン等)の更新は必ずこれを使うこと。
 */
export async function tx(path, fn) {
  const res = await runTransaction(r(path), (cur) => {
    const draft = cur === null ? null : structuredClone(cur);
    const out = fn(draft);
    if (out === false) return undefined; // 中断
    return out === undefined ? draft : out;
  });
  return res;
}

export {
  ref, get, set, update, push, remove,
  onValue, off, runTransaction, onDisconnect, query, limitToLast,
  signInWithEmailAndPassword, onAuthStateChanged, signOut,
};
