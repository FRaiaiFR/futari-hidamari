// =====================================================================
// ペット描画エンジン(レイヤードSVG)
// [進化段階の体] + [表情] + [きせかえ] を重ねて合成する。
// きせかえ追加 = ACC_SVG に1エントリ足すだけ。画像ファイルは不要。
// =====================================================================
import { stageForLevel, effHunger, moodOf } from "./pet.js";
import { isSleepTime } from "../core/ui.js";

// 特別進化フォルムの体色
const FORM_COLORS = {
  amae:      { body: "#FBD3DC", line: "#D98BA0", belly: "#FFEDF2" },
  yuukan:    { body: "#BBD4EE", line: "#7FA3C9", belly: "#EAF3FC" },
  nakayoshi: { body: "#FBC9AE", line: "#D89272", belly: "#FFEEE2" },
  monoshiri: { body: "#DCCCF2", line: "#A98FCB", belly: "#F3ECFC" },
};
const BASE = { body: "#F6E7C9", line: "#C7A97C", belly: "#FFF7E6" };

// 進化段階ごとの座標アンカー
const ANCHOR = {
  baby:    { headY: 102, eyeY: 140, mouthY: 156, neckY: 186, cheekY: 150, sc: 0.85 },
  kids:    { headY: 80,  eyeY: 128, mouthY: 145, neckY: 188, cheekY: 139, sc: 0.95 },
  adult:   { headY: 60,  eyeY: 118, mouthY: 136, neckY: 190, cheekY: 129, sc: 1.05 },
  special: { headY: 60,  eyeY: 118, mouthY: 136, neckY: 190, cheekY: 129, sc: 1.05 },
};

// ---- 体(進化段階別) ----------------------------------------------------
function body(stage, c) {
  const S = `stroke="${c.line}" stroke-width="3"`;
  if (stage === "egg") return `
    <g class="wobble">
      <path d="M130 62 C168 62 182 108 182 140 C182 175 158 194 130 194 C102 194 78 175 78 140 C78 108 92 62 130 62Z"
        fill="${c.body}" ${S}/>
      <circle cx="112" cy="110" r="6" fill="#EFD9AE"/><circle cx="148" cy="132" r="8" fill="#EFD9AE"/>
      <circle cx="120" cy="160" r="5" fill="#EFD9AE"/><circle cx="150" cy="88" r="4" fill="#EFD9AE"/>
      <ellipse cx="112" cy="86" rx="9" ry="14" fill="#FFFDF6" opacity=".7" transform="rotate(-20 112 86)"/>
    </g>`;
  if (stage === "baby") return `
    <ellipse cx="112" cy="192" rx="14" ry="7" fill="${c.body}" ${S}/>
    <ellipse cx="148" cy="192" rx="14" ry="7" fill="${c.body}" ${S}/>
    <circle cx="130" cy="148" r="48" fill="${c.body}" ${S}/>
    <circle cx="106" cy="104" r="9" fill="${c.body}" ${S}/>
    <circle cx="154" cy="104" r="9" fill="${c.body}" ${S}/>
    <ellipse cx="130" cy="172" rx="24" ry="15" fill="${c.belly}"/>`;
  // kids / adult / special 共通ベース
  const big = stage !== "kids";
  const rx = big ? 62 : 54, ry = big ? 72 : 62, cy = big ? 128 : 138;
  const earY = big ? 66 : 84, earR = big ? 16 : 13, earDx = big ? 34 : 30;
  return `
    <ellipse cx="106" cy="196" rx="16" ry="8" fill="${c.body}" ${S}/>
    <ellipse cx="154" cy="196" rx="16" ry="8" fill="${c.body}" ${S}/>
    ${big ? `<path d="M188 150 q26 -6 20 -30 q-4 -14 -18 -12" fill="none" ${S} stroke-linecap="round"/>` : ""}
    <ellipse cx="${130 - earDx}" cy="${earY}" rx="${earR}" ry="${earR + 8}" fill="${c.body}" ${S} transform="rotate(-16 ${130 - earDx} ${earY})"/>
    <ellipse cx="${130 + earDx}" cy="${earY}" rx="${earR}" ry="${earR + 8}" fill="${c.body}" ${S} transform="rotate(16 ${130 + earDx} ${earY})"/>
    <ellipse cx="${130 - earDx}" cy="${earY + 3}" rx="${earR - 8}" ry="${earR - 2}" fill="${c.belly}" transform="rotate(-16 ${130 - earDx} ${earY})"/>
    <ellipse cx="${130 + earDx}" cy="${earY + 3}" rx="${earR - 8}" ry="${earR - 2}" fill="${c.belly}" transform="rotate(16 ${130 + earDx} ${earY})"/>
    <ellipse cx="130" cy="${cy}" rx="${rx}" ry="${ry}" fill="${c.body}" ${S}/>
    <ellipse cx="130" cy="${cy + ry * 0.42}" rx="${rx * 0.55}" ry="${ry * 0.4}" fill="${c.belly}"/>
    <ellipse cx="${130 - rx - 2}" cy="${cy + 18}" rx="11" ry="16" fill="${c.body}" ${S} transform="rotate(18 ${130 - rx} ${cy + 18})"/>
    <ellipse cx="${130 + rx + 2}" cy="${cy + 18}" rx="11" ry="16" fill="${c.body}" ${S} transform="rotate(-18 ${130 + rx} ${cy + 18})"/>`;
}

