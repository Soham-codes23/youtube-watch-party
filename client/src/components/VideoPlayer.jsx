import React, { useRef, useEffect } from 'react';
import YouTube from 'react-youtube';

const VideoPlayer = ({ videoId, isPlaying, timestamp, isHost, onStateChange }) => {
  const playerRef = useRef(null);

  // Sync player when props change (from socket)
  useEffect(() => {
    if (!playerRef.current) return;
    const player = playerRef.current;

    // Only non-hosts (or hosts receiving sync from server) should auto-sync to state
    // But realistically we want everyone to be in sync.
    // If it's a small difference, don't seek to avoid stuttering.
    const syncVideo = async () => {
      try {
        const state = await player.getPlayerState();
        const currentTime = await player.getCurrentTime();
        
        // Handle Seek
        if (Math.abs(currentTime - timestamp) > 2) {
          player.seekTo(timestamp, true);
        }

        // Handle Play/Pause
        if (isPlaying && state !== YouTube.PlayerState.PLAYING && state !== YouTube.PlayerState.BUFFERING) {
          player.playVideo();
        } else if (!isPlaying && state === YouTube.PlayerState.PLAYING) {
          player.pauseVideo();
        }
      } catch (err) {
        console.error("Error syncing player:", err);
      }
    };

    syncVideo();
  }, [isPlaying, timestamp, videoId]);

  const handleReady = (e) => {
    playerRef.current = e.target;
    // initial state sync
    if (isPlaying) {
      e.target.playVideo();
    } else {
      e.target.pauseVideo();
    }
    e.target.seekTo(timestamp, true);
  };

  const handleStateChange = async (e) => {
    if (!isHost) return; // Only host/admin should emit state changes
    
    const state = e.data;
    const currentTime = await e.target.getCurrentTime();

    if (state === YouTube.PlayerState.PLAYING) {
      onStateChange({ isPlaying: true, timestamp: currentTime });
    } else if (state === YouTube.PlayerState.PAUSED) {
      onStateChange({ isPlaying: false, timestamp: currentTime });
    }
  };

  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: isHost ? 1 : 0, // Hide controls for non-hosts
      disablekb: isHost ? 0 : 1, // Disable keyboard for non-hosts
      modestbranding: 1,
      rel: 0,
    },
  };

  if (!videoId) {
    return (
      <div className="player-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Waiting for host to select a video...</p>
      </div>
    );
  }

  return (
    <div className="player-wrapper">
      <YouTube
        videoId={videoId}
        opts={opts}
        onReady={handleReady}
        onStateChange={handleStateChange}
        className="youtube-player"
        iframeClassName="youtube-iframe"
      />
    </div>
  );
};

export default VideoPlayer;
