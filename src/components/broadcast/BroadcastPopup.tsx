import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { BroadcastMessage } from "@/lib/types/broadcast";
import { broadcastService } from "@/services/broadcastService";
import { useAzureADAuth } from "@/contexts/AzureADAuthContext";
import { getLinkSegments } from "@/utils/linkify";

interface BroadcastPopupProps {
  isOpen: boolean;
  onClose: () => void;
  message: BroadcastMessage;
}

function BroadcastPopupContent({ message, onClose }: Omit<BroadcastPopupProps, "isOpen">) {
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Check date scheduling only (global message, no targeting)
  const isWithinSchedule = () => {
    const now = new Date();
    
    if (message.startDate) {
      const start = new Date(message.startDate);
      if (now < start) return false;
    }

    if (message.endDate) {
      const end = new Date(message.endDate);
      if (now > end) return false;
    }

    return true;
  };

  // Always show if within schedule (global popup)
  if (!isWithinSchedule()) {
    return null;
  }

  const handleClose = () => {
    broadcastService.markAsSeen(message.id);
    onClose();
  };

  const getVideoEmbedUrl = () => {
    if (!message.videoUrl) return null;

    // Check if it's a YouTube URL
    const youtubeId = broadcastService.extractYouTubeId(message.videoUrl);
    if (youtubeId) {
      // Add parameters for better compatibility and security
      const params = new URLSearchParams({
        enablejsapi: '1',
        origin: window.location.origin,
        rel: '0', // Don't show related videos from other channels
        modestbranding: '1', // Reduce YouTube branding
        playsinline: '1', // Play inline on mobile
      });
      return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
    }

    // Check if it's a Vimeo URL
    const vimeoId = broadcastService.extractVimeoId(message.videoUrl);
    if (vimeoId) {
      return `https://player.vimeo.com/video/${vimeoId}`;
    }

    // If it's already an embed URL, return as is
    if (message.videoUrl.includes("embed") || message.videoUrl.includes("youtube.com/embed") || message.videoUrl.includes("vimeo.com/video")) {
      return message.videoUrl;
    }

    return null;
  };

  const embedUrl = getVideoEmbedUrl();

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-lg p-0">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative"
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-primary" />
              {message.title}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            {/* Image */}
            {message.imageUrl && !imageError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="rounded-lg overflow-hidden border"
              >
                <img
                  src={message.imageUrl}
                  alt={message.title}
                  className="w-full h-auto object-contain max-h-96"
                  onError={() => setImageError(true)}
                />
              </motion.div>
            )}

            {/* Video */}
            {embedUrl && !videoError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="rounded-lg overflow-hidden border aspect-video"
              >
                <iframe
                  src={embedUrl}
                  title={message.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  onError={() => setVideoError(true)}
                  onLoad={() => {
                    // YouTube iframe loaded successfully
                    console.log('[BroadcastPopup] YouTube iframe loaded successfully');
                  }}
                />
              </motion.div>
            )}

            {/* Fallback for invalid video URL */}
            {message.videoUrl && !embedUrl && !videoError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-lg border p-4 bg-muted"
              >
                <p className="text-sm text-muted-foreground mb-2">
                  Invalid video URL. Please provide a valid YouTube or Vimeo link.
                </p>
                <a
                  href={message.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Open video link
                </a>
              </motion.div>
            )}

            {/* Message Text with Auto-Detected Links */}
            <DialogDescription asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-base leading-relaxed whitespace-pre-wrap text-foreground"
              >
                {getLinkSegments(message.message).map((segment, index) => {
                  if (segment.isLink && segment.url && segment.url !== '#') {
                    return (
                      <a
                        key={index}
                        href={segment.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-primary hover:underline break-all"
                        onClick={(e) => {
                          // Additional client-side validation on click
                          if (segment.url === '#' || !segment.url.startsWith('http') && !segment.url.startsWith('mailto:')) {
                            e.preventDefault();
                            console.warn('[BroadcastPopup] Blocked potentially unsafe URL:', segment.text);
                            return false;
                          }
                        }}
                      >
                        {segment.text}
                      </a>
                    );
                  }
                  // Render as plain text (React automatically escapes strings for XSS protection)
                  return <span key={index}>{segment.text}</span>;
                })}
              </motion.div>
            </DialogDescription>
          </div>

          <div className="px-6 py-4 border-t flex justify-end gap-2">
            <Button onClick={handleClose} className="min-w-[100px]">
              Got it
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export function BroadcastPopup() {
  const { user, isAuthenticated } = useAzureADAuth();
  const [activeMessage, setActiveMessage] = useState<BroadcastMessage | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    const fetchActiveMessage = async () => {
      try {
        setIsLoading(true);
        const message = await broadcastService.getActiveMessage();

        if (message) {
          // Check if user has already seen this message
          const hasSeen = broadcastService.hasBeenSeen(message.id);

          if (!hasSeen) {
            setActiveMessage(message);
            setIsOpen(true);
          }
        }
      } catch (error) {
        console.error("[BroadcastPopup] Error fetching active message:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Small delay to ensure user context is fully loaded
    const timer = setTimeout(fetchActiveMessage, 500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  const handleClose = () => {
    if (activeMessage) {
      broadcastService.markAsSeen(activeMessage.id);
    }
    setIsOpen(false);
  };

  if (isLoading || !activeMessage) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <BroadcastPopupContent
          isOpen={isOpen}
          onClose={handleClose}
          message={activeMessage}
        />
      )}
    </AnimatePresence>
  );
}

