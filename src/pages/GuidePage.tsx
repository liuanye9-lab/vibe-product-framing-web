import { useReducer, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Send,
  Loader2,
  HelpCircle,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Brain,
  Home,
  Lightbulb,
  MessageSquarePlus,
  X,
} from 'lucide-react';
import { useProductBrief } from '../hooks/useProductBrief';
import { STEPS } from '../data/steps';
import { evaluateStep, getStepHint, askFollowUp } from '../api/evaluate';
import type { StepConfig } from '../data/steps';

interface GuideState {
  currentStep: number;
  evaluating: boolean;
  loadingHint: boolean;
  showExamples: boolean;
  showWhyImportant: boolean;
  showHint: boolean;
  hintText: string;
  inputValue: string;
  conversationHistory: ConversationEntry[];
  showSkipConfirm: boolean;
  showCompletionWarning: boolean;
}

interface ConversationEntry {
  id: string;
  role: 'evaluation' | 'followup' | 'user-edit';
  evaluation?: string;
  quality?: 'specific' | 'ok' | 'vague';
  followUp?: string;
  timestamp: number;
}

type GuideAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_EVALUATING'; value: boolean }
  | { type: 'SET_LOADING_HINT'; value: boolean }
  | { type: 'TOGGLE_EXAMPLES' }
  | { type: 'TOGGLE_WHY_IMPORTANT' }
  | { type: 'TOGGLE_HINT' }
  | { type: 'SET_HINT'; text: string }
  | { type: 'SET_INPUT'; value: string }
  | { type: 'ADD_EVALUATION'; entry: ConversationEntry }
  | { type: 'ADD_FOLLOWUP'; entry: ConversationEntry }
  | { type: 'ADD_USER_EDIT'; entry: ConversationEntry }
  | { type: 'SET_SKIP_CONFIRM'; value: boolean }
  | { type: 'SET_COMPLETION_WARNING'; value: boolean }
  | { type: 'RESET_STEP_STATE'; inputValue: string };

function guideReducer(state: GuideState, action: GuideAction): GuideState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    case 'SET_EVALUATING':
      return { ...state, evaluating: action.value };
    case 'SET_LOADING_HINT':
      return { ...state, loadingHint: action.value };
    case 'TOGGLE_EXAMPLES':
      return { ...state, showExamples: !state.showExamples };
    case 'TOGGLE_WHY_IMPORTANT':
      return { ...state, showWhyImportant: !state.showWhyImportant };
    case 'TOGGLE_HINT':
      return { ...state, showHint: !state.showHint };
    case 'SET_HINT':
      return { ...state, hintText: action.text, showHint: true };
    case 'SET_INPUT':
      return { ...state, inputValue: action.value };
    case 'ADD_EVALUATION':
      return { ...state, conversationHistory: [...state.conversationHistory, action.entry] };
    case 'ADD_FOLLOWUP':
      return { ...state, conversationHistory: [...state.conversationHistory, action.entry] };
    case 'ADD_USER_EDIT':
      return { ...state, conversationHistory: [...state.conversationHistory, action.entry] };
    case 'SET_SKIP_CONFIRM':
      return { ...state, showSkipConfirm: action.value };
    case 'SET_COMPLETION_WARNING':
      return { ...state, showCompletionWarning: action.value };
    case 'RESET_STEP_STATE':
      return {
        ...state,
        inputValue: action.inputValue,
        showExamples: false,
        showHint: false,
        hintText: '',
        conversationHistory: [],
      };
    default:
      return state;
  }
}

const MIN_STEPS_TO_COMPLETE = 5;

