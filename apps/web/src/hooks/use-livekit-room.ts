"use client";

import * as React from "react";
import { type LocalVideoTrack, type RemoteTrack, Room, RoomEvent, Track } from "livekit-client";

import { ApiError, matchesApi } from "@/lib/api-client";
import type { MatchRoomErrorKind } from "@/lib/match-room-reducer";

/** Os estados de erro são os mesmos MatchRoomErrorKind — não por coincidência: ambos alimentam o mesmo reducer via useMatchRoom. */
export type LivekitRoomStatus = "connecting" | "connected" | MatchRoomErrorKind;

export type UseLivekitRoomResult = {
  status: LivekitRoomStatus;
  localVideoTrack: LocalVideoTrack | null;
  remoteVideoTrack: RemoteTrack | null;
  remoteIdentity: string | null;
};

function mapTokenErrorToStatus(error: unknown): LivekitRoomStatus {
  if (error instanceof ApiError) {
    if (error.status === 404) return "not-found";
    if (error.status === 403) return "forbidden";
    if (error.status === 409) return "not-active";
  }
  return "connection-failed";
}

/** getUserMedia rejeita com DOMException nomeado assim quando o usuário nega/bloqueia a câmera. */
function isPermissionDeniedError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
}

/**
 * Conecta ao LiveKit da partida (roomName === matchId, identity === próprio
 * userId — apps/api/src/livekit/matches.controller.ts). Não existe
 * GET /matches/:id: a identidade do adversário vem do `identity` do
 * RemoteParticipant, que o servidor sempre carimba com o userId dele.
 */
export function useLivekitRoom(matchId: string): UseLivekitRoomResult {
  const [status, setStatus] = React.useState<LivekitRoomStatus>("connecting");
  const [localVideoTrack, setLocalVideoTrack] = React.useState<LocalVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = React.useState<RemoteTrack | null>(null);
  const [remoteIdentity, setRemoteIdentity] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const room = new Room();

    // Registrados ANTES de room.connect(): TrackSubscribed/ParticipantConnected
    // não disparam para quem já estava na sala no momento em que o listener é
    // anexado — se o adversário chegou primeiro (ex.: corrida ao pedir o
    // token, ou refresh no meio da partida), perderíamos o vídeo dele.
    room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(track);
        setRemoteIdentity(participant.identity);
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack((current) => (current === track ? null : current));
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      setRemoteIdentity((current) => (current === participant.identity ? null : current));
      setRemoteVideoTrack(null);
    });

    async function run(): Promise<void> {
      let token;
      try {
        token = await matchesApi.getLivekitToken(matchId);
      } catch (error) {
        if (!cancelled) setStatus(mapTokenErrorToStatus(error));
        return;
      }
      if (cancelled) return;

      try {
        await room.connect(token.url, token.token);

        // Reforço: cobre o caso (não esperado, já que os listeners acima
        // foram anexados antes do connect) de um participante já presente
        // no snapshot inicial da sala sem um TrackSubscribed correspondente.
        for (const participant of room.remoteParticipants.values()) {
          const publication = participant.getTrackPublication(Track.Source.Camera);
          if (publication?.track) {
            setRemoteVideoTrack(publication.track);
            setRemoteIdentity(participant.identity);
          }
        }

        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);

        if (cancelled) {
          await room.disconnect();
          return;
        }

        setLocalVideoTrack(room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack ?? null);
        setStatus("connected");
      } catch (error) {
        if (cancelled) return;
        setStatus(isPermissionDeniedError(error) ? "permission-denied" : "connection-failed");
      }
    }

    void run();

    return () => {
      cancelled = true;
      void room.disconnect();
    };
  }, [matchId]);

  return { status, localVideoTrack, remoteVideoTrack, remoteIdentity };
}
