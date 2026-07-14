# SETUP.md — 公開までの全手順(所要 約20分)

iPhoneのSafariだけで完結します。パソコンは不要です。

やることは大きく3つ:
**A. Firebaseの準備 → B. config.js等の書き換え → C. GitHub Pagesで公開**

---

## A. Firebaseの準備(約10分)

### A-1. プロジェクト作成
1. https://console.firebase.google.com を開き、Googleアカウントでログイン
2. 「プロジェクトを追加」→ 名前は `futari-hidamari` など好きなもの
3. Googleアナリティクスは **オフ** でOK → 作成

### A-2. Webアプリ登録(設定値の取得)
1. プロジェクトのトップで **`</>`(ウェブ)** アイコンをタップ
2. アプリのニックネーム: `hidamari` → 「Firebase Hosting」は **チェックしない** → 登録
3. 表示される `const firebaseConfig = { ... }` の **中身をメモ**(あとで `js/config.js` に貼ります)
   - あとから見る場合: ⚙️ プロジェクトの設定 → 全般 → マイアプリ

### A-3. Authentication(ログイン)を有効化
1. 左メニュー「構築」→ **Authentication** → 「始める」
2. 「Sign-in method」→ **メール/パスワード** を有効にする(下の「メールリンク」はオフのまま)
3. 「Users」タブ → 「ユーザーを追加」で **2人分** 作成
   - 例: `a@hidamari.local` / パスワード8文字以上
   - 例: `yukari@hidamari.local` / パスワード8文字以上
   - ※実在しないメールでOK(確認メールは使いません)。**この2つのアドレスを後で3か所に書きます**

### A-4. Realtime Database を作成
1. 左メニュー「構築」→ **Realtime Database** → 「データベースを作成」
2. ロケーション: **アジア(asia-southeast1 など)** を選択
3. セキュリティルール: 「**ロックモード**で開始」→ 有効にする
4. 「ルール」タブを開き、全文を消して以下を貼る。
   **メールアドレス2つをA-3で作ったものに書き換えること!**

```json
{
  "rules": {
    ".read": "auth != null && (auth.token.email === 'a@hidamari.local' || auth.token.email === 'yukari@hidamari.local')",
    ".write": "auth != null && (auth.token.email === 'a@hidamari.local' || auth.token.email === 'yukari@hidamari.local')"
  }
}
```

5. 「公開」を押す
   ✅ これで **2人以外は誰もデータを読み書きできません**

---

## B. ファイルの書き換え(約3分)

書き換えるのは基本 **`js/config.js` の1ファイルだけ**です。

### B-1. `js/config.js`
1. `firebaseConfig = { ... }` の中身を、A-2でメモした値に丸ごと差し替え
   - `databaseURL` が含まれているか確認。無ければ Realtime Database の画面上部に
     表示されるURL(`https://xxxx.firebasedatabase.app`)を追記
2. `PARTNERS` の2人分を編集:
   - `name`: 表示名(例: "あ", "ゆかり")
   - `email`: **A-3で作ったメールアドレス**(ここが違うとログインできません)
   - `color` / `emoji`: 好みで変更OK

### B-2. `database.rules.json`(任意)
リポジトリ内のこのファイルは控えです。A-4でルールを直接貼ったなら編集不要ですが、
控えとして同じ内容に揃えておくと後で楽です。

---

## C. GitHub Pagesで公開(約7分)

### C-1. リポジトリ作成とアップロード
1. https://github.com で「New repository」
   - 名前: `futari-hidamari`
   - **Private でOK**(Pagesは無料プランのPublicのみ公開可のため、
     無料プランの場合は **Public** にしてください。コードに秘密情報は
     含まれません — firebaseConfigは公開されても、A-4のルールが守ります)
2. 「uploading an existing file」からこのフォルダの中身を全部アップロード
   - フォルダ構成(`js/`, `css/`, `assets/`)が崩れないように注意
   - スマホの場合: Safariでrepo → 「.」キーは使えないので、
     「Add file → Upload files」をフォルダごとに繰り返すか、
     一度zipのままPCのある人に頼むのが確実です

### C-2. Pagesを有効化
1. リポジトリの **Settings → Pages**
2. Source: **Deploy from a branch** / Branch: **main** / フォルダ: **/(root)** → Save
3. 1〜2分待つと `https://ユーザー名.github.io/futari-hidamari/` が発行される

### C-3. Firebaseにドメインを許可
1. Firebaseコンソール → Authentication → **Settings** → **承認済みドメイン**
2. 「ドメインを追加」→ `ユーザー名.github.io` を追加
   ✅ これを忘れると「auth/unauthorized-domain」エラーでログインできません

---

## D. 動作開始

1. 発行されたURLを2人のスマホで開く
2. 自分のキャラを選んでパスワードでログイン
3. たまごが待っています 🐣
4. **ホーム画面に追加**(Safariの共有→「ホーム画面に追加」)するとアプリのように使えます

## よくあるつまずき

| 症状 | 原因と対処 |
|---|---|
| 「起動に失敗しました」 | `config.js` の貼り間違い。特に `databaseURL` の有無を確認 |
| ログインでエラー | Authenticationのメール/パスワードが未有効、またはメールアドレスの不一致(config.js・Firebaseユーザー・DBルールの3か所が同じか確認) |
| auth/unauthorized-domain | C-3の承認済みドメイン追加を忘れている |
| ログイン後に真っ白/permission denied | DBルールのメールアドレスがログインユーザーと不一致 |
| 相手の名前が「初ログイン待ち」のまま | 相手が一度ログインすると自動で表示されます |
| アプリ更新後にロード画面で止まる | 更新時に `js/config.js` を初期状態のもので上書きした可能性。GitHubで js/config.js を開き、apiKey等が自分の値になっているか確認(初期状態なら「History」から前の版の内容を貼り戻す) |
