export type Language = 'en' | 'zh';
export type SupportedLanguage = Language;

export interface Translations {
  launcher: {
    subtitle: string;
    myWealthTitle: string;
    myWealthDesc: string;
    netWorthLabel: string;
    myWealthFeatures: string;
    openWealth: string;
    vaultTitle: string;
    vaultTag: string;
    vaultDesc: string;
    openVault: string;
    newsTitle: string;
    newsTag: string;
    newsDesc: string;
    openNews: string;
    settingsTitle: string;
    settingsDesc: string;
  };
  nav: {
    home: string;
    themeToggle: string;
    langToggle: string;
  };
  copilot: {
    tabTitle: string;
    tabSub: string;
    drawerTitle: string;
    badge: string;
    status: string;
    inputPlaceholder: string;
    hint: string;
    quickExpense: string;
    quickIncome: string;
    quickNote: string;
    quickTask: string;
    quickWealth: string;
    quickTasks: string;
    welcomeMsg: string;
  };
  binggo: {
    name: string;
    tagline: string;
    ready: string;
    thinking: string;
    listening: string;
    speaking: string;
    errorState: string;
    emptyTitle: string;
    emptyBody: string;
    inputPlaceholder: string;
    send: string;
    call: string;
    endCall: string;
    hold: string;
    resume: string;
    attachImage: string;
    voiceOn: string;
    voiceOff: string;
    clear: string;
    back: string;
    confirm: string;
    cancel: string;
    you: string;
    quickExpense: string;
    quickNote: string;
    quickStory: string;
    quickNetWorth: string;
    thinkingLabel: string;
    memoryNote: string;
    unsupportedVoice: string;
    speakNow: string;
    yourAssistant: string;
    runsInside: string;
    bilingualFact: string;
    canDo: string;
    tileMemory: string;
    tileMemoryLabel: string;
    tileLanguage: string;
    tileLanguageLabel: string;
    tileActions: string;
    tileActionsLabel: string;
    tryAsking: string;
    talkTo: string;
  };
  invest: {
    moveUp: string;
    moveDown: string;
    reorder: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    launcher: {
      subtitle: 'Personal OS · Intelligent Workspace',
      myWealthTitle: 'MyWealth',
      myWealthDesc: 'Personal Finance & Asset Cockpit',
      netWorthLabel: 'Cash + Investments (Excl. Loans)',
      myWealthFeatures: 'Multi-Currency · 50/30/20 Budget · Debt Tracking',
      openWealth: 'Open Wealth Center',
      vaultTitle: 'NoteDown',
      vaultTag: 'Notes & Tasks',
      vaultDesc: 'Quick Notes · Action Tasks · Focus Timer',
      openVault: 'Enter',
      newsTitle: 'NewsHub',
      newsTag: 'Global News',
      newsDesc: 'Curated Tech, Markets & AI Insights',
      openNews: 'Enter',
      settingsTitle: 'Settings & Preferences',
      settingsDesc: 'AI Keys · Language · Theme · Offline Data',
    },
    nav: {
      home: 'Home',
      themeToggle: 'Toggle Theme',
      langToggle: 'Switch to Chinese',
    },
    copilot: {
      tabTitle: 'Ask Apptify',
      tabSub: 'Tap to Open',
      drawerTitle: 'Ask Apptify',
      badge: 'Personal AI',
      status: 'Full System Connected',
      inputPlaceholder: 'Ask anything, record expense, add tasks or notes...',
      hint: 'Supports natural language commands: e.g. "Spent RM25 on lunch" or "Add task: team sync"',
      quickExpense: '⚡ Lunch RM25',
      quickIncome: '💰 Deposit RM500',
      quickNote: '📝 Quick Idea Note',
      quickTask: '🎯 High Priority Task',
      quickWealth: '📊 Net Worth Summary',
      quickTasks: '📋 Todo Checklist',
      welcomeMsg: `Hello! I am your **Ask Apptify Personal AI**.\n\nI have complete awareness of your workspace. You can ask me questions or give me direct commands to **update your data** in real time:\n\n• 💳 **Expense & Income**: e.g. *"Record RM25 lunch"*, *"Deposit RM1000 into Maybank"*\n• 📝 **Quick Notes**: e.g. *"Create note: Ideas for Apptify redesign"*\n• 🎯 **Tasks & Todos**: e.g. *"Add task: Submit report by Friday"*, *"Complete task: Submit report"*\n• 📊 **Wealth Status**: e.g. *"Check my net worth and wallet balances"*`,
    },
    binggo: {
      name: 'BingGo',
      tagline: 'Your assistant across Apptify',
      ready: 'Ready when you are',
      thinking: 'Working on it',
      listening: 'Listening',
      speaking: 'Speaking',
      errorState: 'That did not go through',
      emptyTitle: 'Nothing here yet',
      emptyBody: 'Ask in plain words. BingGo can move money, write notes, set tasks and read the news for you.',
      inputPlaceholder: 'Ask BingGo anything',
      send: 'Send',
      call: 'Start a voice session',
      endCall: 'End',
      hold: 'Hold',
      resume: 'Resume',
      attachImage: 'Attach an image',
      voiceOn: 'Voice replies on',
      voiceOff: 'Voice replies off',
      clear: 'Clear this conversation',
      back: 'Close',
      confirm: 'Confirm',
      cancel: 'Cancel',
      you: 'You',
      quickExpense: 'Log an expense',
      quickNote: 'Write a note',
      quickStory: 'Tell me a story',
      quickNetWorth: 'How am I doing',
      thinkingLabel: 'BingGo is thinking',
      memoryNote: 'Remembers earlier conversations',
      unsupportedVoice: 'This browser cannot speak or listen',
      speakNow: 'Speak',
      yourAssistant: 'Your assistant',
      runsInside: 'Runs inside Apptify',
      bilingualFact: 'English and Chinese — speaks and listens',
      canDo: 'What it can do',
      tileMemory: 'Remembers',
      tileMemoryLabel: 'Memory',
      tileLanguage: 'EN · 中文',
      tileLanguageLabel: 'Language',
      tileActions: 'Real changes',
      tileActionsLabel: 'Actions',
      tryAsking: 'Try asking',
      talkTo: 'Talk to BingGo',
    },
    invest: {
      moveUp: 'Move Up',
      moveDown: 'Move Down',
      reorder: 'Reorder',
    },
  },
  zh: {
    launcher: {
      subtitle: 'Personal OS · 个人智能系统',
      myWealthTitle: 'MyWealth',
      myWealthDesc: '个人财务与资产全局工作台',
      netWorthLabel: '现金+投资总额 (不计Loan)',
      myWealthFeatures: '多币种钱包 · 50/30/20 预算 · 负债追踪',
      openWealth: '进入资产中心',
      vaultTitle: 'NoteDown',
      vaultTag: '灵感便签与待办',
      vaultDesc: '日常速记 · 待办任务 · 沉浸专注',
      openVault: '进入',
      newsTitle: 'NewsHub',
      newsTag: '全球资讯',
      newsDesc: '多源科技 · 商业要闻 · AI 智能精炼',
      openNews: '进入',
      settingsTitle: '系统设置中心',
      settingsDesc: 'AI 密钥配置 · 语言切换 · 偏好设置',
    },
    nav: {
      home: '主页',
      themeToggle: '切换外观',
      langToggle: '切换为英文',
    },
    copilot: {
      tabTitle: 'Ask Apptify',
      tabSub: '点击展开',
      drawerTitle: 'Ask Apptify',
      badge: '专属私人助理',
      status: '全功能数据联动',
      inputPlaceholder: '输入记账、待办、笔记或查询指令...',
      hint: '支持自然语言直接更新数据：如 “记一笔午餐 25 块” 或 “新建待办：下午开会”',
      quickExpense: '⚡ 记午餐 RM25',
      quickIncome: '💰 存入 RM500',
      quickNote: '📝 随手记灵感',
      quickTask: '🎯 加高优待办',
      quickWealth: '📊 查总资产',
      quickTasks: '📋 查待办清单',
      welcomeMsg: `你好！我是你的 **Apptify 专属私人 AI 助手**。\n\n我精通当前 App 的全部功能，你可以随时向我咨询或直接下达命令来**更新 App 的数据**：\n\n• 💳 **财务记账**：如 *“记一笔午餐 28 块”*、*“存入 1000 到 Maybank”*\n• 📝 **灵感随手记**：如 *“记录笔记：明天下午讨论 Apptify UI 优化”*\n• 🎯 **任务待办**：如 *“新建待办：周五前提交财务周报”*、*“完成待办 提交财务周报”*\n• 📊 **资产查询**：如 *“查一下我的净资产和钱包余额”*`,
    },
    binggo: {
      name: 'BingGo',
      tagline: '贯穿整个 Apptify 的助理',
      ready: '随时可以开始',
      thinking: '正在处理',
      listening: '正在听',
      speaking: '正在说',
      errorState: '这次没成功',
      emptyTitle: '这里还是空的',
      emptyBody: '用日常话告诉我就行。BingGo 可以帮你记账、写笔记、建任务、读新闻。',
      inputPlaceholder: '问 BingGo 任何事',
      send: '发送',
      call: '开始语音会话',
      endCall: '结束',
      hold: '暂停',
      resume: '继续',
      attachImage: '附上一张图',
      voiceOn: '语音回复已开',
      voiceOff: '语音回复已关',
      clear: '清空这段对话',
      back: '关闭',
      confirm: '确认',
      cancel: '取消',
      you: '你',
      quickExpense: '记一笔支出',
      quickNote: '写条笔记',
      quickStory: '讲个故事',
      quickNetWorth: '我现在怎么样',
      thinkingLabel: 'BingGo 正在想',
      memoryNote: '记得之前聊过的内容',
      unsupportedVoice: '这个浏览器不支持说话或收音',
      speakNow: '说话',
      yourAssistant: '你的助理',
      runsInside: '运行在 Apptify 里',
      bilingualFact: '英语与中文——能说也能听',
      canDo: '它能做什么',
      tileMemory: '记得住',
      tileMemoryLabel: '记忆',
      tileLanguage: '中 · EN',
      tileLanguageLabel: '语言',
      tileActions: '真的改数据',
      tileActionsLabel: '动手',
      tryAsking: '试着说',
      talkTo: '跟 BingGo 说话',
    },
    invest: {
      moveUp: '上移',
      moveDown: '下移',
      reorder: '排序',
    },
  },
};

export const getStoredLanguage = (): Language => {
  const saved = localStorage.getItem('apptify_language');
  if (saved === 'zh' || saved === 'en') return saved;
  // Default to English as requested
  return 'en';
};

export const setStoredLanguage = (lang: Language) => {
  localStorage.setItem('apptify_language', lang);
  window.dispatchEvent(new Event('apptify_language_change'));
};
