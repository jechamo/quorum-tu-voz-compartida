import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Cabeceras para permitir que tu web llame a esta función (CORS)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Si es una petición "OPTIONS" (el navegador preguntando si puede pasar), le decimos que sí.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Obtenemos los datos que nos envía el Frontend
    const { topic, entity, module } = await req.json();

    // 3. Recuperamos la clave secreta de OpenAI (que configuraremos en el siguiente paso)
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("Falta la clave API OpenAI en Supabase");
    }

    console.log(`Generando pregunta sobre: ${topic} para ${entity} (${module})`);

    // 4. Preparamos el "Prompt" (las instrucciones para la IA)
    const systemPrompt = `
      Eres un experto redactor de encuestas de opinión para una app llamada Quorum.
      Tu objetivo es generar una pregunta de debate interesante y polémica pero neutral.
      
      Reglas:
      1. La pregunta debe ser sobre: ${entity} (Módulo: ${module}).
      2. Contexto/Noticia: "${topic}".
      3. Genera 4 opciones de respuesta cortas y claras.
      4. FORMATO JSON ESTRICTO:
      {
        "question": "¿Texto de la pregunta?",
        "options": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"]
      }
      5. Idioma: Español de España.
      6. No añadas nada más fuera del JSON.
    `;

    // 5. Llamamos a OpenAI (GPT-4o-mini es rápido y barato)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        tools: [{ type: "web_search" }],
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7, // Creatividad media
      }),
    });

    const aiData = await response.json();

    // 6. Extraemos y limpiamos la respuesta
    let content = aiData.choices[0].message.content;
    // A veces la IA pone ```json ... ```, lo quitamos por si acaso
    content = content
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const result = JSON.parse(content);

    // 7. Devolvemos la pregunta limpia al Frontend
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
