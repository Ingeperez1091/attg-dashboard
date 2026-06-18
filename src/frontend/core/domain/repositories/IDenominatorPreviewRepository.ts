export type DenominatorOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'NOT_CONTAINS'
  | 'IN_LIST'
  | 'NOT_IN_LIST'
  | 'GREATER_THAN'
  | 'GREATER_OR_EQUAL'
  | 'LESS_THAN'
  | 'LESS_OR_EQUAL';

export interface DenominatorPreviewRuleInput {
  denominatorModelId: string;
  operator: DenominatorOperator;
  value: string;
}

export interface DenominatorPreviewRule {
  previewId: string;
  sessionId: string;
  applicationId: string;
  denominatorModelId: string;
  operator: DenominatorOperator;
  value: string;
  ruleOrder: number;
  createDate: string;
  expiresAt: string;
}

export interface IDenominatorPreviewRepository {
  stageRules(
    sessionId: string,
    applicationId: string,
    rules: DenominatorPreviewRuleInput[]
  ): Promise<void>;

  deleteBySessionId(sessionId: string): Promise<void>;
}
