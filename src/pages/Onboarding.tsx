import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ArrowRight, ArrowLeft, Check } from "lucide-react";

const platforms = [
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "linkedin", label: "LinkedIn", icon: "💼" },
  { id: "youtube", label: "YouTube", icon: "🎬" },
  { id: "twitter", label: "Twitter/X", icon: "🐦" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
];

const goals = [
  { id: "authority", label: "Build Authority", desc: "Become a recognized expert" },
  { id: "audience", label: "Grow Audience", desc: "Increase followers & reach" },
  { id: "clients", label: "Get Clients", desc: "Attract customers & leads" },
  { id: "product", label: "Sell Product", desc: "Promote & sell offerings" },
];

const tones = [
  { id: "professional", label: "Professional", desc: "Polished & expert" },
  { id: "casual", label: "Casual", desc: "Friendly & approachable" },
  { id: "educational", label: "Educational", desc: "Informative & clear" },
  { id: "storytelling", label: "Storytelling", desc: "Narrative & engaging" },
];

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [niche, setNiche] = useState("");
  const [platform, setPlatform] = useState("");
  const [goal, setGoal] = useState("");
  const [tone, setTone] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUserId(session.user.id);

      // Check if already onboarded
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profile?.onboarding_completed) {
        navigate("/dashboard");
      }
    };

    checkAuth();
  }, [navigate]);

  const handleComplete = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          niche,
          primary_platform: platform,
          long_term_goal: goal,
          tone,
          onboarding_completed: true,
        })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Welcome to ContentForge!",
        description: "Your profile is set up. Let's create amazing content.",
      });

      navigate("/dashboard");
    } catch {
      toast({
        title: "Error saving profile",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return niche.trim().length > 0;
      case 2:
        return platform !== "";
      case 3:
        return goal !== "";
      case 4:
        return tone !== "";
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 w-80 h-80 bg-primary/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative z-10">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                s === step
                  ? "w-12 bg-primary"
                  : s < step
                  ? "w-8 bg-primary/50"
                  : "w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">
            {step === 1 && "What's your niche?"}
            {step === 2 && "Where do you create?"}
            {step === 3 && "What's your goal?"}
            {step === 4 && "What's your style?"}
          </h1>
          <p className="text-muted-foreground">
            {step === 1 && "Help us understand your content focus"}
            {step === 2 && "Choose your primary platform"}
            {step === 3 && "What do you want to achieve?"}
            {step === 4 && "How do you communicate with your audience?"}
          </p>
        </div>

        {/* Content */}
        <div className="glass-card rounded-2xl p-8 glow-border animate-slide-up">
          {step === 1 && (
            <div className="space-y-4">
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g., Personal Finance, Fitness, Tech Reviews..."
                className="w-full h-14 px-5 rounded-xl bg-secondary/50 border border-border/50 text-lg placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
              />
              <p className="text-sm text-muted-foreground">
                Be specific! "Personal finance for millennials" is better than just "finance"
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`p-4 rounded-xl border transition-all duration-200 text-left ${
                    platform === p.id
                      ? "border-primary bg-primary/10 glow-border"
                      : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <span className="text-2xl mb-2 block">{p.icon}</span>
                  <span className="font-medium">{p.label}</span>
                  {platform === p.id && (
                    <Check className="w-4 h-4 text-primary mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {goals.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGoal(g.id)}
                  className={`p-5 rounded-xl border transition-all duration-200 text-left ${
                    goal === g.id
                      ? "border-primary bg-primary/10 glow-border"
                      : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <span className="font-semibold block mb-1">{g.label}</span>
                  <span className="text-sm text-muted-foreground">{g.desc}</span>
                  {goal === g.id && (
                    <Check className="w-4 h-4 text-primary mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tones.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`p-5 rounded-xl border transition-all duration-200 text-left ${
                    tone === t.id
                      ? "border-primary bg-primary/10 glow-border"
                      : "border-border/50 bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <span className="font-semibold block mb-1">{t.label}</span>
                  <span className="text-sm text-muted-foreground">{t.desc}</span>
                  {tone === t.id && (
                    <Check className="w-4 h-4 text-primary mt-2" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border/30">
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              disabled={step === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={!canProceed() || loading}
                className="gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Setting up...
                  </span>
                ) : (
                  <>
                    Get Started
                    <Sparkles className="w-4 h-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
