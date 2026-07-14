// =====================================================================
// 演出エンジン(fx)
// ごはんの放物線 / レベルアップ / 進化 / 100レベル卒業 の演出。
// すべてスキップ可能(タップで閉じる)。transform/opacityのみで60fps維持。
// =====================================================================
import { SE } from "./sound.js";
import { confetti } from "./ui.js";
import { renderPetSVG } from "../pet/petView.js";

/** ① ごはんが放物線を描いてペットの口へ飛ぶ */
export function feedFly(fromEl, toEl, done) {
  try {
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const sx = a.left + a.width / 2, sy = a.top + a.height / 2;
    const ex = b.left + b.width / 2, ey = b.top + b.height * 0.55;
    const el = document.createElement("div");
    el.className = "fx-food";
    el.textContent = "🍙";
    el.style.left = `${sx}px`; el.style.top = `${sy}px`;
    document.body.appendChild(el);
    const midX = (sx + ex) / 2, topY = Math.min(sy, ey) - 130; // 放物線の頂点
    const anim = el.animate([
      { transform: "translate(-50%,-50%) scale(.7) rotate(0deg)", offset: 0 },
      { transform: `translate(calc(-50% + ${midX - sx}px), calc(-50% + ${topY - sy}px)) scale(1.1) rotate(180deg)`, offset: 0.5 },
      { transform: `translate(calc(-50% + ${ex - sx}px), calc(-50% + ${ey - sy}px)) scale(.5) rotate(340deg)`, offset: 1 },
    ], { duration: 620, easing: "cubic-bezier(.3,.1,.5,1)" });
    anim.onfinish = () => {
      el.remove();
      SE("nom");
      // もぐもぐ→満足ホップ
      toEl.classList.remove("munch"); void toEl.offsetWidth; toEl.classList.add("munch");
      setTimeout(() => toEl.classList.remove("munch"), 1300);
      done?.();
    };
  } catch { done?.(); }
}

/** 全画面演出の共通枠(タップでスキップ) */
function cinema(cls, html, ms) {
  return new Promise((res) => {
    const ovl = document.createElement("div");
    ovl.className = `fx-cinema ${cls}`;
    ovl.innerHTML = html + `<small class="fx-skip">タップでとじる</small>`;
    document.body.appendChild(ovl);
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      ovl.classList.add("out");
      setTimeout(() => ovl.remove(), 320);
      res();
    };
    ovl.addEventListener("pointerdown", close);
    setTimeout(close, ms);
    requestAnimationFrame(() => ovl.classList.add("in"));
  });
}

/** ② レベルアップ演出(約2.6秒・スキップ可) */
export function levelUpFx(level, pet) {
  SE("level");
  confetti(26);
  return cinema("fx-level", `
    <div class="fx-rays"></div>
    <div class="fx-stars">${"<i>⭐</i>".repeat(6)}</div>
    <div class="fx-pet">${renderPetSVG({ ...pet, level }, { expression: "excited" })}</div>
    <div class="fx-title">LEVEL UP!</div>
    <div class="fx-lv">Lv ${level}</div>
  `, 2600);
}

/** ③ 進化演出(白い光→シルエット→お披露目。約3.4秒・スキップ可) */
export function evolveFx(stageName, pet) {
  SE("evolve");
  confetti(40);
  return cinema("fx-evolve", `
    <div class="fx-flash"></div>
    <div class="fx-pet fx-silhouette">${renderPetSVG(pet, { expression: "excited" })}</div>
    <div class="fx-title fx-title-evo">✨ しんか! ✨</div>
    <div class="fx-lv">${stageName} になった!</div>
  `, 3400);
}

/** 100レベル達成→卒業(たびだち)演出 */
export function graduateFx(name, gen) {
  SE("evolve");
  confetti(60);
  return cinema("fx-evolve fx-grad", `
    <div class="fx-flash"></div>
    <div class="fx-title fx-title-evo">🎓 Lv100 たっせい!</div>
    <div class="fx-lv">${name}は りっぱに そだった!<br>
      これからは へやで のんびりくらすよ。<br><br>
      …あたらしい たまご(第${gen}世代)が とどいた! 🥚</div>
  `, 5200);
}
