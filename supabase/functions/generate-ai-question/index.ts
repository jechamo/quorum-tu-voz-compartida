import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Evita falsos positivos tipo "athletic performance" para "Athletic Club".
 * - Comprueba coincidencia directa del nombre normalizado.
 * - Comprueba tokens "fuertes" del nombre (más de 3 letras, no genéricos).
 */
function isResultRelevantToEntity(result: any, entity: string, module: string): boolean {
  const text = normalize(`${result.title} ${result.content || ""}`);
  const ent = normalize(entity);

  if (!ent) return true; // si no hay entity, dejamos pasar

  // 1) Coincidencia directa del nombre completo
  if (text.includes(ent)) return true;

  // 2) Coincidencia con palabras clave significativas
  const blacklist = new Set([
    "athletic",
    "club",
    "real",
    "city",
    "united",
    "cf",
    "fc",
    "cd",
    "sc",
    "deportivo",
    "sporting",
    "partido",
    "popular",
    "socialista",
    "españa",
  ]);

  let tokens = ent.split(/\s+/).filter((t) => t.length > 3);

  // filtramos tokens genéricos
  tokens = tokens.filter((t) => !blacklist.has(t));

  // si nos hemos quedado sin tokens "fuertes", usamos el nombre entero
  if (tokens.length === 0) {
    return text.includes(ent);
  }

  return tokens.some((t) => text.includes(t));
}

/**
 * Construye la query de búsqueda para Tavily, ajustando según módulo.
 */
function buildEntityQuery(entity: string, module: string, topic?: string): string {
  const normEntity = (entity || "").trim();
  const baseTopic = topic || "noticias última hora actualidad";

  if (module === "futbol") {
    // reforzamos que es fútbol español / LaLiga
    return `"${normEntity}" fútbol España ${baseTopic} LaLiga "Liga EA Sports"`;
  }

  if (module === "politica") {
    return `"${normEntity}" partido político España ${baseTopic} Congreso Gobierno`;
  }

  // fallback genérico
  return `${normEntity} ${module} España ${baseTopic}`;
}

/**
 * Construye una query general por módulo para las preguntas "generales".
 */
function buildGeneralQuery(module: string, topic?: string): string {
  const baseTopic = topic || "noticias última hora actualidad polémica";

  if (module === "futbol") {
    return `últimas noticias ${baseTopic} fútbol España LaLiga "Liga EA Sports"`;
  }

  if (module === "politica") {
    return `últimas noticias ${baseTopic} política España partidos gobierno Congreso`;
  }

  return `últimas noticias ${baseTopic} España ${module}`;
}

/**
 * Llamada a Tavily con:
 * - topic: "news"
 * - search_depth: "basic"
 * - time_range: "week" (últimos ~7 días)
 * Hace dos intentos:
 *  1. Con dominios filtrados (si useDomains = true)
 *  2. Sin dominios (búsqueda abierta) si no hay resultados.
 */
async function tavilySearch(
  query: string,
  TAVILY_API_KEY: string,
  domains: string[],
  useDomains: boolean,
  maxResults: number,
): Promise<any[]> {
  console.log(`🔎 Tavily buscando: "${query}" (useDomains=${useDomains})`);

  // INTENTO 1: Con dominios (si toca)
  let body: Record<string, unknown> = {
    api_key: TAVILY_API_KEY,
    query,
    topic: "news",
    search_depth: "basic",
    max_results: maxResults,
    time_range: "week", // <--- Última semana
  };

  if (useDomains && domains.length > 0) {
    body.include_domains = domains;
  }

  let resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errTxt = await resp.text();
    console.error("❌ Error Tavily Intento 1:", errTxt);
  }

  let data = resp.ok ? await resp.json() : { results: [] };
  let results: any[] = (data as any).results || [];

  // INTENTO 2: sin dominios si no hay resultados
  if ((!results || results.length === 0) && useDomains) {
    console.log("⚠️ Sin resultados con dominios. Búsqueda abierta sin filtros...");

    body = {
      api_key: TAVILY_API_KEY,
      query,
      topic: "news",
      search_depth: "basic",
      max_results: maxResults,
      time_range: "week",
    };

    resp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errTxt = await resp.text();
      console.error("❌ Error Tavily Intento 2:", errTxt);
      return [];
    }

    data = await resp.json();
    results = (data as any).results || [];
  }

  console.log(`✅ Tavily devolvió ${results.length} resultados.`);
  return results;
}

/**
 * Formatea una lista de resultados de Tavily en texto para el contexto.
 */
function formatResultsBlock(results: any[]): string {
  return results.map((r) => `TITULAR: ${r.title}\nFUENTE: ${r.url}\nRESUMEN: ${r.content}`).join("\n\n");
}