// ---- 特別進化のしるし --------------------------------------------------
function formMark(form) {
  if (form === "amae") return `<path d="M130 158 c-7-9 -20-3 -14 7 c3 5 10 9 14 12 c4-3 11-7 14-12 c6-10 -7-16 -14-7Z" fill="#EE7E9B" opacity=".85"/>`;
  if (form === "yuukan") return `<path d="M130 66 l4 9 10 1 -7 7 2 10 -9-5 -9 5 2-10 -7-7 10-1Z" fill="#F2C14E" stroke="#D9A32E" stroke-width="1.5"/>`;
  if (form === "nakayoshi") return `
    <path d="M104 158 c-5-6 -14-2 -10 5 c2 4 7 6 10 8 c3-2 8-4 10-8 c4-7 -5-11 -10-5Z" fill="#EE7E9B" opacity=".8"/>
    <path d="M156 158 c-5-6 -14-2 -10 5 c2 4 7 6 10 8 c3-2 8-4 10-8 c4-7 -5-11 -10-5Z" fill="#EE7E9B" opacity=".8"/>`;
  if (form === "monoshiri") return `<path d="M120 70 a12 12 0 1 0 14 -8 a10 10 0 1 1 -14 8Z" fill="#F2C14E" opacity=".9"/>`;
  return "";
}

