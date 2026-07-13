// =====================================================================
// ログイン画面
// 自分のキャラクターカードを選ぶ → パスワード入力 → サインイン。
// メールアドレスは config.js の PARTNERS から自動で決まる(入力不要)。
// =====================================================================
import { auth, signInWithEmailAndPassword } from "./firebase.js";
import { PARTNERS } from "../config.js";
import { esc } from "./ui.js";

const ERR_JP = {
  "auth/invalid-credential": "パスワードがちがうみたい。もう一度ためしてね",
  "auth/wrong-password": "パスワードがちがうみたい。もう一度ためしてね",
  "auth/user-not-found": "このアカウントが見つかりません。SETUP.md の手順でアカウントを作ってね",
  "auth/too-many-requests": "試行回数が多すぎます。少し待ってからもう一度どうぞ",
  "auth/network-request-failed": "ネットワークにつながっていないみたい",
  "auth/invalid-email": "config.js のメールアドレスの形式がまちがっています",
};

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login">
      <div class="login-hero">
        <div class="login-logo">🏡</div>
        <h1>ふたりのひだまり</h1>
        <p class="login-sub">おかえりなさい。あなたはどっち？</p>
      </div>
      <div class="login-cards">
        ${PARTNERS.map((p, i) => `
          <button class="login-card" data-i="${i}" style="--pc:${p.color}">
            <span class="lc-emoji">${p.emoji}</span>
            <span class="lc-name">${esc(p.name)}</span>
          </button>`).join("")}
      </div>
      <form class="login-form hidden" autocomplete="on">
        <p class="lf-who"></p>
        <input type="password" class="lf-pass" placeholder="パスワード" autocomplete="current-password" required>
        <button type="submit" class="btn btn-primary lf-go">はいる</button>
        <p class="lf-err"></p>
        <button type="button" class="btn btn-ghost lf-back">← もどる</button>
      </form>
    </div>`;

  const form = root.querySelector(".login-form");
  const cards = root.querySelector(".login-cards");
  const err = root.querySelector(".lf-err");
  let selected = null;

  cards.addEventListener("click", (e) => {
    const c = e.target.closest(".login-card");
    if (!c) return;
    selected = PARTNERS[+c.dataset.i];
    root.querySelector(".lf-who").innerHTML =
      `${selected.emoji} <b>${esc(selected.name)}</b> としてはいる`;
    cards.classList.add("hidden");
    form.classList.remove("hidden");
    form.querySelector(".lf-pass").focus();
  });

  form.querySelector(".lf-back").onclick = () => {
    form.classList.add("hidden");
    cards.classList.remove("hidden");
    err.textContent = "";
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selected) return;
    const btn = form.querySelector(".lf-go");
    btn.disabled = true; btn.textContent = "…";
    err.textContent = "";
    try {
      sessionStorage.setItem("hdm_key", selected.key);
      await signInWithEmailAndPassword(auth, selected.email, form.querySelector(".lf-pass").value);
      // 成功すると main.js の onAuthStateChanged が画面を切り替える
    } catch (ex) {
      err.textContent = ERR_JP[ex.code] || `エラー: ${ex.code || ex.message}`;
      btn.disabled = false; btn.textContent = "はいる";
    }
  });
}
