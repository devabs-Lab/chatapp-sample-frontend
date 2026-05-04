import { useEffect } from "react";

export function useVideoVisibilitys(playerRef) {
  useEffect(() => {
    let observer = null;
    let retryTimeout = null;

    const initObserver = () => {
      const player = playerRef.current?.plyr;
      const video = player?.media;

      if (!video) {
        retryTimeout = setTimeout(initObserver, 50);
        return;
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.intersectionRatio < 0.3) {
            player.pause();
            // video.currentTime = 0; // optional
          }
        },
        {
          threshold: 0,
        },
      );

      observer.observe(video);
    };

    initObserver();

    return () => {
      if (observer) observer.disconnect();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [playerRef]);
}
