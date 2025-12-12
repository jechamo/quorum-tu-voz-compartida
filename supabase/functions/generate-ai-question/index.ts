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
 */
function isResultRelevantToEntity(result: any, entity: string, module: string): boolean {
  const text = normalize(`${result.title} ${result.content || ""}`);
  const ent = normalize(entity);

  if (!ent) return true;

  if (text.includes(ent)) return true;

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
  tokens = tokens.filter((t) => !blacklist.has(t));

  if (tokens.length === 0) {
    return text.includes(ent);
  }

  return tokens.some((t) => text.includes(t));
}

function buildEntityQuery(entity: string, module: string, topic?: string): string {
  const normEntity = (entity || "").trim();
  const baseTopic = topic || "noticias última hora actualidad";

  if (module === "futbol") {
    return `"${normEntity}" fútbol España ${baseTopic} LaLiga "Liga EA Sports"`;
  }

  if (module === "politica") {
    return `"${normEntity}" partido político España ${baseTopic} Congreso Gobierno`;
  }

  return `${normEntity} ${module} España ${baseTopic}`;
}

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

async function tavilySearch(
  query: string,
  TAVILY_API_KEY: string,
  domains: string[],
  useDomains: boolean,
  maxResults: number,
): Promise<any[]> {
  console.log(`🔎 Tavily buscando: "${query}" (useDomains=${useDomains})`);

  let body: Record<string, unknown> = {
    api_key: TAVILY_API_KEY,
    query,
    topic: "general",
    search_depth: "basic",
    max_results: maxResults,
    time_range: "week",
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

function formatResultsBlock(results: any[]): string {
  return results.map((r) => `TITULAR: ${r.title}\nFUENTE: ${r.url}\nRESUMEN: ${r.content}`).join("\n\n");
}

/**
 * Genera el prompt para preguntas ATEMPORALES (sin noticias)
 */
function getTimelessSystemPrompt(module: string, topic?: string): string {
  const moduleContext =
    module === "politica" ? "política española y debates sociales" : "fútbol español, LaLiga y cultura futbolística";

  const topicHint = topic ? `El usuario quiere enfocarse en: "${topic}". Incorpora este tema si es relevante.` : "";

  return `
Eres un experto en crear debates y encuestas sobre ${moduleContext}.

TU MISIÓN: Generar preguntas ATEMPORALES que siempre generan debate, sin depender de noticias actuales.

CARACTERÍSTICAS DE LAS PREGUNTAS ATEMPORALES:
- Son debates CLÁSICOS que SIEMPRE existen y generan opiniones divididas
- NO dependen de eventos actuales ni de noticias recientes
- Son cuestiones FILOSÓFICAS, ÉTICAS o de OPINIÓN sobre el tema
- Pueden repetirse semana tras semana porque son eternas
- NO SACAR temas de actualidad

${topicHint}

${
  module === "politica"
    ? `
EJEMPLOS DE TEMAS ATEMPORALES EN POLÍTICA:
- Cambio horario en España
- Monarquía vs República
- Edad de jubilación
- Duración de los mandatos
- Financiación autonómica
- Modelo territorial
- Pena de muerte
- Eutanasia y aborto
- Inmigración y fronteras
- Impuestos y gasto público
- Educación pública vs concertada
- Sanidad pública vs privada
- Servicio militar obligatorio
- Voto obligatorio
- Límite de mandatos
- Aforamientos políticos
`
    : `
EJEMPLOS DE TEMAS ATEMPORALES EN FÚTBOL:
- VAR: ¿mejora o arruina el fútbol?
- Fichajes millonarios vs cantera
- Superliga europea
- Calendario sobrecargado
- Selección vs club
- Mejor jugador de la historia
- Clásicos rivalidades eternas
- Árbitros profesionales
- Fútbol moderno vs tradicional
- Precios de las entradas
- Horarios de los partidos
- Césped artificial vs natural
- Fair play financiero
- Nacionalización de jugadores
- Mundiales cada 2 años
`
}

GENERA 5 PREGUNTAS ATEMPORALES variadas.

REGLAS:
1. PREGUNTAS POLARIZANTES: Que dividan opiniones claramente
2. SIN FECHAS NI EVENTOS: Nada que dependa de la actualidad
3. OPCIONES NATURALES (¡PROHIBIDO CORCHETES!):
   - MAL: "[A favor]", "[En contra]"
   - BIEN: "Totalmente a favor", "Depende del caso", "Es un error absoluto"

FORMATO JSON:
{
  "results": [
    { "question": "¿Pregunta atemporal?", "options": ["Opción A", "Opción B", "Opción C", "Opción D"], "target_entity": "General" }
  ]
}
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { topic, entity, module, mode, entitiesList, model, isTimeless } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("Falta API Key de OpenAI");
    }

    const effectiveModule = module || "politica";
    const effectiveMode = mode || "single";

    let systemPrompt: string;

    // ---------------------------------------------------------
    // MODO ATEMPORAL: Sin búsqueda de noticias
    // ---------------------------------------------------------
    if (isTimeless) {
      console.log("🕐 Modo ATEMPORAL activado - sin búsqueda de noticias");
      systemPrompt = getTimelessSystemPrompt(effectiveModule, topic);
    } else {
      // ---------------------------------------------------------
      // MODO NORMAL: Con búsqueda de noticias (Tavily)
      // ---------------------------------------------------------
      if (!TAVILY_API_KEY) {
        throw new Error("Falta API Key de Tavily para búsqueda de noticias");
      }

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

      let contextNews = "";

      if (effectiveMode === "batch" && Array.isArray(entitiesList) && entitiesList.length > 0) {
        const generalQuery = buildGeneralQuery(effectiveModule, topic);
        const generalResults = await tavilySearch(generalQuery, TAVILY_API_KEY, domains, true, 7);

        console.log("ℹ️ [BATCH] Resultados GENERAL:", generalResults.length);

        const generalBlock =
          generalResults.length > 0
            ? `GENERAL:\n${formatResultsBlock(generalResults)}`
            : "GENERAL:\nSIN NOTICIAS RECIENTES (últimos 7 días).";

        const perEntityResults = await Promise.all(
          entitiesList.map(async (ent: string) => {
            const q = buildEntityQuery(ent, effectiveModule, topic);
            const rawResults = await tavilySearch(q, TAVILY_API_KEY, domains, true, 5);

            console.log(`ℹ️ [BATCH] Entity="${ent}" rawResults:`, rawResults.length);

            let filtered = rawResults.filter((r) => isResultRelevantToEntity(r, ent, effectiveModule));

            console.log(`ℹ️ [BATCH] Entity="${ent}" filtered:`, filtered.length);

            if (filtered.length === 0 && rawResults.length > 0) {
              console.log(`⚠️ [BATCH] Filtro muy agresivo para "${ent}", usando rawResults.`);
              filtered = rawResults;
            }

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
        const ent = entity || "";
        const q = buildEntityQuery(ent, effectiveModule, topic);

        const rawResults = await tavilySearch(q, TAVILY_API_KEY, domains, true, 5);

        console.log("ℹ️ [SINGLE] Query:", q);
        console.log("ℹ️ [SINGLE] rawResults:", rawResults.length);
        rawResults.slice(0, 3).forEach((r: any, i: number) => {
          console.log(`   [${i}]`, r.title, "->", r.url);
        });

        let filtered = ent ? rawResults.filter((r) => isResultRelevantToEntity(r, ent, effectiveModule)) : rawResults;

        console.log("ℹ️ [SINGLE] Resultados después del filtro:", filtered.length, "(raw:", rawResults.length, ")");

        if (filtered.length === 0 && rawResults.length > 0) {
          console.log("⚠️ [SINGLE] Filtro demasiado agresivo, usando resultados sin filtrar para la entidad:", ent);
          filtered = rawResults;
        }

        if (filtered.length > 0) {
          contextNews = formatResultsBlock(filtered);
        } else {
          console.log("❌ [SINGLE] Sin noticias relevantes en la última semana para la entidad (Tavily devolvió 0).");
          contextNews =
            "NO HAY NOTICIAS RECIENTES (últimos 7 días) para esta entidad. IMPORTANTE: No inventes noticias falsas. Genera una pregunta sobre un tema 'evergreen' (histórico/recurrente) de esta entidad.";
        }
      }

      systemPrompt = `
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
    }

    // ---------------------------------------------------------
    // GENERACIÓN (OPENAI)
    // ---------------------------------------------------------
    const aiModel = model || "gpt-4o-mini";

    const requestBody: any = {
      model: aiModel,
      messages: [{ role: "system", content: systemPrompt }],
      response_format: { type: "json_object" },
    };

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
