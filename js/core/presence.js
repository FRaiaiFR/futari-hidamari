// =====================================================================
// プレゼンス(オンライン状態)
// RTDB の .info/connected と onDisconnect で、切断時に自動でオフラインになる。
// =====================================================================
import { r, onValue, onDisconnect, update } from "./firebase.js";
import { S } from "./state.js";

export function initPresence() {
  const myRef = r(`presence/${S.uid}`);
  onValue(r(".info/connected"), (snap) => {
    if (snap.val() !== true) return;
    // 切断されたら自動で offline に
    onDisconnect(myRef).update({ online: false, last: Date.now() });
    update(myRef, { online: true, last: Date.now() });
  });
  // タブを閉じる直前にも念のため
  addEventListener("pagehide", () => {
    try { update(myRef, { online: false, last: Date.now() }); } catch { /* noop */ }
  });
}
