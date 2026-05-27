/**
 * Agent Workspace Page — the main interface for the Agentic Workflow.
 *
 * Layout:
 * - Left: Chat area with messages
 * - Right: Workflow State sidebar
 * - Bottom: Input bar
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bot,
  Check,
  ChevronRight,
  Home,
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
import type { AgentWorkflowState, AgentMessage, AgentFinding, WorkflowPhase, AgentDecisionStatus } from '../agent/types';
import type { OrchestratorResult } from '../agent/orchestrator';

const PHASE_LABELS: Record<WorkflowPhase, string> = {
  intake: '收集想法',
  demand: '需求诊断',
  product: '产品定义',
  mvp: 'MVP 范围',
  tech: '技术方案',
  risk: '风险审查',
  handoff: '开发交付',
  complete: '已完成',
};

const DECISION_STATUS_LABELS: Record<AgentDecisionStatus, { label: string; color: string }> = {
  need_more_info: { label: '需要更多信息', color: 'var(--color-warning)' },
  ready_to_decide: { label: '可以决策', color: 'var(--color-success)' },
  risk_detected: { label: '发现风险', color: 'var(--color-danger)' },
  can_move_next: { label: '可以推进', color: 'var(--color-success)' },
  blocked: { label: '阻塞', color: 'var(--color-danger)' },
};

export default function AgentWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, save, saveFinalHandoff } = useProductBrief(id);
  const [workflow, setWorkflow] = useState<AgentWorkflowState | null>(null);
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [orchestrator, setOrchestrator] = useState<OrchestratorResult | null>(null);
  const [generatingHandoff, setGeneratingHandoff] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize workflow on load
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

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [workflow?.messages, reply]);

  const handleSend = useCallback(async () => {
    const msg = userInput.trim();
    if (!msg || !brief || sending) return;

    setSending(true);
    setUserInput('');
    setQuestions([]);

    try {
      const result = await runAgentTurn({ brief, userMessage: msg });
      setWorkflow(result.workflow);
      setReply(result.reply);
      setOrchestrator(result.orchestrator);

      // Extract questions from reply
      const qLines = result.reply.split('\n').filter((l) => l.trim().startsWith('·'));
      setQuestions(qLines.map((l) => l.replace('·', '').trim()));

      // Apply brief patch if any
      if (result.briefPatch) {
        const patched = { ...brief, ...result.briefPatch };
        save(patched as typeof brief);
      }
    } catch {
      setReply('抱歉，处理你的消息时出错了。请重试。');
    } finally {
      setSending(false);
    }
  }, [userInput, brief, sending, save]);

  const handleQuickReply = useCallback((question: string) => {
    setUserInput(`我回答这个问题：${question}`);
  }, []);

  const handleSkip = useCallback(async () => {
    if (!brief || sending) return;
    setSending(true);
    try {
      const result = await runAgentTurn({ brief, userMessage: '先跳过' });
      setWorkflow(result.workflow);
      setReply(result.reply);
      setOrchestrator(result.orchestrator);
      setQuestions([]);
    } catch {
      setReply('抱歉，操作失败。请重试。');
    } finally {
      setSending(false);
    }
  }, [brief, sending]);

  const handleContinue = useCallback(async () => {
    if (!brief || sending) return;
    setSending(true);
    try {
      const result = await runAgentTurn({ brief, userMessage: '继续下一步' });
      setWorkflow(result.workflow);
      setReply(result.reply);
      setOrchestrator(result.orchestrator);
      setQuestions([]);
    } catch {
      setReply('抱歉，操作失败。请重试。');
    } finally {
      setSending(false);
    }
  }, [brief, sending]);

  const handleMakeAssumption = useCallback(async () => {
    if (!brief || sending) return;
    setSending(true);
    try {
      const result = await runAgentTurn({ brief, userMessage: '帮我做默认假设' });
      setWorkflow(result.workflow);
      setReply(result.reply);
      setOrchestrator(result.orchestrator);
      setQuestions([]);
    } catch {
      setReply('抱歉，操作失败。请重试。');
    } finally {
      setSending(false);
    }
  }, [brief, sending]);

  const handleGenerateHandoff = useCallback(async () => {
    if (!brief) return;
    setGeneratingHandoff(true);
    try {
      let finalHandoff;
      try {
        finalHandoff = await optimizeHandoff(brief);
      } catch {
        finalHandoff = buildLocalHandoff(brief);
      }
      if (finalHandoff) {
        saveFinalHandoff(finalHandoff);
        navigate(`/handoff/${brief.id}`);
      }
    } catch {
      // fallback
    } finally {
      setGeneratingHandoff(false);
    }
  }, [brief, saveFinalHandoff, navigate]);

  const handleAcceptFinding = useCallback((findingId: string) => {
    if (!id) return;
    const wf = acceptFinding(id, findingId);
    setWorkflow(wf);
  }, [id]);

  const handleRejectFinding = useCallback((findingId: string) => {
    if (!id) return;
    const wf = rejectFinding(id, findingId);
    setWorkflow(wf);
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
          <button className="vp-btn vp-btn-primary" onClick={() => navigate('/')} style={{ marginTop: 12 }}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vp-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header className="vp-header" style={{ flexShrink: 0 }}>
        <div className="vp-header-inner" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="vp-btn vp-btn-ghost" onClick={() => navigate('/')} style={{ padding: '4px 8px' }}>
            <Home size={16} />
          </button>
          <Bot size={18} />
          <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1 }}>Agent Workspace</h1>
          <span style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>
            {PHASE_LABELS[workflow?.currentPhase || 'intake']}
          </span>
        </div>
      </header>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {workflow?.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Pending reply */}
            {reply && (
              <MessageBubble
                message={{
                  id: 'pending',
                  role: 'agent',
                  content: reply,
                  createdAt: new Date().toISOString(),
                  agentRole: orchestrator?.nextAgent,
                  metadata: {
                    phase: orchestrator?.nextPhase,
                    decisionStatus: orchestrator?.decisionStatus,
                  },
                }}
              />
            )}

            {/* Questions chips */}
            {!sending && questions.length > 0 && (
              <div style={{ marginTop: 12, marginLeft: 48 }}>
                {questions.map((q, i) => (
                  <button
                    key={i}
                    className="vp-btn vp-btn-ghost"
                    onClick={() => handleQuickReply(q)}
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      textAlign: 'left',
                      fontSize: 13,
                      padding: '8px 14px',
                    }}
                  >
                    {q}
                  </button>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="vp-btn vp-btn-text" onClick={handleSkip} style={{ fontSize: 12 }}>
                    先跳过
                  </button>
                  <button className="vp-btn vp-btn-text" onClick={handleMakeAssumption} style={{ fontSize: 12 }}>
                    帮我做默认假设
                  </button>
                  <button className="vp-btn vp-btn-text" onClick={handleContinue} style={{ fontSize: 12 }}>
                    继续下一步
                  </button>
                </div>
              </div>
            )}

            {/* Sending indicator */}
            {sending && (
              <div style={{ padding: '12px 0', paddingLeft: 48, color: 'var(--color-text-hint)', fontSize: 13 }}>
                <Loader2 size={14} className="vp-spin" style={{ display: 'inline-block', marginRight: 6 }} />
                Agent 正在思考...
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
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="继续描述你的想法，或直接问：我现在该先做什么？"
                rows={2}
                style={{ flex: 1, resize: 'none' }}
                disabled={sending}
              />
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleSend}
                disabled={!userInput.trim() || sending}
                style={{ flexShrink: 0 }}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Workflow State */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderLeft: '0.5px solid var(--color-border)',
            overflowY: 'auto',
            padding: '16px',
            background: 'var(--color-bg)',
          }}
        >
          <WorkflowSidebar
            workflow={workflow}
            onAcceptFinding={handleAcceptFinding}
            onRejectFinding={handleRejectFinding}
            onGenerateHandoff={handleGenerateHandoff}
            generatingHandoff={generatingHandoff}
            onSkip={handleSkip}
            onContinue={handleContinue}
          />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const phase = message.metadata?.phase;
  const decisionStatus = message.metadata?.decisionStatus;
  const agentRole = message.agentRole;

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        marginBottom: 16,
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        opacity: isSystem ? 0.7 : 1,
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--color-surface)',
            border: '0.5px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isSystem ? <MessageSquare size={14} /> : <Bot size={14} />}
        </div>
      )}

      <div style={{ maxWidth: isUser ? '70%' : '80%' }}>
        {/* Meta info for agent messages */}
        {!isUser && agentRole && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 11, color: 'var(--color-text-hint)' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {agentRole === 'orchestrator' ? '编排 Agent' :
                agentRole === 'demand' ? '需求 Agent' :
                  agentRole === 'product' ? '产品 Agent' :
                    agentRole === 'mvp' ? 'MVP Agent' :
                      agentRole === 'tech' ? '技术 Agent' :
                        agentRole === 'risk' ? '风险 Agent' :
                          agentRole === 'handoff' ? '交付 Agent' : agentRole}
            </span>
            {phase && <span>| {PHASE_LABELS[phase]}</span>}
            {decisionStatus && (
              <span style={{ color: DECISION_STATUS_LABELS[decisionStatus]?.color }}>
                | {DECISION_STATUS_LABELS[decisionStatus]?.label}
              </span>
            )}
          </div>
        )}

        <div
          className={isUser ? 'vp-card' : ''}
          style={{
            padding: isUser ? '10px 14px' : '0',
            fontSize: 13,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: isSystem ? 'var(--color-text-hint)' : 'var(--color-text)',
          }}
        >
          {message.content}
        </div>
      </div>

      {isUser && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 14,
          }}
        >
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
}: {
  workflow: AgentWorkflowState | null;
  onAcceptFinding: (id: string) => void;
  onRejectFinding: (id: string) => void;
  onGenerateHandoff: () => void;
  generatingHandoff: boolean;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const currentPhase = workflow?.currentPhase || 'intake';
  const acceptedIds = workflow?.acceptedFindings || [];
  const rejectedIds = workflow?.rejectedFindings || [];

  return (
    <div style={{ fontSize: 13 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bot size={14} />
        工作流状态
      </h3>

      {/* Phase progress */}
      <div className="vp-card" style={{ marginBottom: 12, padding: '10px 14px' }}>
        <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 4 }}>当前阶段</p>
        <p style={{ fontSize: 14, fontWeight: 600 }}>{PHASE_LABELS[currentPhase]}</p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        <button className="vp-btn vp-btn-ghost" onClick={onSkip} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
          <SkipForward size={14} />
          跳过当前追问
        </button>
        <button
          className="vp-btn vp-btn-primary"
          onClick={onContinue}
          style={{ fontSize: 12, justifyContent: 'flex-start' }}
        >
          <ChevronRight size={14} />
          推进到下一阶段
        </button>
        <button
          className="vp-btn vp-btn-primary"
          onClick={onGenerateHandoff}
          disabled={generatingHandoff}
          style={{ fontSize: 12, justifyContent: 'flex-start' }}
        >
          {generatingHandoff ? (
            <Loader2 size={14} className="vp-spin" />
          ) : (
            <FileText size={14} />
          )}
          生成 Developer Handoff
        </button>
      </div>

      {/* Findings */}
      {workflow && workflow.findings.length > 0 && (
        <div>
          <h4 style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--color-text-secondary)' }}>
            Agent 判断 ({workflow.findings.length})
          </h4>
          {workflow.findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              accepted={acceptedIds.includes(finding.id)}
              rejected={rejectedIds.includes(finding.id)}
              onAccept={() => onAcceptFinding(finding.id)}
              onReject={() => onRejectFinding(finding.id)}
            />
          ))}
        </div>
      )}

      {/* Missing info */}
      {workflow?.findings.some((f) => f.missingInfo.length > 0) && (
        <div className="vp-card" style={{ marginTop: 10, padding: '10px 14px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--color-warning)' }}>缺失信息</p>
          {workflow.findings
            .filter((f) => f.missingInfo.length > 0)
            .slice(-1)
            .map((f) =>
              f.missingInfo.map((info, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0' }}>
                  · {info}
                </p>
              )),
            )}
        </div>
      )}

      {/* Risks */}
      {workflow?.findings.some((f) => f.risks.length > 0) && (
        <div className="vp-card" style={{ marginTop: 10, padding: '10px 14px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--color-danger)' }}>风险</p>
          {workflow.findings
            .filter((f) => f.risks.length > 0)
            .slice(-1)
            .map((f) =>
              f.risks.map((risk, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0' }}>
                  · {risk}
                </p>
              )),
            )}
        </div>
      )}
    </div>
  );
}

