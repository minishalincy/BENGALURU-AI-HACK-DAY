import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Zap, Loader2, TrendingUp, Eye, Heart, Lightbulb } from "lucide-react";

interface AttentionAnalysisProps {
  userProfile: {
    niche: string;
    primary_platform: string;
    long_term_goal: string;
    tone: string;
  };
}

interface AnalysisResult {
  hookStrength: number;
  clarity: number;
  emotionalTrigger: string;
  attentionAnalysis: string;
  improvements: string[];
}

export const AttentionAnalysis = ({ userProfile }: AttentionAnalysisProps) => {
  const [idea, setIdea] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!idea.trim()) {
      toast({
        title: "Enter your content",
        description: "Please enter a content idea or hook to analyze.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      // Save the idea to database
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "Not authenticated",
          description: "Please sign in again.",
          variant: "destructive",
        });
        return;
      }

      const { data: ideaData, error: ideaError } = await supabase
        .from("content_ideas")
        .insert({
          user_id: session.user.id,
          idea_text: idea.trim(),
        })
        .select()
        .single();

      if (ideaError) throw ideaError;

      // Call AI analysis
      const { data, error } = await supabase.functions.invoke("analyze-content", {
        body: {
          type: "attention",
          idea: idea.trim(),
          userProfile,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const analysisResult = data.result as AnalysisResult;
      setResult(analysisResult);

      // Save analysis result
      await supabase.from("analysis_results").insert({
        content_idea_id: ideaData.id,
        user_id: session.user.id,
        analysis_type: "attention",
        attention_insight: analysisResult.attentionAnalysis,
        explanation: JSON.stringify(analysisResult),
      });

    } catch (error) {
      toast({
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400";
    if (score >= 5) return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <Zap className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Attention Analysis</h2>
          <p className="text-muted-foreground">
            Understand why your content grabs or loses attention
          </p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Paste your content idea, hook, or caption here..."
          className="min-h-[120px] bg-secondary/50 border-border/50 resize-none text-base"
        />

        <Button
          onClick={handleAnalyze}
          disabled={loading || !idea.trim()}
          className="mt-4 gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Analyze Attention
            </>
          )}
        </Button>
      </div>

      {result && (
        <div className="space-y-4 animate-slide-up">
          {/* Scores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Hook Strength</span>
              </div>
              <span className={`text-4xl font-bold ${getScoreColor(result.hookStrength)}`}>
                {result.hookStrength}/10
              </span>
            </div>
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Clarity</span>
              </div>
              <span className={`text-4xl font-bold ${getScoreColor(result.clarity)}`}>
                {result.clarity}/10
              </span>
            </div>
          </div>

          {/* Emotional Trigger */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="font-medium">Emotional Trigger</span>
            </div>
            <p className="text-muted-foreground">{result.emotionalTrigger}</p>
          </div>

          {/* Analysis */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-medium">Why This Works (or Doesn't)</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {result.attentionAnalysis}
            </p>
          </div>

          {/* Improvements */}
          {result.improvements && result.improvements.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">Improvement Suggestions</span>
              </div>
              <ul className="space-y-2">
                {result.improvements.map((improvement, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-muted-foreground"
                  >
                    <span className="text-primary mt-1">•</span>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
