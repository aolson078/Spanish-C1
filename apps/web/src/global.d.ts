import type {
  CorrectionProposal,
  ProviderDiagnostics,
} from '../../../packages/ai-provider/src/contracts';
import type {
  AnalysisResult,
  AssessmentView,
  ApplicationState,
  WeaknessDetail,
} from '../../desktop/application-service';
import type { LearnerDecision, StoredSessionProgress } from '../../../packages/persistence/src/models';
import type { PortableBackup } from '../../../packages/persistence/src/portable-files';
import type { DataPreview, RecoveryResult } from '../../desktop/recovery-coordinator';
import type { ReadinessStatus } from '../../desktop/readiness';
import type { BootstrapStatus } from '../../desktop/recovery-mode';
import type { AudioRetention, AudioStatus, AudioTranscriptDraft, SynthesizedSpeech } from '../../desktop/audio-service';

type AppError = { code: string; message: string };
type AppResult<T> = { ok: true; value: T } | { ok: false; error: AppError };

declare global {
  interface Window {
    spanishC1: {
      getAppState(): Promise<AppResult<ApplicationState>>;
      getBootstrapStatus(): Promise<AppResult<BootstrapStatus>>;
      getReadiness(): Promise<AppResult<ReadinessStatus>>;
      acknowledgeSetup(): Promise<AppResult<void>>;
      listBackups(): Promise<AppResult<readonly PortableBackup[]>>;
      createBackup(): Promise<AppResult<string>>;
      createExport(): Promise<AppResult<string>>;
      previewBackup(id: string): Promise<AppResult<DataPreview>>;
      selectImport(): Promise<AppResult<DataPreview | undefined>>;
      commitImport(token: string, confirmation: 'IMPORT'): Promise<AppResult<RecoveryResult>>;
      commitRestore(token: string, confirmation: 'RESTORE'): Promise<AppResult<RecoveryResult>>;
      getAiDiagnostics(): Promise<AppResult<ProviderDiagnostics>>;
      proposeCorrection(learnerText: string): Promise<AppResult<AnalysisResult>>;
      getAudioStatus(): Promise<AppResult<AudioStatus>>;
      setAudioRetention(retention: AudioRetention): Promise<AppResult<AudioStatus>>;
      transcribeSessionAudio(sessionId: string, bytes: ArrayBuffer): Promise<AppResult<AudioTranscriptDraft>>;
      submitSessionTranscript(sessionId: string, token: string, transcript: string): Promise<AppResult<StoredSessionProgress>>;
      synthesizeSpeech(text: string): Promise<AppResult<SynthesizedSpeech>>;
      startFifteenMinuteSession(): Promise<AppResult<StoredSessionProgress>>;
      advanceWarmup(sessionId: string): Promise<AppResult<StoredSessionProgress>>;
      submitSessionText(sessionId: string, learnerText: string): Promise<AppResult<StoredSessionProgress>>;
      reviewCorrection(sessionId: string, decision: LearnerDecision): Promise<AppResult<StoredSessionProgress>>;
      completeFifteenMinuteSession(sessionId: string): Promise<AppResult<StoredSessionProgress>>;
      getWeaknessDetail(weaknessId: string): Promise<AppResult<WeaknessDetail>>;
      setWeaknessPaused(weaknessId: string, paused: boolean): Promise<AppResult<WeaknessDetail>>;
      startAssessment(kind: 'baseline' | 'checkpoint'): Promise<AppResult<AssessmentView>>;
      submitAssessmentResponse(assessmentId: string, response: string): Promise<AppResult<AssessmentView>>;
    };
  }
}

export {};
