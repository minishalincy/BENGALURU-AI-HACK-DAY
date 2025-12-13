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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing env vars:', { url: !!supabaseUrl, key: !!supabaseKey });
      throw new Error('Supabase configuration missing');
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { recordingId, transcription, userProfile } = await req.json();

    if (!recordingId || !transcription) {
      throw new Error('Recording ID and transcription are required');
    }

    console.log('Processing transcription for recording:', recordingId);
    console.log('Transcription length:', transcription.length);

    // Step 1: Extract insights from the transcription
    const insightsResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert content analyst specializing in extracting valuable insights from live events, workshops, and talks. Your job is to identify the most impactful, shareable, and thought-provoking content from event transcriptions.

Focus on:
- Key insights and takeaways that would resonate with an audience
- Memorable quotes that capture important ideas
- Actionable advice or wisdom shared
- Unique perspectives or contrarian views
- Stories or examples that illustrate key points

Ignore:
- Filler words and casual conversation
- Administrative announcements
- Off-topic tangents
- Repetitive content`
          },
          {
            role: "user",
            content: `Analyze this event transcription and extract the most valuable content for social media posts.

TRANSCRIPTION:
${transcription}

Provide your analysis in the following JSON format:
{
  "keyInsights": ["insight1", "insight2", "insight3"],
  "bestQuotes": ["quote1", "quote2"],
  "mainThemes": ["theme1", "theme2"],
  "actionableAdvice": ["advice1", "advice2"],
  "eventSummary": "A brief 2-3 sentence summary of what this event was about"
}`
          }
        ],
      }),
    });

    if (!insightsResponse.ok) {
      const errorText = await insightsResponse.text();
      console.error('Insights API error:', insightsResponse.status, errorText);
      throw new Error('Failed to extract insights');
    }

    const insightsData = await insightsResponse.json();
    const insightsText = insightsData.choices?.[0]?.message?.content || '';
    
    // Parse insights JSON
    let insights;
    try {
      const jsonMatch = insightsText.match(/\{[\s\S]*\}/);
      insights = jsonMatch ? JSON.parse(jsonMatch[0]) : { keyInsights: [], bestQuotes: [], mainThemes: [], actionableAdvice: [], eventSummary: '' };
    } catch {
      console.error('Failed to parse insights JSON, using fallback');
      insights = { keyInsights: [], bestQuotes: [], mainThemes: [], actionableAdvice: [], eventSummary: '' };
    }

    console.log('Extracted insights:', insights);

    // Step 2: Generate platform-specific content
    const niche = userProfile?.niche || 'general';
    const platform = userProfile?.primary_platform || 'LinkedIn';
    const goal = userProfile?.long_term_goal || 'build authority';
    const tone = userProfile?.tone || 'professional';

    const contentResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are an expert social media content creator who transforms event insights into engaging, platform-optimized posts.

Creator Profile:
- Niche: ${niche}
- Primary Platform: ${platform}
- Long-term Goal: ${goal}
- Preferred Tone: ${tone}

Your content must:
- Feel authentic to the creator's voice
- Be optimized for each platform's algorithm
- Drive engagement and shares
- Position the creator as a thought leader
- Be ready to post with minimal editing`
          },
          {
            role: "user",
            content: `Based on these event insights, create ready-to-post content for each platform.

EVENT INSIGHTS:
${JSON.stringify(insights, null, 2)}

Create content in the following JSON format:
{
  "linkedinPost": {
    "content": "The full LinkedIn post text (include line breaks with \\n, use emojis sparingly, end with a call-to-action or question)",
    "whyItWorks": "Brief explanation of why this post will perform well"
  },
  "instagramCaption": {
    "content": "The Instagram caption (storytelling format, emojis encouraged, include relevant hashtags at the end)",
    "whyItWorks": "Brief explanation of why this caption will engage"
  },
  "twitterThread": {
    "content": "A Twitter/X thread as an array of tweets, each under 280 characters",
    "whyItWorks": "Brief explanation of why this thread will get engagement"
  }
}`
          }
        ],
      }),
    });

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      console.error('Content generation API error:', contentResponse.status, errorText);
      throw new Error('Failed to generate content');
    }

    const contentData = await contentResponse.json();
    const contentText = contentData.choices?.[0]?.message?.content || '';

    // Parse content JSON
    let generatedContent;
    try {
      const jsonMatch = contentText.match(/\{[\s\S]*\}/);
      generatedContent = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      console.error('Failed to parse content JSON');
      generatedContent = null;
    }

    if (!generatedContent) {
      throw new Error('Failed to parse generated content');
    }

    console.log('Generated content for all platforms');

    // Format Twitter thread as a single string
    const twitterThreadContent = Array.isArray(generatedContent.twitterThread?.content)
      ? generatedContent.twitterThread.content.join('\n\n---\n\n')
      : generatedContent.twitterThread?.content || '';

    // Update the recording in the database
    const { error: updateError } = await supabaseClient
      .from('event_recordings')
      .update({
        transcription,
        insights,
        linkedin_post: generatedContent.linkedinPost?.content || '',
        instagram_caption: generatedContent.instagramCaption?.content || '',
        twitter_thread: twitterThreadContent,
        status: 'completed'
      })
      .eq('id', recordingId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Database update error:', updateError);
      throw new Error('Failed to save analysis results');
    }

    return new Response(JSON.stringify({
      success: true,
      insights,
      content: {
        linkedin: {
          post: generatedContent.linkedinPost?.content || '',
          explanation: generatedContent.linkedinPost?.whyItWorks || ''
        },
        instagram: {
          caption: generatedContent.instagramCaption?.content || '',
          explanation: generatedContent.instagramCaption?.whyItWorks || ''
        },
        twitter: {
          thread: twitterThreadContent,
          explanation: generatedContent.twitterThread?.whyItWorks || ''
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Process event audio error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
