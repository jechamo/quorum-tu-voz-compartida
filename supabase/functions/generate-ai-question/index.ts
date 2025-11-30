import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { topic, entity, module } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY"); // <--- Necesitas esto

    if (!OPENAI_API_KEY) throw new Error("Falta OPENAI_API_KEY");
    if (!TAVILY_API_KEY) throw new Error("Falta TAVILY_API_KEY para buscar noticias");

    // 1. BÚSQUEDA DE NOTICIAS REALES (Esto sustituye al web_search)
    console.log(`🔎 Buscando noticias sobre: ${entity} ${topic || ""}`);

    const searchResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: `Noticias polémica última hora ${entity} ${module} España ${topic || ""}`,
        search_depth: "news",
        include_domains: ["elpais.com", "elmundo.es", "marca.com", "as.com", "elconfidencial.com"],
        max_results: 3,
      }),
    });

    const searchData = await searchResponse.json();
    const contextNews = searchData.results
      ? searchData.results.map((r: any) => `- ${r.title}: ${r.content}`).join("\n")
      : "No se encontraron noticias recientes.";

    console.log("📰 Noticias encontradas:", searchData.results?.length || 0);

    // 2. GENERACIÓN CON GPT (Le damos las noticias masticadas)
    const systemPrompt = `
      Eres un experto redactor de encuestas para la app Quorum.
      
      INFORMACIÓN DE ÚLTIMA HORA:
      ${contextNews}
      
      OBJETIVO: Generar una pregunta de debate basada en estas noticias.
      REGLAS:
      1. Entidad: ${entity}.
      2. Tono: Polémico pero neutral.
      3. FORMATO JSON ESTRICTO:
      {
        "question": "¿Pregunta?",
        "options": ["Opción 1", "Opción 2", "Opción 3", "Opción 4"]
      }
    `;

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
        response_format: { type: "json_object" }, // Esto garantiza JSON y evita errores de parseo
      }),
    });

    const aiData = await openAiResponse.json();
    const content = aiData.choices[0].message.content;
    const result = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // <--- Aquí está el arreglo del error TS
    console.error("Error en la función:", error);

    // Arreglo seguro para TypeScript:
    const errorMessage = error instanceof Error ? error.message : String(error);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
