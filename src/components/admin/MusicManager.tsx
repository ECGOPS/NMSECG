import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Music, Trash2, Play, Pause } from "lucide-react";
import { MusicService, MusicFile } from "@/services/MusicService";
import { useAudio } from "@/contexts/AudioContext";

export function MusicManager() {
  const [musicFiles, setMusicFiles] = useState<MusicFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const { playTrack, setPlaylist } = useAudio();
  const musicService = MusicService.getInstance();

  useEffect(() => {
    loadMusicFiles();
  }, []);

  const loadMusicFiles = async () => {
    try {
      const files = await musicService.getAllMusic();
      const filesWithState = files.map(file => ({ ...file, isPlaying: false }));
      setMusicFiles(filesWithState);
      setPlaylist(filesWithState);
    } catch (error) {
      console.error('Error loading music files:', error);
      toast({
        title: "Error",
        description: "Failed to load music files",
        variant: "destructive"
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await musicService.uploadMusic(file);
      }
      await loadMusicFiles();
      toast({
        title: "Success",
        description: "Music files uploaded successfully"
      });
    } catch (error) {
      console.error('Error uploading music:', error);
      toast({
        title: "Error",
        description: "Failed to upload music files",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await musicService.deleteMusic(id);
      setMusicFiles(prev => prev.filter(file => file.id !== id));
      toast({
        title: "Success",
        description: "Music file deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting music:', error);
      toast({
        title: "Error",
        description: "Failed to delete music file",
        variant: "destructive"
      });
    }
  };

  const handlePlay = async (file: MusicFile) => {
    try {
      // If this file is already playing, pause it
      if (file.isPlaying) {
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          await audioElement.pause();
        }
        setMusicFiles(prev => 
          prev.map(f => f.id === file.id ? { ...f, isPlaying: false } : f)
        );
        return;
      }

      // Pause any currently playing track
      setMusicFiles(prev => 
        prev.map(f => ({ ...f, isPlaying: false }))
      );

      // Play the selected track
      await playTrack(file);
      setMusicFiles(prev => 
        prev.map(f => f.id === file.id ? { ...f, isPlaying: true } : f)
      );
    } catch (error) {
      console.error('Error playing music:', error);
      toast({
        title: "Error",
        description: "Failed to play music file",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileUpload}
          disabled={isUploading}
          className="max-w-xs"
        />
        <Button
          onClick={() => (document.querySelector('input[type="file"]') as HTMLInputElement)?.click()}
          disabled={isUploading}
        >
          <Music className="mr-2 h-4 w-4" />
          {isUploading ? "Uploading..." : "Upload Music"}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {musicFiles.map((file) => (
            <TableRow key={file.id}>
              <TableCell>{file.name}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handlePlay(file)}
                  >
                    {file.isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 