import { useState, useEffect, useCallback } from 'react';
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
  Lightbulb,
} from 'lucide-react';
import { useProductBrief } from '../hooks/useProductBrief';
import { STEPS } from '../data/steps';
import { evaluateStep, getStepHint } from '../api/evaluate';
import type { StepConfig } from '../data/steps';

export default function GuidePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, updateStep } = useProductBrief(id);
  const [currentStep, setCurrentStep] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showWhyImportant, setShowWhyImportant] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hintText, setHintText] = useState('');
  const [loadingHint, setLoadingHint] = useState(false);

  const step: StepConfig = STEPS[currentStep];
  const stepData = brief?.steps[step.key];

  useEffect(() => {
    if (stepData) {
      setInputValue(stepData.userAnswer);
    }
    setShowExamples(false);
    setShowHint(false);
    setHintText('');
  }, [step.key]);

  // Auto-save on input change
  useEffect(() => {
    if (!brief || !id) return;
    const timer = setTimeout(() => {
      if (inputValue !== (brief.steps[step.key]?.userAnswer || '')) {
        updateStep(step.key, { userAnswer: inputValue });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue, step.key, id]);

  const handleSubmitAnswer = useCallback(async () => {
    if (!inputValue.trim() || !brief || evaluating) return;
    setEvaluating(true);
    try {
      const result = await evaluateStep({
        step,
        userAnswer: inputValue.trim(),
        rawIdea: brief.rawIdea,
        allSteps: brief.steps,
      });
      updateStep(step.key, {
        userAnswer: inputValue.trim(),
        aiEvaluation: result.evaluation,
        aiQuality: result.quality,
        aiFollowUp: result.followUp,
        isCompleted: result.quality === 'specific',
      });
    } finally {
      setEvaluating(false);
    }
  }, [inputValue, brief, step, evaluating, updateStep]);

  const handleShowHint = async () => {
    if (showHint) {
      setShowHint(false);
      return;
    }
    setLoadingHint(true);
    setShowHint(true);
    try {
      const hint = await getStepHint(step, brief?.rawIdea || '');
      setHintText(hint);
    } finally {
      setLoadingHint(false);
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      navigate(`/preview/${id}`);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => {
    if (brief) {
      updateStep(step.key, { isCompleted: true });
    }
    handleNext();
  };

  if (loading || !brief) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Loader2 size={24} className="vp-spin" style={{ color: 'var(--color-primary)' }} />
      </div>
    );
  }

  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const isLastStep = currentStep === STEPS.length - 1;
  const hasFeedback = stepData && stepData.aiEvaluation;
  const qualityClass = {
    specific: 'vp-quality-specific',
    ok: 'vp-quality-ok',
    vague: 'vp-quality-vague',
  };
  const qualityLabel = {
    specific: '具体清晰',
    ok: '可以更好',
    vague: '太模糊',
  };
  const qualityIcon = {
    specific: <CheckCircle2 size={14} />,
    ok: <AlertTriangle size={14} />,
    vague: <AlertTriangle size={14} />,
  };

  return (
    <div className="vp-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="vp-header">
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Brain size={16} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>VibePilot</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: 'var(--color-surface)',
                overflow: 'hidden',
              }}
            >
              <div
                className="vp-progress-fill"
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--color-primary)',
                  borderRadius: 2,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: 'var(--color-text-hint)', flexShrink: 0 }}>
              {currentStep + 1} / {STEPS.length}
            </span>
          </div>
        </div>
      </header>

      {/* Step Navigation */}
      <nav
        style={{
          padding: '0.75rem 2rem',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}
      >
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
          }}
        >
          {STEPS.map((s, i) => {
            const data = brief.steps[s.key];
            const isActive = i === currentStep;
            const isDone = data?.isCompleted;
            return (
              <button
                key={s.key}
                onClick={() => setCurrentStep(i)}
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
            Step {currentStep + 1}: {step.title}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>
            {step.question}
          </p>

          {/* Why Important */}
          <div className="vp-collapse" style={{ marginBottom: 20 }}>
            <button
              className="vp-collapse-trigger"
              onClick={() => setShowWhyImportant(!showWhyImportant)}
            >
              <span>📌 为什么这步重要？</span>
              {showWhyImportant ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {showWhyImportant && (
              <div className="vp-collapse-content" style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
                {step.whyImportant}
              </div>
            )}
          </div>

          {/* Hint - "I don't know how to write" */}
          {!showHint && !hasFeedback && (
            <div style={{ marginBottom: 16 }}>
              <button className="vp-help-btn" onClick={handleShowHint} disabled={loadingHint}>
                <Lightbulb size={14} />
                {loadingHint ? '正在思考提示…' : '我不知道怎么写'}
              </button>
            </div>
          )}

          {showHint && (
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                background: 'var(--color-primary-light)',
                border: '1px solid var(--color-primary)',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Lightbulb size={14} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-primary)' }}>思考方向提示</span>
              </div>
              {loadingHint ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Loader2 size={14} className="vp-spin" style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>正在生成提示…</span>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.7 }}>
                  {hintText}
                </p>
              )}
              <button
                className="vp-btn-text"
                onClick={() => setShowHint(false)}
                style={{ marginTop: 8, fontSize: 12, padding: '4px 8px' }}
              >
                收起提示
              </button>
            </div>
          )}

          {/* User Input */}
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 500,
                marginBottom: 8,
                color: 'var(--color-text)',
              }}
            >
              你的答案：
            </label>
            <textarea
              className="vp-textarea"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={step.placeholder}
              rows={5}
              disabled={evaluating}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !evaluating) {
                  handleSubmitAnswer();
                }
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
                {inputValue.length > 0 && `${inputValue.length} 字`}
                {inputValue.length > 0 && ' · '}
                Ctrl+Enter 提交
              </span>
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleSubmitAnswer}
                disabled={!inputValue.trim() || evaluating}
              >
                {evaluating ? (
                  <>
                    <Loader2 size={14} className="vp-spin" />
                    AI 正在评价…
                  </>
                ) : (
                  <>
                    提交我的答案
                    <Send size={14} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Feedback */}
          {hasFeedback && (
            <div
              style={{
                borderRadius: 10,
                border: '1px solid',
                borderColor: stepData.aiQuality === 'specific'
                  ? 'rgba(29,158,117,0.25)'
                  : stepData.aiQuality === 'ok'
                    ? 'rgba(186,117,23,0.25)'
                    : 'rgba(226,75,74,0.25)',
                background: stepData.aiQuality === 'specific'
                  ? 'rgba(29,158,117,0.05)'
                  : stepData.aiQuality === 'ok'
                    ? 'rgba(186,117,23,0.05)'
                    : 'rgba(226,75,74,0.05)',
                padding: 16,
                marginBottom: 20,
              }}
            >
              {/* Quality Badge */}
              <div className={`vp-quality-badge ${qualityClass[stepData.aiQuality]}`} style={{ marginBottom: 12 }}>
                {qualityIcon[stepData.aiQuality]}
                答案质量：{qualityLabel[stepData.aiQuality]}
              </div>

              {/* Evaluation */}
              <p style={{ fontSize: 14, lineHeight: 1.7, marginBottom: 12, color: 'var(--color-text)' }}>
                {stepData.aiEvaluation}
              </p>

              {/* Follow-up */}
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-primary)', marginBottom: 4, display: 'block' }}>
                  🔍 AI 追问：
                </span>
                <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.6 }}>
                  {stepData.aiFollowUp}
                </p>
              </div>

              {stepData.aiQuality !== 'specific' && (
                <button
                  className="vp-btn vp-btn-ghost"
                  onClick={handleSubmitAnswer}
                  disabled={evaluating || !inputValue.trim()}
                  style={{ fontSize: 12 }}
                >
                  我已修改，重新评价
                </button>
              )}
            </div>
          )}

          {/* Good/Bad Examples */}
          <div className="vp-collapse" style={{ marginBottom: 24 }}>
            <button
              className="vp-collapse-trigger"
              onClick={() => setShowExamples(!showExamples)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HelpCircle size={14} style={{ color: 'var(--color-text-hint)' }} />
                好答案 vs 坏答案示例
              </span>
              {showExamples ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {showExamples && (
              <div className="vp-collapse-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="vp-example-bad">
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-danger)', marginBottom: 4 }}>
                    ❌ 坏答案
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--color-text)', marginBottom: 4 }}>
                    {step.badExample}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {step.badExampleReason}
                  </p>
                </div>
                <div className="vp-example-good">
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-success)', marginBottom: 4 }}>
                    ✅ 好答案
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--color-text)' }}>
                    {step.goodExample}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 16,
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button
              className="vp-btn vp-btn-ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              <ChevronLeft size={16} />
              上一步
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              {!isLastStep && (
                <button className="vp-btn vp-btn-danger-text" onClick={handleSkip}>
                  跳过这步
                </button>
              )}
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleNext}
                style={{
                  opacity: stepData?.isCompleted ? 1 : 0.6,
                }}
              >
                {isLastStep ? '预览 Product Brief' : '继续下一步'}
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
