import { describe, expect, it } from 'vitest';

import { AntiCheatDecisionSchema } from '../src/enums/anti-cheat-decision.enum.js';
import { ConsentTypeSchema } from '../src/enums/consent-type.enum.js';
import { GestureLabelSchema } from '../src/enums/gesture-label.enum.js';
import { MatchSideSchema } from '../src/enums/match-side.enum.js';
import { MatchStatusSchema } from '../src/enums/match-status.enum.js';
import { ModerationActionTypeSchema } from '../src/enums/moderation-action-type.enum.js';
import { QueueStatusSchema } from '../src/enums/queue-status.enum.js';
import { ReportReasonSchema } from '../src/enums/report-reason.enum.js';
import { ReportSourceSchema } from '../src/enums/report-source.enum.js';
import { ReportStatusSchema } from '../src/enums/report-status.enum.js';
import { RoleSchema } from '../src/enums/role.enum.js';
import { SecurityEventTypeSchema } from '../src/enums/security-event-type.enum.js';
import { TrustLevelSchema } from '../src/enums/trust-level.enum.js';

describe('ConsentTypeSchema', () => {
  it.each(['camera', 'terms'])('aceita %s', (value) => {
    expect(ConsentTypeSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(ConsentTypeSchema.safeParse('microphone').success).toBe(false);
  });
});

describe('RoleSchema', () => {
  it.each(['user', 'moderator'])('aceita %s', (value) => {
    expect(RoleSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(RoleSchema.safeParse('admin').success).toBe(false);
  });
});

describe('ReportReasonSchema', () => {
  it.each(['cheating', 'harassment', 'inappropriate_camera_content', 'other'])(
    'aceita %s',
    (value) => {
      expect(ReportReasonSchema.safeParse(value).success).toBe(true);
    },
  );

  it('rejeita um valor fora do enum', () => {
    expect(ReportReasonSchema.safeParse('spam').success).toBe(false);
  });
});

describe('ReportStatusSchema', () => {
  it.each(['open', 'resolved'])('aceita %s', (value) => {
    expect(ReportStatusSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(ReportStatusSchema.safeParse('closed').success).toBe(false);
  });
});

describe('ModerationActionTypeSchema', () => {
  it.each(['dismissed', 'warned', 'banned'])('aceita %s', (value) => {
    expect(ModerationActionTypeSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(ModerationActionTypeSchema.safeParse('muted').success).toBe(false);
  });
});

describe('ReportSourceSchema', () => {
  it.each(['manual', 'anti_cheat'])('aceita %s', (value) => {
    expect(ReportSourceSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(ReportSourceSchema.safeParse('system').success).toBe(false);
  });
});

describe('MatchSideSchema', () => {
  it.each(['player1', 'player2'])('aceita %s', (value) => {
    expect(MatchSideSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(MatchSideSchema.safeParse('player3').success).toBe(false);
  });
});

describe('MatchStatusSchema', () => {
  it.each(['pending', 'active', 'completed', 'cancelled'])('aceita %s', (value) => {
    expect(MatchStatusSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(MatchStatusSchema.safeParse('archived').success).toBe(false);
  });
});

describe('QueueStatusSchema', () => {
  it.each(['idle', 'queued', 'matched'])('aceita %s', (value) => {
    expect(QueueStatusSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(QueueStatusSchema.safeParse('banned').success).toBe(false);
  });
});

describe('TrustLevelSchema', () => {
  it.each(['high', 'medium', 'low'])('aceita %s', (value) => {
    expect(TrustLevelSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(TrustLevelSchema.safeParse('critical').success).toBe(false);
  });
});

describe('AntiCheatDecisionSchema', () => {
  it.each(['valid', 'flagged', 'discarded'])('aceita %s', (value) => {
    expect(AntiCheatDecisionSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(AntiCheatDecisionSchema.safeParse('banned').success).toBe(false);
  });
});

describe('GestureLabelSchema', () => {
  it.each(['moggar', 'farmarAura', 'none'])('aceita %s', (value) => {
    expect(GestureLabelSchema.safeParse(value).success).toBe(true);
  });

  it('rejeita um valor fora do enum', () => {
    expect(GestureLabelSchema.safeParse('mogging').success).toBe(false);
  });
});

describe('SecurityEventTypeSchema', () => {
  it.each(['login_failed', 'refresh_token_reuse_detected', 'password_changed', 'email_changed'])(
    'aceita %s',
    (value) => {
      expect(SecurityEventTypeSchema.safeParse(value).success).toBe(true);
    },
  );

  it('rejeita um valor fora do enum', () => {
    expect(SecurityEventTypeSchema.safeParse('account_deleted').success).toBe(false);
  });
});
