import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, ArrowLeft, Image, FileText, Calendar, 
  Copy, Download, ExternalLink, Sparkles, User, LogOut,
  Clock, Layers, MessageSquare, Presentation, Target
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BeamsBackground } from "@/components/ui/beams-background";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PlatformContent {
  platform: string;
  caption: string;
  thumbnailUrl?: string;
}

interface RecommendedPlatform {
  platform: string;
  reason: string;
  score: number;
}

interface Creation {
  id: string;
  created_at: string;
  transcription: string | null;
  platforms: string[];
  generated_content: PlatformContent[];
  additional_context: string | null;
  duration_seconds: number | null;
  creation_mode: string | null;
  key_takeaways: string[] | null;
  recommended_platforms: RecommendedPlatform[] | null;
}

const MyCreations = () => {
  const [creations, setCreations] = useState<Creation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCreation, setSelectedCreation] = useState<Creation | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    fetchCreations();
    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchCreations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("event_recordings")
        .select("id, created_at, transcription, platforms, generated_content, additional_context, duration_seconds, creation_mode, key_takeaways, recommended_platforms")
        .eq("user_id", session.user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform and filter data
      const validCreations = (data || [])
        .filter(item => item.generated_content && Array.isArray(item.generated_content) && (item.generated_content as unknown[]).length > 0)
        .map(item => ({
          ...item,
          platforms: item.platforms || [],
          generated_content: item.generated_content as unknown as PlatformContent[],
          key_takeaways: item.key_takeaways as unknown as string[] | null,
          recommended_platforms: item.recommended_platforms as unknown as RecommendedPlatform[] | null
        }));

      setCreations(validCreations);
    } catch (error) {
      console.error("Error fetching creations:", error);
      toast({
        title: "Error loading creations",
        description: "Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const copyToClipboard = (text: string, platform: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${platform} caption copied to clipboard.`
    });
  };

  const copyTakeaways = (takeaways: string[]) => {
    navigator.clipboard.writeText(takeaways.join('\n• '));
    toast({
      title: "Copied!",
      description: "Key takeaways copied to clipboard."
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFirstThumbnail = (content: PlatformContent[]) => {
    return content.find(c => c.thumbnailUrl)?.thumbnailUrl;
  };

  const getPreviewCaption = (content: PlatformContent[]) => {
    const first = content[0];
    if (!first) return "";
    return first.caption.length > 100 ? first.caption.slice(0, 100) + "..." : first.caption;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <BeamsBackground intensity="medium" className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-lg">My Creations</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-border">
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        {creations.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No creations yet</h2>
            <p className="text-muted-foreground mb-6">
              Start recording to create your first content
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Creator Studio
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">
                {creations.length} creation{creations.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Creations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {creations.map((creation) => (
                <div
                  key={creation.id}
                  onClick={() => setSelectedCreation(creation)}
                  className="group cursor-pointer rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-muted/50 relative overflow-hidden">
                    {getFirstThumbnail(creation.generated_content) ? (
                      <img 
                        src={getFirstThumbnail(creation.generated_content)} 
                        alt="Creation thumbnail"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-12 h-12 text-muted-foreground/30" />
                      </div>
                    )}
                    
                    {/* Mode badge */}
                    {creation.creation_mode && (
                      <div className="absolute top-2 right-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full backdrop-blur-sm ${
                          creation.creation_mode === 'speaker'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-primary/20 text-primary'
                        }`}>
                          {creation.creation_mode === 'speaker' ? 'Speaker' : 'Creator'}
                        </span>
                      </div>
                    )}
                    
                    {/* Platform badges */}
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      {creation.platforms.slice(0, 3).map((platform) => (
                        <span 
                          key={platform}
                          className="text-xs px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm"
                        >
                          {platform}
                        </span>
                      ))}
                      {creation.platforms.length > 3 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-sm">
                          +{creation.platforms.length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <p className="text-sm line-clamp-2">
                      {getPreviewCaption(creation.generated_content)}
                    </p>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(creation.created_at)}
                      </span>
                      {creation.duration_seconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(creation.duration_seconds)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCreation} onOpenChange={() => setSelectedCreation(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-background border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Creation Details
              {selectedCreation?.creation_mode && (
                <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${
                  selectedCreation.creation_mode === 'speaker'
                    ? 'bg-blue-500/10 text-blue-500'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {selectedCreation.creation_mode === 'speaker' ? 'Speaker Mode' : 'Creator Mode'}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCreation && (
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-6">
                {/* Meta info */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(selectedCreation.created_at)}
                  </span>
                  {selectedCreation.duration_seconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {formatDuration(selectedCreation.duration_seconds)} recording
                    </span>
                  )}
                </div>

                {/* Key Takeaways */}
                {selectedCreation.key_takeaways && selectedCreation.key_takeaways.length > 0 && (
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <h4 className="font-medium">Key Takeaways</h4>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => copyTakeaways(selectedCreation.key_takeaways!)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <ul className="space-y-2">
                      {selectedCreation.key_takeaways.map((takeaway, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-sm">{takeaway}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Platforms */}
                {selectedCreation.recommended_platforms && selectedCreation.recommended_platforms.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      <h4 className="text-sm font-medium text-muted-foreground">AI Platform Recommendations</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCreation.recommended_platforms.map((rec, idx) => (
                        <div 
                          key={idx}
                          className="px-3 py-2 rounded-lg bg-muted/30 border border-border/50"
                        >
                          <span className="font-medium text-sm">{rec.platform}</span>
                          <p className="text-xs text-muted-foreground">{rec.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Original transcript */}
                {selectedCreation.transcription && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Original Transcript</h4>
                    <p className="text-sm p-4 rounded-xl bg-muted/30 border border-border/50">
                      {selectedCreation.transcription}
                    </p>
                  </div>
                )}

                {/* Platform outputs */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Generated Content</h4>
                  
                  {selectedCreation.generated_content.map((content, index) => (
                    <div 
                      key={index}
                      className="rounded-xl border border-border/50 bg-card/50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                        <span className="font-medium">{content.platform}</span>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(content.caption, content.platform)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                      </div>
                      
                      <div className="p-4 space-y-4">
                        {content.thumbnailUrl && (
                          <div className="space-y-2">
                            <img 
                              src={content.thumbnailUrl} 
                              alt={`${content.platform} thumbnail`}
                              className="w-full max-w-md rounded-lg border border-border/50"
                            />
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(content.thumbnailUrl, '_blank')}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Download Thumbnail
                            </Button>
                          </div>
                        )}
                        
                        <div className="space-y-2">
                          <p className="text-sm whitespace-pre-wrap">{content.caption}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </BeamsBackground>
  );
};

export default MyCreations;
