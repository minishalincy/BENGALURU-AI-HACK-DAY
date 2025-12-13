import * as React from "react";

interface AILoaderProps {
  size?: number;
  text?: string;
}

export const AILoader: React.FC<AILoaderProps> = ({ 
  size = 180, 
  text = "Generating" 
}) => {
  const letters = text.split("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-primary/30 via-background to-background">
      <div
        className="relative flex items-center justify-center font-sans select-none"
        style={{ width: size, height: size }}
      >
        {/* Animated Letters */}
        {letters.map((letter, index) => (
          <span
            key={index}
            className="inline-block text-foreground opacity-40 text-xl font-medium animate-loader-letter"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </span>
        ))}

        {/* Rotating Circle */}
        <div className="absolute inset-0 rounded-full animate-loader-circle" />
      </div>
    </div>
  );
};

export default AILoader;
