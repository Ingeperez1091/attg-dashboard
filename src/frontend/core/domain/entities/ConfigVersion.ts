export type RuleScope = 'Denominator' | 'Numerator';

export interface ConfigVersion {
  applicationId: string;
  ruleScope: RuleScope;
  version: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

export interface ConfigVersionConflict {
  currentVersion: number;
  currentRules: unknown[];
  lastModifiedBy: string;
  lastModifiedAt: string;
}
