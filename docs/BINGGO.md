# BingGo — 构建方案

**分支：`feature/binggo`** · **状态：进行中** · **main 未受影响**

> 这个功能按你的要求**暂不上线**。全部工作在这一条分支上，`main` 保持你当前在用的版本。
> `git checkout main` 随时回到现状；完成后再决定合并。

---

## 1. 已确认的三个技术选择

| 决策 | 选定方案 |
|---|---|
| 在哪做 | **git 分支 `feature/binggo`**（零重复、合并简单） |
| 语音 | **浏览器原生 Web Speech API**（免费、无需密钥、低延迟） |
| 记忆 | **本地持久 + 向量召回 + Drive 同步** |

---

## 2. 需求拆解

| # | 需求 | 状态 |
|---|---|---|
| 1 | AskApptify → **BingGo** 更名 | 待做 |
| 2 | 换成上传的形象，带眨眼/思考/高兴/难过 | **形象已完成** |
| 3 | 主页添加入口（参考 Foku 图） | 待做 |
| 4 | 点击进入**通话式**对话页（参考 Gemini Live 图） | 待做 |
| 5 | 认真对话 + **有记忆** | 记忆服务进行中 |
| 6 | **说话 / 看图片 / 听声音** | 语音服务进行中 |
| 7 | 多语言（英/中） | 复用现有 i18n |
| 8 | 其他页面**悬浮带眨眼的 BingGo** | 待做 |
| 9 | 能操作 APPTIFY 的**每一项任务** | 引擎已有，待扩展 |

---

## 3. 关键架构发现

### 3.1 技能引擎是「可搬运」的

`AskApptify.tsx` 里的 `executeAction(intent, data)`（约 470 行）**不依赖任何父组件状态**。它只做两件事：

```
读 → localStorage.getItem('mw_data_main' / 'apptify_notes' / 'apptify_tasks')
写 → localStorage.setItem(...) + dispatchEvent('apptify_data_changed')
```

只有**导航类意图**需要外部能力（`setCurrentApp`）。

**结论：** 可以把整套引擎抽到 `src/services/skillExecutor.ts`，让新旧两套界面共用，而不是把 1164 行的组件复制一份。这是本次重构最重要的决定——**复制组件会立刻产生两份需要同步维护的技能逻辑**。

### 3.2 「操作每一项任务」的地基已经存在

`skillRegistry.ts` 已有 3 组技能，带参数定义与中英例句：

| 技能组 | 意图 |
|---|---|
| MyWealth | `ADD_MONEY` `WITHDRAW_MONEY` `TRANSFER_MONEY` `ADD_BUDGET` `ADD_LOAN` `REPAY_LOAN` `QUERY` |
| NoteDown | 笔记与任务的增删改 |
| System | 页面导航 |

要满足「每一项任务」，需要扩到：账户增删改、预算项增删改、贷款增删改、持仓买卖、笔记/任务完整 CRUD、专注计时、新闻源管理、设置项、主题/语言。**每一个意图都需要在 `executeAction` 里配一个处理器**，这是独立的一条工作流。

### 3.3 多模态与记忆的底层已经在

- `aiService.chat(model, key, prompt, systemInstruction, images[])` —— **看图片已经通了**
- `aiService.embeddings(model, key, input)` —— **向量召回的地基已经在**
- Google Drive BYOS 同步 —— **跨设备记忆的地基已经在**

---

## 4. 形象设计（已完成）

按你给的图精确测量（源图 462×444）：

```
身体圆角    21.6%        眼睛对总宽   46.5%（占身体宽）
单眼宽      17.3%        单眼高       43.9%（占身体高）
双眼间距    11.9%        （用 space-between 实现，保证任意尺寸下几何不变）
```

**重绘为 DOM 而非贴图**——只有这样眼睛才能真正变形。全部表情只动两个可动画属性：`transform` 与 `border-radius`，因此：

- 每种表情变换都是 **GPU 合成**，不触发重排
- 表情**可在中途被打断**并平滑接续（不会跳帧）
- 单一组件服务全部尺寸（28px 到 160px 均已验证）

| 表情 | 实现 |
|---|---|
| `idle` | 基础竖椭圆 + 4.4s 呼吸缩放 |
| `blink` | `scaleY(0.07)`，随机 2.2–6s 触发一次，持续 140ms |
| `think` | 视线右上偏移 + 近眼收窄至 62%（眯眼，不是压扁色块）+ 三点环绕 |
| `happy` | 圆角改为 `50% 50% 0 0 / 100% 100% 0 0` —— **完整上拱弧**，身体上浮 5% |
| `sad` | 反拱 `0 0 50% 50% / 0 0 100% 100%` + 眼角外垂 13° |
| `listen` | 眼睛放大 8%，外圈 1px 脉冲环 |
| `speak` | 双眼错相 150ms 的 900ms 脉动，避免静态感 |

自动眨眼由组件自己管理：**只在外部持有 `idle` 时运行**，因此永远不会和刻意指定的表情打架。`prefers-reduced-motion` 下全部静止。

---

## 5. 分层与文件

```
新增
  src/components/BingGo.tsx          ✅ 形象组件（表情状态机 + 自动眨眼）
  src/components/BingGo.css          ✅ 形象样式
  src/services/voiceService.ts       ⏳ 语音（TTS + STT，浏览器原生）
  src/services/memoryService.ts      ⏳ 记忆（持久化 + 向量召回）
  src/services/skillExecutor.ts      ⬜ 从 AskApptify 抽出的技能引擎
  src/components/BingGoAssistant.tsx ⬜ 助理（文字对话 + 通话式界面）
  src/components/BingGoHomeCard.tsx  ⬜ 主页入口
  src/components/BingGoFab.tsx       ⬜ 悬浮召唤按钮（带眨眼）

改动
  src/services/skillRegistry.ts      ⬜ 扩展到覆盖每一项任务
  src/App.tsx                        ⬜ 挂载主页入口 + 悬浮按钮
  src/utils/i18n.ts                  ⬜ BingGo 文案（英/中）

退役
  src/components/AskApptify.tsx      ⬜ 逻辑迁走后由 BingGoAssistant 取代
```

---

## 6. 验证要求

- `npx tsc --noEmit` 零错误
- `npm run build` 通过
- 形象：全部尺寸 + 全部表情截图核对
- 技能：每个意图**真实执行一次**并检查 `localStorage` 落盘（不能只看界面）
- 语音：不支持该 API 的浏览器必须**降级而不是崩溃**
- 记忆：刷新后仍在；跨设备经 Drive 同步后仍在

---

## 7. 需要你后续拍板的点

1. **通话界面的视觉**：图三是深色渐变（Gemini 风）。你的 App 是白底四色系统，我倾向**保持 Ink & Signal**（蓝/黑/白/黄）而不是引入深色渐变，否则会和其他页面割裂。要不要保留一张深色通话页？
2. **语音的默认语言**：跟随 App 语言，还是独立设置？
3. **记忆的边界**：对话里的敏感财务数字要不要在写入记忆前脱敏？
4. **悬浮按钮的默认位置**：参考 Foku 图是右下角。但底部已有 dock，需要避开——我倾向放在 dock 上方右侧。
