// =====================================================================
// あそぶ画面: 対決ゲームの一覧と「さそう」
// =====================================================================
import { S, me, partnerUid, personOf } from "../core/state.js";
import { esc, agoJP, toast, modal } from "../core/ui.js";
import { MATCH_GAMES, invite, cancelInvite } from "../core/match.js";

let waitModal = null;

export function render(el) {
  const u = me();
  const pu = partnerUid();
  const pa = pu ? personOf(pu) : null;
  const paOn = pu && S.presence[pu]?.online;
  const st = u?.stats || {};
  const setR = st.coinSetRounds || 0;

  el.innerHTML = `
  <div class="play">
    <h2 class="page-title">🎮 あそぶ</h2>
    <div class="presence-banner ${paOn ? "on" : ""}">
      ${pa
        ? paOn
          ? `<i class="dot on"></i><b style="color:${pa.color}">${esc(pa.name)}</b>はオンライン! いますぐあそべるよ`
          : `<i class="dot"></i><b>${esc(pa.name)}</b>はオフライン(${agoJP(S.presence[pu]?.last)})。さそいは送れるよ`
        : "あいてがまだログインしていません"}
    </div>

    ${Object.values(MATCH_GAMES).map((g) => `
      <section class="card game-card">
        <div class="gc-head"><span class="gc-ico">${g.icon}</span>
          <div><b>${esc(g.name)}</b><p class="dim">${esc(g.desc)}</p></div>
        </div>
        <div class="gc-stats">
          ${g.id === "coin"
            ? `<span>せんせき ${st.byGame?.coin?.wins || 0}勝${(st.byGame?.coin?.played || 0) - (st.byGame?.coin?.wins || 0)}敗</span>
               <span>読まれ率 ${setR ? Math.round(((st.coinSetRead || 0) / setR) * 100) : "-"}%</span>`
            : `<span>あそんだ回数 ${st.byGame?.wordmatch?.played || 0}</span>
               <span>一致した数 💞${st.wordMatchTotal || 0}</span>`}
        </div>
        <div class="gc-btns">
          <button class="btn btn-ghost btn-sm" data-rule="${g.id}">ルール</button>
          <button class="btn btn-primary" data-invite="${g.id}">さそう</button>
        </div>
      </section>`).join("")}

    <p class="dim center small-note">さそいを送ると、あいての画面におしらせが出ます。<br>あそぶには2人が同時にひらいている必要があります。</p>
  </div>`;

  el.querySelectorAll("[data-rule]").forEach((b) => {
    b.onclick = () => {
      const g = MATCH_GAMES[b.dataset.rule];
      modal({ title: `${g.icon} ${g.name}`, body: `<p>${g.rules}</p>`, actions: [{ label: "OK", cls: "btn-primary" }] });
    };
  });
  el.querySelectorAll("[data-invite]").forEach((b) => {
    b.onclick = async () => {
      const ok = await invite(b.dataset.invite);
      if (ok) showWaiting(MATCH_GAMES[b.dataset.invite]);
    };
  });
}

function showWaiting(g) {
  waitModal?.close();
  waitModal = modal({
    title: `${g.icon} さそいちゅう…`,
    body: `<p class="center waiting-dots">あいてが「あそぶ!」を押すのを まっています</p>
           <p class="dim center">あいてがアプリをひらくと おしらせが出ます</p>`,
    dismissable: false,
    actions: [{ label: "とりさげる", cls: "btn-ghost", onClick: (c) => { c(); cancelInvite(); } }],
  });
  // 相手が受けたら(=matchがactiveになったら)自動で閉じる
  const iv = setInterval(() => {
    if (S.match?.status !== "invite") { waitModal?.close(); waitModal = null; clearInterval(iv); }
  }, 500);
}
