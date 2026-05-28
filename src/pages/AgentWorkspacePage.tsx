/**
 * Agent Workspace Page — V3.0 Real Agent Workflow System
 *
 * Key changes from V2:
 * - Uses runAgentRuntimeTurn (V3) instead of old runAgentTurn (V2)
 * - AgentSession replaces AgentWorkflowState
 * - Action Cards instead of text-parsed questions
 * - Debug panel for transparency
 * - Control panel with tasks, findings, phase status
 * - Full cross-linking with legacy flow and history
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
  Send,
  SkipForward,
  User,
  FileText,
  Bug,
  ListChecks,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
} from 'lucide-react';
import { useProductBrief } from '../hooks/useProductBrief';
import { getAgentSession } from '../agent-v3/sessionStore';
import { runAgentRuntimeTurn, sendV3WelcomeMessage } from '../agent-v3/runtime';
import { migrateLegacyAgentWorkflowIfNeeded } from '../agent-v3/migrateLegacyAgent';
import { optimizeHandoff } from '../api/evaluate';
import { getAgentPhaseLabel, getNextAgentPhase } from '../agent-v3/phaseMachine';
import type {
  AgentSession,
  AgentMessage,
  AgentFinding,
  AgentActionCard,
  AgentRunStatus,
  DecisionStatus,
} from '../agent-v3/types';

const DECISION_LABELS: Record<DecisionStatus, { label: string; color: string }> = {
  need_more_info: { label: '需要更多信息', color: 'var(--color-warning)' },
  ready: { label: '可以决策', color: 'var(--color-success)' },
  risk_detected: { label: '发现风险', color: 'var(--color-danger)' },
  blocked: { label: '阻塞', color: 'var(--color-danger)' },
  can_continue: { label: '可以推进', color: 'var(--color-success)' },
  completed: { label: '已完成', color: 'var(--color-success)' },
};

const RUN_STATUS_LABELS: Record<AgentRunStatus, { label: string; color: string }> = {
  idle: { label: '空闲', color: 'var(--color-text-hint)' },
  thinking: { label: '思考中', color: 'var(--color-primary)' },
  waiting_user: { label: '等待用户', color: 'var(--color-warning)' },
  running_tools: { label: '执行工具', color: 'var(--color-primary)' },
  blocked: { label: '阻塞', color: 'var(--color-danger)' },
  completed: { label: '已完成', color: 'var(--color-success)' },
  failed: { label: '失败', color: 'var(--color-danger)' },
};

const AGENT_LABELS: Record<string, string> = {
  orchestrator: '编排 Agent',
  intake: '想法收集 Agent',
  demand: '需求 Agent',
  product: '产品 Agent',
  mvp: 'MVP Agent',
  tech: '技术 Agent',
  risk: '风险 Agent',
  handoff: '交付 Agent',
  reviewer: '审查 Agent',
};

function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'string') return v.length > 400 ? v.slice(0, 400) + '...' : v;
  if (Array.isArray(v)) return v.map(String).join(', ').slice(0, 200);
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 400);
  return String(v);
}

export default function AgentWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, save, saveFinalHandoff } = useProductBrief(id);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [generatingHandoff, setGeneratingHandoff] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize session
  useEffect(() => {
    if (!id || !brief) return;
    let sess = getAgentSession(id);
    if (!sess) {
      sess = migrateLegacyAgentWorkflowIfNeeded(id);
    }
    if (!sess || sess.messages.length === 0) {
      sess = sendV3WelcomeMessage(brief);
    }
    setSession(sess);
  }, [id, brief]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  const sendAgentMessage = useCallback(async (message: string) => {
    if (!brief || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await runAgentRuntimeTurn({ brief, userMessage: message });
      setSession(result.session);
      if (result.briefPatch && Object.keys(result.briefPatch).length > 0) {
        save({ ...brief, ...result.briefPatch });
      }
    } catch (e) {
      setError('处理消息时出错，请重试。');
      console.error('[AgentV3] sendAgentMessage error:', e);
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
  const handleGenerateHandoffCmd = useCallback(() => sendAgentMessage('生成开发文档'), [sendAgentMessage]);

  const handleActionClick = useCallback((action: AgentActionCard['actions'][0]) => {
    switch (action.intent) {
      case 'continue': handleContinue(); break;
      case 'skip': handleSkip(); break;
      case 'make_assumption': handleMakeAssumption(); break;
      case 'generate_handoff': handleGenerateHandoffCmd(); break;
      case 'answer':
        setUserInput(action.value ? `关于：${action.value}` : '');
        break;
      default:
        // For other intents, just call with the value
        sendAgentMessage(action.value || action.label);
    }
  }, [handleContinue, handleSkip, handleMakeAssumption, handleGenerateHandoffCmd, sendAgentMessage]);

  const handleGenerateHandoffDirect = useCallback(async () => {
    if (!brief) return;
    setGeneratingHandoff(true);
    try {
      // V4.4: Only AI handoff. No local-rule fallback.
      const handoff = await optimizeHandoff(brief);
      if (handoff) {
        saveFinalHandoff(handoff);
        navigate(`/handoff/${brief.id}`);
      }
    } catch { /* API error already surfaced via evaluate.ts */ } finally { setGeneratingHandoff(false); }
  }, [brief, saveFinalHandoff, navigate]);

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

  const currentPhase = session?.currentPhase || 'intake';

  return (
    <div className="vp-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header className="vp-header" style={{ flexShrink: 0 }}>
        <div className="vp-header-inner" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="vp-btn vp-btn-ghost" onClick={() => navigate('/')} style={{ padding: '4px 8px' }} title="首页">
            <Home size={16} />
          </button>
          <Bot size={18} />
          <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Agent Workspace V3
          </h1>
          <span style={{ fontSize: 11, color: RUN_STATUS_LABELS[session?.runStatus || 'idle']?.color, fontWeight: 500, whiteSpace: 'nowrap' }}>
            {session ? RUN_STATUS_LABELS[session.runStatus]?.label : ''}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-hint)', whiteSpace: 'nowrap' }}>
            {getAgentPhaseLabel(currentPhase)}
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
          <button className="vp-btn vp-btn-text" onClick={() => setShowDebug(!showDebug)} style={{ padding: '4px 8px' }} title="调试面板">
            <Bug size={12} />
          </button>
        </div>
      </header>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {session?.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} onActionClick={handleActionClick} />
            ))}

            {/* Action cards from last agent message */}
            {!sending && session && session.messages && session.messages.length > 0 && (() => {
              const lastAgent = [...session.messages].reverse().find((m) => m.role === 'agent');
              if (lastAgent?.actionCards?.length) {
                return (
                  <div style={{ marginTop: 8, marginLeft: 48 }}>
                    {lastAgent.actionCards.map((card) => (
                      <ActionCardBubble key={card.id} card={card} onActionClick={handleActionClick} />
                    ))}
                  </div>
                );
              }
              return null;
            })()}

            {/* Fallback action cards if no messages */}
            {!sending && (!session?.messages?.length || session?.messages?.length <= 2) && session?.runStatus === 'waiting_user' && (
              <div style={{ marginTop: 8, marginLeft: 48 }}>
                <ActionCardBubble card={{
                  id: 'fallback',
                  type: 'decision',
                  title: '开始你的产品决策',
                  description: '你可以补充想法，或让我基于已有信息推进。',
                  actions: [
                    { id: 'continue', label: '继续下一步', intent: 'continue' },
                    { id: 'skip', label: '先跳过当前阶段', intent: 'skip' },
                    { id: 'assume', label: '帮我做默认假设', intent: 'make_assumption' },
                  ],
                }} onActionClick={handleActionClick} />
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
                placeholder={'继续描述你的想法，或直接说：继续下一步 / 帮我做默认假设 / 生成开发文档'}
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

        {/* Right: Control Panel */}
        <div style={{ width: 300, flexShrink: 0, borderLeft: '0.5px solid var(--color-border)', overflowY: 'auto', padding: '16px', background: 'var(--color-bg)' }}>
          <ControlPanel
            session={session}
            onContinue={handleContinue}
            onSkip={handleSkip}
            onMakeAssumption={handleMakeAssumption}
            onGenerateHandoff={handleGenerateHandoffDirect}
            generatingHandoff={generatingHandoff}
            onGoToLegacy={() => navigate(`/discovery/${brief.id}`)}
            onGoToHandoff={() => navigate(`/handoff/${brief.id}`)}
            showDebug={showDebug}
          />
        </div>
      </div>
    </div>
  );
}

