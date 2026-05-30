/**
 * Agent Workspace Page — V4.8 Minimal Monochrome Edition
 *
 * Uses agent-v4 runtime: AgentGraphSession, Graph Nodes, Event Log,
 * Checkpoints, Tool Registry, Memory, Skill Library.
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
  Database,
  StopCircle,
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
import { AgentSlotPanel } from '../agent-v4/ui/AgentSlotPanel';
import { AgentProgressIndicator } from '../agent-v4/ui/AgentProgressIndicator';
import { AgentThinkingBubble } from '../agent-v4/ui/AgentThinkingBubble';
import { listMcpLikeTools } from '../agent-v4/adapters/mcpLikeToolAdapter';
import { buildImmediateAgentReply } from '../agent-v4/immediateReply';
import { ApiRequiredGate } from '../components/ApiRequiredGate';
import { getApiHealth } from '../api/apiHealth';
import { LiquidBadge } from '../components/liquid';
import ThemeToggle from '../components/ThemeToggle';
import {
  type AgentTurnLifecycle,
  createAgentTurnLifecycle,
  createDefaultProgressSteps,
  markProgressStep,
} from '../agent-v4/turnLifecycle';

const STATUS_LABELS: Record<AgentGraphStatus, { label: string; color: string }> = {
  idle: { label: '空闲', color: 'var(--vp-text-tertiary)' },
  running: { label: '运行中', color: 'var(--vp-accent)' },
  waiting_user: { label: '等待用户', color: 'var(--vp-warning)' },
  interrupted: { label: '已中断', color: 'var(--vp-danger)' },
  completed: { label: '已完成', color: 'var(--vp-success)' },
  failed: { label: '失败', color: 'var(--vp-danger)' },
};

type TabKey = 'state' | 'slots' | 'tasks' | 'findings' | 'memory' | 'skills' | 'debug';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'state', label: '状态', icon: <Activity size={12} /> },
  { key: 'slots', label: '信息槽', icon: <Database size={12} /> },
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

  // Turn lifecycle & optimistic UI
  const [activeTurn, setActiveTurn] = useState<AgentTurnLifecycle | null>(null);
  const [slowHint, setSlowHint] = useState('');
  const slowTimerRef = useRef<number | null>(null);
  const [optimisticUserMsg, setOptimisticUserMsg] = useState<string>('');
  const [optimisticAgentReply, setOptimisticAgentReply] = useState<string>('');

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (slowTimerRef.current) window.clearTimeout(slowTimerRef.current); };
  }, []);

  // Initialize session
  useEffect(() => {
    if (!id || !brief) return;
    let sess = getGraphSession(id);
    if (!sess) sess = sendV4WelcomeMessage(brief);
    setSession(sess);
  }, [id, brief]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.events, activeTurn, optimisticUserMsg, optimisticAgentReply]);

  const sendAgentMessage = useCallback(async (message: string, opts?: { immediateReply?: string }) => {
    if (!brief || sending) return;
    setSending(true);
    setError('');
    setSlowHint('');

    const currentNodeLabel = getNodeLabel(session?.state?.currentNodeId || 'intake');

    // Immediate feedback
    setOptimisticUserMsg(message);

    const immediateReply = opts?.immediateReply ??
      buildImmediateAgentReply({
        userMessage: message,
        currentNodeLabel,
        pendingQuestions: session?.state?.pendingQuestions,
      });

    setOptimisticAgentReply(immediateReply);

    // Create turn lifecycle
    let turn = createAgentTurnLifecycle({
      briefId: brief.id,
      sessionId: session?.id || '',
      userMessage: message,
      immediateReply,
    });
    turn = { ...turn, progressSteps: createDefaultProgressSteps({ userMessage: message, currentNodeLabel }) };
    setActiveTurn(turn);

    // Slow feedback timer
    slowTimerRef.current = window.setTimeout(() => {
      setSlowHint('这一步分析稍慢，我还在处理上下文和生成交付结构，请稍等。');
    }, 8000);

    try {
      const result = await runAgentGraphTurn({
        brief,
        userMessage: message,
        onProgress: (evt) => {
          turn = markProgressStep({ lifecycle: turn, phase: evt.phase as never, status: 'done' });
          setActiveTurn({ ...turn });
        },
      });

      // Cleanup
      if (slowTimerRef.current) { window.clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }

      setSession(result.session);
      setOptimisticUserMsg('');
      setOptimisticAgentReply('');
      setActiveTurn(null);
      setSlowHint('');

      if (result.briefPatch && Object.keys(result.briefPatch).length > 0) {
        save({ ...brief, ...result.briefPatch });
      }
    } catch (e) {
      if (slowTimerRef.current) { window.clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }

      const errMsg = e instanceof Error ? e.message : String(e);
      const fallbackReply = errMsg.includes('timeout') || errMsg.includes('timed out')
        ? 'API 响应超时，本轮未生成结果。请检查 API 配置或网络后重试。'
        : errMsg.includes('json') || errMsg.includes('parse')
          ? '模型返回格式不稳定，本轮未生成结果。建议更换稳定模型后重试。'
          : 'API 调用失败，本轮 Agent 未执行。请检查 API 配置后重试。';

      setOptimisticAgentReply(fallbackReply);
      setError(fallbackReply);

      console.error('[AgentV4] sendAgentMessage error:', e);
    } finally {
      setSending(false);
    }
  }, [brief, sending, save, session]);

  // Cancel waiting
  const handleCancel = useCallback(() => {
    if (slowTimerRef.current) { window.clearTimeout(slowTimerRef.current); slowTimerRef.current = null; }
    setSending(false);
    setActiveTurn(null);
    setSlowHint('');
    setOptimisticUserMsg('');
    setOptimisticAgentReply('');
    setError('已停止等待。你可以继续输入新的指令。');
  }, []);

  const handleSend = useCallback(() => {
    const msg = userInput.trim();
    if (!msg) return;
    setUserInput('');
    sendAgentMessage(msg);
  }, [userInput, sendAgentMessage]);

  const handleContinue = useCallback(() => sendAgentMessage('继续下一步', { immediateReply: '收到，我会推进到下一阶段。如果信息不足，会先用低置信度假设。' }), [sendAgentMessage]);
  const handleSkip = useCallback(() => sendAgentMessage('先跳过', { immediateReply: '已收到，我会把当前缺失项标记为跳过，并继续推进。' }), [sendAgentMessage]);
  const handleMakeAssumption = useCallback(() => sendAgentMessage('帮我做默认假设', { immediateReply: '可以，我会先做低置信度假设，并把这些假设标出来，后面你可以随时改。' }), [sendAgentMessage]);
  const handleGenerateHandoff = useCallback(() => sendAgentMessage('生成开发文档', { immediateReply: '收到，我会先补齐必要假设，然后整理 Product Brief、MVP Scope、DEV_SPEC 和 Codex Prompt。' }), [sendAgentMessage]);

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
          <p style={{ fontSize: 14, color: 'var(--vp-text-secondary)' }}>未找到项目</p>
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
  const apiHealth = getApiHealth();

  // Filter only user-visible events for conversation
  const conversationEvents = (session?.events || []).filter((e) =>
    ['user_message', 'agent_message', 'ai_call_started', 'ai_call_completed', 'ai_call_failed', 'tool_completed', 'error'].includes(e.type),
  );

  return (
    <ApiRequiredGate
      title="Agent 工作流需要 API"
      description="Agent Decision OS 依赖真实大模型 API 进行多阶段产品决策。API 未通过验证前，系统不会使用本地规则或 mock 结果继续生成。"
    >
    <div className="vp-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header — macOS titlebar style */}
      <header className="vp-titlebar" style={{ flexShrink: 0 }}>
        {/* Traffic lights — monochrome gray */}
        <div className="vp-traffic-lights">
          <span className="vp-traffic-light" />
          <span className="vp-traffic-light" />
          <span className="vp-traffic-light" />
        </div>

        <button className="vp-btn-text" onClick={() => navigate('/')} style={{ padding: '2px 6px' }} title="首页">
          <Home size={14} />
        </button>

        <GitBranch size={14} style={{ color: 'var(--vp-accent)' }} />

        <h1 style={{ fontSize: 13, fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          Agent Decision OS V4.8
        </h1>

        {/* Current node + API badge */}
        <span style={{ fontSize: 11, color: 'var(--vp-text-tertiary)', whiteSpace: 'nowrap' }}>
          {getNodeLabel(currentNodeId)}
        </span>

        <LiquidBadge variant={apiHealth.status === 'ready' ? 'green' : 'orange'}>
          {apiHealth.status === 'ready' ? 'Ready' : 'No API'}
        </LiquidBadge>

        <span style={{
          fontSize: 11,
          color: STATUS_LABELS[status]?.color || 'var(--vp-text-tertiary)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}>
          {STATUS_LABELS[status]?.label || status}
        </span>

        <ThemeToggle />

        <button className="vp-btn-text" onClick={() => navigate(`/discovery/${brief.id}`)} style={{ padding: '2px 6px' }} title="四步流程">
          <Layout size={13} />
        </button>
        <button className="vp-btn-text" onClick={() => navigate(`/handoff/${brief.id}`)} style={{ padding: '2px 6px' }} title="查看交付">
          <FileText size={13} />
        </button>
        <button className="vp-btn-text" onClick={() => navigate(`/output/${brief.id}`)} style={{ padding: '2px 6px', fontSize: 11 }} title="查看决策输出">
          决策输出
        </button>
        <button className="vp-btn-text" onClick={() => navigate('/history')} style={{ padding: '2px 6px' }} title="历史记录">
          <History size={13} />
        </button>
      </header>

      {/* Graph Panel */}
      <div style={{ padding: '6px 20px', borderBottom: '0.5px solid var(--vp-border)', background: 'var(--vp-bg)' }}>
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
            {conversationEvents.length === 0 && !sending && (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <Bot size={32} style={{ color: 'var(--vp-text-tertiary)', marginBottom: 12 }} />
                <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Agent Decision OS V4.8 就绪</p>
                <p style={{ fontSize: 12, color: 'var(--vp-text-secondary)', lineHeight: 1.7 }}>
                  描述你的产品想法，我会像产品经理一样带你一步步把想法变成开发规格。
                </p>
              </div>
            )}

            {/* Session events */}
            {conversationEvents.map((event) => (
              <EventBubble key={event.id} event={event} />
            ))}

            {/* Optimistic user message */}
            {optimisticUserMsg && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, justifyContent: 'flex-end' }}>
                <div className="vp-bubble-user" style={{ maxWidth: '70%', padding: '10px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {optimisticUserMsg}
                </div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--vp-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={14} />
                </div>
              </div>
            )}

            {/* Optimistic agent reply */}
            {sending && optimisticAgentReply && (
              <>
                <AgentThinkingBubble
                  message={optimisticAgentReply}
                  phase={activeTurn ? `正在处理 · ${activeTurn.phase}` : undefined}
                  slowHint={slowHint || undefined}
                />
                <AgentProgressIndicator lifecycle={activeTurn} />
              </>
            )}

            {/* Old-style sending indicator */}
            {sending && !optimisticAgentReply && (
              <div style={{ padding: '12px 0', paddingLeft: 48, color: 'var(--vp-text-tertiary)', fontSize: 13 }}>
                <Loader2 size={14} className="vp-spin" style={{ display: 'inline-block', marginRight: 6 }} />
                Agent 正在处理...
              </div>
            )}

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

            {/* Floating quick actions */}
            {!isWaiting && !isComplete && !sending && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 'var(--vp-radius-pill)',
                  background: 'var(--vp-surface)',
                  border: '1px solid var(--vp-border)',
                  boxShadow: 'var(--vp-shadow-xs)',
                }}>
                  <button className="vp-btn vp-btn-ghost" onClick={handleContinue} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--vp-radius-pill)' }}>
                    <ChevronRight size={12} /> 继续下一步
                  </button>
                  <button className="vp-btn vp-btn-ghost" onClick={handleMakeAssumption} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--vp-radius-pill)' }}>
                    <MessageSquare size={12} /> 默认假设
                  </button>
                  <button className="vp-btn vp-btn-ghost" onClick={handleSkip} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--vp-radius-pill)' }}>
                    <SkipForward size={12} /> 跳过
                  </button>
                  <button className="vp-btn vp-btn-ghost" onClick={handleGenerateHandoff} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--vp-radius-pill)' }}>
                    <FileText size={12} /> 生成 Handoff
                  </button>
                  <button className="vp-btn vp-btn-ghost" onClick={() => navigate(`/output/${brief.id}`)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--vp-radius-pill)' }}>
                    查看 Output
                  </button>
                </div>
              </div>
            )}

            {/* Cancel button */}
            {sending && slowHint && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <button className="vp-btn vp-btn-ghost" onClick={handleCancel} style={{ fontSize: 11, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <StopCircle size={12} />
                  停止等待
                </button>
              </div>
            )}

            {error && (
              <div style={{ padding: '8px 14px', margin: '8px 0', color: 'var(--vp-danger)', fontSize: 13, background: 'var(--color-danger-light)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input — Spotlight style */}
          <div style={{ padding: '12px 20px 20px', flexShrink: 0 }}>
            <div className="vp-spotlight-input">
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={'描述你的想法，或说：继续下一步 / 帮我做默认假设 / 生成开发文档'}
                rows={2}
                style={{
                  flex: 1,
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--vp-text)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  padding: '8px 0',
                  fontFamily: 'inherit',
                }}
                disabled={sending}
              />
              <button
                className="vp-btn vp-btn-primary"
                onClick={handleSend}
                disabled={!userInput.trim() || sending}
                style={{ borderRadius: '50%', width: 34, height: 34, padding: 0, flexShrink: 0 }}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Decision OS Panel */}
        <div style={{ width: 340, flexShrink: 0, borderLeft: '0.5px solid var(--vp-border)', overflowY: 'auto', background: 'var(--vp-surface-muted)' }}>
          {/* Tabs — segmented style */}
          <div style={{
            display: 'flex',
            padding: '8px',
            gap: 2,
            borderBottom: '0.5px solid var(--vp-border)',
          }}>
            <div className="vp-segmented" style={{ width: '100%', display: 'flex' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`vp-segmented__item${activeTab === tab.key ? ' vp-segmented__item--active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ flex: 1, fontSize: 10, padding: '5px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '10px 12px' }}>
            {activeTab === 'state' && <StateView session={session} />}
            {activeTab === 'slots' && <AgentSlotPanel slots={state?.slotFilling?.slots as Record<string, import('../agent-v4/types').InfoSlot> | undefined} />}
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
                    <p key={ck.id} style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', margin: '1px 0' }}>
                      {new Date(ck.createdAt).toLocaleTimeString()} - {ck.reason.slice(0, 40)}
                    </p>
                  ))}
                </div>
                <div className="vp-card" style={{ padding: '8px 12px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>可调用工具 ({listMcpLikeTools().length})</p>
                  {listMcpLikeTools().map((t) => (
                    <p key={t.name} style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', margin: '1px 0' }}>
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
    </ApiRequiredGate>
  );
}

// ---- Event Bubble ----
function EventBubble({ event }: { event: AgentGraphEvent }) {
  const isUser = event.type === 'user_message';
  const isAgent = event.type === 'agent_message';
  const isTool = event.type === 'tool_completed';
  const isAIStart = event.type === 'ai_call_started';
  const isAIDone = event.type === 'ai_call_completed';
  const isAIFail = event.type === 'ai_call_failed';
  const isError = event.type === 'error';
  const nodeLabel = event.nodeId ? AGENT_NODE_LABELS[event.nodeId] || event.nodeId : '';

  if (isUser) {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, justifyContent: 'flex-end' }}>
        <div className="vp-bubble-user" style={{ maxWidth: '70%', padding: '10px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {fmtVal(event.message)}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--vp-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <User size={14} />
        </div>
      </div>
    );
  }

  if (isTool) {
    return (
      <div style={{ marginBottom: 4, marginLeft: 48, fontSize: 10, color: 'var(--vp-text-tertiary)', opacity: 0.6 }}>
        &#9881; {fmtVal(event.message)}
      </div>
    );
  }

  if (isAIStart || isAIDone || isAIFail) {
    const label = isAIFail ? 'AI ✗' : isAIDone ? 'AI ✓' : 'AI →';
    return (
      <div style={{ marginBottom: 4, marginLeft: 48, fontSize: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span className={`vp-status-chip vp-status-chip--ai-${isAIFail ? 'fail' : isAIDone ? 'done' : 'calling'}`}>
          {label}
        </span>
        <span style={{ color: 'var(--vp-text-tertiary)', fontSize: 10 }}>{fmtVal(event.message)}</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div style={{ marginBottom: 8, marginLeft: 48, fontSize: 11, color: 'var(--vp-danger)', background: 'var(--color-danger-light)', padding: '6px 10px', borderRadius: 6 }}>
        {fmtVal(event.message)}
      </div>
    );
  }

  if (isAgent) {
    return (
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--vp-surface)', border: '0.5px solid var(--vp-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Bot size={14} />
        </div>
        <div style={{ maxWidth: '80%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            {nodeLabel && (
              <p style={{ fontSize: 11, color: 'var(--vp-text-tertiary)', fontWeight: 600, margin: 0 }}>
                {nodeLabel}
              </p>
            )}
            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: 'var(--vp-accent)', color: '#fff', lineHeight: '16px' }}>
              AI
            </span>
          </div>
          <div className="vp-bubble-agent" style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
  if (!state) return <p style={{ fontSize: 12, color: 'var(--vp-text-tertiary)' }}>无状态数据</p>;

  const apiHealth = getApiHealth();
  const apiReady = apiHealth.status === 'ready';
  const apiColors: Record<string, string> = { ready: 'var(--vp-success)', connection_failed: 'var(--vp-danger)', json_failed: 'var(--vp-danger)', validation_failed: 'var(--vp-warning)', unknown: 'var(--vp-text-tertiary)', not_configured: 'var(--vp-text-tertiary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
      {/* API Status Card */}
      <div className="vp-card" style={{
        padding: '10px 12px',
        borderColor: apiReady ? 'rgba(52,199,89,0.25)' : 'rgba(255,59,48,0.15)',
        boxShadow: apiReady ? '0 0 20px rgba(52,199,89,0.08)' : undefined,
      }}>
        <p style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', marginBottom: 2 }}>API Runtime</p>
        <p style={{ fontSize: 13, fontWeight: 600, color: apiColors[apiHealth.status] || 'var(--vp-text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: apiColors[apiHealth.status] || 'var(--vp-text-tertiary)', display: 'inline-block' }} />
          {apiReady ? 'Ready' : `Blocked: ${apiHealth.status}`}
        </p>
        {apiHealth.model && <p style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', marginTop: 2 }}>{apiHealth.model}</p>}
      </div>

      {/* Last AI Call */}
      {state.lastAIStatus && state.lastAIStatus !== 'not_called' && (
        <div className="vp-card" style={{ padding: '10px 12px', borderColor: state.lastAIStatus === 'failed' ? 'rgba(255,59,48,0.15)' : state.lastAIStatus === 'calling' ? 'rgba(0,122,255,0.15)' : 'rgba(52,199,89,0.15)' }}>
          <p style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', marginBottom: 2 }}>Last AI Call</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: state.lastAIStatus === 'failed' ? 'var(--vp-danger)' : state.lastAIStatus === 'calling' ? 'var(--vp-accent)' : 'var(--vp-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: state.lastAIStatus === 'failed' ? 'var(--vp-danger)' : state.lastAIStatus === 'calling' ? 'var(--vp-accent)' : 'var(--vp-success)', display: 'inline-block' }} />
            {state.lastAIStatus === 'calling' ? 'Calling...' : state.lastAIStatus === 'success' ? 'Success' : 'Failed'}
          </p>
          {state.lastAINodeId && <p style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', marginTop: 2 }}>Node: {state.lastAINodeId}</p>}
          {state.lastAIError && <p style={{ fontSize: 10, color: 'var(--vp-danger)', marginTop: 2, wordBreak: 'break-word' }}>{state.lastAIError.slice(0, 120)}</p>}
        </div>
      )}

      {/* Current Phase */}
      <div className="vp-card" style={{ padding: '10px 12px' }}>
        <p style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', marginBottom: 2 }}>当前阶段</p>
        <p style={{ fontSize: 14, fontWeight: 600 }}>{getNodeLabel(state.currentNodeId)}</p>
        <p style={{ fontSize: 11, color: 'var(--vp-text-tertiary)', marginTop: 4 }}>
          Active Agent: {state.activeAgentName} · Status: {state.status}
        </p>
        {state.advancementCount != null && state.advancementCount > 0 && (
          <p style={{ fontSize: 10, color: 'var(--vp-text-tertiary)', marginTop: 2 }}>
            已推进 {state.advancementCount} 次
          </p>
        )}
      </div>

      {/* Slot Status Summary */}
      {state.slotFilling?.slots && (() => {
        const slots = Object.values(state.slotFilling.slots);
        const answered = slots.filter((s) => s.status === 'answered').length;
        const assumed = slots.filter((s) => s.status === 'assumed').length;
        const skipped = slots.filter((s) => s.status === 'skipped').length;
        const unknown = slots.filter((s) => s.status === 'unknown' || s.status === 'asked').length;
        if (answered + assumed + skipped + unknown === 0) return null;
        return (
          <div className="vp-card" style={{ padding: '10px 12px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>信息槽状态</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10 }}>
              <span style={{ color: 'var(--vp-success)' }}>✓ 已知: {answered}</span>
              <span style={{ color: 'var(--vp-warning)' }}>◎ 假设: {assumed}</span>
              <span style={{ color: 'var(--vp-text-tertiary)' }}>→ 跳过: {skipped}</span>
              <span style={{ color: 'var(--vp-danger)' }}>? 未知: {unknown}</span>
            </div>
          </div>
        );
      })()}

      {/* Pending Questions */}
      {state.pendingQuestions.length > 0 && (
        <div className="vp-card" style={{ padding: '10px 12px', borderColor: 'rgba(255,149,0,0.25)' }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--vp-warning)', marginBottom: 4 }}>待回答问题 ({state.pendingQuestions.length})</p>
          {state.pendingQuestions.map((q, i) => (
            <p key={i} style={{ fontSize: 11, color: 'var(--vp-text-secondary)', margin: '2px 0' }}>· {q}</p>
          ))}
        </div>
      )}

      {state.lastEvaluation && (
        <div className="vp-card" style={{ padding: '10px 12px' }}>
          <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>最新评估</p>
          <p style={{ fontSize: 11 }}>评分: {state.lastEvaluation.score}</p>
          <p style={{ fontSize: 11 }}>状态: {state.lastEvaluation.readiness}</p>
          {state.lastEvaluation.issues.length > 0 && (
            <p style={{ fontSize: 10, color: 'var(--vp-danger)', marginTop: 2 }}>
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
    return <p style={{ fontSize: 12, color: 'var(--vp-text-tertiary)', textAlign: 'center', padding: 8 }}>暂无判断</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
      {findings.slice().reverse().map((f) => (
        <div key={f.id} className="vp-card" style={{ padding: '8px 10px' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: 6, background: 'var(--vp-surface)', color: 'var(--vp-text-tertiary)' }}>
              {AGENT_NODE_LABELS[f.nodeId] || f.nodeId}
            </span>
            <span style={{ fontSize: 9, color: 'var(--vp-text-tertiary)' }}>
              conf: {f.confidence.toFixed(1)}
            </span>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600 }}>{f.title}</p>
          <p style={{ fontSize: 10, color: 'var(--vp-text-secondary)' }}>{f.summary.slice(0, 120)}</p>
          {f.risks.length > 0 && (
            <div style={{ marginTop: 4 }}>
              {f.risks.slice(0, 2).map((r, i) => (
                <p key={i} style={{ fontSize: 9, color: 'var(--vp-danger)' }}>· {r}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
