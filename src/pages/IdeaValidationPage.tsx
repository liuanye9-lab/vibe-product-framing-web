/**
 * Idea Validation Page — V6.0
 *
 * Conversational interface for the Idea Validation Agent Workflow.
 * Not a simple chatbot — each agent node is visible with progress.
 *
 * UI: Minimalist monochrome, iOS frosted glass, clear information hierarchy.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Home,
  History,
  Send,
  Loader2,
  CheckCircle2,
  Circle,
  AlertTriangle,
  SkipForward,
  Package,
  FileText,
  Building2,
  BarChart3,
  Lightbulb,
  Search,
  Target,
  Zap,
} from 'lucide-react';
import {
  createIdeaValidationTask,
  getIdeaValidationTask,
} from '../storage/ideaValidationStorage';
import { ensureProductBriefFromIdeaValidationTask } from '../storage/ideaValidationHandoff';
import { runIdeaValidationTurn } from '../agent-v4/ideaValidationRuntime';
import type {
  IdeaValidationTask,
  IdeaGoalType,
  IdeaValidationNodeKey,
  GitHubReference,
  OpportunityEvaluation,
} from '../types/ideaValidation';
import {
  IDEA_GOAL_LABELS,
  VALIDATION_NODE_LABELS,
  VALIDATION_DECISION_LABELS,
} from '../types/ideaValidation';

// ─── Goal Options ─────────────────────────────────────────────────────────────

const GOAL_OPTIONS: { value: IdeaGoalType; label: string; icon: string }[] = [
  { value: 'personal_efficiency', label: '提升个人效率', icon: '⚡' },
  { value: 'portfolio', label: '作品集展示', icon: '🎨' },
  { value: 'job_interview', label: '求职面试', icon: '💼' },
  { value: 'commercialization', label: '商业化', icon: '💰' },
  { value: 'technical_practice', label: '技术练习', icon: '🔧' },
  { value: 'unknown', label: '不确定', icon: '❓' },
];

// ─── Node Icons ───────────────────────────────────────────────────────────────

const NODE_ICONS: Record<IdeaValidationNodeKey, typeof Lightbulb> = {
  idea_intake: Lightbulb,
  clarification: Search,
  query_planning: Target,
  github_research: Package,
  paper_research: FileText,
  competitor_research: Building2,
  opportunity_evaluation: BarChart3,
  decision: CheckCircle2,
  handoff: Zap,
};

// ─── Message Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  nodeKey?: IdeaValidationNodeKey;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IdeaValidationPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [task, setTask] = useState<IdeaValidationTask | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ─── Rebuild Messages ─────────────────────────────────────────────────────

  function rebuildMessages(t: IdeaValidationTask) {
    const msgs: ChatMessage[] = [];
    msgs.push({
      id: 'init',
      role: 'system',
      content: `开始验证想法：「${t.rawIdea}」\n目标：${IDEA_GOAL_LABELS[t.goalType]}`,
      timestamp: t.createdAt,
    });

    if (t.clarifiedIdea) {
      msgs.push({
        id: 'clarified',
        role: 'agent',
        content: `想法已澄清：${t.clarifiedIdea}\n目标用户：${t.targetUser ?? '未指定'}\n使用场景：${t.useCase ?? '未指定'}`,
        timestamp: t.updatedAt,
        nodeKey: 'clarification',
      });
    }

    if (t.evaluation) {
      msgs.push({
        id: 'eval',
        role: 'agent',
        content: `评估完成，总分：${t.evaluation.overallScore}/100`,
        timestamp: t.updatedAt,
        nodeKey: 'opportunity_evaluation',
      });
    }

    if (t.decision) {
      msgs.push({
        id: 'decision',
        role: 'agent',
        content: `决策：${VALIDATION_DECISION_LABELS[t.decision.decision]}\n${t.decision.recommendation}`,
        timestamp: t.updatedAt,
        nodeKey: 'decision',
      });
    }

    setMessages(msgs);
  }

  // ─── Initialize ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (id) {
      const existing = getIdeaValidationTask(id);
      if (existing) {
        setTask(existing);
        // Rebuild messages from task state
        rebuildMessages(existing);
      } else {
        navigate('/validate');
      }
    }
  }, [id, navigate]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ─── Add Message ──────────────────────────────────────────────────────────

  function addMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>) {
    setMessages((prev) => [
      ...prev,
      {
        ...msg,
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
      },
    ]);
  }

  // ─── Handle New Idea ──────────────────────────────────────────────────────

  function handleCreateTask(idea: string) {
    if (!idea.trim()) return;

    setShowGoalPicker(true);
    setInputValue(idea);
  }

  function handleGoalSelected(goal: IdeaGoalType) {
    const idea = inputValue.trim();
    if (!idea) return;

    const newTask = createIdeaValidationTask({
      rawIdea: idea,
      goalType: goal,
    });

    setTask(newTask);
    setShowGoalPicker(false);
    setInputValue('');

    addMessage({
      role: 'user',
      content: idea,
    });

    addMessage({
      role: 'system',
      content: `目标类型：${IDEA_GOAL_LABELS[goal]}`,
    });

    // Start the workflow
    runTurn(newTask.id, 'start');
  }

  // ─── Run Turn ─────────────────────────────────────────────────────────────

  async function runTurn(taskId: string, action?: string, userMessage?: string) {
    setIsLoading(true);

    try {
      const result = await runIdeaValidationTurn({
        taskId,
        userMessage,
        action: action as never,
        onProgress: (event) => {
          // Could update a progress indicator here
          console.log('[IdeaValidation] Progress:', event);
        },
      });

      setTask(result.task);

      addMessage({
        role: 'agent',
        content: result.reply,
        nodeKey: result.task.currentNodeId as IdeaValidationNodeKey,
      });

      // If requires user input, focus the input
      if (result.requiresUserInput) {
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      addMessage({
        role: 'system',
        content: `错误：${err instanceof Error ? err.message : '未知错误'}`,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function openDevSpec(t: IdeaValidationTask) {
    const briefId = ensureProductBriefFromIdeaValidationTask(t);
    navigate(`/output/${briefId}`);
  }

  // ─── Handle Send ──────────────────────────────────────────────────────────

  function handleSend() {
    if (!inputValue.trim() || !task || isLoading) return;

    const msg = inputValue.trim();
    setInputValue('');

    addMessage({
      role: 'user',
      content: msg,
    });

    // Determine action based on current state
    const currentNode = task.nodes.find((n) => n.key === task.currentNodeId);
    const action =
      currentNode?.key === 'clarification' && currentNode?.status === 'waiting_user'
        ? 'answer_clarification'
        : undefined;

    runTurn(task.id, action, msg);
  }

  // ─── Handle Key Press ─────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  // No task yet — show input
  if (!task) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--vp-bg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <header className="vp-header">
          <div className="vp-header-inner">
            <button
              className="vp-btn-text"
              onClick={() => navigate('/')}
              style={{ padding: '4px 6px' }}
            >
              <Home size={16} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Idea Validation Agent</span>
            <button
              className="vp-btn-text"
              onClick={() => navigate('/history')}
              style={{ padding: '4px 6px' }}
            >
              <History size={16} />
            </button>
          </div>
        </header>

        {/* Center Input */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
          }}
        >
          <div style={{ maxWidth: 600, width: '100%', textAlign: 'center' }}>
            <div
              style={{
                fontSize: 48,
                marginBottom: 16,
              }}
            >
              💡
            </div>
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--vp-text)',
                marginBottom: 8,
              }}
            >
              验证一个想法
            </h1>
            <p
              style={{
                fontSize: 14,
                color: 'var(--vp-text-secondary)',
                marginBottom: 32,
                lineHeight: 1.6,
              }}
            >
              描述你的产品想法，AI 会帮你分析是否有价值、是否有竞品、是否值得做。
            </p>

            {/* Input Box */}
            <div
              className="vp-card"
              style={{
                padding: 16,
                textAlign: 'left',
              }}
            >
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (showGoalPicker) return;
                    handleCreateTask(inputValue);
                  }
                }}
                placeholder="例如：我想做一个帮助设计学生优化 AI 生图 prompt 的工具..."
                style={{
                  width: '100%',
                  minHeight: 100,
                  padding: 12,
                  border: '1px solid var(--vp-border)',
                  borderRadius: 8,
                  background: 'var(--vp-surface)',
                  color: 'var(--vp-text)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  resize: 'vertical',
                  outline: 'none',
                }}
              />

              {/* Goal Picker */}
              {showGoalPicker && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--vp-text-secondary)',
                      marginBottom: 8,
                    }}
                  >
                    你的目标是什么？
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 8,
                    }}
                  >
                    {GOAL_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className="vp-btn vp-btn-ghost"
                        onClick={() => handleGoalSelected(opt.value)}
                        style={{
                          padding: '8px 12px',
                          fontSize: 13,
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              {!showGoalPicker && (
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                  <button
                    className="vp-btn vp-btn-primary"
                    onClick={() => handleCreateTask(inputValue)}
                    disabled={!inputValue.trim()}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <Search size={14} />
                    开始验证
                  </button>
                </div>
              )}
            </div>

            {/* Example Ideas */}
            <div style={{ marginTop: 24, textAlign: 'left' }}>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--vp-text-secondary)',
                  marginBottom: 8,
                }}
              >
                试试这些想法：
              </div>
              {[
                '帮助设计师用 AI 快速生成 UI 原型',
                '一个能自动分析代码质量的 VS Code 插件',
                '面向小商家的智能客服系统',
              ].map((example) => (
                <button
                  key={example}
                  className="vp-btn-text"
                  onClick={() => {
                    setInputValue(example);
                    inputRef.current?.focus();
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 0',
                    fontSize: 13,
                    color: 'var(--vp-text-secondary)',
                  }}
                >
                  「{example}」
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Has task — show conversation
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--vp-bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header className="vp-header">
        <div className="vp-header-inner">
          <button
            className="vp-btn-text"
            onClick={() => navigate('/')}
            style={{ padding: '4px 6px' }}
          >
            <Home size={16} />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {task.clarifiedIdea ?? task.rawIdea.slice(0, 30) + '...'}
          </span>
          <button
            className="vp-btn-text"
            onClick={() => navigate('/history')}
            style={{ padding: '4px 6px' }}
          >
            <History size={16} />
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div
        style={{
          padding: '8px 16px',
          background: 'var(--vp-surface)',
          borderBottom: '1px solid var(--vp-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {task.nodes.map((node, i) => {
            const Icon = NODE_ICONS[node.key] ?? Circle;
            const isActive = node.key === task.currentNodeId;
            const isCompleted = node.status === 'completed';
            const isFailed = node.status === 'failed';
            const isSkipped = node.status === 'skipped';

            return (
              <div
                key={node.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isCompleted
                      ? 'var(--vp-success)'
                      : isFailed
                        ? 'var(--vp-error)'
                        : isActive
                          ? 'var(--vp-primary)'
                          : 'var(--vp-border)',
                    color:
                      isCompleted || isFailed || isActive
                        ? '#fff'
                        : 'var(--vp-text-secondary)',
                    transition: 'all 0.3s',
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={12} />
                  ) : isFailed ? (
                    <AlertTriangle size={12} />
                  ) : isSkipped ? (
                    <SkipForward size={12} />
                  ) : (
                    <Icon size={12} />
                  )}
                </div>
                {i < task.nodes.length - 1 && (
                  <div
                    style={{
                      width: 20,
                      height: 2,
                      background: isCompleted ? 'var(--vp-success)' : 'var(--vp-border)',
                      transition: 'all 0.3s',
                    }}
                  />
                )}
              </div>
            );
          })}
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 12,
              color: 'var(--vp-text-secondary)',
            }}
          >
            {task.progressPercent}%
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} task={task} />
        ))}

        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              background: 'var(--vp-surface)',
              borderRadius: 12,
              alignSelf: 'flex-start',
              maxWidth: '80%',
            }}
          >
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--vp-primary)' }} />
            <span style={{ fontSize: 13, color: 'var(--vp-text-secondary)' }}>
              分析中...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input / Quick Actions */}
      <div
        style={{
          padding: '12px 16px',
          background: 'var(--vp-surface)',
          borderTop: '1px solid var(--vp-border)',
        }}
      >
        {task.status !== 'completed' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                task.status === 'waiting_user'
                  ? '输入你的回答...'
                  : '输入消息或指令...'
              }
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                padding: '8px 12px',
                border: '1px solid var(--vp-border)',
                borderRadius: 8,
                background: 'var(--vp-bg)',
                color: 'var(--vp-text)',
                fontSize: 14,
                lineHeight: 1.5,
                resize: 'none',
                outline: 'none',
              }}
            />
            <button
              className="vp-btn vp-btn-primary"
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Send size={14} />
            </button>
          </div>
        )}

        {/* Quick Actions */}
        {task.decision && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: task.status !== 'completed' ? 8 : 0,
              flexWrap: 'wrap',
            }}
          >
            {task.decision.shouldGenerateDevSpec && (
              <button
                className="vp-btn vp-btn-ghost"
                onClick={() => openDevSpec(task)}
                style={{ fontSize: 12, padding: '4px 8px' }}
              >
                <FileText size={12} style={{ marginRight: 4 }} />
                生成 DEV_SPEC
              </button>
            )}
            <button
              className="vp-btn vp-btn-ghost"
              onClick={() => navigate(`/validate/${task.id}/result`)}
              style={{ fontSize: 12, padding: '4px 8px' }}
            >
              <BarChart3 size={12} style={{ marginRight: 4 }} />
              查看报告
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Message Bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  task,
}: {
  message: ChatMessage;
  task: IdeaValidationTask;
}) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '4px 0',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: 'var(--vp-text-secondary)',
            background: 'var(--vp-surface)',
            padding: '2px 12px',
            borderRadius: 12,
          }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        className="vp-card"
        style={{
          maxWidth: '80%',
          padding: '12px 16px',
          background: isUser ? 'var(--vp-primary)' : 'var(--vp-surface)',
          color: isUser ? '#fff' : 'var(--vp-text)',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        }}
      >
        {/* Node Badge */}
        {message.nodeKey && !isUser && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--vp-text-secondary)',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {(() => {
              const Icon = NODE_ICONS[message.nodeKey] ?? Circle;
              return <Icon size={11} />;
            })()}
            <span>{VALIDATION_NODE_LABELS[message.nodeKey]}</span>
          </div>
        )}

        {/* Content */}
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>

        {/* Research Results Cards */}
        {message.nodeKey === 'github_research' && task.research.githubRepos.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <GitHubRepoCards repos={task.research.githubRepos.slice(0, 3)} />
          </div>
        )}

        {message.nodeKey === 'opportunity_evaluation' && task.evaluation && (
          <div style={{ marginTop: 12 }}>
            <EvaluationCard evaluation={task.evaluation} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GitHub Repo Cards ───────────────────────────────────────────────────────

function GitHubRepoCards({ repos }: { repos: GitHubReference[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {repos.map((repo) => (
        <a
          key={repo.id}
          href={repo.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            padding: '8px 12px',
            background: 'var(--vp-bg)',
            borderRadius: 8,
            border: '1px solid var(--vp-border)',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Package size={14} style={{ color: 'var(--vp-text-secondary)' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{repo.fullName}</span>
            {repo.stars && (
              <span style={{ fontSize: 11, color: 'var(--vp-text-secondary)' }}>
                ⭐ {repo.stars.toLocaleString()}
              </span>
            )}
          </div>
          {repo.description && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--vp-text-secondary)',
                marginTop: 4,
                lineHeight: 1.4,
              }}
            >
              {repo.description.slice(0, 100)}
              {repo.description.length > 100 ? '...' : ''}
            </div>
          )}
        </a>
      ))}
    </div>
  );
}

// ─── Evaluation Card ─────────────────────────────────────────────────────────

function EvaluationCard({ evaluation }: { evaluation: OpportunityEvaluation }) {
  const metrics = [
    { label: '需求强度', value: evaluation.demandStrength },
    { label: '用户清晰度', value: evaluation.userClarity },
    { label: '差异化空间', value: evaluation.differentiationSpace },
    { label: '技术可行性', value: evaluation.technicalFeasibility },
  ];

  return (
    <div
      style={{
        padding: '12px',
        background: 'var(--vp-bg)',
        borderRadius: 8,
        border: '1px solid var(--vp-border)',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <BarChart3 size={14} />
        评估结果
      </div>

      {/* Score Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 8,
            background: 'var(--vp-border)',
            borderRadius: 4,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${evaluation.overallScore}%`,
              height: '100%',
              background:
                evaluation.overallScore >= 70
                  ? 'var(--vp-success)'
                  : evaluation.overallScore >= 40
                    ? 'var(--vp-warning)'
                    : 'var(--vp-error)',
              borderRadius: 4,
              transition: 'width 0.5s',
            }}
          />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{evaluation.overallScore}</span>
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--vp-text-secondary)' }}>{m.label}</span>
            <span style={{ fontWeight: 600 }}>{m.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
