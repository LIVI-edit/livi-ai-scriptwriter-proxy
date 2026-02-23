try {
    const { message, persona } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing 'message' string" });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "Message too long (max 2000 chars)" });
    }

    const personaPrompts = {
      director:
        "Ты AI-сценарист LiVi. Веди пользователя вопросами, чтобы уточнить цель, аудиторию, жанр, длительность и формат. Не давай длинных лекций. Если данных мало — задай 1-2 коротких уточняющих вопроса. Пиши по-русски.",
      marketer:
        "Ты AI-сценарист LiVi с уклоном в маркетинг. Уточняй цель ролика, оффер, аудиторию, CTA, площадку. Коротко, по делу. Пиши по-русски."
    };

    const system = personaPrompts[persona] || personaPrompts.director;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: message },
        ],
        max_output_tokens: 350,
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(500).json({ error: "OpenAI error", details: errText });
    }

    const data = await r.json();

    const text =
      data.output_text ||
      (Array.isArray(data.output)
        ? data.output
            .flatMap((o) => o.content || [])
            .filter((c) => c.type === "output_text" && c.text)
            .map((c) => c.text)
            .join("\n")
        : "");

    return res.status(200).json({ ok: true, persona: persona || "director", text });
  } catch (e) {
    return res.status(500).json({ error: "Server error", details: String(e) });
  }
}