serve(async (req) => {
  // Manejo CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { topic, entity, module, mode, entitiesList, model } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

    if (!OPENAI_API_KEY || !TAVILY_API_KEY) {
      throw new Error("Faltan API Keys (OpenAI o Tavily)");
    }

    const effectiveModule = module || "politica";
    const effectiveMode = mode || "single";

    // Dominios fiables
    const domains =
      effectiveModule === "futbol"
        ? ["marca.com", "as.com", "mundodeportivo.com", "sport.es", "relevo.com", "elpais.com"]
        : [
            "elpais.com",
            "elmundo.es",
            "elconfidencial.com",
            "okdiario.com",
            "eldiario.es",
            "abc.es",
            "elespanol.com",
            "lavanguardia.com",
          ];

    // ---------------------------------------------------------
    // 1. BÚSQUEDA DE NOTICIAS (TAVILY)
    // ---------------------------------------------------------

    let contextNews = "";

    if (effectiveMode === "batch" && Array.isArray(entitiesList) && entitiesList.length > 0) {
      // ---- MODO BATCH ----
      // 1) Bloque GENERAL por módulo (para la pregunta general)
      const generalQuery = buildGeneralQuery(effectiveModule, topic);
      const generalResults = await tavilySearch(generalQuery, TAVILY_API_KEY, domains, true, 7);

      const generalBlock =
        generalResults.length > 0
          ? `GENERAL:\n${formatResultsBlock(generalResults)}`
          : "GENERAL:\nSIN NOTICIAS RECIENTES (últimos 7 días).";

      // 2) Búsqueda por cada ENTIDAD
      const perEntityResults = await Promise.all(
        entitiesList.map(async (ent: string) => {
          const q = buildEntityQuery(ent, effectiveModule, topic);
          const rawResults = await tavilySearch(q, TAVILY_API_KEY, domains, true, 5);

          const filtered = rawResults.filter((r) => isResultRelevantToEntity(r, ent, effectiveModule));

          return { entity: ent, results: filtered };
        }),
      );

      const perEntityBlocks = perEntityResults
        .map(({ entity: ent, results }) => {
          if (!results || results.length === 0) {
            return `ENTIDAD: ${ent}\nSIN NOTICIAS RECIENTES (últimos 7 días).`;
          }

          return `ENTIDAD: ${ent}\n${formatResultsBlock(results)}`;
        })
        .join("\n\n");

      contextNews = `${generalBlock}\n\n${perEntityBlocks}`;
    } else {
      // ---- MODO SINGLE (por defecto) ----
      const ent = entity || "";
      const q = buildEntityQuery(ent, effectiveModule, topic);

      const rawResults = await tavilySearch(q, TAVILY_API_KEY, domains, true, 5);

      const filtered = ent ? rawResults.filter((r) => isResultRelevantToEntity(r, ent, effectiveModule)) : rawResults;

      if (filtered.length > 0) {
        contextNews = formatResultsBlock(filtered);
      } else {
        console.log("❌ Sin noticias relevantes en la última semana para la entidad.");
        contextNews =
          "NO HAY NOTICIAS RECIENTES (últimos 7 días) para esta entidad. IMPORTANTE: No inventes noticias falsas. Genera una pregunta sobre un tema 'evergreen' (histórico/recurrente) de esta entidad.";
      }
    }

    // ---------------------------------------------------------
    // 2. GENERACIÓN (OPENAI)
    // ---------------------------------------------------------

    const systemPrompt = `
Eres un redactor jefe de un medio digital en España.

TU MISIÓN: Crear encuestas basadas en HECHOS REALES encontrados abajo.

NOTICIAS RECIENTES (ÚLTIMA SEMANA, LA VERDAD):
${contextNews}

OBJETIVO:
${
  effectiveMode === "batch"
    ? `Genera una batería de preguntas (mínimo 3). 1 general sobre el contexto "GENERAL" y otras para: [${
        entitiesList ? entitiesList.join(", ") : ""
      }]. Si no hay noticia para una entidad, SÁLTALA.`
    : `Genera una encuesta sobre: ${entity}.`
}

REGLAS DE ORO (ESTRICTAS):
1. BASADO EN HECHOS: Solo usa las noticias proporcionadas arriba. Si no hay, usa temas históricos generales (evergreen) de la entidad, pero sin inventar sucesos concretos recientes.
2. PREGUNTAS INTELIGENTES: Nada de "¿Qué opinas?". Usa fórmulas como: "¿Es admisible...?", "¿Debe dimitir...?", "¿Acierto o error?", "¿Te parece adecuado...?".
3. OPCIONES NATURALES (¡PROHIBIDO CORCHETES!):
   - MAL: "[Indignado]", "[A favor]"
   - BIEN: "Es una vergüenza absoluta", "Totalmente de acuerdo", "Tienen parte de razón", "Es una cortina de humo".

FORMATO JSON:
{
  "results": [
    { "question": "¿Pregunta?", "options": ["Frase A", "Frase B", "Frase C", "Frase D"], "target_entity": "Nombre" }
  ]
}
    `;

    const aiModel = model || "gpt-4o-mini";

    const requestBody: any = {
      model: aiModel,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    };

    // Ajuste de parámetros según modelo (gpt-5 / o1 vs modelos "clásicos")
    if (aiModel.includes("gpt-5") || aiModel.startsWith("o1")) {
      requestBody.max_completion_tokens = 4000;
    } else {
      requestBody.max_tokens = 4000;
      requestBody.temperature = 0.8;
    }

    const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!openAiResponse.ok) {
      const err = await openAiResponse.text();
      throw new Error(`OpenAI Error: ${err}`);
    }

    const aiData = await openAiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    let result;
    try {
      result = JSON.parse(content);
    } catch (_e) {
      console.error("⚠️ No se pudo parsear JSON, devuelvo envoltorio.");
      result = { raw: content };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("🔥 Error Function:", errorMessage);

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
