import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, idea, userProfile, pastIdeas } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (type) {
      case "attention":
        systemPrompt = `You are a strategic content advisor specializing in social media attention dynamics. 
        Analyze content hooks and ideas for their attention-grabbing potential.
        The user is a ${userProfile.niche} creator on ${userProfile.primary_platform} with a ${userProfile.tone} tone.
        Their long-term goal is: ${userProfile.long_term_goal}.
        
        Analyze the content and provide:
        1. Hook Strength Score (1-10)
        2. Clarity Score (1-10)
        3. Emotional Trigger Analysis
        4. Why this content may gain or lose attention
        5. Specific improvement suggestions
        
        Be direct, actionable, and speak like a trusted advisor. Format your response as JSON:
        {
          "hookStrength": number,
          "clarity": number,
          "emotionalTrigger": "string describing the emotional appeal",
          "attentionAnalysis": "string explaining why it works or doesn't",
          "improvements": ["array of specific suggestions"]
        }`;
        userPrompt = `Analyze this content idea/hook: "${idea}"`;
        break;

      case "repetition":
        const pastIdeasList = pastIdeas?.map((i: string, idx: number) => `${idx + 1}. ${i}`).join('\n') || 'No past ideas stored';
        systemPrompt = `You are a content strategy advisor helping creators avoid idea repetition.
        The user is a ${userProfile.niche} creator.
        
        Compare the new idea against their past content ideas and identify:
        1. Similarity score (0-100, where 100 is identical)
        2. Which past ideas are similar and why
        3. How to reframe for freshness
        
        Past ideas:
        ${pastIdeasList}
        
        Format response as JSON:
        {
          "similarityScore": number,
          "similarIdeas": ["array of similar past ideas with brief explanation"],
          "reframesSuggestions": ["array of ways to make the idea feel fresh"],
          "verdict": "unique" | "similar" | "repetitive"
        }`;
        userPrompt = `Check this new idea for repetition: "${idea}"`;
        break;

      case "format":
        systemPrompt = `You are a content format strategist for ${userProfile.primary_platform}.
        The user's goal is: ${userProfile.long_term_goal}
        Their niche: ${userProfile.niche}
        Their tone: ${userProfile.tone}
        
        Recommend the best content format and explain why.
        Consider the platform's algorithm preferences and the idea's nature.
        
        Format options: reel, carousel, thread, single post, story, long-form video
        
        Format response as JSON:
        {
          "recommendedFormat": "string",
          "reasoning": "string explaining why this format fits",
          "alternativeFormat": "string",
          "alternativeReasoning": "string",
          "goalAlignment": "string explaining how this supports their goal"
        }`;
        userPrompt = `What's the best format for this content idea: "${idea}"`;
        break;

      case "hooks":
        systemPrompt = `You are a hook writing specialist for ${userProfile.primary_platform} content.
        The user's niche: ${userProfile.niche}
        Their tone: ${userProfile.tone}
        Their goal: ${userProfile.long_term_goal}
        
        Generate 4 different opening hooks in these styles:
        1. Curiosity - Creates an information gap
        2. Authority - Establishes credibility immediately
        3. Storytelling - Opens with a narrative
        4. Contrarian - Challenges common beliefs
        
        Rank each hook by attention strength (1-10).
        
        Format response as JSON:
        {
          "hooks": [
            {
              "style": "curiosity",
              "hook": "the hook text",
              "attentionScore": number,
              "explanation": "why this works"
            }
          ]
        }`;
        userPrompt = `Generate hooks for this content idea: "${idea}"`;
        break;

      default:
        throw new Error("Invalid analysis type");
    }

    console.log(`Processing ${type} analysis for idea: ${idea?.substring(0, 50)}...`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      parsedContent = { rawResponse: content };
    }

    console.log(`${type} analysis completed successfully`);

    return new Response(JSON.stringify({ 
      success: true, 
      type,
      result: parsedContent 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in analyze-content function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