// ---- Message Bubble ----
function MessageBubble({
  message,
  onActionClick,
}: {
  message: AgentMessage;
  onActionClick?: (action: AgentActionCard['actions'][0]) => void;
}) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';
  const agentRole = message.agentRole;

  if (isTool) {
    return (
      <div style={{ marginBottom: 8, marginLeft: 48, fontSize: 11, color: 'var(--color-text-hint)', opacity: 0.7 }}>
        &#9881; {fmtValue(message.content)}
      </div>
    );
  }

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
            <span style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {AGENT_LABELS[agentRole] || agentRole}
            </span>
            {message.phase && <span>| {getAgentPhaseLabel(message.phase)}</span>}
          </div>
        )}
        <div className={isUser ? 'vp-card' : ''} style={{
          padding: isUser ? '10px 14px' : '0',
          fontSize: 13,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {String(message.content)}
        </div>
        {message.questions?.length && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {message.questions.map((q, i) => (
              <button key={i} className="vp-btn vp-btn-ghost"
                onClick={() => onActionClick?.({ id: `q-${i}`, label: q, intent: 'answer', value: q })}
                style={{ fontSize: 11, padding: '4px 10px' }}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={14} />
        </div>
      )}
    </div>
  );
}

// ---- Action Card ----
function ActionCardBubble({
  card,
  onActionClick,
}: {
  card: AgentActionCard;
  onActionClick?: (action: AgentActionCard['actions'][0]) => void;
}) {
  const typeIcons: Record<string, React.ReactNode> = {
    question: <MessageSquare size={14} />,
    decision: <Check size={14} />,
    warning: <AlertTriangle size={14} />,
    next_step: <ChevronRight size={14} />,
    patch_preview: <FileText size={14} />,
    handoff_ready: <FileText size={14} />,
  };
  const typeColors: Record<string, string> = {
    question: 'var(--color-primary)',
    decision: 'var(--color-success)',
    warning: 'var(--color-warning)',
    next_step: 'var(--color-text-secondary)',
    patch_preview: 'var(--color-text-secondary)',
    handoff_ready: 'var(--color-success)',
  };

  return (
    <div className="vp-card" style={{ marginBottom: 10, padding: '12px 16px', borderColor: typeColors[card.type] || 'var(--color-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: typeColors[card.type] || 'var(--color-text-secondary)' }}>
        {typeIcons[card.type] || null}
        <span style={{ fontSize: 13, fontWeight: 600 }}>{card.title}</span>
      </div>
      {card.description && (
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: 8 }}>{card.description}</p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {card.actions.map((action) => (
          <button
            key={action.id}
            className="vp-btn vp-btn-ghost"
            onClick={() => onActionClick?.(action)}
            style={{ fontSize: 11, padding: '5px 12px' }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Control Panel ----
function ControlPanel({
  session,
  onContinue,
  onSkip,
  onMakeAssumption,
  onGenerateHandoff,
  generatingHandoff,
  onGoToLegacy,
  onGoToHandoff,
  showDebug,
}: {
  session: AgentSession | null;
  onContinue: () => void;
  onSkip: () => void;
  onMakeAssumption: () => void;
  onGenerateHandoff: () => void;
  generatingHandoff: boolean;
  onGoToLegacy: () => void;
  onGoToHandoff: () => void;
  showDebug: boolean;
}) {
  const phase = session?.currentPhase || 'intake';
  const nextPhase = getNextAgentPhase(phase);
  const isComplete = phase === 'complete';
  const tasks = session?.tasks || [];
  const findings = session?.findings || [];
  const pendingQuestions = session?.pendingQuestions || [];
  const activeTodos = tasks.filter((t) => t.status !== 'done' && t.status !== 'skipped');

  return (
    <div style={{ fontSize: 13 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Bot size={14} /> Agent 控制面板
      </h3>

      {/* Phase */}
      <div className="vp-card" style={{ marginBottom: 8, padding: '10px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 2 }}>当前阶段</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{getAgentPhaseLabel(phase)}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 10, color: 'var(--color-text-hint)', marginBottom: 2 }}>当前 Agent</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {AGENT_LABELS[session?.activeAgent || ''] || session?.activeAgent || '-'}
            </p>
          </div>
        </div>
        {session?.decisionStatus && (
          <p style={{ fontSize: 11, marginTop: 4, color: DECISION_LABELS[session.decisionStatus]?.color }}>
            {DECISION_LABELS[session.decisionStatus]?.label}
          </p>
        )}
        {!isComplete && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--color-text-hint)' }}>
            下一阶段：{getAgentPhaseLabel(nextPhase)}
          </div>
        )}
        {isComplete && (
          <p style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 4, fontWeight: 500 }}>
            已完成
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
        {!isComplete && (
          <>
            <button className="vp-btn vp-btn-primary" onClick={onContinue} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
              <ChevronRight size={14} /> 继续下一步
            </button>
            <button className="vp-btn vp-btn-ghost" onClick={onSkip} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
              <SkipForward size={14} /> 先跳过
            </button>
            <button className="vp-btn vp-btn-ghost" onClick={onMakeAssumption} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
              <MessageSquare size={14} /> 帮我做默认假设
            </button>
          </>
        )}
        <button className="vp-btn vp-btn-primary" onClick={onGenerateHandoff} disabled={generatingHandoff} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
          {generatingHandoff ? <Loader2 size={14} className="vp-spin" /> : <FileText size={14} />}
          生成 Developer Handoff
        </button>
        <button className="vp-btn vp-btn-ghost" onClick={onGoToLegacy} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
          <Layout size={14} /> 切换到四步流程
        </button>
        <button className="vp-btn vp-btn-ghost" onClick={onGoToHandoff} style={{ fontSize: 12, justifyContent: 'flex-start' }}>
          <FileText size={14} /> 查看交付
        </button>
      </div>

      {/* Pending questions */}
      {pendingQuestions.length > 0 && (
        <div className="vp-card" style={{ padding: '10px 14px', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4, color: 'var(--color-warning)' }}>待回答问题</p>
          {pendingQuestions.map((q, i) => (
            <p key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '1px 0' }}>· {q}</p>
          ))}
        </div>
      )}

      {/* Tasks */}
      {activeTodos.length > 0 && (
        <div className="vp-card" style={{ padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            <ListChecks size={12} />
            <p style={{ fontSize: 11, fontWeight: 600 }}>任务列表 ({activeTodos.length})</p>
          </div>
          {activeTodos.slice(0, 5).map((t) => (
            <p key={t.id} style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0' }}>
              · {t.title} <span style={{ color: t.required ? 'var(--color-danger)' : 'var(--color-text-hint)', fontSize: 10 }}>
                {t.required ? '(必做)' : ''} {t.status}
              </span>
            </p>
          ))}
        </div>
      )}

      {/* Latest Finding */}
      {findings.length > 0 && (() => {
        const last = findings[findings.length - 1];
        return (
          <div className="vp-card" style={{ padding: '10px 14px', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <Lightbulb size={12} />
              <p style={{ fontSize: 11, fontWeight: 600 }}>最新判断</p>
            </div>
            <p style={{ fontSize: 12, fontWeight: 500 }}>{last.title}</p>
            <p style={{ fontSize: 11, color: 'var(--color-text-hint)' }}>{last.summary}</p>
            {last.missingInfo.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 10, color: 'var(--color-warning)' }}>缺失信息:</p>
                {last.missingInfo.slice(0, 3).map((m, i) => (
                  <p key={i} style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>· {m}</p>
                ))}
              </div>
            )}
            {last.risks.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <p style={{ fontSize: 10, color: 'var(--color-danger)' }}>风险:</p>
                {last.risks.slice(0, 3).map((r, i) => (
                  <p key={i} style={{ fontSize: 10, color: 'var(--color-text-hint)' }}>· {r}</p>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* All findings summary */}
      {findings.length > 1 && (
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
            所有判断 ({findings.length})
          </p>
          {findings.slice(-5).reverse().map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}

      {/* Debug Panel */}
      {showDebug && (
        <div className="vp-card" style={{ padding: '10px 14px', marginTop: 8, fontSize: 10, fontFamily: 'monospace', background: 'var(--color-surface)' }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Debug Panel</p>
          <p>sessionId: {session?.id || '-'}</p>
          <p>phase: {phase}</p>
          <p>activeAgent: {session?.activeAgent || '-'}</p>
          <p>runStatus: {session?.runStatus || '-'}</p>
          <p>decisionStatus: {session?.decisionStatus || '-'}</p>
          <p>messages: {session?.messages.length || 0}</p>
          <p>tasks: {session?.tasks.length || 0}</p>
          <p style={{ marginTop: 4 }}>last commands ({session?.commands?.slice(-3).length || 0}):</p>
          {session?.commands?.slice(-3).map((c) => (
            <p key={c.id} style={{ paddingLeft: 8, color: 'var(--color-text-hint)' }}>
              - {c.type} by {c.agentRole}
            </p>
          ))}
          <p style={{ marginTop: 4 }}>last tool results ({session?.toolResults?.slice(-3).length || 0}):</p>
          {session?.toolResults?.slice(-3).map((tr) => (
            <p key={tr.id} style={{ paddingLeft: 8, color: tr.success ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {tr.success ? '✓' : '✗'} {tr.message.slice(0, 60)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Finding Card ----
function FindingCard({ finding }: { finding: AgentFinding }) {
  return (
    <div className="vp-card" style={{ marginBottom: 4, padding: '6px 10px' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text-hint)' }}>
          {AGENT_LABELS[finding.agentRole] || finding.agentRole}
        </span>
        <span style={{ fontSize: 9, fontWeight: 500, color: DECISION_LABELS[finding.decisionStatus]?.color }}>
          {DECISION_LABELS[finding.decisionStatus]?.label}
        </span>
      </div>
      <p style={{ fontSize: 11, fontWeight: 600 }}>{finding.title}</p>
      <p style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{finding.summary}</p>
    </div>
  );
}
