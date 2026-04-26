/**
 * Content Phase Logic
 *
 * Core business logic for content phase voting and resolution.
 */

import { ContentPhaseState, ParticipantState } from "../state/types";
import { contentConfigLoader } from "../../config/content/ContentConfigLoader";

/**
 * Cast a vote for a subject
 * 🔥 CRITICAL: Validates against table's allowed subjects, not just global config
 */
export function castVote(
  contentPhase: ContentPhaseState,
  userId: string,
  subjectKey: string,
  tableId: string, // 🆕 Required for table-based validation
): void {
  const config = contentConfigLoader.getConfig(contentPhase.tableThemeKey);

  if (!config) {
    console.error(
      `[ContentPhase] Unknown theme: ${contentPhase.tableThemeKey}`,
    );
    return;
  }

  // 🆕 CRITICAL: Validate against TABLE_DEFINITIONS, not just config
  const { getTableDefinition } = require("../../ui-config/tableDefinitions");
  const tableDefinition = getTableDefinition(tableId);

  if (!tableDefinition || !tableDefinition.content) {
    console.error(`[ContentPhase] No table definition for: ${tableId}`);
    return;
  }

  // ❌ Reject votes for subjects not allowed by this table
  const subjectAllowedByTable = tableDefinition.content.subjects.some(
    (s: any) => s.key === subjectKey,
  );

  if (!subjectAllowedByTable) {
    console.error(
      `[ContentPhase] Subject "${subjectKey}" not allowed for table "${tableId}"`,
    );
    return;
  }

  contentPhase.votes.set(userId, subjectKey);
  console.log(`[ContentPhase] Vote cast: ${userId} → ${subjectKey}`);
}

/**
 * Remove a vote (used when user disconnects)
 */
export function removeVote(
  contentPhase: ContentPhaseState,
  userId: string,
): void {
  if (contentPhase.votes.has(userId)) {
    contentPhase.votes.delete(userId);
    console.log(`[ContentPhase] Vote removed for user: ${userId}`);
  }
}

/**
 * Check if all active users have voted
 */
export function allUsersVoted(
  contentPhase: ContentPhaseState,
  participants: Map<string, ParticipantState>,
): boolean {
  const activeUserIds = Array.from(participants.values())
    .filter((p) => p.presence === "CONNECTED")
    .map((p) => p.userId);

  if (activeUserIds.length === 0) return false;

  const votedUserIds = Array.from(contentPhase.votes.keys());

  console.log(
    `[ContentPhase] Vote check: ${votedUserIds.length}/${activeUserIds.length} users voted`,
  );
  console.log(`[ContentPhase] Active users: ${activeUserIds.join(", ")}`);
  console.log(`[ContentPhase] Voted users: ${votedUserIds.join(", ")}`);

  for (const userId of activeUserIds) {
    if (!contentPhase.votes.has(userId)) {
      console.log(`[ContentPhase] ❌ User ${userId} has not voted yet`);
      return false;
    }
  }

  console.log(`[ContentPhase] ✅ All users have voted!`);
  return true;
}

/**
 * Resolve votes and determine winning subject
 * Returns subjectKey or null if no votes
 */
export function resolveVotes(contentPhase: ContentPhaseState): string | null {
  const voteCounts = new Map<string, number>();

  // Count votes
  for (const subjectKey of contentPhase.votes.values()) {
    voteCounts.set(subjectKey, (voteCounts.get(subjectKey) || 0) + 1);
  }

  if (voteCounts.size === 0) return null;

  // Find max vote count
  let maxVotes = 0;
  for (const count of voteCounts.values()) {
    if (count > maxVotes) maxVotes = count;
  }

  // Find all subjects with max votes (for tie-breaking)
  const winners: string[] = [];
  for (const [subject, count] of voteCounts.entries()) {
    if (count === maxVotes) {
      winners.push(subject);
    }
  }

  // Random selection among winners (tie-break)
  const winner = winners[Math.floor(Math.random() * winners.length)];

  console.log(
    `[ContentPhase] Resolution: ${winner} won with ${maxVotes} votes ${winners.length > 1 ? "(tie-broken randomly)" : ""}`,
  );

  return winner;
}