export default function GuidePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, updateStep } = useProductBrief(id);

  const [state, dispatch] = useReducer(guideReducer, {
    currentStep: 0,
    evaluating: false,
    loadingHint: false,
    showExamples: false,
    showWhyImportant: true,
    showHint: false,
    hintText: '',
    inputValue: '',
    conversationHistory: [],
    showSkipConfirm: false,
    showCompletionWarning: false,
  });

  const step: StepConfig = STEPS[state.currentStep];
  const stepData = brief?.steps[step.key];

  // Sync input when step changes
  useEffect(() => {
    const answer = stepData?.userAnswer || '';
    dispatch({ type: 'RESET_STEP_STATE', inputValue: answer });
  }, [step.key]);

  // Restore conversation history from stepData
  useEffect(() => {
    if (stepData?.aiEvaluation) {
      const existingEval = state.conversationHistory.find(e => e.role === 'evaluation');
      if (!existingEval) {
        dispatch({
          type: 'ADD_EVALUATION',
          entry: {
            id: `eval-${step.key}`,
            role: 'evaluation',
            evaluation: stepData.aiEvaluation,
            quality: stepData.aiQuality,
            followUp: stepData.aiFollowUp,
            timestamp: Date.now(),
          },
        });
      }
    }
  }, [step.key]);

  // Auto-save on input change
  useEffect(() => {
    if (!brief || !id) return;
    const timer = setTimeout(() => {
      if (state.inputValue !== (brief.steps[step.key]?.userAnswer || '')) {
        updateStep(step.key, { userAnswer: state.inputValue });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state.inputValue, step.key, id]);

  const completedSteps = Object.values(brief?.steps || {}).filter(s => s.isCompleted || s.userAnswer?.length > 10).length;

  const handleSubmitAnswer = useCallback(async () => {
    if (!state.inputValue.trim() || !brief || state.evaluating) return;
    dispatch({ type: 'SET_EVALUATING', value: true });
    try {
      const result = await evaluateStep({
        step,
        userAnswer: state.inputValue.trim(),
        rawIdea: brief.rawIdea,
        allSteps: brief.steps,
      });
      updateStep(step.key, {
        userAnswer: state.inputValue.trim(),
        aiEvaluation: result.evaluation,
        aiQuality: result.quality,
        aiFollowUp: result.followUp,
        isCompleted: result.quality === 'specific',
      });
      dispatch({
        type: 'ADD_EVALUATION',
        entry: {
          id: `eval-${Date.now()}`,
          role: 'evaluation',
          evaluation: result.evaluation,
          quality: result.quality,
          followUp: result.followUp,
          timestamp: Date.now(),
        },
      });
    } finally {
      dispatch({ type: 'SET_EVALUATING', value: false });
    }
  }, [state.inputValue, brief, step, state.evaluating, updateStep]);

  const handleAskFollowUp = useCallback(async () => {
    if (!brief || state.evaluating) return;
    dispatch({ type: 'SET_EVALUATING', value: true });
    try {
      const lastEval = [...state.conversationHistory].reverse().find(e => e.role === 'evaluation');
      const followUpText = await askFollowUp({
        step,
        userAnswer: state.inputValue.trim(),
        rawIdea: brief.rawIdea,
        allSteps: brief.steps,
        previousEvaluation: lastEval?.evaluation,
      });
      dispatch({
        type: 'ADD_FOLLOWUP',
        entry: {
          id: `followup-${Date.now()}`,
          role: 'followup',
          followUp: followUpText,
          timestamp: Date.now(),
        },
      });
    } finally {
      dispatch({ type: 'SET_EVALUATING', value: false });
    }
  }, [brief, step, state.inputValue, state.conversationHistory, state.evaluating]);

  const handleShowHint = useCallback(async () => {
    if (state.showHint) {
      dispatch({ type: 'TOGGLE_HINT' });
      return;
    }
    dispatch({ type: 'SET_LOADING_HINT', value: true });
    dispatch({ type: 'TOGGLE_HINT' });
    try {
      const hint = await getStepHint(step);
      dispatch({ type: 'SET_HINT', text: hint });
    } finally {
      dispatch({ type: 'SET_LOADING_HINT', value: false });
    }
  }, [state.showHint, step]);

  const handleNext = useCallback(() => {
    if (state.currentStep < STEPS.length - 1) {
      dispatch({ type: 'SET_STEP', step: state.currentStep + 1 });
    } else {
      if (completedSteps < MIN_STEPS_TO_COMPLETE) {
        dispatch({ type: 'SET_COMPLETION_WARNING', value: true });
        return;
      }
      navigate(`/preview/${id}`);
    }
  }, [state.currentStep, completedSteps, navigate, id]);

  const handlePrev = useCallback(() => {
    if (state.currentStep > 0) dispatch({ type: 'SET_STEP', step: state.currentStep - 1 });
  }, [state.currentStep]);

  const handleSkip = useCallback(() => {
    if (!state.showSkipConfirm) {
      dispatch({ type: 'SET_SKIP_CONFIRM', value: true });
      return;
    }
    if (brief) {
      updateStep(step.key, { isCompleted: true });
    }
    dispatch({ type: 'SET_SKIP_CONFIRM', value: false });
    handleNext();
  }, [state.showSkipConfirm, brief, step.key, updateStep, handleNext]);

  if (loading || !brief) {
    return (
      <div className="vp-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Loader2 size={24} className="vp-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  const progress = ((state.currentStep + 1) / STEPS.length) * 100;
  const isLastStep = state.currentStep === STEPS.length - 1;
  const hasFeedback = state.conversationHistory.length > 0;
  const qualityClass = { specific: 'vp-quality-specific', ok: 'vp-quality-ok', vague: 'vp-quality-vague' };
  const qualityLabel = { specific: '具体清晰', ok: '可以更好', vague: '太模糊' };
  const qualityIcon = { specific: <CheckCircle2 size={14} />, ok: <AlertTriangle size={14} />, vague: <AlertTriangle size={14} /> };

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="vp-header">
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '4px 6px' }} title="返回主页">
              <Home size={16} />
            </button>
            <Brain size={16} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--color-surface)', overflow: 'hidden' }}>
              <div
                className="vp-progress-fill"
                style={{ height: '100%', width: `${progress}%`, background: 'var(--color-primary)', borderRadius: 2, transition: 'width 0.3s ease' }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)', flexShrink: 0 }}>
              {state.currentStep + 1} / {STEPS.length}
            </span>
          </div>
        </div>
      </header>

      {/* Step Navigation */}
      <nav style={{ padding: '0.75rem 2rem', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', gap: 4, overflowX: 'auto' }}>
          {STEPS.map((s, i) => {
            const data = brief.steps[s.key];
            const isActive = i === state.currentStep;
            const isDone = data?.isCompleted;
            return (
              <button
                key={s.key}
                onClick={() => dispatch({ type: 'SET_STEP', step: i })}
                className={`vp-step-btn ${isActive ? 'vp-step-btn-active' : ''} ${isDone && !isActive ? 'vp-step-btn-done' : ''}`}
              >
                {isDone && !isActive ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                {s.title}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {/* Step Title */}
          <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
            Step {state.currentStep + 1}: {step.title}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>
            {step.question}
          </p>

          {/* Why Important */}
          <div className="vp-collapse" style={{ marginBottom: 20 }}>
            <button className="vp-collapse-trigger" onClick={() => dispatch({ type: 'TOGGLE_WHY_IMPORTANT' })}>
              <span>📌 为什么这步重要？</span>
              {state.showWhyImportant ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {state.showWhyImportant && (
              <div className="vp-collapse-content" style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                {step.whyImportant}
              </div>
            )}
          </div>

          {/* Hint */}
          {!state.showHint && !hasFeedback && (
            <div style={{ marginBottom: 16 }}>
              <button className="vp-help-btn" onClick={handleShowHint} disabled={state.loadingHint}>
                <Lightbulb size={14} />
                {state.loadingHint ? '正在思考提示…' : '我不知道怎么写'}
              </button>
            </div>
          )}

          {state.showHint && (
            <div style={{ padding: 14, borderRadius: 10, background: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Lightbulb size={14} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-primary)' }}>思考方向提示</span>
              </div>
              {state.loadingHint ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={14} className="vp-spin" style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>正在生成提示…</span>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.7 }}>{state.hintText}</p>
              )}
              <button className="vp-btn-text" onClick={() => dispatch({ type: 'TOGGLE_HINT' })} style={{ marginTop: 8, fontSize: 12, padding: '4px 8px' }}>
                收起提示
              </button>
            </div>
          )}

          {/* User Input */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--color-text)' }}>
              你的答案：
            </label>
            <textarea
              className="vp-textarea"
              value={state.inputValue}
              onChange={(e) => dispatch({ type: 'SET_INPUT', value: e.target.value })}
              placeholder={step.placeholder}
              rows={5}
              disabled={state.evaluating}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !state.evaluating) {
                  handleSubmitAnswer();
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
                {state.inputValue.length > 0 && `${state.inputValue.length} 字`}
                {state.inputValue.length > 0 && ' · '}
                Ctrl+Enter 提交
              </span>
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleSubmitAnswer}
                disabled={!state.inputValue.trim() || state.evaluating}
              >
                {state.evaluating ? (
                  <><Loader2 size={14} className="vp-spin" /> AI 正在评价…</>
                ) : (
                  <>提交我的答案 <Send size={14} /></>
                )}
              </button>
            </div>
          </div>

          {/* Conversation History (multi-turn) */}
          {state.conversationHistory.map((entry) => (
            <div key={entry.id} style={{ marginBottom: 16 }}>
              {entry.role === 'evaluation' && (
                <div style={{
                  borderRadius: 10, border: '1px solid',
                  borderColor: entry.quality === 'specific'
                    ? 'rgba(29,158,117,0.25)' : entry.quality === 'ok'
                      ? 'rgba(186,117,23,0.25)' : 'rgba(226,75,74,0.25)',
                  background: entry.quality === 'specific'
                    ? 'rgba(29,158,117,0.05)' : entry.quality === 'ok'
                      ? 'rgba(186,117,23,0.05)' : 'rgba(226,75,74,0.05)',
                  padding: 16,
                }}>
                  <div className={`vp-quality-badge ${qualityClass[entry.quality!]}`} style={{ marginBottom: 12 }}>
                    {qualityIcon[entry.quality!]}
                    答案质量：{qualityLabel[entry.quality!]}
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12, color: 'var(--color-text)' }}>
                    {entry.evaluation}
                  </p>
                  {entry.followUp && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-primary)', marginBottom: 4, display: 'block' }}>
                        🔍 AI 追问：
                      </span>
                      <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>{entry.followUp}</p>
                    </div>
                  )}
                  {entry.quality !== 'specific' && (
                    <button
                      className="vp-btn vp-btn-ghost"
                      onClick={handleSubmitAnswer}
                      disabled={state.evaluating || !state.inputValue.trim()}
                      style={{ fontSize: 12 }}
                    >
                      我已修改，重新评价
                    </button>
                  )}
                </div>
              )}

              {entry.role === 'followup' && (
                <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <MessageSquarePlus size={14} style={{ color: 'var(--color-primary)' }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-primary)' }}>深入追问</span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>{entry.followUp}</p>
                </div>
              )}

              {entry.role === 'user-edit' && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(88,166,255,0.06)', border: '1px solid rgba(88,166,255,0.2)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  <span style={{ fontWeight: 500, color: 'var(--color-info)' }}>📝 你修改了答案并重新提交</span>
                </div>
              )}
            </div>
          ))}

          {/* Ask Follow-up button */}
          {hasFeedback && !state.evaluating && (
            <div style={{ marginBottom: 20 }}>
              <button
                className="vp-btn vp-btn-ghost"
                onClick={handleAskFollowUp}
                style={{ fontSize: 13 }}
              >
                <MessageSquarePlus size={14} />
                继续追问 AI
              </button>
            </div>
          )}

          {/* Good/Bad Examples */}
          <div className="vp-collapse" style={{ marginBottom: 24 }}>
            <button className="vp-collapse-trigger" onClick={() => dispatch({ type: 'TOGGLE_EXAMPLES' })}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HelpCircle size={14} style={{ color: 'var(--color-text-hint)' }} />
                好答案 vs 坏答案示例
              </span>
              {state.showExamples ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {state.showExamples && (
              <div className="vp-collapse-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="vp-example-bad">
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-danger)', marginBottom: 4 }}>❌ 坏答案</p>
                  <p style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 4 }}>{step.badExample}</p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{step.badExampleReason}</p>
                </div>
                <div className="vp-example-good">
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-success)', marginBottom: 4 }}>✅ 好答案</p>
                  <p style={{ fontSize: 13, color: 'var(--color-text)' }}>{step.goodExample}</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <button className="vp-btn vp-btn-ghost" onClick={handlePrev} disabled={state.currentStep === 0}>
              <ChevronLeft size={16} />
              上一步
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              {!isLastStep && (
                <>
                  <button className="vp-btn vp-btn-danger-text" onClick={handleSkip}>
                    跳过这步
                  </button>
                </>
              )}
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleNext}
                style={{ opacity: stepData?.isCompleted ? 1 : 0.6 }}
              >
                {isLastStep ? '预览 Product Brief' : '继续下一步'}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Skip Confirm Dialog */}
      {state.showSkipConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-background)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500 }}>确认跳过？</h3>
              <button className="vp-btn-text" onClick={() => dispatch({ type: 'SET_SKIP_CONFIRM', value: false })}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              跳过后这一步会留空，可能会影响最终生成的 Development Prompt 质量。确定要跳过吗？
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="vp-btn vp-btn-ghost" onClick={() => dispatch({ type: 'SET_SKIP_CONFIRM', value: false })}>
                取消
              </button>
              <button className="vp-btn vp-btn-primary" onClick={handleSkip}>
                确认跳过
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Warning Dialog */}
      {state.showCompletionWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--color-background)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500 }}>完成度不足</h3>
              <button className="vp-btn-text" onClick={() => dispatch({ type: 'SET_COMPLETION_WARNING', value: false })}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
              你目前只完成了 <strong>{completedSteps}</strong> / {STEPS.length} 个步骤（建议至少完成 {MIN_STEPS_TO_COMPLETE} 个）。生成的 Development Prompt 可能不够完善。
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="vp-btn vp-btn-ghost" onClick={() => dispatch({ type: 'SET_COMPLETION_WARNING', value: false })}>
                返回补充
              </button>
              <button
                className="vp-btn vp-btn-primary"
                onClick={() => {
                  dispatch({ type: 'SET_COMPLETION_WARNING', value: false });
                  navigate(`/preview/${id}`);
                }}
              >
                仍然预览
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
