import { useEffect, useState, type FormEvent } from 'react';
import type { CorrectionProposal, ProviderDiagnostics } from '../../../packages/ai-provider/src/contracts';
import { assessmentRubric, type AssessmentJudgment, type AssessmentSkill, type ProfileTrend } from '../../../packages/domain/src/assessment';
import type { LearnerDecision, StoredSessionProgress, WeaknessSummaryRecord } from '../../../packages/persistence/src/models';
import type { PortableBackup } from '../../../packages/persistence/src/portable-files';
import type { ApplicationState, AssessmentView, WeaknessDetail } from '../../desktop/application-service';
import type { DataPreview } from '../../desktop/recovery-coordinator';
import type { ReadinessStatus } from '../../desktop/readiness';
import type { BootstrapStatus } from '../../desktop/recovery-mode';
import type { AudioRetention, AudioStatus } from '../../desktop/audio-service';
import { PromptAudioButton, SessionAudioControls } from './SessionAudioControls';

const sample = 'Si tendría más tiempo, viajaría más.';
type AppView = 'today' | 'progress' | 'settings';

const viewCopy: Record<AppView, { eyebrow: string; title: string; description: string }> = {
  today: {
    eyebrow: 'Daily practice',
    title: 'Today',
    description: 'Continue the work most likely to improve your practical Spanish.',
  },
  progress: {
    eyebrow: 'Evidence and checkpoints',
    title: 'Progress',
    description: 'Inspect recurring weaknesses, review evidence, and compare assessment checkpoints.',
  },
  settings: {
    eyebrow: 'Private and local',
    title: 'Settings',
    description: 'Confirm the local AI connection and where this application stores its learning data.',
  },
};

const phaseGuidance: Record<StoredSessionProgress['phase'], string> = {
  warmup: 'Retrieval warm-up · about 2 minutes',
  production: 'Targeted production · about 5 minutes',
  repair: 'Focused repair · about 3 minutes',
  targeted_practice: 'Targeted practice · part of the repair block',
  transfer: 'Changed-context transfer · about 3 minutes',
  summary: 'Summary and scheduling · about 2 minutes',
  completed: 'Completed',
};

const sessionStages = ['Warm up', 'Produce', 'Repair', 'Transfer', 'Wrap up'] as const;
const sessionStageIndex: Record<StoredSessionProgress['phase'], number> = {
  warmup: 0,
  production: 1,
  repair: 2,
  targeted_practice: 2,
  transfer: 3,
  summary: 4,
  completed: 4,
};

const weaknessNames: Readonly<Record<string, string>> = {
  'conditional.present_hypothetical': 'Hypothetical si-clauses',
  'conditional.real_present_future': 'Real present and future conditions',
  'conditional.past_counterfactual': 'Past counterfactual conditions',
};

const weaknessStateLabels: Readonly<Record<string, string>> = {
  suspected: 'Suspected',
  confirmed: 'Confirmed',
  remediating: 'In focused practice',
  provisional: 'Provisionally improved',
  verified: 'Verified in delayed review',
  resurfaced: 'Resurfaced',
};

const evidencePurposeLabels: Readonly<Record<string, string>> = {
  detection: 'Detected',
  remediation: 'Repair practice',
  transfer: 'Changed context',
  delayed_verification: 'Delayed check',
  recurrence: 'Resurfaced',
};

const evidenceDispositionLabels: Readonly<Record<string, string>> = {
  correct: 'Correct use observed',
  incorrect: 'Issue observed',
  uncertain: 'Needs review',
  learner_disagreed: 'Learner disagreed',
};

const validationSourceLabels: Readonly<Record<string, string>> = {
  model_only: 'AI proposal only',
  deterministic: 'Deterministic check',
  reference_backed: 'Reference-backed check',
  learner_reviewed: 'Learner reviewed',
};

const formatTechnicalKey = (key: string): string => key
  .split('.')
  .at(-1)!
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const weaknessName = (key: string): string => weaknessNames[key] ?? formatTechnicalKey(key);
const weaknessStateLabel = (state: string): string => weaknessStateLabels[state] ?? formatTechnicalKey(state);
const formatDateTime = (value: string): string => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

type AssessmentDimensionKey = keyof NonNullable<AssessmentView['profile']>['dimensions'];
type AssessmentDimensionEntry = NonNullable<AssessmentView['profile']>['dimensions'][AssessmentDimensionKey];

const assessmentBandLabels: Readonly<Record<AssessmentJudgment, string>> = {
  strong_evidence: 'Strong evidence',
  mixed_evidence: 'Mixed evidence',
  limited_evidence: 'Limited evidence',
  not_assessable: 'Not assessed',
};

const assessmentBandDefinitions: readonly { key: AssessmentJudgment; description: string }[] = [
  { key: 'strong_evidence', description: 'The written sample clearly met the supplied criteria.' },
  { key: 'mixed_evidence', description: 'The sample met some criteria but still showed important gaps.' },
  { key: 'limited_evidence', description: 'The sample supplied too little control for a stronger claim.' },
  { key: 'not_assessable', description: 'No reliable written judgment is available for these dimensions.' },
];

const profileTrendLabels: Readonly<Record<ProfileTrend, string>> = {
  stronger_evidence: 'Stronger evidence than baseline',
  weaker_evidence: 'Weaker evidence than baseline',
  same_evidence_band: 'Same evidence band as baseline',
  insufficient_evidence: 'Not enough comparable evidence',
};

const assessmentDimensionLabel = (skill: AssessmentDimensionKey): string => skill === 'spoken_comprehension_production'
  ? 'Spoken comprehension and production'
  : assessmentRubric[skill].label;

const assessmentBandKey = (entry: AssessmentDimensionEntry): AssessmentJudgment => entry.status === 'not_sampled'
  ? 'not_assessable'
  : entry.judgment ?? 'not_assessable';

const formatLabelList = (labels: readonly string[]): string => new Intl.ListFormat(undefined, {
  style: 'long',
  type: 'conjunction',
}).format(labels);

