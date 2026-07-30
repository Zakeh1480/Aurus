import { Test } from "@nestjs/testing";
import { AURA_SCORE_VERSION } from "@aurafarming/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

describe("AppController", () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = moduleRef.get(AppController);
  });

  describe("GET /health", () => {
    it("retorna status ok com a versão do Aura Score (import de shared)", () => {
      expect(appController.getHealth()).toEqual({
        status: "ok",
        auraScoreVersion: AURA_SCORE_VERSION,
      });
    });
  });
});
