import { Injectable } from '@nestjs/common';
import { LIVE_AWAY_MS, type PresenceDTO } from '../shared';

const FORGET_AFTER_MS = LIVE_AWAY_MS * 6;

@Injectable()
export class PresenceStore {
  private readonly sheets = new Map<string, Map<string, PresenceDTO>>();

  update(submissionId: string, presence: PresenceDTO) {
    const sheet = this.sheets.get(submissionId) ?? new Map<string, PresenceDTO>();
    sheet.set(presence.userId, presence);
    this.sheets.set(submissionId, sheet);
  }

  others(submissionId: string, userId: string, now: number): PresenceDTO[] {
    const sheet = this.sheets.get(submissionId);
    if (!sheet) return [];
    for (const [id, p] of sheet) if (now - Date.parse(p.seenAt) > FORGET_AFTER_MS) sheet.delete(id);
    if (sheet.size === 0) this.sheets.delete(submissionId);
    return [...sheet.values()].filter((p) => p.userId !== userId);
  }

  leave(submissionId: string, userId: string) {
    this.sheets.get(submissionId)?.delete(userId);
  }
}
