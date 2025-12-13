import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Zap,
  RefreshCw,
  Layout,
  PenLine,
  LogOut,
  Loader2,
  Mic,
} from "lucide-react";
import { AttentionAnalysis } from "@/components/AttentionAnalysis";
import { RepetitionCheck } from "@/components/RepetitionCheck";
import { FormatRecommendation } from "@/components/FormatRecommendation";
import { HookGenerator } from "@/components/HookGenerator";
import LiveEventRecorder from "@/components/LiveEventRecorder";

type FeatureKey = "attention" | "repetition" | "format" | "hooks" | "live-event";

interface UserProfile {
  niche: string;
  primary_platform: string;
  long_term_goal: string;
  tone: string;
}

const features = [
  {
    key: "live-event" as FeatureKey,
    icon: Mic,
    title: "Record Live Event",
    description: "Capture & convert events to content",
    color: "text-rose-400",
  },
  {
    key: "attention" as FeatureKey,
    icon: Zap,
    title: "Analyze Attention",
    description: "Understand why content works",
    color: "text-amber-400",
  },
  {
    key: "repetition" as FeatureKey,
    icon: RefreshCw,
    title: "Check Repetition",
    description: "Avoid repeating ideas",
    color: "text-blue-400",
  },
  {
    key: "format" as FeatureKey,
    icon: Layout,
    title: "Best Format",
    description: "Get format recommendations",
    color: "text-emerald-400",
  },
  {
    key: "hooks" as FeatureKey,
    icon: PenLine,
    title: "Generate Hooks",
    description: "Create attention-grabbing openers",
    color: "text-purple-400",
  },
];

const Dashboard = () => {
  const [activeFeature, setActiveFeature] = useState<FeatureKey | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("niche, primary_platform, long_term_goal, tone, onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        toast({
          title: "Error loading profile",
          description: "Please try refreshing the page.",
          variant: "destructive",
        });
        return;
      }

      if (!profileData?.onboarding_completed) {
        navigate("/onboarding");
        return;
      }

      setProfile({
        niche: profileData.niche || "",
        primary_platform: profileData.primary_platform || "",
        long_term_goal: profileData.long_term_goal || "",
        tone: profileData.tone || "",
      });
      setLoading(false);
    };

    fetchProfile();

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-80 h-80 bg-primary/2 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-lg">ContentForge</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {profile?.niche} • {profile?.primary_platform}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Welcome */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Your Content <span className="text-gradient">Advisor</span>
          </h1>
          <p className="text-muted-foreground text-lg">
            Choose an action to get strategic guidance for your content
          </p>
        </div>

        {/* Feature Grid */}
        {!activeFeature && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up">
            {features.map((feature) => (
              <button
                key={feature.key}
                onClick={() => setActiveFeature(feature.key)}
                className="glass-card rounded-2xl p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:glow-border group"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${feature.color}`}
                >
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-1">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </button>
            ))}
          </div>
        )}

        {/* Feature Panels */}
        {activeFeature && profile && (
          <div className="animate-slide-up">
            <Button
              variant="ghost"
              onClick={() => setActiveFeature(null)}
              className="mb-6"
            >
              ← Back to actions
            </Button>

            {activeFeature === "live-event" && (
              <LiveEventRecorder userProfile={profile} />
            )}
            {activeFeature === "attention" && (
              <AttentionAnalysis userProfile={profile} />
            )}
            {activeFeature === "repetition" && (
              <RepetitionCheck userProfile={profile} />
            )}
            {activeFeature === "format" && (
              <FormatRecommendation userProfile={profile} />
            )}
            {activeFeature === "hooks" && (
              <HookGenerator userProfile={profile} />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
