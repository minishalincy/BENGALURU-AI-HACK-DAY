import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

const SUGGESTED_PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'twitter', name: 'Twitter/X' },
  { id: 'youtube', name: 'YouTube' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'threads', name: 'Threads' },
  { id: 'medium', name: 'Medium' },
];

interface PlatformSelectorProps {
  selectedPlatforms: string[];
  onSelectionChange: (platforms: string[]) => void;
}

const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  selectedPlatforms,
  onSelectionChange
}) => {
  const [customPlatforms, setCustomPlatforms] = useState<string[]>([]);

  const togglePlatform = (platformId: string) => {
    if (selectedPlatforms.includes(platformId)) {
      onSelectionChange(selectedPlatforms.filter(p => p !== platformId));
    } else {
      onSelectionChange([...selectedPlatforms, platformId]);
    }
  };

  const removeCustomPlatform = (platform: string) => {
    setCustomPlatforms(customPlatforms.filter(p => p !== platform));
    onSelectionChange(selectedPlatforms.filter(p => p !== platform.toLowerCase()));
  };

  return (
    <div className="space-y-6">
      {/* Suggested Platforms Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SUGGESTED_PLATFORMS.map((platform) => {
          const isSelected = selectedPlatforms.includes(platform.id);
          return (
            <button
              key={platform.id}
              onClick={() => togglePlatform(platform.id)}
              className={`relative p-4 rounded-xl border transition-all duration-200 text-left group ${
                isSelected
                  ? 'border-primary bg-primary/10 glow-border'
                  : 'border-border/50 bg-card/50 hover:bg-card hover:border-border'
              }`}
            >
              <div className="font-medium text-sm">{platform.name}</div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Platforms */}
      {customPlatforms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customPlatforms.map((platform) => (
            <div
              key={platform}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30"
            >
              <span className="text-sm font-medium">{platform}</span>
              <button
                onClick={() => removeCustomPlatform(platform)}
                className="w-4 h-4 rounded-full hover:bg-destructive/20 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Selection Summary */}
      {selectedPlatforms.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          {selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};

export default PlatformSelector;
