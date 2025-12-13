import React from 'react';
import { Copy, Check, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface PlatformContent {
  platform: string;
  caption: string;
  thumbnailConcept: string;
}

interface PlatformOutputsProps {
  content: PlatformContent[];
  onContentChange: (content: PlatformContent[]) => void;
}

const PLATFORM_CONFIG: Record<string, { icon: string; name: string; color: string }> = {
  linkedin: { icon: '💼', name: 'LinkedIn', color: 'bg-blue-500/10 border-blue-500/30' },
  instagram: { icon: '📸', name: 'Instagram', color: 'bg-pink-500/10 border-pink-500/30' },
  twitter: { icon: '🐦', name: 'Twitter/X', color: 'bg-sky-500/10 border-sky-500/30' },
  youtube: { icon: '🎬', name: 'YouTube', color: 'bg-red-500/10 border-red-500/30' },
  tiktok: { icon: '🎵', name: 'TikTok', color: 'bg-fuchsia-500/10 border-fuchsia-500/30' },
  facebook: { icon: '👥', name: 'Facebook', color: 'bg-indigo-500/10 border-indigo-500/30' },
  threads: { icon: '🧵', name: 'Threads', color: 'bg-slate-500/10 border-slate-500/30' },
  medium: { icon: '📝', name: 'Medium', color: 'bg-emerald-500/10 border-emerald-500/30' },
};

const PlatformOutputs: React.FC<PlatformOutputsProps> = ({ content, onContentChange }) => {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  const handleCopy = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast({ title: "Copied to clipboard!" });
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleCaptionChange = (index: number, newCaption: string) => {
    const updated = [...content];
    updated[index] = { ...updated[index], caption: newCaption };
    onContentChange(updated);
  };

  const getPlatformConfig = (platformId: string) => {
    const lower = platformId.toLowerCase();
    return PLATFORM_CONFIG[lower] || { 
      icon: '🌐', 
      name: platformId.charAt(0).toUpperCase() + platformId.slice(1),
      color: 'bg-primary/10 border-primary/30'
    };
  };

  // Determine grid layout based on number of platforms
  const getGridClass = () => {
    switch (content.length) {
      case 1:
        return 'grid-cols-1 max-w-2xl mx-auto';
      case 2:
        return 'grid-cols-1 md:grid-cols-2';
      case 3:
        return 'grid-cols-1 md:grid-cols-3';
      default:
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
    }
  };

  return (
    <div className={`grid ${getGridClass()} gap-6`}>
      {content.map((item, index) => {
        const config = getPlatformConfig(item.platform);
        
        return (
          <div
            key={`${item.platform}-${index}`}
            className={`rounded-2xl border ${config.color} overflow-hidden animate-slide-up`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Platform Header */}
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{config.icon}</span>
                <span className="font-semibold">{config.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(item.caption, index)}
                className="gap-2"
              >
                {copiedIndex === index ? (
                  <>
                    <Check className="w-4 h-4 text-primary" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>

            {/* Caption */}
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                  Caption
                </label>
                <Textarea
                  value={item.caption}
                  onChange={(e) => handleCaptionChange(index, e.target.value)}
                  className="min-h-[180px] bg-background/50 border-border/50 resize-none"
                  placeholder="Your caption..."
                />
              </div>

              {/* Thumbnail Concept */}
              {item.thumbnailConcept && (
                <div className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Thumbnail Idea
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80">
                    {item.thumbnailConcept}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlatformOutputs;
