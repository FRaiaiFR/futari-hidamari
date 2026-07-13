# EXTENDING.md — 機能の増やし方

このアプリは「マスターデータに1個足すだけ」で増やせるように作られています。
すべてGitHubのWeb編集(スマホ可)で完結します。

## 1. 質問を増やす — `js/data/questions.js`

```js
{ id: "q311", level: 3, text: "10年後、2人でどこに住んでいたい？" },
```
- `id` は他と被らなければ何でもOK(既存は q1xx=Level1, q2xx=Level2, q3xx=Level3)
- 追加した瞬間から「きょうの1問」の抽選対象にもなります

## 2. ワードマッチのお題を増やす — `js/data/masters.js` の `TOPICS`

```js
"「ふたりで行きたい国」といえば？",
```

## 3. 実績を増やす — `js/data/masters.js` の `ACHIEVEMENTS`

```js
{
  id: "a_talk50", icon: "🗣️", name: "おしゃべり50",
  desc: "質問に50回答える",
  cond: (c) => (c.u.stats?.talkCount || 0) >= 50,
  reward: { coins: 60 },
},
```
- `cond(c)` … `c = { u:自分, pet, shared, users }` を見て true/false を返すだけ
- `reward` … `coins` / `food` / `hearts` / `title:"t_xxx"` を組み合わせ可
- 称号を付ける場合は `TITLES` にも1行追加

## 4. きせかえを増やす — 2ファイル

1. `js/data/masters.js` の `ACCESSORIES` に定義を追加:
```js
{ id: "beret", name: "ベレーぼう", icon: "🎨", slot: "head", price: { coins: 180 } },
```
2. `js/pet/petView.js` の `ACC_SVG` に見た目(SVG片)を追加:
```js
beret: (a) => `<ellipse cx="${130 - 14 * a.sc}" cy="${a.headY - 34 * a.sc}"
  rx="${30 * a.sc}" ry="${12 * a.sc}" fill="#B33951" stroke="#5C4B3A" stroke-width="5"/>`,
```
- `a` には進化段階ごとの基準座標(`headY` など)と倍率 `sc` が入っています

## 5. ゲームを増やす — `js/games/` に1ファイル

`js/games/janken.js` のように新規ファイルを作り、この形で default export:

```js
export default {
  id: "janken", name: "じゃんけん", icon: "✊", desc: "説明文",
  rules: "ルール説明(モーダルに出る)",
  initData() { return { round: 1, picks: {} }; },   // 対戦開始時の初期状態
  render(el, m) { /* m.data を見て画面を描く。更新は txMatch で */ },
  renderResult(m) { return `結果HTML`; },
  async rewards(m, isHost) {
    // isHost=false: 自分の報酬(両方の端末で1回ずつ呼ばれる)
    // isHost=true : ペット・共有分(ホスト側で1回だけ呼ばれる)
  },
};
```

あとは `js/main.js` に2行:
```js
import janken from "./games/janken.js";
register(janken);
```
招待・同期・切断検知・報酬の二重付与防止はすべて基盤(`core/match.js`)がやります。
**ゲーム側は「状態の描画」と「状態の更新」だけ書けばOK。**

- 状態更新は必ず `txMatch((m) => { ...mを書き換えて return m })` を使う
  (2人が同時に押しても壊れません)
- ホームの「おねだり」対象にしたい場合は `js/pet/dialogue.js` の
  `todaysWish()` の配列に id を足す

## 6. セリフを増やす — `js/data/dialogues.js`

`DIALOGUE` の各配列に文字列を足すだけ。`{you}` `{partner}` `{pet}` が名前に置換されます。

## 7. ペットの種類(第2のペット)を増やしたい場合の方針

現状は `pet/` 直下の1体構成です。増やす場合:
1. DBを `pets/{petId}/` に変更し、`config/activePet` で選択
2. `petView.js` の色・形状テーブル(`FORM_COLORS`, `body()`)を種類別に分岐
3. ホームに切替UIを追加
(互換のため、最初のペットは `petId: "moko"` として移行するのが安全)

## 8. ショップを本実装する方針

きせかえ購入は既にホームの「きせかえ」内で動いています。
「その他」タブのショップを本格化する場合:
- 家具(部屋の `shelf` / `rug` / 壁紙)を `ACCESSORIES` と同様の
  `FURNITURE` マスター+`pet/room` ノードで管理
- 見た目は `screens/home.js` の `.room` 内に差し込む

## 9. AIセリフ(Gemini等)を足す方針

`js/pet/dialogue.js` の `speak()` がセリフの唯一の出口なので、ここだけ差し替えれば全画面に効きます。
**注意:** APIキーをフロントに直書きしないこと。無料のCloudflare Workersを
プロキシにして、Workers側にキーを置く構成にしてください(kakeiboで検討した方式と同じ)。

## 10. 季節イベントの足し方(例)

`js/core/economy.js` の `boostToday()` に日付条件を足すと、
その日だけ経験値倍率が変わります。クリスマスに部屋の飾りを変えるなら
`screens/home.js` の `.room` 描画で `todayStr().slice(5) === "12-25"` を見て
絵文字を差し替えるのが最小実装です。