const formatPriorityList = (labels: readonly string[]): string => labels.length < 2
  ? labels[0] ?? 'No immediate priority was isolated from this sample.'
  : `${labels.slice(0, -1).join(', ')}, then ${labels.at(-1)}`;

type WeaknessGroupKey = 'due' | 'active' | 'improved' | 'paused';
const weaknessGroupDefinitions: readonly { key: WeaknessGroupKey; title: string; description: string }[] = [
  { key: 'due', title: 'Due now', description: 'Ready for delayed verification.' },
  { key: 'active', title: 'Active practice', description: 'Still gathering or repairing evidence.' },
  { key: 'improved', title: 'Provisionally improved', description: 'Improved evidence exists; durability still matters.' },
  { key: 'paused', title: 'Paused', description: 'Excluded from automatic activity selection.' },
];

const weaknessGroupKey = (weakness: WeaknessSummaryRecord, dueWeaknessIds: ReadonlySet<string>): WeaknessGroupKey => {
  if (weakness.isPaused) return 'paused';
  if (dueWeaknessIds.has(weakness.id)) return 'due';
  if (weakness.state === 'provisional' || weakness.state === 'verified') return 'improved';
  return 'active';
};

const Proposal = ({ proposal, heading = 'Suggested correction' }: { proposal: CorrectionProposal; heading?: string }) => (
  <article className="proposal" aria-live="polite">
    <p className="trust-note">AI proposal — review before accepting as evidence</p>
    <h3>{heading}</h3>
    {heading !== 'Suggested correction' && <p className="context-label">Suggested correction</p>}
    <p className="corrected">{proposal.correctedText}</p>
    <h4>Why</h4>
    {proposal.issues.length === 0 ? <p>No specific issue was proposed for this response.</p> : (
      <ul>{proposal.issues.map((issue, index) => (
        <li key={`${issue.category}-${index}`}>
          <strong>{issue.span} → {issue.replacement}</strong>
          <span>{issue.explanation}</span>
          <small>{Math.round(issue.confidence * 100)}% model confidence</small>
        </li>
      ))}</ul>
    )}
    {proposal.mexicanSpanishNotes.length > 0 && (
      <div className="proposal-notes">
        <h4>Mexican Spanish notes</h4>
        <ul>{proposal.mexicanSpanishNotes.map((note) => <li key={note}>{note}</li>)}</ul>
      </div>
    )}
    {proposal.uncertainties.length > 0 && (
      <div className="proposal-notes">
        <h4>What remains uncertain</h4>
        <ul>{proposal.uncertainties.map((uncertainty) => <li key={uncertainty}>{uncertainty}</li>)}</ul>
      </div>
    )}
  </article>
);

