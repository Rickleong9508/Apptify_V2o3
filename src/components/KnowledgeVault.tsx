import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  CheckSquare, 
  Clock, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Pin, 
  Check, 
  Play, 
  Pause, 
  RotateCcw, 
  Tag, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  X,
  ChevronRight,
  Filter,
  Flame,
  AlertCircle
} from 'lucide-react';
import { getStoredLanguage, SupportedLanguage } from '../utils/i18n';

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: 'work' | 'idea' | 'meeting' | 'life';
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  category: 'work' | 'personal';
  createdAt: string;
}

interface KnowledgeVaultProps {
  onExit: () => void;
}

const CATEGORY_MAP = {
  work: { labelZh: '工作', labelEn: 'Work', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20' },
  idea: { labelZh: '灵感', labelEn: 'Idea', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20' },
  meeting: { labelZh: '会议', labelEn: 'Meeting', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/20' },
  life: { labelZh: '生活', labelEn: 'Life', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
};

const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'welcome-note',
    title: 'Welcome to NoteDown Workspace',
    content: 'Your dedicated personal notebook:\n- Capture meeting logs, quick memos, and thoughts\n- Tag categorization, pinning, and instant filter\n- Ask the AI Assistant to jot down notes on the fly!',
    category: 'work',
    pinned: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const INITIAL_TASKS: TaskItem[] = [
  {
    id: 'welcome-task-1',
    title: 'Explore NoteDown Action Tasks',
    completed: false,
    priority: 'high',
    dueDate: new Date().toISOString().slice(0, 10),
    category: 'work',
    createdAt: new Date().toISOString()
  },
  {
    id: 'welcome-task-2',
    title: 'Try asking AI: "Add a task: Review Friday report"',
    completed: false,
    priority: 'medium',
    category: 'work',
    createdAt: new Date().toISOString()
  }
];

const KnowledgeVault: React.FC<KnowledgeVaultProps> = ({ onExit }) => {
  const [lang, setLang] = useState<SupportedLanguage>(getStoredLanguage());
  useEffect(() => {
    const handleLang = () => setLang(getStoredLanguage());
    window.addEventListener('apptify_language_change', handleLang);
    return () => window.removeEventListener('apptify_language_change', handleLang);
  }, []);

  const [activeTab, setActiveTab] = useState<'notes' | 'tasks' | 'focus'>('notes');

  // --- Notes State ---
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('apptify_notes');
      return saved ? JSON.parse(saved) : INITIAL_NOTES;
    } catch {
      return INITIAL_NOTES;
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<'work' | 'idea' | 'meeting' | 'life'>('work');

  // --- Tasks State ---
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem('apptify_tasks');
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');

  // --- Focus Pomodoro State ---
  const [focusTime, setFocusTime] = useState(25 * 60); // 25 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [focusMode, setFocusMode] = useState<'work' | 'break'>('work');
  const [completedSessions, setCompletedSessions] = useState(0);

  const isExternalUpdateRef = React.useRef(false);

  // Sync Notes to LocalStorage & Dispatch Event
  useEffect(() => {
    if (isExternalUpdateRef.current) return;
    localStorage.setItem('apptify_notes', JSON.stringify(notes));
    window.dispatchEvent(new Event('apptify_data_changed'));
  }, [notes]);

  // Sync Tasks to LocalStorage & Dispatch Event
  useEffect(() => {
    if (isExternalUpdateRef.current) {
      isExternalUpdateRef.current = false;
      return;
    }
    localStorage.setItem('apptify_tasks', JSON.stringify(tasks));
    window.dispatchEvent(new Event('apptify_data_changed'));
  }, [tasks]);

  // Listen to external data changes (e.g. from Ask Apptify Copilot, Google Drive sync, or logout)
  useEffect(() => {
    const handleDataChange = () => {
      try {
        const savedNotes = localStorage.getItem('apptify_notes');
        const savedTasks = localStorage.getItem('apptify_tasks');
        isExternalUpdateRef.current = true;
        setNotes(savedNotes ? JSON.parse(savedNotes) : []);
        setTasks(savedTasks ? JSON.parse(savedTasks) : []);
      } catch (e) {
        console.error(e);
      }
    };
    window.addEventListener('apptify_data_changed', handleDataChange);
    window.addEventListener('apptify_notes_changed', handleDataChange);
    window.addEventListener('apptify_tasks_changed', handleDataChange);
    return () => {
      window.removeEventListener('apptify_data_changed', handleDataChange);
      window.removeEventListener('apptify_notes_changed', handleDataChange);
      window.removeEventListener('apptify_tasks_changed', handleDataChange);
    };
  }, []);

  // Pomodoro Countdown Timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && focusTime > 0) {
      interval = setInterval(() => {
        setFocusTime(prev => prev - 1);
      }, 1000);
    } else if (focusTime === 0) {
      setIsTimerRunning(false);
      if (focusMode === 'work') {
        setCompletedSessions(c => c + 1);
        setFocusMode('break');
        setFocusTime(5 * 60); // 5 min break
      } else {
        setFocusMode('work');
        setFocusTime(25 * 60);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, focusTime, focusMode]);

  // --- Note Actions ---
  const handleSaveNote = () => {
    if (!noteTitle.trim() && !noteContent.trim()) return;

    if (editingNote) {
      setNotes(prev => prev.map(n => n.id === editingNote.id ? {
        ...n,
        title: noteTitle.trim() || (lang === 'zh' ? '无标题笔记' : 'Untitled Note'),
        content: noteContent.trim(),
        category: noteCategory,
        updatedAt: new Date().toISOString()
      } : n));
    } else {
      const newNote: NoteItem = {
        id: 'note_' + Date.now(),
        title: noteTitle.trim() || (lang === 'zh' ? '无标题笔记' : 'Untitled Note'),
        content: noteContent.trim(),
        category: noteCategory,
        pinned: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setNotes(prev => [newNote, ...prev]);
    }

    setEditingNote(null);
    setIsCreatingNote(false);
    setNoteTitle('');
    setNoteContent('');
  };

  const handleEditNote = (note: NoteItem) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteCategory(note.category);
    setIsCreatingNote(true);
  };

  const handleDeleteNote = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleTogglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  // --- Task Actions ---
  const handleAddTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: TaskItem = {
      id: 'task_' + Date.now(),
      title: newTaskTitle.trim(),
      completed: false,
      priority: newTaskPriority,
      dueDate: new Date().toISOString().slice(0, 10),
      category: 'work',
      createdAt: new Date().toISOString()
    };
    setTasks(prev => [newTask, ...prev]);
    setNewTaskTitle('');
  };

  const handleToggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // Filtered Notes
  const filteredNotes = notes
    .filter(n => selectedCategory === 'all' || n.category === selectedCategory)
    .filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  // Filtered Tasks
  const filteredTasks = tasks.filter(t => {
    if (taskFilter === 'pending') return !t.completed;
    if (taskFilter === 'completed') return t.completed;
    return true;
  });

  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;
  const taskProgress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Format Time (MM:SS)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-28 px-4 sm:px-6 max-w-4xl mx-auto selection:bg-blue-500/20">
      {/* Page header — module identity, then the system segmented control */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="signal-label block text-black/40 dark:text-white/40">
            {lang === 'zh' ? '模块' : 'MODULE'}
          </span>
          <h1 className="text-[27px] font-semibold tracking-[-0.038em] leading-[1.05] mt-1.5 text-gray-900 dark:text-white">
            NoteDown
          </h1>
        </div>
        <span className="signal-label text-black/40 dark:text-white/40 mt-1 text-right">INK &amp; SIGNAL</span>
      </div>

      {/* Capsule segmented control — items flex equally */}
      <div className="seg mt-5 mb-6" role="tablist" aria-label={lang === 'zh' ? '模块视图' : 'Module views'}>
        <button
          role="tab"
          aria-selected={activeTab === 'notes'}
          onClick={() => setActiveTab('notes')}
          className={`seg__item flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 !px-2 ${
            activeTab === 'notes' ? 'is-on' : ''
          }`}
        >
          <FileText size={13} />
          <span className="truncate">{lang === 'zh' ? `笔记 (${notes.length})` : `Notes (${notes.length})`}</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'tasks'}
          onClick={() => setActiveTab('tasks')}
          className={`seg__item flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 !px-2 ${
            activeTab === 'tasks' ? 'is-on' : ''
          }`}
        >
          <CheckSquare size={13} />
          <span className="truncate">{lang === 'zh' ? `待办 (${pendingCount})` : `Tasks (${pendingCount})`}</span>
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'focus'}
          onClick={() => setActiveTab('focus')}
          className={`seg__item flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 !px-2 ${
            activeTab === 'focus' ? 'is-on' : ''
          }`}
        >
          <Clock size={13} />
          <span className="truncate">{lang === 'zh' ? '专注' : 'Focus'}</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: NOTES (随手记 & 工作日志)
          ========================================================================= */}
      {activeTab === 'notes' && (
        <div className="space-y-5 animate-fade-in">
          {/* Action Bar: Search & New Note */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={lang === 'zh' ? "搜索笔记标题或内容..." : "Search notes..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="ios-input w-full pl-10 pr-4 py-2.5 text-sm placeholder-gray-400"
              />
            </div>
            <button
              onClick={() => {
                setEditingNote(null);
                setNoteTitle('');
                setNoteContent('');
                setNoteCategory('work');
                setIsCreatingNote(true);
              }}
              className="px-5 py-2.5 rounded-full bg-[#2600FD] hover:bg-[#1F00D6] active:scale-95 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all whitespace-nowrap"
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>{lang === 'zh' ? '新建笔记' : 'New Note'}</span>
            </button>
          </div>

          {/* Category filter chips — horizontal rail, ink marks the active chip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11.5px] font-medium border whitespace-nowrap active:scale-95 transition-transform ${
                selectedCategory === 'all'
                  ? 'bg-[#0A0A0B] border-transparent text-white dark:bg-white dark:text-[#0A0A0B]'
                  : 'bg-white border-black/[0.14] text-black/70 dark:bg-transparent dark:border-white/[0.15] dark:text-white/70'
              }`}
            >
              {lang === 'zh' ? '全部笔记' : 'All Notes'}
            </button>
            {Object.entries(CATEGORY_MAP).map(([key, info]) => (
              <button
                key={key}
                onClick={() => setSelectedCategory(key)}
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11.5px] font-medium border whitespace-nowrap active:scale-95 transition-transform ${
                  selectedCategory === key
                    ? 'bg-[#0A0A0B] border-transparent text-white dark:bg-white dark:text-[#0A0A0B]'
                    : 'bg-white border-black/[0.14] text-black/70 dark:bg-transparent dark:border-white/[0.15] dark:text-white/70'
                }`}
              >
                {lang === 'zh' ? info.labelZh : info.labelEn}
              </button>
            ))}
          </div>

          {/* Notes Card Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredNotes.map(note => {
              const cat = CATEGORY_MAP[note.category];
              return (
                <div
                  key={note.id}
                  onClick={() => handleEditNote(note)}
                  className="group relative p-5 rounded-3xl liquid-card-blue backdrop-blur-2xl flex flex-col justify-between text-left active:scale-[0.98] transition-all duration-300 cursor-pointer hover:-translate-y-1 overflow-hidden min-h-[170px]"
                >
                  {/* Specular Shimmer */}
                  <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-white/20 dark:bg-white/10 blur-xl pointer-events-none" />

                  {/* Top Bar: Category & Pin */}
                  <div className="flex items-center justify-between w-full relative z-10">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${cat.color} backdrop-blur-md`}>
                      {lang === 'zh' ? cat.labelZh : cat.labelEn}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => handleTogglePin(note.id, e)}
                        className={`p-1.5 rounded-full transition-colors ${
                          note.pinned ? 'text-blue-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
                        }`}
                        title={note.pinned ? (lang === 'zh' ? '取消置顶' : 'Unpin note') : (lang === 'zh' ? '置顶笔记' : 'Pin note')}
                      >
                        <Pin size={14} className={note.pinned ? 'fill-current' : ''} />
                      </button>
                      <button
                        onClick={e => handleDeleteNote(note.id, e)}
                        className="p-1.5 text-gray-400 hover:text-rose-500 rounded-full transition-colors"
                        title={lang === 'zh' ? "删除" : "Delete"}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Title & Preview Content */}
                  <div className="my-2.5 relative z-10">
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white leading-snug line-clamp-1">
                      {note.title}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium mt-1 leading-relaxed line-clamp-3 whitespace-pre-wrap">
                      {note.content || (lang === 'zh' ? '无内容' : 'No content')}
                    </p>
                  </div>

                  {/* Footer Timestamp */}
                  <div className="flex items-center justify-between pt-2 border-t border-blue-500/10 text-[10px] text-gray-400 font-mono relative z-10">
                    <span>{new Date(note.updatedAt).toLocaleDateString()} {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      {lang === 'zh' ? '编辑' : 'Edit'} <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredNotes.length === 0 && (
              <div className="col-span-full p-10 rounded-3xl bg-white/50 dark:bg-white/5 backdrop-blur-xl border border-dashed border-gray-300 dark:border-white/10 text-center flex flex-col items-center justify-center">
                <FileText size={36} className="text-blue-500/40 mb-2" />
                <p className="font-bold text-gray-700 dark:text-gray-300 text-sm">{lang === 'zh' ? '暂无匹配的笔记' : 'No matching notes found'}</p>
                <p className="text-xs text-gray-400 mt-1">{lang === 'zh' ? '点击右上角“新建笔记”或让 AI 助手帮您记录一笔' : 'Click "New Note" above or ask AI assistant to record a note'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: TASKS & GTD (待办与工作清单)
          ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="space-y-6 animate-fade-in">
          {/* Progress Header Card */}
          <div className="p-5 sm:p-6 rounded-3xl liquid-card-blue backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                {lang === 'zh' ? '工作与生活待办概览' : 'Tasks & Action Items'}
              </span>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                {lang === 'zh' ? `今日完成率: ${taskProgress}%` : `Completion Rate: ${taskProgress}%`}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {lang === 'zh' ? `共 ${tasks.length} 项任务 · 待处理 ${pendingCount} 项 · 已完成 ${completedCount} 项` : `${tasks.length} Total · ${pendingCount} Pending · ${completedCount} Completed`}
              </p>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full sm:w-48 space-y-1.5">
              <div className="h-3 w-full bg-black/5 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/20">
                <div
                  style={{ width: `${taskProgress}%` }}
                  className="h-full bg-[#2600FD] rounded-full transition-all duration-500"
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                <span>0%</span>
                <span>{lang === 'zh' ? '目标 100%' : 'Goal 100%'}</span>
              </div>
            </div>
          </div>

          {/* Quick Task Input Form */}
          <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={lang === 'zh' ? "添加新的待办任务... (例如：写周报、跟进客户)" : "Add a new task... (e.g., Weekly report, Call client)"}
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/70 dark:bg-[#141416]/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:border-blue-500 transition-colors shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={newTaskPriority}
                onChange={e => setNewTaskPriority(e.target.value as any)}
                className="px-3 py-3 rounded-2xl bg-white/70 dark:bg-[#141416]/70 backdrop-blur-2xl border border-white/60 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none cursor-pointer"
              >
                <option value="high">{lang === 'zh' ? '🔴 紧急高优' : '🔴 High Priority'}</option>
                <option value="medium">{lang === 'zh' ? '🟡 正常跟进' : '🟡 Medium Priority'}</option>
                <option value="low">{lang === 'zh' ? '🟢 日常备忘' : '🟢 Low Priority'}</option>
              </select>
              <button
                type="submit"
                className="px-5 py-3 rounded-2xl bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>{lang === 'zh' ? '添加' : 'Add'}</span>
              </button>
            </div>
          </form>

          {/* Task filter chips */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTaskFilter('all')}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11.5px] font-medium border whitespace-nowrap active:scale-95 transition-transform ${
                taskFilter === 'all'
                  ? 'bg-[#0A0A0B] border-transparent text-white dark:bg-white dark:text-[#0A0A0B]'
                  : 'bg-white border-black/[0.14] text-black/70 dark:bg-transparent dark:border-white/[0.15] dark:text-white/70'
              }`}
            >
              {lang === 'zh' ? `全部 (${tasks.length})` : `All (${tasks.length})`}
            </button>
            <button
              onClick={() => setTaskFilter('pending')}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11.5px] font-medium border whitespace-nowrap active:scale-95 transition-transform ${
                taskFilter === 'pending'
                  ? 'bg-[#0A0A0B] border-transparent text-white dark:bg-white dark:text-[#0A0A0B]'
                  : 'bg-white border-black/[0.14] text-black/70 dark:bg-transparent dark:border-white/[0.15] dark:text-white/70'
              }`}
            >
              {lang === 'zh' ? `待处理 (${pendingCount})` : `Pending (${pendingCount})`}
            </button>
            <button
              onClick={() => setTaskFilter('completed')}
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-[11.5px] font-medium border whitespace-nowrap active:scale-95 transition-transform ${
                taskFilter === 'completed'
                  ? 'bg-[#0A0A0B] border-transparent text-white dark:bg-white dark:text-[#0A0A0B]'
                  : 'bg-white border-black/[0.14] text-black/70 dark:bg-transparent dark:border-white/[0.15] dark:text-white/70'
              }`}
            >
              {lang === 'zh' ? `已完成 (${completedCount})` : `Completed (${completedCount})`}
            </button>
          </div>

          {/* Task Items List */}
          <div className="space-y-2.5">
            {filteredTasks.map(task => (
              <div
                key={task.id}
                onClick={() => handleToggleTask(task.id)}
                className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-3 cursor-pointer group active:scale-[0.99] ${
                  task.completed
                    ? 'bg-white/40 dark:bg-white/5 border-gray-200/50 dark:border-white/5 opacity-60'
                    : 'bg-white/80 dark:bg-[#141416]/80 backdrop-blur-xl border-white/60 dark:border-white/10 shadow-sm hover:border-blue-500/40'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${
                      task.completed
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'border-2 border-gray-300 dark:border-gray-600 group-hover:border-blue-500'
                    }`}
                  >
                    {task.completed && <Check size={14} strokeWidth={3} />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className={`text-sm font-semibold truncate ${
                        task.completed
                          ? 'line-through text-gray-400 dark:text-gray-500'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {task.title}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                          task.priority === 'high'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : task.priority === 'medium'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {task.priority === 'high' ? (lang === 'zh' ? '高优先级' : 'High') : task.priority === 'medium' ? (lang === 'zh' ? '中等' : 'Medium') : (lang === 'zh' ? '日常' : 'Low')}
                      </span>
                      {task.dueDate && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                          <Calendar size={10} /> {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteTask(task.id);
                  }}
                  className="p-1.5 text-gray-300 hover:text-rose-500 rounded-lg transition-colors opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                  title={lang === 'zh' ? "删除待办" : "Delete task"}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            {filteredTasks.length === 0 && (
              <div className="p-8 rounded-3xl bg-white/40 dark:bg-white/5 backdrop-blur-md border border-dashed border-gray-300 dark:border-white/10 text-center">
                <p className="text-sm font-bold text-gray-500">{lang === 'zh' ? '没有待办事项' : 'No tasks'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{lang === 'zh' ? '在上方输入框添加任务，或对 AI 助手说：“帮我记个待办”' : 'Add a task above or ask AI assistant to add one'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: FOCUS POMODORO (沉浸专注番茄钟)
          ========================================================================= */}
      {activeTab === 'focus' && (
        <div className="space-y-6 animate-fade-in flex flex-col items-center">
          {/* Pomodoro Dial Card */}
          <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl liquid-card-blue backdrop-blur-3xl flex flex-col items-center text-center relative overflow-hidden">
            {/* Ambient Background Aura */}
            <div className={`absolute -inset-10 rounded-full blur-3xl opacity-30 transition-all duration-700 pointer-events-none ${
              isTimerRunning ? 'bg-blue-400 animate-pulse' : 'bg-transparent'
            }`} />

            {/* Mode Indicator */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold uppercase tracking-wider mb-6">
              <Flame size={14} className={isTimerRunning ? 'animate-bounce text-blue-500' : ''} />
              <span>{focusMode === 'work' ? (lang === 'zh' ? '沉浸工作专注' : 'Deep Work Session') : (lang === 'zh' ? '休息充电时刻' : 'Break Time')}</span>
            </div>

            {/* Digital Clock Display */}
            <div className="my-4 relative z-10">
              <span className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-gray-900 dark:text-white drop-shadow-sm">
                {formatTimer(focusTime)}
              </span>
            </div>

            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-8">
              {isTimerRunning ? (lang === 'zh' ? '正在专注中，请保持沉浸状态...' : 'Focusing... Stay in flow') : (lang === 'zh' ? '点击开始，保持 25 分钟单线程高效工作' : 'Click Start for a 25-minute single-task sprint')}
            </p>

            {/* Control Buttons */}
            <div className="flex items-center gap-4 relative z-10">
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${
                  isTimerRunning
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25'
                    : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/25'
                }`}
              >
                {isTimerRunning ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
              </button>

              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setFocusTime(focusMode === 'work' ? 25 * 60 : 5 * 60);
                }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-white/60 dark:border-white/15 shadow-sm active:scale-95 transition-all"
                title={lang === 'zh' ? "重置计时" : "Reset timer"}
              >
                <RotateCcw size={18} />
              </button>
            </div>

            {/* Stats Footer */}
            <div className="mt-8 pt-6 border-t border-blue-500/10 w-full flex justify-around text-xs font-bold text-gray-600 dark:text-gray-300">
              <div>
                <p className="text-[10px] text-gray-400 uppercase">{lang === 'zh' ? '今日专注回合' : 'Sessions Today'}</p>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400">{completedSessions} {lang === 'zh' ? '次' : 'rounds'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 uppercase">{lang === 'zh' ? '累计专注时长' : 'Total Focus Time'}</p>
                <p className="text-lg font-black text-blue-600 dark:text-blue-400">{completedSessions * 25} {lang === 'zh' ? '分钟' : 'mins'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE / EDIT NOTE MODAL (iOS Bottom Sheet on Mobile)
          ========================================================================= */}
      {isCreatingNote && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full sm:max-w-lg bg-white/95 dark:bg-[#141416]/95 backdrop-blur-3xl rounded-t-[32px] sm:rounded-3xl border-t sm:border border-white/60 dark:border-white/10 shadow-2xl p-6 space-y-4 pb-safe animate-fade-in-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                {editingNote ? (lang === 'zh' ? '编辑笔记' : 'Edit Note') : (lang === 'zh' ? '新建日常/工作笔记' : 'New Note')}
              </h3>
              <button
                onClick={() => setIsCreatingNote(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Note Title Input */}
            <input
              type="text"
              placeholder={lang === 'zh' ? "笔记标题..." : "Note title..."}
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-base font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
            />

            {/* Category Select Pills */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400">{lang === 'zh' ? '分类:' : 'Category:'}</span>
              {Object.entries(CATEGORY_MAP).map(([key, info]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNoteCategory(key as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border ${
                    noteCategory === key
                      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                      : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-transparent'
                  }`}
                >
                  {lang === 'zh' ? info.labelZh : info.labelEn}
                </button>
              ))}
            </div>

            {/* Note Content Textarea */}
            <textarea
              placeholder={lang === 'zh' ? "写下您的工作纪要、灵感草稿或任务备忘..." : "Write down your meeting memo, idea, or notes..."}
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
              rows={6}
              className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white outline-none focus:border-blue-500 transition-colors resize-none leading-relaxed"
            />

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreatingNote(false)}
                className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-white/10 font-bold text-sm text-gray-700 dark:text-gray-300 active:scale-95 transition-all"
              >
                {lang === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="flex-1 py-3 rounded-full bg-[#2600FD] hover:bg-[#1F00D6] text-white font-semibold text-sm active:scale-95 transition-all"
              >
                {lang === 'zh' ? '保存笔记' : 'Save Note'}
              </button>
            </div>

            {/* Clearance for the fixed bottom navigation dock (mobile sheet only) */}
            <div className="h-[92px] sm:hidden" aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeVault;