function FindingCard({
  finding,
  accepted,
  rejected,
  onAccept,
  onReject,
}: {
  finding: AgentFinding;
  accepted: boolean;
  rejected: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div
      className="vp-card"
      style={{
        marginBottom: 8,
        padding: '10px 14px',
        borderColor: accepted ? 'var(--color-success)' : rejected ? 'var(--color-danger)' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: 8,
            background: 'var(--color-surface)',
            color: 'var(--color-text-hint)',
            flexShrink: 0,
          }}
        >
          {finding.agentRole}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            padding: '1px 6px',
            borderRadius: 8,
            background: DECISION_STATUS_LABELS[finding.decisionStatus]?.color ? `${DECISION_STATUS_LABELS[finding.decisionStatus].color}20` : undefined,
            color: DECISION_STATUS_LABELS[finding.decisionStatus]?.color,
            flexShrink: 0,
          }}
        >
          {DECISION_STATUS_LABELS[finding.decisionStatus]?.label}
        </span>
      </div>
      <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{finding.title}</p>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{finding.summary}</p>

      {/* Accept / Reject */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        {!accepted && !rejected && (
          <>
            <button
              className="vp-btn vp-btn-text"
              onClick={onAccept}
              style={{ fontSize: 11, color: 'var(--color-success)', padding: '2px 6px' }}
            >
              <Check size={12} />
              接受
            </button>
            <button
              className="vp-btn vp-btn-text"
              onClick={onReject}
              style={{ fontSize: 11, color: 'var(--color-danger)', padding: '2px 6px' }}
            >
              <X size={12} />
              拒绝
            </button>
          </>
        )}
        {accepted && (
          <span style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 500 }}>
            <Check size={12} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> 已接受
          </span>
        )}
        {rejected && (
          <span style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 500 }}>
            <X size={12} style={{ display: 'inline-block', verticalAlign: 'middle' }} /> 已拒绝
          </span>
        )}
      </div>
    </div>
  );
}