export const App = () => {
  const [activeView, setActiveView] = useState<AppView>('today');
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostics>();
  const [applicationState, setApplicationState] = useState<ApplicationState>();
  const [activeSession, setActiveSession] = useState<StoredSessionProgress>();
  const [diagnosticError, setDiagnosticError] = useState<string>();
  const [learnerText, setLearnerText] = useState(sample);
  const [sessionText, setSessionText] = useState('');
  const [proposal, setProposal] = useState<CorrectionProposal>();
  const [requestError, setRequestError] = useState<string>();
  const [working, setWorking] = useState(false);
  const [selectedWeakness, setSelectedWeakness] = useState<WeaknessDetail>();
  const [assessment, setAssessment] = useState<AssessmentView>();
  const [assessmentText, setAssessmentText] = useState('');
  const [backups, setBackups] = useState<readonly PortableBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [dataMessage, setDataMessage] = useState<string>();
  const [readiness, setReadiness] = useState<ReadinessStatus>();
  const [dataPreview, setDataPreview] = useState<DataPreview>();
  const [bootstrap, setBootstrap] = useState<BootstrapStatus>();
  const [audioStatus, setAudioStatus] = useState<AudioStatus>();
  const [responseMode, setResponseMode] = useState<'written' | 'spoken'>('written');

  const refreshState = async () => {
    const result = await window.spanishC1.getAppState();
    if (result.ok) {
      setApplicationState(result.value);
      if (!result.value.setupAcknowledged) setActiveView('settings');
      if (result.value.activeSession) setActiveSession(result.value.activeSession);
      if (result.value.activeAssessment) setAssessment(result.value.activeAssessment);
      else if (!assessment && result.value.assessmentHistory[0]) setAssessment(result.value.assessmentHistory[0]);
    }
  };

  useEffect(() => {
    void window.spanishC1.getBootstrapStatus().then((result) => {
      if (!result.ok) { setRequestError(result.error.message); return; }
      setBootstrap(result.value);
      if (result.value.mode === 'recovery') { void refreshBackups(); return; }
      if (result.value.mode === 'blocked') return;
      void refreshState();
      void refreshReadiness();
      void refreshAudioStatus();
      void window.spanishC1.getAiDiagnostics().then((diagnosticResult) => {
        if (diagnosticResult.ok) setDiagnostics(diagnosticResult.value);
        else setDiagnosticError(diagnosticResult.error.message);
      });
    });
  }, []);

  const refreshReadiness = async () => {
    const result = await window.spanishC1.getReadiness();
    if (result.ok) setReadiness(result.value);
    else setRequestError(result.error.message);
  };

  const refreshAudioStatus = async () => {
    const result = await window.spanishC1.getAudioStatus();
    if (result.ok) setAudioStatus(result.value);
    else setRequestError(result.error.message);
  };

  const changeAudioRetention = async (retention: AudioRetention) => {
    setWorking(true);
    const result = await window.spanishC1.setAudioRetention(retention);
    if (result.ok) { setAudioStatus(result.value); await refreshState(); }
    else setRequestError(result.error.message);
    setWorking(false);
  };

  const refreshBackups = async () => {
    const result = await window.spanishC1.listBackups();
    if (result.ok) {
      setBackups(result.value);
      setSelectedBackup((current) => result.value.some((backup) => backup.id === current) ? current : result.value[0]?.id ?? '');
    } else setRequestError(result.error.message);
  };

  const createDataFile = async (kind: 'backup' | 'export') => {
    setWorking(true);
    setRequestError(undefined);
    setDataMessage(undefined);
    const result = kind === 'backup' ? await window.spanishC1.createBackup() : await window.spanishC1.createExport();
    if (result.ok) {
      setDataMessage(`${kind === 'backup' ? 'Backup' : 'Export'} saved locally: ${result.value}`);
      if (kind === 'backup') await refreshBackups();
    } else setRequestError(result.error.message);
    setWorking(false);
  };

  const previewRestore = async () => {
    if (!selectedBackup) return;
    setWorking(true);
    setRequestError(undefined);
    const result = await window.spanishC1.previewBackup(selectedBackup);
    if (result.ok) { setDataPreview(result.value); setRestoreConfirmation(''); }
    else setRequestError(result.error.message);
    setWorking(false);
  };

  const selectImport = async () => {
    setWorking(true);
    setRequestError(undefined);
    const result = await window.spanishC1.selectImport();
    if (result.ok && result.value) { setDataPreview(result.value); setRestoreConfirmation(''); }
    else if (!result.ok) setRequestError(result.error.message);
    setWorking(false);
  };

  const commitRecovery = async (event: FormEvent) => {
    event.preventDefault();
    if (!dataPreview) return;
    setWorking(true);
    setRequestError(undefined);
    setDataMessage('Restarting safely — validating the replacement and preserving current data first…');
    const result = dataPreview.kind === 'import'
      ? await window.spanishC1.commitImport(dataPreview.token, 'IMPORT')
      : await window.spanishC1.commitRestore(dataPreview.token, 'RESTORE');
    if (!result.ok) {
      setRequestError(result.error.message);
      setDataMessage(undefined);
      setWorking(false);
    }
  };

  const finishSetup = async () => {
    const result = await window.spanishC1.acknowledgeSetup();
    if (result.ok) { await refreshState(); await refreshReadiness(); }
    else setRequestError(result.error.message);
  };

  const acceptProgress = async (operation: Promise<{ ok: true; value: StoredSessionProgress } | { ok: false; error: { message: string } }>) => {
    setWorking(true);
    setRequestError(undefined);
    const result = await operation;
    if (result.ok) {
      setActiveSession(result.value);
      setSessionText('');
      await refreshState();
    } else setRequestError(result.error.message);
    setWorking(false);
  };

  const submitFreeAnalysis = async (event: FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setRequestError(undefined);
    setProposal(undefined);
    const result = await window.spanishC1.proposeCorrection(learnerText);
    if (result.ok) {
      setProposal(result.value.proposal);
      await refreshState();
    } else setRequestError(result.error.message);
    setWorking(false);
  };

  const submitSessionText = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeSession) return;
    await acceptProgress(window.spanishC1.submitSessionText(activeSession.sessionId, sessionText));
  };

  const acceptAudioProgress = async (progress: StoredSessionProgress) => {
    setActiveSession(progress);
    setSessionText('');
    await refreshState();
  };

  const review = async (decision: LearnerDecision) => {
    if (!activeSession) return;
    await acceptProgress(window.spanishC1.reviewCorrection(activeSession.sessionId, decision));
  };

  const sessionProposal = activeSession?.proposal as CorrectionProposal | undefined;

  const selectWeakness = async (weaknessId: string) => {
    setRequestError(undefined);
    const result = await window.spanishC1.getWeaknessDetail(weaknessId);
    if (result.ok) setSelectedWeakness(result.value);
    else setRequestError(result.error.message);
  };

  const toggleWeakness = async () => {
    if (!selectedWeakness) return;
    setWorking(true);
    const result = await window.spanishC1.setWeaknessPaused(
      selectedWeakness.weakness.id,
      !selectedWeakness.weakness.isPaused,
    );
    if (result.ok) {
      setSelectedWeakness(result.value);
      await refreshState();
    } else setRequestError(result.error.message);
    setWorking(false);
  };

  const startAssessment = async (kind: 'baseline' | 'checkpoint') => {
    setWorking(true);
    setRequestError(undefined);
    const result = await window.spanishC1.startAssessment(kind);
    if (result.ok) {
      setAssessment(result.value);
      setAssessmentText('');
      await refreshState();
    } else setRequestError(result.error.message);
    setWorking(false);
  };

  const submitAssessment = async (event: FormEvent) => {
    event.preventDefault();
    if (!assessment) return;
    setWorking(true);
    setRequestError(undefined);
    const result = await window.spanishC1.submitAssessmentResponse(assessment.id, assessmentText);
    if (result.ok) {
      setAssessment(result.value);
      setAssessmentText('');
      await refreshState();
    } else setRequestError(result.error.message);
    setWorking(false);
  };

  if (!bootstrap) return <main id="main-content"><p className="loading-message" role="status">Opening the private learning workspace…</p></main>;

  if (bootstrap.mode === 'blocked') return (
    <main className="recovery-mode" id="main-content">
      <header><p className="eyebrow">Read-only guidance</p><h1>This data folder is already open</h1></header>
      <p className="error" role="alert">{bootstrap.message}</p>
      <dl><div><dt>Active data root</dt><dd>{bootstrap.activeDataRoot}</dd></div></dl>
      <p>No learning data was opened or changed. Close the other Spanish C1 window, then launch this copy again.</p>
    </main>
  );

  if (bootstrap.mode === 'recovery') return (
    <main id="main-content" className="recovery-mode">
      <header><p className="eyebrow">Protected recovery mode</p><h1>Learning data needs attention</h1></header>
      <p className="error" role="alert">{bootstrap.message}</p>
      <p>No learning data was changed. Before replacement, the unreadable database family will be preserved in the portable backup folder.</p>
      <dl><div><dt>Active data root</dt><dd>{bootstrap.activeDataRoot}</dd></div></dl>
      <section className="restore-panel">
        <h2>Choose a recovery source</h2>
        <label htmlFor="recovery-backup">Managed backup</label>
        <select id="recovery-backup" onChange={(event) => setSelectedBackup(event.target.value)} value={selectedBackup}>
          {backups.length === 0 && <option value="">No managed backups found</option>}
          {backups.map((backup) => <option key={backup.id} value={backup.id}>{formatDateTime(backup.createdAt)}</option>)}
        </select>
        <div className="data-actions"><button disabled={!selectedBackup || working} onClick={() => void previewRestore()} type="button">Preview backup restore</button><button className="button-secondary" disabled={working} onClick={() => void selectImport()} type="button">Choose JSON export</button></div>
      </section>
      {dataPreview && <form className="restore-panel" onSubmit={commitRecovery}>
        <h2>Confirm {dataPreview.kind === 'import' ? 'JSON import' : 'backup restore'}</h2>
        <p>{dataPreview.displayName} · {Object.values(dataPreview.incomingCounts).reduce((sum, count) => sum + count, 0)} incoming records</p>
        <label htmlFor="recovery-confirmation">Type {dataPreview.kind === 'import' ? 'IMPORT' : 'RESTORE'} to confirm</label>
        <input id="recovery-confirmation" onChange={(event) => setRestoreConfirmation(event.target.value)} value={restoreConfirmation} />
        <button className="restore-button" disabled={working || restoreConfirmation !== (dataPreview.kind === 'import' ? 'IMPORT' : 'RESTORE')} type="submit">Preserve current files, replace, and restart</button>
      </form>}
      {dataMessage && <p role="status">{dataMessage}</p>}
      {requestError && <p className="error" role="alert">{requestError}</p>}
    </main>
  );

  const currentView = viewCopy[activeView];
  const dueWeaknessIds = new Set(applicationState?.dueReviews.map((review) => review.weaknessId) ?? []);
  const weaknessGroups = weaknessGroupDefinitions.map((definition) => ({
    ...definition,
    weaknesses: applicationState?.weaknesses.filter((weakness) => weaknessGroupKey(weakness, dueWeaknessIds) === definition.key) ?? [],
  }));
  const assessmentDimensions = assessment?.profile
    ? (Object.entries(assessment.profile.dimensions) as [AssessmentDimensionKey, AssessmentDimensionEntry][]).map(([skill, entry]) => ({
        skill,
        entry,
        band: assessmentBandKey(entry),
        label: assessmentDimensionLabel(skill),
      }))
    : [];
  const assessmentGroups = assessmentBandDefinitions.map((definition) => ({
    ...definition,
    dimensions: assessmentDimensions.filter((dimension) => dimension.band === definition.key),
  }));
  const assessmentStrengths = assessmentDimensions
    .filter((dimension) => dimension.band === 'strong_evidence')
    .map((dimension) => dimension.label);
  const assessmentPriorities = [
    ...assessmentDimensions.filter((dimension) => dimension.band === 'limited_evidence'),
    ...assessmentDimensions.filter((dimension) => dimension.band === 'mixed_evidence'),
  ].map((dimension) => dimension.label);

  return (
    <>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <main id="main-content">
      <header className="app-header">
        <div className="brand">
          <p className="eyebrow">Private · local-first · Mexican Spanish</p>
          <h1>Spanish C1</h1>
          <p className="subtitle">Find the exact weakness, repair it, and verify it later.</p>
        </div>
        <nav className="primary-nav" aria-label="Main views">
          {(['today', 'progress', 'settings'] as const).map((view) => (
            <button
              aria-current={activeView === view ? 'page' : undefined}
              className="view-tab"
              key={view}
                          onClick={() => { setActiveView(view); if (view === 'settings') { void refreshBackups(); void refreshAudioStatus(); } }}
              type="button"
            >
              {viewCopy[view].title}
            </button>
          ))}
        </nav>
      </header>

      <section className="view-intro" aria-labelledby="active-view-heading">
        <div>
          <p className="eyebrow">{currentView.eyebrow}</p>
          <h2 id="active-view-heading">{currentView.title}</h2>
          <p>{currentView.description}</p>
        </div>
        {activeView === 'today' && (
          <dl className="today-summary" aria-label="Today's learning summary">
            <div><dt>Reviews due</dt><dd>{applicationState?.dueReviewCount ?? 0}</dd></div>
            <div><dt>Weaknesses tracked</dt><dd>{applicationState?.weaknesses.length ?? 0}</dd></div>
          </dl>
        )}
      </section>

      <section className="settings audio-settings" aria-labelledby="audio-settings-heading" hidden={activeView !== 'settings'}>
        <h2 id="audio-settings-heading">Desktop audio</h2>
        <dl>
          <div><dt>Status</dt><dd>{audioStatus?.available ? 'Ready' : 'Unavailable'}</dd></div>
          <div><dt>Speech to text</dt><dd>{audioStatus?.speechToTextModel ?? 'Checking…'}</dd></div>
          <div><dt>Mexican voice</dt><dd>{audioStatus?.textToSpeechModel ?? 'Checking…'}</dd></div>
        </dl>
        <p>{audioStatus?.message ?? 'Checking offline speech…'}</p>
        <label htmlFor="audio-retention">Recording retention</label>
        <select
          disabled={working}
          id="audio-retention"
          onChange={(event) => void changeAudioRetention(event.target.value as AudioRetention)}
          value={applicationState?.audioRetention ?? audioStatus?.retention ?? 'discard'}
        >
          <option value="discard">Discard recordings after transcription</option>
          <option value="keep">Keep recordings under the portable data folder</option>
        </select>
        <p className="selection">Transcripts remain editable either way. Only a confirmed transcript can enter the learning system.</p>
      </section>

      <section className="diagnostics" aria-label="Local AI diagnostics" hidden={activeView !== 'settings'}>
        <strong>First-run readiness</strong>
        {readiness && <><p className={`readiness-status readiness-status--${readiness.overall}`}>Overall: {readiness.overall}</p><ul className="readiness-list">{readiness.checks.map((check) => (
          <li key={check.id}><strong>{check.label}</strong><span>{check.message}</span><small>{check.level}</small></li>
        ))}</ul><div className="data-actions"><button className="button-secondary" onClick={() => void refreshReadiness()} type="button">Recheck</button>{!readiness.setupAcknowledged && <button onClick={() => void finishSetup()} type="button">Finish setup</button>}</div></>}
        <strong className="diagnostics-subheading">Local AI details</strong>
        {diagnostics ? (
          <dl>
            <div><dt>Status</dt><dd>{diagnostics.modelAvailable ? 'Ready' : 'Model missing'}</dd></div>
            <div><dt>Endpoint</dt><dd>{diagnostics.endpoint}</dd></div>
            <div><dt>Model</dt><dd>{diagnostics.model}</dd></div>
            <div><dt>Context</dt><dd>{diagnostics.contextLength.toLocaleString()}</dd></div>
            <div><dt>Ollama</dt><dd>{diagnostics.providerVersion}</dd></div>
          </dl>
        ) : (
          <p className={diagnosticError ? 'inline-error' : 'loading-message'} role={diagnosticError ? 'alert' : 'status'}>
            {diagnosticError ?? 'Checking local AI…'}
          </p>
        )}
      </section>

      <section className="dashboard" aria-labelledby="dashboard-heading" hidden={activeView !== 'progress'}>
        <div className="session-heading">
          <div><p className="eyebrow">Learning control</p><h2 id="dashboard-heading">Weakness dashboard</h2></div>
          <span className="phase">{applicationState?.weaknesses.length ?? 0} tracked</span>
        </div>
        <p className="selection-reason"><strong>Why the next activity?</strong> {applicationState?.nextActivityExplanation ?? 'Loading…'}</p>

        {(applicationState?.weaknesses.length ?? 0) === 0 ? <p>No weaknesses recorded yet.</p> : (
          <div className="weakness-layout">
            <div className="weakness-groups" aria-label="Tracked weaknesses">
              {weaknessGroups.filter((group) => group.weaknesses.length > 0).map((group) => (
                <section className={`weakness-group weakness-group--${group.key}`} key={group.key}>
                  <header>
                    <div><h3>{group.title}</h3><p>{group.description}</p></div>
                    <span>{group.weaknesses.length}</span>
                  </header>
                  <div className="weakness-list">
                    {group.weaknesses.map((weakness) => {
                      const isSelected = selectedWeakness?.weakness.id === weakness.id;
                      return (
                        <button
                          aria-pressed={isSelected}
                          className={`weakness-card${weakness.isPaused ? ' is-paused' : ''}`}
                          key={weakness.id}
                          onClick={() => void selectWeakness(weakness.id)}
                          type="button"
                        >
                          <span className="weakness-card-heading">
                            <span><strong>{weaknessName(weakness.featureKey)}</strong><code>{weakness.featureKey}</code></span>
                            {isSelected && <span className="selected-indicator">Selected</span>}
                          </span>
                          <span className="weakness-state">{weaknessStateLabel(weakness.state)}</span>
                          <dl className="weakness-metrics">
                            <div><dt>Severity</dt><dd>{weakness.severity}/5</dd></div>
                            <div><dt>Impact</dt><dd>{weakness.communicativeImpact}/5</dd></div>
                            <div><dt>Recurrence</dt><dd>{weakness.recurrenceCount}</dd></div>
                            <div><dt>Evidence</dt><dd>{weakness.evidenceCount}</dd></div>
                          </dl>
                          <small className="review-date">Next review: {weakness.nextReviewAt ? formatDateTime(weakness.nextReviewAt) : 'not scheduled'}</small>
                          <small className="confidence-note">AI confidence: {Math.round(weakness.confidence * 100)}%</small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
            {selectedWeakness && (
              <article className="weakness-detail" aria-live="polite">
                <header className="weakness-detail-heading">
                  <div>
                    <p className="eyebrow">Selected weakness</p>
                    <h3>{weaknessName(selectedWeakness.weakness.featureKey)}</h3>
                    <code>{selectedWeakness.weakness.featureKey}</code>
                  </div>
                  <span className="weakness-state">{weaknessStateLabel(selectedWeakness.weakness.state)}</span>
                </header>
                <dl className="weakness-detail-metrics">
                  <div><dt>State</dt><dd>{selectedWeakness.weakness.state}</dd></div>
                  <div><dt>Severity</dt><dd>{selectedWeakness.weakness.severity}/5</dd></div>
                  <div><dt>Impact</dt><dd>{selectedWeakness.weakness.communicativeImpact}/5</dd></div>
                  <div><dt>Recurrence</dt><dd>{selectedWeakness.weakness.recurrenceCount}</dd></div>
                  <div><dt>Evidence</dt><dd>{selectedWeakness.evidence.length}</dd></div>
                  <div><dt>Next review</dt><dd>{selectedWeakness.weakness.nextReviewAt ? formatDateTime(selectedWeakness.weakness.nextReviewAt) : 'Not scheduled'}</dd></div>
                </dl>
                <button className="button-quiet" disabled={working} onClick={() => void toggleWeakness()} type="button">
                  {selectedWeakness.weakness.isPaused ? 'Reopen automatic practice' : 'Pause automatic practice'}
                </button>
                <h4>Evidence sequence</h4>
                {selectedWeakness.evidence.length === 0 ? <p>No evidence events recorded.</p> : (
                  <ol className="evidence-timeline">{selectedWeakness.evidence.map((event, index) => (
                    <li key={event.id}>
                      <span className="evidence-marker" aria-hidden="true">{index + 1}</span>
                      <article>
                        <header>
                          <div><strong>{evidencePurposeLabels[event.purpose] ?? formatTechnicalKey(event.purpose)}</strong><time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></div>
                          <span className="evidence-source">{validationSourceLabels[event.validationSource] ?? formatTechnicalKey(event.validationSource)}</span>
                        </header>
                        <p className="evidence-observation"><span>Observed</span>{event.observedBehavior}</p>
                        <p className="evidence-result"><strong>{evidenceDispositionLabels[event.disposition] ?? formatTechnicalKey(event.disposition)}.</strong> {event.validatorResult.explanation}</p>
                        <details className="evidence-technical">
                          <summary>Technical evidence</summary>
                          <dl>
                            <div><dt>Expected</dt><dd>{event.expectedBehavior}</dd></div>
                            <div><dt>Support</dt><dd>{event.supportLevel}</dd></div>
                            <div><dt>Validator</dt><dd>{event.validatorResult.status}</dd></div>
                            <div><dt>AI confidence</dt><dd>{Math.round(event.confidence * 100)}%</dd></div>
                          </dl>
                          <small>References: {event.referenceIds.join(', ') || 'none'}</small>
                        </details>
                      </article>
                    </li>
                  ))}</ol>
                )}
                {selectedWeakness.controls.length > 0 && <><h4>Manual controls</h4><ol>{selectedWeakness.controls.map((control) => (
                  <li key={control.id}><strong>{control.action}</strong> · {control.reason}</li>
                ))}</ol></>}
              </article>
            )}
          </div>
        )}
      </section>

      <section className="settings" aria-labelledby="settings-heading" hidden={activeView !== 'settings'}>
        <h2 id="settings-heading">Learning data</h2>
        <dl>
          <div><dt>Saved sessions</dt><dd>{applicationState?.recentSessions.length ?? 0}</dd></div>
          <div><dt>Reviews due</dt><dd>{applicationState?.dueReviewCount ?? 0}</dd></div>
          <div><dt>Active data root</dt><dd>{applicationState?.activeDataRoot ?? 'Loading…'}</dd></div>
        </dl>
        <div className="data-actions">
          <button disabled={working} onClick={() => void createDataFile('backup')} type="button">Create backup</button>
          <button className="button-secondary" disabled={working} onClick={() => void createDataFile('export')} type="button">Export readable JSON</button>
          <button className="button-secondary" disabled={working} onClick={() => void selectImport()} type="button">Import JSON export</button>
        </div>
        {dataMessage && <p className="saved-message" role="status">{dataMessage}</p>}
        <section className="restore-panel">
          <h3>Restore from backup</h3>
          <p>This replaces current learning data and restarts the app. A fresh safety backup is created first.</p>
          <label htmlFor="restore-backup">Restore point</label>
          <select id="restore-backup" onChange={(event) => setSelectedBackup(event.target.value)} value={selectedBackup}>
            {backups.length === 0 && <option value="">No backups available</option>}
            {backups.map((backup) => <option key={backup.id} value={backup.id}>{formatDateTime(backup.createdAt)} · {(backup.sizeBytes / 1_048_576).toFixed(1)} MB</option>)}
          </select>
          <button className="button-quiet" disabled={working || !selectedBackup} onClick={() => void previewRestore()} type="button">Preview restore</button>
        </section>
        {dataPreview && <form className="restore-panel" onSubmit={commitRecovery}>
          <h3>{dataPreview.kind === 'import' ? 'Confirm JSON import' : 'Confirm backup restore'}</h3>
          <p><strong>{dataPreview.displayName}</strong> · created {formatDateTime(dataPreview.createdAt)} · expires {formatDateTime(dataPreview.expiresAt)}</p>
          <div className="preview-counts"><div><strong>Current records</strong><span>{Object.values(dataPreview.currentCounts).reduce((sum, count) => sum + count, 0)}</span></div><div><strong>Incoming records</strong><span>{Object.values(dataPreview.incomingCounts).reduce((sum, count) => sum + count, 0)}</span></div></div>
          <p>This is a full replacement. A verified safety backup is created first.</p>
          <label htmlFor="restore-confirmation">Type {dataPreview.kind === 'import' ? 'IMPORT' : 'RESTORE'} to confirm</label>
          <input autoComplete="off" id="restore-confirmation" onChange={(event) => setRestoreConfirmation(event.target.value)} value={restoreConfirmation} />
          <button className="restore-button" disabled={working || restoreConfirmation !== (dataPreview.kind === 'import' ? 'IMPORT' : 'RESTORE')} type="submit">Replace data and restart</button>
        </form>}
      </section>

      <section className="assessment" aria-labelledby="assessment-heading" hidden={activeView !== 'progress'}>
        <div className="session-heading">
          <div><p className="eyebrow">Checkpoints</p><h2 id="assessment-heading">Practical C1 profile</h2></div>
          {assessment && <span className="phase">{assessment.kind} · {assessment.status}</span>}
        </div>
        {(applicationState?.incompatibleAssessmentCount ?? 0) > 0 && (
          <p className="trust-note" role="status">{applicationState!.incompatibleAssessmentCount} assessment record(s) from a different rubric are preserved for export but cannot be compared with rubric {assessment?.progress.rubricVersion ?? 'practical-c1-text.v2'}.</p>
        )}
        {(applicationState?.corruptAssessmentCount ?? 0) > 0 && (
          <p className="error" role="alert">{applicationState!.corruptAssessmentCount} current-rubric assessment record(s) failed integrity checks. They remain preserved for export but are excluded from assessment views and comparisons.</p>
        )}
        {!assessment ? (
          <div className="assessment-actions">
            <button disabled={working} onClick={() => void startAssessment('baseline')} type="button">Start baseline</button>
            <button className="button-secondary" disabled={working} onClick={() => void startAssessment('checkpoint')} type="button">Start checkpoint</button>
          </div>
        ) : assessment.status === 'active' ? (
          <>
            <p className="selection">Prompt {assessment.progress.currentIndex + 1} of {assessment.progress.steps.length} · stable rubric {assessment.progress.rubricVersion} · {assessment.progress.supportLevel} support</p>
            <p className="session-prompt">{assessment.progress.steps[assessment.progress.currentIndex]?.prompt}</p>
            {assessment.progress.steps[assessment.progress.currentIndex]?.supportGuidance && (
              <p className="selection-reason"><strong>Baseline support:</strong> {assessment.progress.steps[assessment.progress.currentIndex]?.supportGuidance}</p>
            )}
            <form className="session-form" onSubmit={submitAssessment}>
              <label htmlFor="assessment-text">Your assessment response</label>
              <textarea id="assessment-text" maxLength={5_000} onChange={(event) => setAssessmentText(event.target.value)} rows={7} value={assessmentText} />
              <button disabled={working || assessmentText.trim().length === 0} type="submit">{working ? 'Analyzing locally…' : 'Save and continue'}</button>
            </form>
          </>
        ) : (
          <div className="assessment-report">
            <p className="trust-note">Evidence-linked profile — not a single C1 score</p>
            <p className="report-rubric">Rubric: {assessment.profile?.rubricVersion}</p>
            <section className="assessment-summary" aria-labelledby="assessment-summary-heading">
              <h3 id="assessment-summary-heading">Assessment summary</h3>
              <div className="assessment-summary-grid">
                <article>
                  <p className="context-label">Demonstrated strengths</p>
                  <p>{assessmentStrengths.length > 0 ? formatLabelList(assessmentStrengths) : 'No dimension reached the strong-evidence band in this sample.'}</p>
                </article>
                <article>
                  <p className="context-label">Next priorities</p>
                  <p>{formatPriorityList(assessmentPriorities)}</p>
                </article>
                <article>
                  <p className="context-label">What this report cannot claim</p>
                  <p>This is written, local-model evidence—not a proficiency score. Spoken performance remains unassessed while audio is deferred.</p>
                </article>
              </div>
            </section>
            {(assessment.profile?.initialWeaknesses.length ?? 0) > 0 && <div className="due-queue notice-panel"><h3>Model-proposed initial weaknesses</h3><ul>{assessment.profile!.initialWeaknesses.map((weakness, index) => (
              <li key={`${weakness.key}-${weakness.evidencePromptIds.join('-')}-${index}`}>
                <strong>{weaknessName(weakness.key)}</strong>
                <span>{weakness.observationCount} model-proposed observation(s). {weakness.uncertainty}</span>
                <details>
                  <summary>Technical weakness evidence</summary>
                  <dl>
                    <div><dt>Technical key</dt><dd>{weakness.key}</dd></div>
                    <div><dt>AI confidence</dt><dd>{Math.round(weakness.modelConfidence * 100)}%</dd></div>
                    <div><dt>Prompt evidence</dt><dd>{weakness.evidencePromptIds.join(', ')}</dd></div>
                    <div><dt>References</dt><dd>{weakness.referenceIds.join(', ') || 'none'}</dd></div>
                  </dl>
                </details>
              </li>
            ))}</ul></div>}
            <div className="profile-groups">{assessmentGroups.filter((group) => group.dimensions.length > 0).map((group) => (
              <section className={`profile-group profile-group--${group.key}`} key={group.key} aria-labelledby={`assessment-band-${group.key}`}>
                <header>
                  <div><h3 id={`assessment-band-${group.key}`}>{assessmentBandLabels[group.key]}</h3><p>{group.description}</p></div>
                  <span className="phase">{group.dimensions.length}</span>
                </header>
                <div className="profile-grid">{group.dimensions.map(({ skill, entry, band, label }) => {
                  const trend = skill === 'spoken_comprehension_production' ? undefined : assessment.comparison?.[skill as AssessmentSkill];
                  return (
                    <article key={skill}>
                      <header><h4>{label}</h4><span className="evidence-band">{assessmentBandLabels[band]}</span></header>
                      {trend && <p className="profile-trend"><strong>Change since baseline:</strong> {profileTrendLabels[trend]}</p>}
                      {entry.status === 'not_sampled' && <p className="spoken-boundary">This assessment did not sample spoken performance, so this report makes no spoken-language claim.</p>}
                      <details>
                        <summary>Evidence and uncertainty</summary>
                        {entry.evidence.length > 0 ? <><h5>Observed evidence</h5><ul>{entry.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></> : <p>No observed evidence was recorded.</p>}
                        <h5>Uncertainty</h5>
                        <ul>{entry.uncertainties.map((uncertainty) => <li key={uncertainty}>{uncertainty}</li>)}</ul>
                        <dl>
                          <div><dt>Technical key</dt><dd>{skill}</dd></div>
                          <div><dt>Prompt evidence</dt><dd>{entry.evidencePromptIds.join(', ') || 'none'}</dd></div>
                          <div><dt>AI confidence</dt><dd>{entry.modelConfidence === undefined ? 'not available' : `${Math.round(entry.modelConfidence * 100)}%`}</dd></div>
                        </dl>
                      </details>
                    </article>
                  );
                })}</div>
              </section>
            ))}</div>
            <div className="assessment-actions">
              <button disabled={working} onClick={() => void startAssessment('checkpoint')} type="button">Start checkpoint</button>
              <button className="button-quiet" disabled={working} onClick={() => { setAssessment(undefined); void startAssessment('baseline'); }} type="button">Start new baseline</button>
            </div>
          </div>
        )}
      </section>

      <section className="daily-session daily-session--primary" aria-labelledby="daily-heading" hidden={activeView !== 'today'}>
        <div className="session-heading">
          <div><p className="eyebrow">Daily option</p><h2 id="daily-heading">15-minute session</h2></div>
          {activeSession && <span className="phase">{phaseGuidance[activeSession.phase]}</span>}
        </div>

        {!activeSession ? (
          <button disabled={working} onClick={() => void acceptProgress(window.spanishC1.startFifteenMinuteSession())} type="button">Start a 15-minute session</button>
        ) : (
          <div className="session-body">
            <ol className="session-path" aria-label="Session progress">
              {sessionStages.map((stage, index) => {
                const currentIndex = sessionStageIndex[activeSession.phase];
                const isComplete = activeSession.phase === 'completed' || index < currentIndex;
                const isCurrent = activeSession.phase !== 'completed' && index === currentIndex;
                return (
                  <li
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`${isComplete ? 'is-complete' : ''}${isCurrent ? ' is-current' : ''}`.trim()}
                    key={stage}
                  >
                    <span className="stage-marker" aria-hidden="true">{index + 1}</span>
                    <span>{stage}</span>
                  </li>
                );
              })}
            </ol>

            <div className="session-context">
              <p className="selection">Selected from: {activeSession.selectionReason === 'due_review' ? 'a due review' : activeSession.targetWeaknessId ? 'a high-impact weakness' : 'diagnostic practice'}</p>
              {activeSession.selectionExplanation && <p className="selection-reason">{activeSession.selectionExplanation}</p>}
              {activeSession.difficulty && (
                <details className="difficulty"><summary>Difficulty controls</summary><dl>
                  <div><dt>Complexity</dt><dd>{activeSession.difficulty.linguisticComplexity}/5</dd></div>
                  <div><dt>Openness</dt><dd>{activeSession.difficulty.taskOpenness}/5</dd></div>
                  <div><dt>Time pressure</dt><dd>{activeSession.difficulty.timePressure}/5</dd></div>
                  <div><dt>Topic familiarity</dt><dd>{activeSession.difficulty.topicFamiliarity}/5</dd></div>
                  <div><dt>Hints</dt><dd>{activeSession.difficulty.grammaticalHints}/3</dd></div>
                  <div><dt>Lexical support</dt><dd>{activeSession.difficulty.lexicalSupport}/3</dd></div>
                  <div><dt>Targets</dt><dd>{activeSession.difficulty.simultaneousTargets}</dd></div>
                  <div><dt>Mode</dt><dd>{activeSession.difficulty.modality} {activeSession.difficulty.taskMode}</dd></div>
                </dl><p>{activeSession.difficultyReason}</p></details>
              )}
            </div>

            <section className="session-task" aria-labelledby="session-task-heading">
              <div className="session-task-heading">
                <p className="eyebrow">Current task</p>
                <h3 id="session-task-heading">{sessionStages[sessionStageIndex[activeSession.phase]]}</h3>
              </div>

              {activeSession.response && (
                <article className="learner-response">
                  <p className="context-label">{activeSession.phase === 'repair' ? 'Your submitted response' : 'Most recent response'}</p>
                  <blockquote lang="es">{activeSession.response}</blockquote>
                </article>
              )}

              {sessionProposal && ['transfer', 'summary'].includes(activeSession.phase) && (
                <Proposal heading="Feedback on your previous response" proposal={sessionProposal} />
              )}

              <div className="prompt-block">
                <p className="context-label">Prompt</p>
                <p className="session-prompt">{activeSession.prompt}</p>
                {audioStatus?.available && <PromptAudioButton disabled={working} onError={setRequestError} text={activeSession.prompt} />}
              </div>

              {activeSession.phase === 'warmup' && (
                <button disabled={working} onClick={() => void acceptProgress(window.spanishC1.advanceWarmup(activeSession.sessionId))} type="button">Continue to production</button>
              )}

              {['production', 'targeted_practice', 'transfer'].includes(activeSession.phase) && (
                <>
                  <fieldset className="response-mode">
                    <legend>Response mode</legend>
                    <button aria-pressed={responseMode === 'written'} className={responseMode === 'written' ? '' : 'button-quiet'} disabled={working} onClick={() => setResponseMode('written')} type="button">Write</button>
                    <button aria-pressed={responseMode === 'spoken'} className={responseMode === 'spoken' ? '' : 'button-quiet'} disabled={working || !audioStatus?.available} onClick={() => setResponseMode('spoken')} type="button">Speak</button>
                  </fieldset>
                  {responseMode === 'written' ? (
                    <form className="session-form" onSubmit={submitSessionText}>
                      <label htmlFor="session-text">Your Spanish response</label>
                      <textarea id="session-text" maxLength={5_000} onChange={(event) => setSessionText(event.target.value)} rows={6} value={sessionText} />
                      <button disabled={working || sessionText.trim().length === 0} type="submit">{working ? 'Analyzing locally…' : 'Continue'}</button>
                    </form>
                  ) : (
                    <SessionAudioControls
                      disabled={working}
                      key={`${activeSession.sessionId}:${activeSession.phase}`}
                      onBusyChange={setWorking}
                      onError={setRequestError}
                      onProgress={acceptAudioProgress}
                      sessionId={activeSession.sessionId}
                    />
                  )}
                </>
              )}

              {activeSession.phase === 'repair' && (
                <>
                  {sessionProposal && <Proposal proposal={sessionProposal} />}
                  <fieldset className="decision-controls session-decision">
                    <legend>Your review</legend>
                    <p>No independent verification yet. Your decision is recorded separately from the AI proposal.</p>
                    <button disabled={working} onClick={() => void review('agree')} type="button">I agree</button>
                    <button className="button-secondary" disabled={working} onClick={() => void review('disagree')} type="button">I disagree</button>
                    <button className="button-quiet" disabled={working} onClick={() => void review('unclear')} type="button">This is unclear</button>
                    <button className="button-quiet" disabled={working} onClick={() => void review('defer')} type="button">Defer it</button>
                  </fieldset>
                </>
              )}

              {activeSession.phase === 'summary' && (
                <button disabled={working} onClick={() => void acceptProgress(window.spanishC1.completeFifteenMinuteSession(activeSession.sessionId))} type="button">Finish and save</button>
              )}
              {activeSession.phase === 'completed' && <p className="saved-message" role="status">Saved. You can close the app safely.</p>}
            </section>
          </div>
        )}
      </section>

      {requestError && <p className="error" role="alert">{requestError}</p>}

      <section className="workspace" aria-labelledby="free-practice-heading" hidden={activeView !== 'today'}>
        <h2 id="free-practice-heading">Open practice</h2>
        <form onSubmit={submitFreeAnalysis}>
          <label htmlFor="learner-text">Write something in Spanish</label>
          <textarea id="learner-text" value={learnerText} maxLength={5_000} onChange={(event) => setLearnerText(event.target.value)} rows={7} />
          <button className="button-secondary" disabled={working || learnerText.trim().length === 0} type="submit">{working ? 'Analyzing locally…' : 'Analyze this Spanish'}</button>
        </form>
        {proposal && <Proposal proposal={proposal} />}
      </section>
    </main>
    </>
  );
};
