import { z } from 'zod';
import {
  supportedIssueCategories,
  supportedReferenceIds,
} from '../../references/src/catalog.js';

const nonBlankText = (max: number) => z.string().trim().min(1).max(max);

export const correctionIssueSchema = z
  .object({
    category: z.enum(supportedIssueCategories),
    span: nonBlankText(200),
    replacement: nonBlankText(300),
    explanation: nonBlankText(1_000),
    confidence: z.number().min(0).max(1),
    referenceIds: z.array(z.enum(supportedReferenceIds)).max(5),
  })
  .strict();

export const correctionProposalSchema = z
  .object({
    correctedText: nonBlankText(5_000),
    issues: z.array(correctionIssueSchema).max(20),
    mexicanSpanishNotes: z.array(nonBlankText(500)).max(10),
    uncertainties: z.array(nonBlankText(500)).max(10),
  })
  .strict();

export const assessmentEvaluationSchema = z.object({
  skill: z.enum([
    'written_production',
    'comprehension',
    'grammatical_control',
    'lexical_precision_range',
    'cohesion_discourse',
    'register_pragmatics',
    'mexican_spanish_naturalness',
  ]),
  judgment: z.enum(['strong_evidence', 'mixed_evidence', 'limited_evidence', 'not_assessable']),
  confidence: z.number().min(0).max(1),
  evidence: z.array(nonBlankText(500)).max(10),
  weaknesses: z.array(z.object({
    category: z.enum(supportedIssueCategories),
    explanation: nonBlankText(1_000),
    confidence: z.number().min(0).max(1),
    referenceIds: z.array(z.enum(supportedReferenceIds)).max(5),
  }).strict()).max(20),
  mexicanSpanishNotes: z.array(nonBlankText(500)).max(10),
  uncertainties: z.array(nonBlankText(500)).max(10),
}).strict();

export const ollamaVersionSchema = z
  .object({ version: nonBlankText(100) })
  .passthrough();

export const ollamaTagsSchema = z
  .object({
    models: z.array(
      z
        .object({
          name: nonBlankText(300),
          model: z.string().max(300).optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const ollamaChatSchema = z
  .object({
    message: z
      .object({
        content: z.string().min(1).max(100_000),
      })
      .passthrough(),
  })
  .passthrough();
