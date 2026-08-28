export const supportedIssueCategories = [
  'grammar.conditional.si_clause',
  'grammar.subjunctive',
  'grammar.tense_aspect',
  'grammar.agreement',
  'lexicon.precision',
  'discourse.cohesion',
  'pragmatics.register',
] as const;

export const supportedReferenceIds = [
  'conditional.present_hypothetical',
  'conditional.real_present_future',
  'conditional.past_counterfactual',
] as const;

export type IssueCategory = (typeof supportedIssueCategories)[number];
export type ReferenceId = (typeof supportedReferenceIds)[number];