// ---- 表情 ---------------------------------------------------------------
function face(expr, a) {
  const ink = "#4A3F35";
  const eyeL = 130 - 22, eyeR = 130 + 22, y = a.eyeY, my = a.mouthY;
  let eyes = "", mouth = "";
  switch (expr) {
    case "happy":
      eyes = `<path d="M${eyeL - 8} ${y} q8 -9 16 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
              <path d="M${eyeR - 8} ${y} q8 -9 16 0" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`;
      mouth = `<path d="M${130 - 11} ${my - 3} q11 13 22 0 Z" fill="#C96F6C"/>`;
      break;
    case "sleepy":
      eyes = `<path d="M${eyeL - 8} ${y} q8 4 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
              <path d="M${eyeR - 8} ${y} q8 4 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`;
      mouth = `<ellipse cx="130" cy="${my}" rx="4.5" ry="5.5" fill="#C96F6C"/>
               <text x="176" y="${y - 22}" font-size="17" fill="${ink}" opacity=".65" class="zzz">z z Z</text>`;
      break;
    case "hungry":
      eyes = normalEyes(eyeL, eyeR, y, ink);
      mouth = `<path d="M${130 - 10} ${my} q5 -5 10 0 q5 5 10 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
               <path d="M${eyeR + 16} ${y + 8} q6 8 0 12 q-6 -4 0 -12Z" fill="#9CC4E4"/>`;
      break;
    case "excited":
      eyes = `<path d="M${eyeL} ${y - 8} l2.6 5.4 5.9.6 -4.4 4 1.2 5.8 -5.3-3 -5.3 3 1.2-5.8 -4.4-4 5.9-.6Z" fill="${ink}"/>
              <path d="M${eyeR} ${y - 8} l2.6 5.4 5.9.6 -4.4 4 1.2 5.8 -5.3-3 -5.3 3 1.2-5.8 -4.4-4 5.9-.6Z" fill="${ink}"/>`;
      mouth = `<path d="M${130 - 12} ${my - 4} q12 15 24 0 Z" fill="#C96F6C"/>`;
      break;
    default: // normal
      eyes = normalEyes(eyeL, eyeR, y, ink);
      mouth = `<path d="M${130 - 9} ${my} q4.5 5.5 9 0 q4.5 5.5 9 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round" transform="translate(-4.5 0)"/>`;
  }
  const cheeks = expr === "sleepy" ? "" : `
    <ellipse cx="${eyeL - 14}" cy="${a.cheekY}" rx="7.5" ry="5" fill="#F3AFA3" opacity=".65"/>
    <ellipse cx="${eyeR + 14}" cy="${a.cheekY}" rx="7.5" ry="5" fill="#F3AFA3" opacity=".65"/>`;
  return eyes + mouth + cheeks;
}
function normalEyes(l, r, y, ink) {
  // blink=まばたき(縦つぶれ) / gaze=ときどき視線が泳ぐ(横ゆれ) を別グループで合成
  return `
    <g class="gaze"><g class="blink"><circle cx="${l}" cy="${y}" r="6" fill="${ink}"/><circle cx="${l + 2}" cy="${y - 2}" r="2" fill="#fff"/></g></g>
    <g class="gaze"><g class="blink"><circle cx="${r}" cy="${y}" r="6" fill="${ink}"/><circle cx="${r + 2}" cy="${y - 2}" r="2" fill="#fff"/></g></g>`;
}

