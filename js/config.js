// =====================================================================
// ふたりのひだまり - 設定ファイル
// ★ 自分で書き換えるのは、このファイルと database.rules.json だけです。
//    手順は SETUP.md を見てください。
// =====================================================================

// ① Firebaseコンソール > プロジェクトの設定 > マイアプリ からコピーして
//    まるごと貼り替えてください。
export const firebaseConfig = {
  apiKey: "ここにapiKeyを貼る",
  authDomain: "ここにauthDomainを貼る",
  databaseURL: "ここにdatabaseURLを貼る",
  projectId: "ここにprojectIdを貼る",
  storageBucket: "ここにstorageBucketを貼る",
  messagingSenderId: "ここに貼る",
  appId: "ここに貼る",
};

// ② ふたりの情報。email は Firebase Authentication で作成した
//    2アカウントのメールアドレスと完全に一致させてください。
//    name / emoji / color は自由に変えてOKです。
export const PARTNERS = [
  { key: "p1", name: "あ",     email: "p1@example.com", color: "#6D9BC3", emoji: "🫐" },
  { key: "p2", name: "ゆかり", email: "p2@example.com", color: "#EF8E7D", emoji: "🍑" },
];

// ③ アプリ全体の設定
export const APP = {
  defaultPetName: "もこ",   // ペットの初期名(設定画面でいつでも変更可)
  version: "1.0.0",
};
