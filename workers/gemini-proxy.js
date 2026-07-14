// =====================================================================
// ㉒ AIセリフ用 Cloudflare Workers プロキシ(デプロイは任意)
// なぜ必要? … GeminiのAPIキーをアプリに直書きすると全世界に公開されてしまう。
//              このWorkerがキーを預かり、アプリはWorkerにだけ話しかける。
// つかいかた: EXTENDING.md 9章(無料枠でOK・約10分)
// =====================================================================
export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",   // 公開後は自分のGitHub PagesのURLに絞るとより安全
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST") return new Response("POST only", { status: 405, headers: cors });

    try {
      const { situation = "idle", pet = {}, names = {} } = await req.json();
      const prompt = [
        "あなたは2人暮らしのカップルが育てている小さなペットです。",
        `名前:${pet.name || "もこ"} レベル:${pet.level || 1} 気分:${pet.mood || "ふつう"} 性格:${pet.topAxis || "なかよし"}`,
        `飼い主: ${names.you || "きみ"} と ${names.partner || "あのこ"}`,
        `いまの状況: ${situation}`,
        "この状況にあった一言セリフを、ひらがな多めのやわらかい日本語で1文だけ(40文字以内)。",
        "絵文字は0〜1個。説明や引用符は不要、セリフ本文のみを返す。",
      ].join("\n");

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 60, temperature: 0.9 },
          }),
        });
      const j = await r.json();
      const text = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      return new Response(JSON.stringify({ text }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    } catch (e) {
      return new Response(JSON.stringify({ text: "" }), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }
  },
};
