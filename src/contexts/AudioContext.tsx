import { createContext, useContext, useState, useRef, ReactNode, useEffect } from "react";
import { MusicFile } from "@/services/MusicService";
import { MusicService } from "@/services/MusicService";

interface AudioContextType {
  isPlaying: boolean;
  volume: number;
  togglePlay: () => void;
  setVolume: (volume: number) => void;
  audioRef: React.RefObject<HTMLAudioElement>;
  playTrack: (file: MusicFile) => Promise<void>;
  currentTrack: MusicFile | null;
  playlist: MusicFile[];
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  setPlaylist: (files: MusicFile[]) => void;
  loadPlaylist: () => Promise<void>;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTrack, setCurrentTrack] = useState<MusicFile | null>(null);
  const [playlist, setPlaylist] = useState<MusicFile[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicService = MusicService.getInstance();

  // Load playlist on mount
  useEffect(() => {
    loadPlaylist();
  }, []);

  const loadPlaylist = async () => {
    try {
      const files = await musicService.getAllMusic();
      setPlaylist(files);
    } catch (error) {
      console.error("Failed to load playlist:", error);
    }
  };

  const playTrack = async (file: MusicFile) => {
    if (audioRef.current) {
      audioRef.current.src = file.url;
      await audioRef.current.play();
      setIsPlaying(true);
      setCurrentTrack(file);
    }
  };

  const nextTrack = async () => {
    if (playlist.length === 0) {
      await loadPlaylist();
      if (playlist.length === 0) return;
    }
    
    let nextIndex = 0;
    if (currentTrack) {
      const currentIndex = playlist.findIndex(track => track.id === currentTrack.id);
      nextIndex = (currentIndex + 1) % playlist.length;
    }
    
    const nextFile = playlist[nextIndex];
    if (audioRef.current) {
      audioRef.current.src = nextFile.url;
      await audioRef.current.play();
      setIsPlaying(true);
      setCurrentTrack(nextFile);
    }
  };

  const previousTrack = async () => {
    if (playlist.length === 0) {
      await loadPlaylist();
      if (playlist.length === 0) return;
    }
    
    let prevIndex = playlist.length - 1;
    if (currentTrack) {
      const currentIndex = playlist.findIndex(track => track.id === currentTrack.id);
      prevIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    }
    
    const prevFile = playlist[prevIndex];
    if (audioRef.current) {
      audioRef.current.src = prevFile.url;
      await audioRef.current.play();
      setIsPlaying(true);
      setCurrentTrack(prevFile);
    }
  };

  const togglePlay = async () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (!currentTrack && playlist.length > 0) {
          // If no track is playing but we have a playlist, start with the first track
          await playTrack(playlist[0]);
        } else if (currentTrack) {
          await audioRef.current.play();
          setIsPlaying(true);
        } else {
          // If no track and no playlist, try to load playlist and play first track
          await loadPlaylist();
          if (playlist.length > 0) {
            await playTrack(playlist[0]);
          }
        }
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  return (
    <AudioContext.Provider
      value={{
        isPlaying,
        volume,
        togglePlay,
        setVolume: handleVolumeChange,
        audioRef,
        playTrack,
        currentTrack,
        playlist,
        nextTrack,
        previousTrack,
        setPlaylist,
        loadPlaylist,
      }}
    >
      {children}
      <audio
        ref={audioRef}
        onEnded={() => {
          setIsPlaying(false);
          nextTrack();
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
} 