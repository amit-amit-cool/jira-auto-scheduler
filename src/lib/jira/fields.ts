import { JiraField } from '@/types/jira';

const STORY_POINTS_NAMES = [
  't-shirt size in story points',
  'story points',
  'story point estimate',
  'story point',
  'points',
  'sp',
];

const TIME_SPENT_NAMES = [
  'time spent total (days)',
  'time spent total',
  'time spent days',
  'time spent (days)',
  'days spent',
];

export interface DiscoveredFields {
  storyPointsFieldId: string | null;
  timeSpentFieldId: string | null;
}

export function discoverFieldIds(
  fields: JiraField[],
  overrides?: { storyPointsFieldId?: string; timeSpentFieldId?: string }
): DiscoveredFields {
  if (overrides?.storyPointsFieldId && overrides?.timeSpentFieldId) {
    return {
      storyPointsFieldId: overrides.storyPointsFieldId,
      timeSpentFieldId: overrides.timeSpentFieldId,
    };
  }

  const customFields = fields.filter((f) => f.custom);

  function findField(names: string[]): string | null {
    for (const name of names) {
      const match = customFields.find((f) =>
        f.name.toLowerCase().includes(name.toLowerCase())
      );
      if (match) return match.id;
    }
    return null;
  }

  return {
    storyPointsFieldId:
      overrides?.storyPointsFieldId ?? findField(STORY_POINTS_NAMES),
    timeSpentFieldId:
      overrides?.timeSpentFieldId ?? findField(TIME_SPENT_NAMES),
  };
}
