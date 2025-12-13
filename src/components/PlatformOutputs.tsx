import React, { useState } from 'react';
import { Copy, Check, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface PlatformContent {
  platform: string;
  caption: string;
  thumbnailUrl?: string;
  thumbnailConcept?: string;
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);

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

  const handleDownloadThumbnail = async (thumbnailUrl: string, platform: string, index: number) => {
    try {
      setDownloadingIndex(index);
      const response = await fetch(thumbnailUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${platform}-thumbnail.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Thumbnail downloaded!" });
    } catch (error) {
      toast({ title: "Download failed", variant: "destructive" });
    } finally {
      setDownloadingIndex(null);
    }
  };

  const getPlatformConfig = (platformId: string) => {
    const lower = platformId.toLowerCase();
    return PLATFORM_CONFIG[lower] || { 
      icon: '🌐', 
      name: platformId.charAt(0).toUpperCase() + platformId.slice(1),
      color: 'bg-primary/10 border-primary/30'
    };
  };

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

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* AI Generated Thumbnail */}
              {item.thumbnailUrl && (
                <div className="space-y-2">
                  <div className="relative group">
                    <img
                      src={item.thumbnailUrl}
                      alt={`${item.platform} thumbnail`}
                      className="w-full aspect-video rounded-lg object-cover border border-border/30"
                    />
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDownloadThumbnail(item.thumbnailUrl!, item.platform, index)}
                        disabled={downloadingIndex === index}
                        className="gap-2"
                      >
                        {downloadingIndex === index ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        Download
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Caption */}
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
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PlatformOutputs;
