import type { StoryAtSchema } from './schema';
import type { StoryEvent } from './types';
import type { z } from 'zod';

/*
 * When in the day a story event appears (SPEC 3, `at`; SPEC 4, 4a and 5). Only
 * data decides: the code knows no figure and no text.
 */

export type Moment = z.infer<typeof StoryAtSchema>;

/** Moment of an event; without `at` the start of the day. */
export const momentOf = (e: StoryEvent): Moment => ('at' in e && e.at !== undefined ? e.at : 'start');

/** Order of the moments in a day: start, after an Akte, end. */
export const momentRank = (m: Moment): number => (m === 'start' ? 0 : m === 'end' ? 2 : 1);

/** Shown at the start of the day (day card, desk set up in the morning). */
export const atStart = (e: StoryEvent): boolean => momentOf(e) === 'start';

/** True if the Akte `akteId` on the desk is the one `at.case` names: the case itself or its follow-up. */
export const answersCase = (akteId: string, caseId: string): boolean => akteId === caseId || akteId === `${caseId}/folge`;

/** Events that appear at the desk at all (`event` cards are not shown in this version, `actSummary` never has `at`). */
export const isDeskEvent = (e: StoryEvent): boolean => e.type !== 'event' && e.type !== 'actSummary' && !atStart(e);
