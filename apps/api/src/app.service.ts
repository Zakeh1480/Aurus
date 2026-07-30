import { Injectable } from "@nestjs/common";
import { AURA_SCORE_VERSION } from "@aurafarming/shared";

export interface HealthStatus {
  status: "ok";
  auraScoreVersion: typeof AURA_SCORE_VERSION;
}

@Injectable()
export class AppService {
  getHealth(): HealthStatus {
    return { status: "ok", auraScoreVersion: AURA_SCORE_VERSION };
  }
}
