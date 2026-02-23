module.exports = async (req, res) => {
  // CORS (чтобы запросы из браузера не блокировались)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Иногда body приходит строкой — подстрахуемся
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
   const { message, persona, mode, messages } = body;

  const modeLower = (mode || "chat").toLowerCase();

// message обязателен только в режиме chat
if (modeLower !== "build") {
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing 'message' string" });
  }
  if (message.length > 2000) {
    return res.status(400).json({ error: "Message too long (max 2000 chars)" });
  }
}

    const personaPrompts = {
      director:
        "Ты AI-сценарист LiVi. Веди пользователя вопросами, чтобы уточнить цель, аудиторию, жанр, длительность и формат. Не давай длинных лекций. Если данных мало — задай 1-2 коротких уточняющих вопроса. Пиши по-русски.",
      marketer:
        "Ты AI-сценарист LiVi с уклоном в маркетинг. Уточняй цель ролика, оффер, аудиторию, CTA, площадку. Коротко, по делу. Пиши по-русски."
    };

    const system = personaPrompts[persona] || personaPrompts.director;
    const safeMessages = Array.isArray(messages) ? messages.slice(-20) : [];
const userMessage = (typeof message === "string" && message.trim()) ? message.trim() : null;

const buildInstruction = `
Собери ПОЛНУЮ структуру ролика LiVi как готовый сценарный документ.

Требования:
- Не сокращай текст.
- Пиши подробно, но без воды.
- Минимум 5 сцен.
- Каждая сцена: id, название, подробное описание (2–3 предложения), примерная длительность.
- Пропиши атмосферу и визуальные детали.

Формат:

1) SCENES  
Список сцен с подробным описанием.

2) CHOICES  
Если интерактив не нужен — напиши, что ролик линейный.  
Если можно — предложи 1 вариант интерактива.

3) TRANSITIONS  
Тип переходов между сценами (буфер, переходный клип, продолжение).

4) VISUAL STYLE  
Цвета, свет, атмосфера, стиль камеры.

5) PROMPTS  
6–8 готовых промптов для генерации видео.

6) JSON  
В конце выведи один валидный JSON:
{
  scenes:[],
  choices:[],
  transitions:[],
  style:"",
  prompts:[]
}

Если данных достаточно — НЕ задавай вопросов. Сразу собирай структуру.
`.trim();
let input = [{ role: "system", content: system }];

for (const m of safeMessages) {
  if (!m || typeof m !== "object") continue;
  if (!["user", "assistant"].includes(m.role)) continue;
  if (typeof m.content !== "string") continue;
  input.push({ role: m.role, content: m.content });
}

if (userMessage) input.push({ role: "user", content: userMessage });

if ((mode || "").toLowerCase() === "build") {
  input.push({ role: "user", content: buildInstruction });
}

if (input.length < 2) {
  return res.status(400).json({ error: "No input provided" });
}

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input,
        max_output_tokens: 900
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(500).json({ error: "OpenAI error", details: errText });
    }

    const data = await r.json();

    // Достаём итоговый текст
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
};
