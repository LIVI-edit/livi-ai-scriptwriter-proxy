import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const body = req.body || {};
    const action = body.action || "SCENE_IDEAS";
    const payload = body.payload || {};

    // ===== SCENE IDEAS =====

    if (action === "SCENE_IDEAS") {

      const prompt = `
Create 3 cinematic scene ideas.

Return JSON only:

{
 "ideas":[
  {
   "id":"exact",
   "short_title":"...",
   "scene_text":"...",
   "why_it_works":"..."
  }
 ]
}
`;

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.8,
        messages: [
          { role: "system", content: "You are a cinematic scene generator." },
          { role: "user", content: prompt }
        ]
      });

      const text = completion.choices[0].message.content;

      return res.json({
        ok: true,
        action: "SCENE_IDEAS",
        data: JSON.parse(text)
      });
    }

    // ===== REFINEMENT =====

    if (action === "REFINEMENT") {

      const prompt = `
Ask 1 short clarification question to improve the scene.

Return JSON:

{
 "question":"..."
}
`;

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: "You refine cinematic scenes." },
          { role: "user", content: prompt }
        ]
      });

      const text = completion.choices[0].message.content;

      return res.json({
        ok: true,
        action: "REFINEMENT",
        data: JSON.parse(text)
      });
    }

    // ===== FINAL ASSEMBLY =====

    if (action === "FINAL_ASSEMBLY") {

      const prompt = `
Build final cinematic scene description.

Return JSON:

{
 "scene_title":"...",
 "scene_description":"...",
 "visual_prompt":"..."
}
`;

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: "You assemble cinematic prompts." },
          { role: "user", content: prompt }
        ]
      });

      const text = completion.choices[0].message.content;

      return res.json({
        ok: true,
        action: "FINAL_ASSEMBLY",
        data: JSON.parse(text)
      });
    }

    return res.status(400).json({ error: "Unknown action" });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      error: "AI error",
      message: err.message
    });

  }

}