// ---- きせかえ(アクセサリーのSVG定義) ------------------------------------
// ★ 新しいきせかえは masters.js に定義を、ここに見た目を足す。
const ACC_SVG = {
  ribbon: (a) => at(155, a.headY + 6, a.sc, `
    <path d="M0 0 L-17 -11 L-15 9 Z" fill="#F286A0" stroke="#D45F80" stroke-width="2"/>
    <path d="M0 0 L17 -11 L15 9 Z" fill="#F286A0" stroke="#D45F80" stroke-width="2"/>
    <circle r="5.5" fill="#EE6E8E" stroke="#D45F80" stroke-width="2"/>`),
  strawhat: (a) => at(130, a.headY - 2, a.sc, `
    <ellipse rx="44" ry="11" fill="#EAC873" stroke="#C9A24C" stroke-width="2.5"/>
    <path d="M-24 -2 a24 20 0 0 1 48 0 l0 3 a24 8 0 0 1 -48 0 Z" fill="#F0D48A" stroke="#C9A24C" stroke-width="2.5"/>
    <rect x="-24" y="-6" width="48" height="7" rx="3.5" fill="#D96A5F"/>`),
  glasses: (a) => at(130, a.eyeY, 1, `
    <circle cx="-22" r="13" fill="rgba(255,255,255,.35)" stroke="#6B5B4A" stroke-width="3"/>
    <circle cx="22" r="13" fill="rgba(255,255,255,.35)" stroke="#6B5B4A" stroke-width="3"/>
    <path d="M-9 0 q9 -6 18 0" fill="none" stroke="#6B5B4A" stroke-width="3"/>`),
  bowtie: (a) => at(130, a.neckY - 8, a.sc, `
    <path d="M0 0 L-16 -9 L-16 9 Z" fill="#5C7FA8" stroke="#44618A" stroke-width="2"/>
    <path d="M0 0 L16 -9 L16 9 Z" fill="#5C7FA8" stroke="#44618A" stroke-width="2"/>
    <circle r="4.5" fill="#44618A"/>`),
  scarf: (a) => at(130, a.neckY - 12, a.sc, `
    <path d="M-40 0 q40 14 80 0 l0 10 q-40 14 -80 0 Z" fill="#D96A5F" stroke="#B84F46" stroke-width="2"/>
    <path d="M18 8 l4 26 q1 6 -6 6 l-8 0 q-6 0 -5 -6 l4 -26 Z" fill="#D96A5F" stroke="#B84F46" stroke-width="2"/>
    <path d="M6 34 l14 0 M7 40 l12 0" stroke="#B84F46" stroke-width="2"/>`),
  crown: (a) => at(130, a.headY - 4, a.sc, `
    <path d="M-20 4 L-20 -14 L-10 -4 L0 -18 L10 -4 L20 -14 L20 4 Z"
      fill="#F2C14E" stroke="#C9962E" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="-20" cy="-15" r="3" fill="#EE6E8E"/><circle cx="0" cy="-19" r="3" fill="#6D9BC3"/><circle cx="20" cy="-15" r="3" fill="#8FBF88"/>`),
  halo: (a) => `<g class="halo"><ellipse cx="130" cy="${a.headY - 20}" rx="${30 * a.sc}" ry="8"
      fill="none" stroke="#F2C14E" stroke-width="5" opacity=".9"/></g>`,
};
const at = (x, y, s, inner) => `<g transform="translate(${x} ${y}) scale(${s})">${inner}</g>`;

// ---- 合成 ---------------------------------------------------------------
/**
 * ペットのSVG文字列を返す。
 * opts.expression で表情を強制指定できる(演出用)。
 */
export function renderPetSVG(pet, opts = {}) {
  if (!pet) return "";
  const stage = stageForLevel(pet.level || 1);
  const c = stage === "special" && pet.form ? (FORM_COLORS[pet.form] || BASE) : BASE;
  const a = ANCHOR[stage] || ANCHOR.adult;

  // 表情の自動決定
  let expr = opts.expression;
  if (!expr) {
    const mood = moodOf(pet);
    expr = mood === "sleeping" ? "sleepy"
      : mood === "hungry" ? "hungry"
      : mood === "happy" ? "happy" : "normal";
  }

  const isEgg = stage === "egg";
  const aura = stage === "special"
    ? `<circle cx="130" cy="128" r="88" fill="${c.body}" opacity=".22" class="aura"/>
       <g class="sparkles" fill="#F2C14E">
         <circle cx="52" cy="72" r="3"/><circle cx="212" cy="96" r="2.5"/>
         <circle cx="66" cy="168" r="2.5"/><circle cx="206" cy="176" r="3"/>
       </g>` : "";

  const acc = isEgg ? "" : ["neck", "head", "face"]
    .map((slot) => {
      const id = pet.equipped?.[slot];
      return id && ACC_SVG[id] ? ACC_SVG[id](a) : "";
    }).join("");

  return `
  <svg class="pet-svg" viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ペット">
    <ellipse cx="130" cy="203" rx="72" ry="12" fill="rgba(120,90,50,.14)"/>
    ${aura}
    <g class="breathe">
      ${body(stage, c)}
      ${stage === "special" ? formMark(pet.form) : ""}
      ${isEgg ? "" : face(expr, a)}
      ${acc}
    </g>
  </svg>`;
}
