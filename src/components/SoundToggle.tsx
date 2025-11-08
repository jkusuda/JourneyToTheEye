import { useState, useRef, useEffect } from 'react';

export default function SoundToggle() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Load the audio file
    audioRef.current = new Audio('space.mp3');
    audioRef.current.volume = 0.4;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const toggleSound = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.warn('Autoplay blocked:', err));
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div 
      className="sound-toggle"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSound();
        }}
        className="text-3xl select-none cursor-pointer transition-transform hover:scale-110"
        title={isPlaying ? 'Turn sound off' : 'Turn sound on'}
      >
        {isPlaying ? '🔊' : '🔇'}
      </button>
    </div>
  );
}
