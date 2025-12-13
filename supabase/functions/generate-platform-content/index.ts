import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { recordingId, transcription, userProfile, platforms } = await req.json();

    if (!recordingId || !transcription || !platforms || platforms.length === 0) {
      throw new Error('Recording ID, transcription, and platforms are required');
    }

    console.log('Generating content for platforms:', platforms);
    console.log('Transcription length:', transcription.length);

    const niche = userProfile?.niche || 'general content';
    const goal = userProfile?.long_term_goal || 'engage audience';
    const tone = userProfile?.tone || 'professional';

    // Generate content for all platforms in one AI call
    const platformsList = platforms.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(', ');
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert social media content creator. Your job is to transform audio transcriptions into platform-ready posts.

Creator Profile:
- Niche: ${niche}
- Goal: ${goal}
- Tone: ${tone}

Guidelines:
- Create content that feels authentic to the creator's voice
- Optimize for each platform's algorithm and format
- Include appropriate emojis and formatting for each platform
- Generate a thumbnail concept for visual platforms
- Content should be ready to post with minimal editing

IMPORTANT: Output valid JSON only, no markdown.`
          },
          {
            role: "user",
            content: `Create platform-specific content from this transcription.

TRANSCRIPTION:
${transcription}

PLATFORMS: ${platformsList}

Return a JSON object with this exact structure:
{
  "platforms": [
    {
      "platform": "platform_name",
      "caption": "The full post/caption text ready to publish. Include line breaks (\\n) where appropriate. Use relevant hashtags for Instagram/TikTok. Keep Twitter under 280 chars.",
      "thumbnailConcept": "A brief description of a thumbnail or visual that would work well with this post (2-3 sentences)"
    }
  ]
}

Generate content for each of these platforms: ${platformsList}`
          }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (response.status === 402) {
        throw new Error('AI credits exhausted. Please add credits to continue.');
      }
      throw new Error('Failed to generate content');
    }

    const data = await response.json();
    const contentText = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response length:', contentText.length);

    // Parse the JSON response
    let platformContent;
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        platformContent = parsed.platforms || [];
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Raw response:', contentText.substring(0, 500));
    }

    // Fallback if parsing fails
    if (!platformContent || platformContent.length === 0) {
      console.log('Using fallback content generation');
      platformContent = platforms.map((platform: string) => ({
        platform,
        caption: `🎯 Key insights from today:\n\n${transcription.substring(0, 200)}...\n\nWhat are your thoughts? Let me know below! 👇`,
        thumbnailConcept: `A clean, professional image with a key quote from the content overlaid on a branded background.`
      }));
    }

    // Store the generated content
    const contentJson = platformContent.reduce((acc: Record<string, string>, item: { platform: string; caption: string }) => {
      acc[item.platform] = item.caption;
      return acc;
    }, {});

    const { error: updateError } = await supabaseClient
      .from('event_recordings')
      .update({
        transcription,
        insights: { platforms: platformContent },
        status: 'completed'
      })
      .eq('id', recordingId);

    if (updateError) {
      console.error('Database update error:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      platformContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Generate platform content error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
