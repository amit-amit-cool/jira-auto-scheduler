export interface JiraField {
  id: string;
  name: string;
  key: string;
  custom: boolean;
  schema?: { type: string; custom?: string };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  avatarUrls?: Record<string, string>;
}

export interface JiraEpic {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    assignee?: { displayName: string; emailAddress: string } | null;
    priority?: { name: string } | null;
    [customFieldId: string]: unknown;
  };
}

export interface JiraRoleActor {
  id: number;
  displayName: string;
  type: string;
  avatarUrl?: string;
  actorUser?: { accountId: string };
}

export interface JiraRole {
  id: number;
  name: string;
  actors: JiraRoleActor[];
}

export interface JiraSearchResponse {
  issues: JiraEpic[];
  isLast: boolean;
  nextPageToken?: string;
}

export interface JiraFieldsResponse {
  fields: JiraField[];
  storyPointsFieldId: string | null;
  timeSpentFieldId: string | null;
}
