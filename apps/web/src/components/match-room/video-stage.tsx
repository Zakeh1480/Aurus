'use client';

import * as React from 'react';
import type { LocalVideoTrack, RemoteTrack } from 'livekit-client';

type AttachableTrack = Pick<LocalVideoTrack | RemoteTrack, 'attach' | 'detach'>;

function useAttachedTrack(
  track: AttachableTrack | null,
  videoRef: React.RefObject<HTMLVideoElement | null>,
): void {
  React.useEffect(() => {
    const element = videoRef.current;
    if (!track || !element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track, videoRef]);
}

type TileProps = {
  label: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  muted: boolean;
  placeholderMessage?: string;
};

function Tile({ label, videoRef, muted, placeholderMessage }: TileProps) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
      <video ref={videoRef} autoPlay playsInline muted={muted} className="size-full object-cover" />
      {placeholderMessage && (
        <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground">
          {placeholderMessage}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-background/70 px-2 py-0.5 text-xs font-medium">
        {label}
      </span>
    </div>
  );
}

type VideoStageProps = {
  localVideoTrack: LocalVideoTrack | null;
  remoteVideoTrack: RemoteTrack | null;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
};

export function VideoStage({ localVideoTrack, remoteVideoTrack, localVideoRef }: VideoStageProps) {
  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  useAttachedTrack(localVideoTrack, localVideoRef);
  useAttachedTrack(remoteVideoTrack, remoteVideoRef);

  return (
    <div className="grid grid-cols-2 gap-3">
      <Tile label="Você" videoRef={localVideoRef} muted />
      <Tile
        label="Adversário"
        videoRef={remoteVideoRef}
        muted={false}
        placeholderMessage={remoteVideoTrack ? undefined : 'Aguardando vídeo do adversário…'}
      />
    </div>
  );
}
