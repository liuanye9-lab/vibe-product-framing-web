/**
 * Agent Workspace Page — V4.0 Agent Graph Runtime & Decision OS
 *
 * Uses agent-v4 runtime: AgentGraphSession, Graph Nodes, Event Log,
 * Checkpoints, Tool Registry, Memory, Skill Library.
 *
 * Layout:
 * - Left 65%: Agent Conversation + Event Timeline indicator
 * - Right 35%: Decision OS Panel (State / Tasks / Findings / Memory / Debug tabs)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Bot,
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
  MessageSquare,
  Activity,
  Brain,
  Lightbulb,
  Zap,
  GitBranch,
} from 'lucide-react';
import { useProductBrief } from '../hooks/useProductBrief';
import { getGraphSession } from '../agent-v4/graphStore';
import { runAgentGraphTurn, sendV4WelcomeMessage } from '../agent-v4/graphRuntime';
import { getNodeLabel } from '../agent-v4/graph';
import type {
  AgentGraphSession,
  AgentGraphEvent,
  AgentGraphFinding,
  AgentGraphStatus,
} from '../agent-v4/types';
import { AGENT_NODE_LABELS } from '../agent-v4/types';
import { AgentGraphPanel } from '../agent-v4/ui/AgentGraphPanel';
import { AgentEventTimeline } from '../agent-v4/ui/AgentEventTimeline';
import { AgentTaskBoard } from '../agent-v4/ui/AgentTaskBoard';
import { AgentMemoryPanel } from '../agent-v4/ui/AgentMemoryPanel';
import { AgentSkillPanel } from '../agent-v4/ui/AgentSkillPanel';
import { AgentDebugPanel } from '../agent-v4/ui/AgentDebugPanel';
import { AgentInterruptCard } from '../agent-v4/ui/AgentInterruptCard';
import { listMcpLikeTools } from '../agent-v4/adapters/mcpLikeToolAdapter';

const STATUS_LABELS: Record<AgentGraphStatus, { label: string; color: string }> = {
  idle: { label: '空闲', color: 'var(--color-text-hint)' },
  running: { label: '运行中', color: 'var(--color-primary)' },
  waiting_user: { label: '等待用户', color: 'var(--color-warning)' },
  interrupted: { label: '已中断', color: 'var(--color-danger)' },
  completed: { label: '已完成', color: 'var(--color-success)' },
  failed: { label: '失败', color: 'var(--color-danger)' },
};

type TabKey = 'state' | 'tasks' | 'findings' | 'memory' | 'skills' | 'debug';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'state', label: '状态', icon: <Activity size={12} /> },
  { key: 'tasks', label: '任务', icon: <ListChecks size={12} /> },
  { key: 'findings', label: '判断', icon: <Lightbulb size={12} /> },
  { key: 'memory', label: '记忆', icon: <Brain size={12} /> },
  { key: 'skills', label: '技能', icon: <Zap size={12} /> },
  { key: 'debug', label: '调试', icon: <Bug size={12} /> },
];

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'string') return v.length > 300 ? v.slice(0, 300) + '...' : v;
  if (Array.isArray(v)) return v.map((s) => String(s)).join(', ').slice(0, 200);
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 400);
  return String(v);
}

export default function AgentWorkspacePageV4() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { brief, loading, save } = useProductBrief(id);
  const [session, setSession] = useState<AgentGraphSession | null>(null);
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('state');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize session
  useEffect(() => {
    if (!id || !brief) return;
    let sess = getGraphSession(id);
    if (!sess) {
      sess = sendV4WelcomeMessage(brief);
    }
    setSession(sess);
  }, [id, brief]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.events]);

  const sendAgentMessage = useCallback(async (message: string) => {
    if (!brief || sending) return;
    setSending(true);
    setError('');
    try {
      const result = await runAgentGraphTurn({ brief, userMessage: message });
      setSession(result.session);
      if (result.briefPatch && Object.keys(result.briefPatch).length > 0) {
        save({ ...brief, ...result.briefPatch });
      }
    } catch (e) {
      setError('处理消息时出错，请重试。');
      console.error('[AgentV4] sendAgentMessage error:', e);
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

  const handleContinue = useCallback(() => sendAgentMessage('继续下一步'), [sendAgentMessage]);
  const handleSkip = useCallback(() => sendAgentMessage('先跳过'), [sendAgentMessage]);
  const handleMakeAssumption = useCallback(() => sendAgentMessage('帮我做默认假设'), [sendAgentMessage]);
  const handleGenerateHandoff = useCallback(() => sendAgentMessage('生成开发文档'), [sendAgentMessage]);
  const handleReanalyze = useCallback(() => sendAgentMessage('重新分析当前节点'), [sendAgentMessage]);

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

  const state = session?.state;
  const currentNodeId = state?.currentNodeId || 'intake';
  const status = state?.status || 'idle';
  const isWaiting = status === 'waiting_user';
  const isComplete = status === 'completed';

  // Build conversation from events
  const conversationEvents = (session?.events || []).filter((e) =>
    ['user_message', 'agent_message', 'tool_completed', 'error'].includes(e.type),
  );

  return (
    <div className="vp-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header className="vp-header" style={{ flexShrink: 0 }}>
        <div className="vp-header-inner" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="vp-btn vp-btn-ghost" onClick={() => navigate('/')} style={{ padding: '4px 8px' }} title="首页">
            <Home size={16} />
          </button>
          <GitBranch size={16} style={{ color: 'var(--color-primary)' }} />
          <h1 style={{ fontSize: 15, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Agent Decision OS V4
          </h1>
          <span style={{
            fontSize: 11,
            color: STATUS_LABELS[status]?.color || 'var(--color-text-hint)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            padding: '2px 8px',
            borderRadius: 8,
            background: (STATUS_LABELS[status]?.color || 'var(--color-text-hint)') + '15',
          }}>
            {STATUS_LABELS[status]?.label || status}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-hint)', whiteSpace: 'nowrap' }}>
            {getNodeLabel(currentNodeId)}
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

      {/* Graph Panel */}
      <div style={{ padding: '6px 20px', borderBottom: '0.5px solid var(--color-border)', background: 'var(--color-bg)' }}>
        <AgentGraphPanel
          currentNodeId={currentNodeId}
          completedNodes={status === 'completed' ? ['intake', 'demand', 'product', 'mvp', 'tech', 'risk', 'handoff', 'reviewer'] : []}
          status={status}
        />
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Conversation */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {conversationEvents.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <Bot size={32} style={{ color: 'var(--color-text-hint)', marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Agent Graph Runtime V4 就绪</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  描述你的产品想法，Agent 会通过图工作流逐步推进决策。
                </p>
              </div>
            )}

            {conversationEvents.map((event) => (
              <EventBubble key={event.id} event={event} />
            ))}

            {/* Interrupt card when waiting */}
            {isWaiting && !sending && (
              <AgentInterruptCard
                title="需要你的确认"
                description={state?.pendingQuestions?.[0] || '请补充信息，或选择继续推进。'}
                questions={state?.pendingQuestions?.slice(0, 3)}
                onAnswer={(answer) => setUserInput(answer)}
                onContinue={handleContinue}
                onSkip={handleSkip}
                onMakeAssumption={handleMakeAssumption}
              />
            )}

            {/* Quick actions when pending */}
            {!isWaiting && !isComplete && !sending && (
              <div style={{ marginTop: 8, marginLeft: 48 }}>
                <div className="vp-card" style={{ padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-hint)', marginBottom: 6 }}>快捷操作</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button className="vp-btn vp-btn-ghost" onClick={handleContinue} style={{ fontSize: 11, padding: '4px 10px' }}>
                      <ChevronRight size={12} /> 继续下一步
                    </button>
                    <button className="vp-btn vp-btn-ghost" onClick={handleSkip} style={{ fontSize: 11, padding: '4px 10px' }}>
                      <SkipForward size={12} /> 先跳过
                    </button>
                    <button className="vp-btn vp-btn-ghost" onClick={handleMakeAssumption} style={{ fontSize: 11, padding: '4px 10px' }}>
                      <MessageSquare size={12} /> 默认假设
                    </button>
                    <button className="vp-btn vp-btn-ghost" onClick={handleGenerateHandoff} style={{ fontSize: 11, padding: '4px 10px' }}>
                      <FileText size={12} /> 生成交付
                    </button>
                    <button className="vp-btn vp-btn-ghost" onClick={handleReanalyze} style={{ fontSize: 11, padding: '4px 10px' }}>
                      重新分析
                    </button>
                  </div>
                </div>
              </div>
            )}

            {sending && (
              <div style={{ padding: '12px 0', paddingLeft: 48, color: 'var(--color-text-hint)', fontSize: 13 }}>
                <Loader2 size={14} className="vp-spin" style={{ display: 'inline-block', marginRight: 6 }} />
                Agent 正在处理...
              </div>
            )}

            {error && (
              <div style={{ padding: '8px 14px', margin: '8px 0', color: 'var(--color-danger)', fontSize: 13, background: 'var(--color-background-danger)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 20px 20px', borderTop: '0.5px solid var(--color-border)', background: 'var(--color-surface)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <textarea
                className="vp-textarea"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={'描述你的想法，或说：继续下一步 / 帮我做默认假设 / 生成开发文档'}
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

        {/* Right: Decision OS Panel */}
        <div style={{ width: 340, flexShrink: 0, borderLeft: '0.5px solid var(--color-border)', overflowY: 'auto', background: 'var(--color-bg)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '0.5px solid var(--color-border)', padding: '4px 8px', gap: 2 }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={activeTab === tab.key ? 'vp-btn vp-btn-primary' : 'vp-btn-text'}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '10px 12px' }}>
            {activeTab === 'state' && <StateView session={session} />}
            {activeTab === 'tasks' && (
              <AgentTaskBoard
                tasks={state?.tasks || []}
                onToggleTask={(taskId, newStatus) => {
                  const updatedTasks = (state?.tasks || []).map((t) =>
                    t.id === taskId ? { ...t, status: newStatus, updatedAt: new Date().toISOString() } : t,
                  );
                  if (session) {
                    setSession({
                      ...session,
                      state: { ...session.state, tasks: updatedTasks },
                    });
                  }
                }}
              />
            )}
            {activeTab === 'findings' && <FindingsView findings={state?.findings || []} />}
            {activeTab === 'memory' && <AgentMemoryPanel workingMemory={state?.workingMemory || {}} />}
            {activeTab === 'skills' && <AgentSkillPanel />}
            {activeTab === 'debug' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <AgentDebugPanel session={session} />
                <div className="vp-card" style={{ padding: '8px 12px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Checkpoints ({session?.checkpoints.length || 0})</p>
                  {(session?.checkpoints || []).slice(-5).map((ck) => (
                    <p key={ck.id} style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: '1px 0' }}>
                      {new Date(ck.createdAt).toLocaleTimeString()} - {ck.reason.slice(0, 40)}
                    </p>
                  ))}
                </div>
                <div className="vp-card" style={{ padding: '8px 12px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>可调用工具 ({listMcpLikeTools().length})</p>
                  {listMcpLikeTools().map((t) => (
                    <p key={t.name} style={{ fontSize: 10, color: 'var(--color-text-hint)', margin: '1px 0' }}>
                      {t.name} - {t.description.slice(0, 60)}
                    </p>
                  ))}
                </div>
                <div className="vp-card" style={{ padding: '8px 12px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>事件流</p>
                  <AgentEventTimeline events={session?.events || []} maxEvents={20} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Event Bubble ----
function EventBubble({ event }: { event: AgentGraphEvent }) {
  const isUser = event.type === 'user_message';
  const isAgent = event.type === 'agent_message';
  const isTool = event.type === 'tool_completed';
  const isError = event.type === 'error';
  const nodeLabel = event.nodeId ? AGENT_NODE_LABELS[event.nodeId] || event.nodeId : '';

  if (isUser) {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, justifyContent: 'flex-end' }}>
        <div className="vp-card" style={{ maxWidth: '70%', padding: '10px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {fmtVal(event.message)}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={14} />
        </div>
      </div>
    );
  }

  if (isTool) {
    return (
      <div style={{ marginBottom: 4, marginLeft: 48, fontSize: 10, color: 'var(--color-text-hint)', opacity: 0.6 }}>
        &#9881; {fmtVal(event.message)}
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ marginBottom: 8, marginLeft: 48, fontSize: 11, color: 'var(--color-danger)', background: 'var(--color-background-danger)', padding: '6px 10px', borderRadius: 6 }}>
        {fmtVal(event.message)}
      </div>
    );
  }

  if (isAgent) {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-surface)', border: '0.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={14} />
        </div>
        <div style={{ maxWidth: '80%' }}>
          {nodeLabel && (
            <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginBottom: 4, fontWeight: 600 }}>
              {nodeLabel}
            </p>
          )}
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {fmtVal(event.message)}
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ---- State View ----
function StateView({ session }: { session: AgentGraphSession | null }) {
  const state = session?.state;
  if (!state) return <p style={{ fontSize: 12, color: 'var(--color-text-hint)' }}>无状态数据</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
      <div className="vp-card" style={{ padding: '10px 12px' }}>
        <p style={{ fontSize: 10, color: 'var(--color-text-hint)', marginBottom: 2 }}>当前阶段</p>
        <p style={{ fontSize: 14, fontWeight: 600 }}>{getNodeLabel(state.currentNodeId)}</p>
        <p style={{ fontSize: 11, color: 'var(--color-text-hint)', marginTop: 4 }}>
          Active Agent: {state.activeAgentName} · Status: {state.status}
        </p>
      </div>

      {state.pendingQuestions.length > 0 && (
        <div className="vp-card" style={{ padding: '10px 12px', borderColor: 'var(--color-warning)' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-warning)', marginBottom: 4 }}>待回答问题 ({state.pendingQuestions.length})</p>
          {state.pendingQuestions.map((q, i) => (
            <p key={i} style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: '2px 0' }}>· {q}</p>
          ))}
        </div>
      )}

      {state.lastEvaluation && (
        <div className="vp-card" style={{ padding: '10px 12px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>最新评估</p>
          <p style={{ fontSize: 11 }}>评分: {state.lastEvaluation.score}</p>
          <p style={{ fontSize: 11 }}>状态: {state.lastEvaluation.readiness}</p>
          {state.lastEvaluation.issues.length > 0 && (
            <p style={{ fontSize: 10, color: 'var(--color-danger)', marginTop: 2 }}>
              问题: {state.lastEvaluation.issues.join('；')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Findings View ----
function FindingsView({ findings }: { findings: AgentGraphFinding[] }) {
  if (findings.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--color-text-hint)', textAlign: 'center', padding: 8 }}>暂无判断</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
      {findings.slice().reverse().map((f) => (
        <div key={f.id} className="vp-card" style={{ padding: '8px 10px' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 6, background: 'var(--color-surface)', color: 'var(--color-text-hint)' }}>
              {AGENT_NODE_LABELS[f.nodeId] || f.nodeId}
            </span>
            <span style={{ fontSize: 9, color: 'var(--color-text-hint)' }}>
              conf: {f.confidence.toFixed(1)}
            </span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600 }}>{f.title}</p>
          <p style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{f.summary.slice(0, 120)}</p>
          {f.risks.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {f.risks.slice(0, 2).map((r, i) => (
                <p key={i} style={{ fontSize: 9, color: 'var(--color-danger)' }}>· {r}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
