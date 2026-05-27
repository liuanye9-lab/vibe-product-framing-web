/**
 * Agent Workspace Page — V2.1
 *
 * Key changes:
 * - Single sendAgentMessage helper replaces 4 duplicate handlers
 * - No duplicate reply pending bubble (workflow.messages is the source of truth)
 * - Questions from result.questions (structured), not text parsing
 * - Cross-links: legacy flow, handoff, history in header + sidebar
 * - getPhaseLabel from shared phaseUtils
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bot,
  Check,
  ChevronRight,
  Home,
  History,
  Layout,
  Loader2,
  MessageSquare,
  Send,
  SkipForward,
  User,
  X,
  FileText,
} from 'lucide-react';
import { useProductBrief } from '../hooks/useProductBrief';
import { getAgentWorkflow, acceptFinding, rejectFinding } from '../agent/workflowStore';
import { runAgentTurn, sendWelcomeMessage } from '../agent/runAgent';
import { buildLocalHandoff, optimizeHandoff } from '../api/evaluate';
import { getPhaseLabel, getNextPhase } from '../agent/phaseUtils';
import type { AgentWorkflowState, AgentMessage, AgentFinding, AgentDecisionStatus } from '../agent/types';

const DECISION_STATUS_LABELS: Record<AgentDecisionStatus, { label: string; color: string }> = {
  need_more_info: { label: '需要更多信息', color: 'var(--color-warning)' },
  ready_to_decide: { label: '可以决策', color: 'var(--color-success)' },
  risk_detected: { label: '发现风险', color: 'var(--color-danger)' },
  can_move_next: { label: '可以推进', color: 'var(--color-success)' },
  blocked: { label: '阻塞', color: 'var(--color-danger)' },
};

const AGENT_LABELS: Record<string, string> = {
  orchestrator: '编排 Agent',
  demand: '需求 Agent',
  product: '产品 Agent',
  mvp: 'MVP Agent',
  tech: '技术 Agent',
  risk: '风险 Agent',
  handoff: '交付 Agent',
};

export default function AgentWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, save, saveFinalHandoff } = useProductBrief(id);
  const [workflow, setWorkflow] = useState<AgentWorkflowState | null>(null);
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [generatingHandoff, setGeneratingHandoff] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize workflow
  useEffect(() => {
    if (!id || !brief) return;
    const wf = getAgentWorkflow(id);
    if (wf && wf.messages.length > 0) {
      setWorkflow(wf);
    } else {
      const newWf = sendWelcomeMessage(brief);
      setWorkflow(newWf);
    }
  }, [id, brief]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [workflow?.messages]);

  // Unified send helper
  const sendAgentMessage = useCallback(async (message: string) => {
    if (!brief || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await runAgentTurn({ brief, userMessage: message });
      setWorkflow(result.workflow);
      setQuestions(result.questions);

      if (result.briefPatch && Object.keys(result.briefPatch).length > 0) {
        save({ ...brief, ...result.briefPatch });
      }
    } catch (e) {
      setError('处理消息时出错，请重试。');
      console.error('[AgentWorkspace] sendAgentMessage error:', e);
    } finally {
      setSending(false);
    }
  }, [brief, sending, save]);

  const handleSend = useCallback(() => {
    const msg = userInput.trim();
    if (!msg) return;
    setUserInput('');
    sendAgentMessage(msg);
  }, [userInput, sendAgentMessage]);

  const handleSkip = useCallback(() => sendAgentMessage('先跳过'), [sendAgentMessage]);
  const handleContinue = useCallback(() => sendAgentMessage('继续下一步'), [sendAgentMessage]);
  const handleMakeAssumption = useCallback(() => sendAgentMessage('帮我做默认假设'), [sendAgentMessage]);

  const handleQuickReply = useCallback((question: string) => {
    setUserInput(`我回答这个问题：${question}`);
  }, []);

  const handleGenerateHandoff = useCallback(async () => {
    if (!brief) return;
    setGeneratingHandoff(true);
    try {
      let handoff;
      try { handoff = await optimizeHandoff(brief); } catch { handoff = buildLocalHandoff(brief); }
      if (handoff) { saveFinalHandoff(handoff); navigate(`/handoff/${brief.id}`); }
    } catch { /* fallback */ } finally { setGeneratingHandoff(false); }
  }, [brief, saveFinalHandoff, navigate]);

  const handleAcceptFinding = useCallback((findingId: string) => {
    if (!id) return;
    setWorkflow(acceptFinding(id, findingId));
  }, [id]);

  const handleRejectFinding = useCallback((findingId: string) => {
    if (!id) return;
    setWorkflow(rejectFinding(id, findingId));
  }, [id]);

  if (loading) {
    return (
      <div className="vp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <Loader2 size={24} className="vp-spin" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="vp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="vp-card" style={{ textAlign: 'center', maxWidth: 400 }}>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>未找到项目</p>
          <button className="vp-btn vp-btn-primary" onClick={() => navigate('/')} style={{ marginTop: 12 }}>返回首页</button>
        </div>
      </div>
    );
  }

  const currentPhase = workflow?.currentPhase || 'intake';

  return (
    <div className="vp-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header with cross-links */}
      <header className="vp-header" style={{ flexShrink: 0 }}>
        <div className="vp-header-inner" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="vp-btn vp-btn-ghost" onClick={() => navigate('/')} style={{ padding: '4px 8px' }} title="首页">
            <Home size={16} />
          </button>
          <Bot size={18} />
          <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Agent Workspace
          </h1>
          <span style={{ fontSize: 12, color: 'var(--color-text-hint)', whiteSpace: 'nowrap' }}>
            {getPhaseLabel(currentPhase)}
          </span>
          <button className="vp-btn vp-btn-ghost" onClick={() => navigate(`/discovery/${brief.id}`)} style={{ padding: '4px 8px' }} title="四步流程">
            <Layout size={14} />
          </button>
          <button className="vp-btn vp-btn-ghost" onClick={() => navigate(`/handoff/${brief.id}`)} style={{ padding: '4px 8px' }} title="查看交付">
            <FileText size={14} />
          </button>
          <button className="vp-btn vp-btn-ghost" onClick={() => navigate('/history')} style={{ padding: '4px 8px' }} title="历史记录">
            <History size={14} />
          </button>
        </div>
      </header>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {workflow?.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Questions for last agent message */}
            {!sending && questions.length > 0 && (
              <div style={{ marginTop: 8, marginLeft: 48 }}>
                {questions.map((q, i) => (
                  <button
                    key={i}
                    className="vp-btn vp-btn-ghost"
                    onClick={() => handleQuickReply(q)}
                    style={{ display: 'block', marginBottom: 6, textAlign: 'left', fontSize: 13, padding: '8px 14px' }}
                  >{q}</button>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button className="vp-btn vp-btn-text" onClick={handleSkip} style={{ fontSize: 12 }}>先跳过</button>
                  <button className="vp-btn vp-btn-text" onClick={handleMakeAssumption} style={{ fontSize: 12 }}>帮我做默认假设</button>
                  <button className="vp-btn vp-btn-text" onClick={handleContinue} style={{ fontSize: 12 }}>继续下一步</button>
                </div>
              </div>
            )}

            {sending && (
              <div style={{ padding: '12px 0', paddingLeft: 48, color: 'var(--color-text-hint)', fontSize: 13 }}>
                <Loader2 size={14} className="vp-spin" style={{ display: 'inline-block', marginRight: 6 }} />
                Agent 正在思考...
              </div>
            )}

            {error && (
              <div style={{ padding: '8px 14px', margin: '8px 0', color: 'var(--color-danger)', fontSize: 13, background: 'var(--color-background-danger)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input bar */}
          <div style={{ padding: '12px 20px 20px', borderTop: '0.5px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                className="vp-textarea"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="继续描述你的想法，或直接问：我现在该先做什么？"
                rows={2}
                style={{ flex: 1, resize: 'none' }}
                disabled={sending}
              />
              <button className="vp-btn vp-btn-primary" onClick={handleSend} disabled={!userInput.trim() || sending} style={{ flexShrink: 0 }}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div style={{ width: 280, flexShrink: 0, borderLeft: '0.5px solid var(--color-border)', overflowY: 'auto', padding: '16px', background: 'var(--color-bg)' }}>
          <WorkflowSidebar
            workflow={workflow}
            onAcceptFinding={handleAcceptFinding}
            onRejectFinding={handleRejectFinding}
            onGenerateHandoff={handleGenerateHandoff}
            generatingHandoff={generatingHandoff}
            onSkip={handleSkip}
            onContinue={handleContinue}
            onMakeAssumption={handleMakeAssumption}
            onGoToLegacy={() => navigate(`/discovery/${brief.id}`)}
            onGoToHandoff={() => navigate(`/handoff/${brief.id}`)}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  const phase = message.metadata?.phase;
  const decisionStatus = message.metadata?.decisionStatus;
  const agentRole = message.agentRole;

  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={14} />
        </div>
      )}
      <div style={{ maxWidth: isUser ? '70%' : '80%' }}>
        {!isUser && agentRole && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 11, color: 'var(--color-text-hint)', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>{AGENT_LABELS[agentRole] || agentRole}</span>
            {phase && <span>| {getPhaseLabel(phase)}</span>}
            {decisionStatus && (
              <span style={{ color: DECISION_STATUS_LABELS[decisionStatus]?.color }}>
                | {DECISION_STATUS_LABELS[decisionStatus]?.label}
              </span>
            )}
          </div>
        )}
        <div className={isUser ? 'vp-card' : ''} style={{ padding: isUser ? '10px 14px' : '0', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {String(message.content)}
        </div>
      </div>
      {isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={14} />
        </div>
      )}
    </div>
  );
}

function WorkflowSidebar({
  workflow,
  onAcceptFinding,
  onRejectFinding,
  onGenerateHandoff,
  generatingHandoff,
  onSkip,
  onContinue,
  onMakeAssumption,
  onGoToLegacy,
  onGoToHandoff,
}: {
  workflow: AgentWorkflowState | null;
  onAcceptFinding: (id: string) => void;
  onRejectFinding: (id: string) => void;
  onGenerateHandoff: () => void;
  generatingHandoff: boolean;
  onSkip: () => void;
  onContinue: () => void;
  onMakeAssumption: () => void;
  onGoToLegacy: () => void;
  onGoToHandoff: () => void;
}) {
  const currentPhase = workflow?.currentPhase || 'intake';
  const nextPhase = getNextPhase(currentPhase);
  const isComplete = currentPhase === 'complete';
  const acceptedIds = workflow?.acceptedFindings || [];
  const rejectedIds = workflow?.rejectedFindings || [];

  const lastFinding = workflow?.findings?.length ? workflow.findings[workflow.findings.length - 1] : null;

  return (
    <div style={{ fontSize: 13 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bot size={14} /> 工作流状态
      </h3>

      {/* Phase */}
      <div className="vp-card" style={{ marginBottom: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 2 }}>当前阶段</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{getPhaseLabel(currentPhase)}</p>
          </div>
          {!isComplete && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 10, color: 'var(--color-text-hint)', marginBottom: 2 }}>下一阶段</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{getPhaseLabel(nextPhase)}</p>
            </div>
          )}
        </div>
        {isComplete && (
          <p style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 4, fontWeight: 500 }}>
            已完成，可以查看 Developer Handoff
          </p>
        )}
      </div>

      {/* Actions */}
      {!isComplete && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
          <button className="vp-btn vp-btn-primary" onClick={onContinue} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
            <ChevronRight size={14} /> 继续下一步
          </button>
          <button className="vp-btn vp-btn-ghost" onClick={onSkip} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
            <SkipForward size={14} /> 先跳过
          </button>
          <button className="vp-btn vp-btn-ghost" onClick={onMakeAssumption} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
            <MessageSquare size={14} /> 帮我做默认假设
          </button>
        </div>
      )}

      <button
        className="vp-btn vp-btn-primary"
        onClick={onGenerateHandoff}
        disabled={generatingHandoff}
        style={{ fontSize: 12, justifyContent: 'flex-start', marginBottom: 8 }}
      >
        {generatingHandoff ? <Loader2 size={14} className="vp-spin" /> : <FileText size={14} />}
        生成 Developer Handoff
      </button>
      <button
        className="vp-btn vp-btn-ghost"
        onClick={onGoToLegacy}
        style={{ fontSize: 12, justifyContent: 'flex-start', marginBottom: 3 }}
      >
        <Layout size={14} /> 回到四步流程
      </button>
      <button
        className="vp-btn vp-btn-ghost"
        onClick={onGoToHandoff}
        style={{ fontSize: 12, justifyContent: 'flex-start', marginBottom: 12 }}
      >
        <FileText size={14} /> 查看交付
      </button>

      {/* Latest finding */}
      {lastFinding && (
        <div className="vp-card" style={{ padding: '10px 14px', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>最近判断</p>
          <p style={{ fontSize: 12, fontWeight: 500 }}>{lastFinding.title}</p>
          <p style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{lastFinding.summary}</p>
        </div>
      )}

      {/* Missing info */}
      {lastFinding?.missingInfo.length ? (
        <div className="vp-card" style={{ padding: '10px 14px', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--color-warning)' }}>缺失信息</p>
          {lastFinding.missingInfo.map((m, i) => (
            <p key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '1px 0' }}>· {m}</p>
          ))}
        </div>
      ) : null}

      {/* Risks */}
      {lastFinding?.risks.length ? (
        <div className="vp-card" style={{ padding: '10px 14px', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--color-danger)' }}>风险</p>
          {lastFinding.risks.map((r, i) => (
            <p key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '1px 0' }}>· {r}</p>
          ))}
        </div>
      ) : null}

      {/* Suggestions */}
      {lastFinding?.suggestions.length ? (
        <div className="vp-card" style={{ padding: '10px 14px', marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--color-success)' }}>建议</p>
          {lastFinding.suggestions.map((s, i) => (
            <p key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '1px 0' }}>· {s}</p>
          ))}
        </div>
      ) : null}

      {/* All findings */}
      {workflow && workflow.findings.length > 0 && (
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>
            所有判断 ({workflow.findings.length})
          </h4>
          {workflow.findings.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              accepted={acceptedIds.includes(f.id)}
              rejected={rejectedIds.includes(f.id)}
              onAccept={() => onAcceptFinding(f.id)}
              onReject={() => onRejectFinding(f.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingCard({
  finding, accepted, rejected, onAccept, onReject,
}: {
  finding: AgentFinding;
  accepted: boolean;
  rejected: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="vp-card" style={{ marginBottom: 6, padding: '8px 12px', borderColor: accepted ? 'var(--color-success)' : rejected ? 'var(--color-danger)' : undefined }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: 'var(--color-surface)', color: 'var(--color-text-hint)' }}>
          {AGENT_LABELS[finding.agentRole] || finding.agentRole}
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 8, color: DECISION_STATUS_LABELS[finding.decisionStatus]?.color, background: DECISION_STATUS_LABELS[finding.decisionStatus]?.color ? `${DECISION_STATUS_LABELS[finding.decisionStatus].color}20` : undefined }}>
          {DECISION_STATUS_LABELS[finding.decisionStatus]?.label}
        </span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{finding.title}</p>
      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{finding.summary}</p>
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        {!accepted && !rejected && (
          <>
            <button className="vp-btn vp-btn-text" onClick={onAccept} style={{ fontSize: 11, color: 'var(--color-success)', padding: '2px 6px' }}>
              <Check size={12} /> 接受
            </button>
            <button className="vp-btn vp-btn-text" onClick={onReject} style={{ fontSize: 11, color: 'var(--color-danger)', padding: '2px 6px' }}>
              <X size={12} /> 拒绝
            </button>
          </>
        )}
        {accepted && <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 500 }}>✓ 已接受</span>}
        {rejected && <span style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 500 }}>✗ 已拒绝</span>}
      </div>
    </div>
  );
}
