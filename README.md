# 人生重开模拟器 · Life Restart Simulator

一个纯前端、零依赖、双语（中文 / English）的「一生模拟器」。
随机一副皮囊 → 挑三个天赋 → 一次点击过一个有意义的年份 → 活到死，看结局与评级。

没有构建步骤，没有框架，没有 `node_modules` —— 只有 ES modules、CSS 和一点点 DOM。

```
npm start          # → http://localhost:5173
```

> 必须用 `npm start` 打开。项目用的是原生 ES modules，直接双击 `index.html`
> （`file://`）会被浏览器的 CORS 策略拦截。

---

## 玩法

1. **天赋页**：每次重开都会掷出 5 项初始属性（颜值 / 智力 / 体质 / 家境 / 心情）
   和 6 个天赋，从中最多选 3 个。种子可以手动输入，用来复现同一条命。
2. **人生页**：点「继续」（或按空格）推进。**一次点击 = 一个有意义的事件**，
   平淡的年份会自动压缩成一行「20–25 岁，平淡而安稳地过去了」。
   也可以「快进 5 年」（5 个事件）或开启自动播放。
3. **决策**：14 个事件会在中途停下来让你选（分科、要不要孩子、父母生病……）。
   选项旁直接标出属性变化，选择会留下 flag，后续事件与结局会读它。
4. **结算页**：结局、评级（F–SSS）、评分、五项属性、本次新解锁的成就。

### 数值

| 项目 | 规则 |
| --- | --- |
| 属性 | `charm / intellect / physique / wealth / mood`，范围 `0..30` |
| 金钱 | 独立的 `¥` 货币，下限 `-40`；工作年份有收入，成年后有固定开销 |
| 体质 | 不是纯事件驱动：22 岁前自然成长，45 岁后渐近衰减，天赋会推后衰减起点 |
| 心情 | 会向个人基线回归（跌得快、升得慢），所以长期高心情需要持续经营 |
| 生命 | 死亡每年检定；自然死亡从 60 岁起按指数曲线上升，体质与寿命天赋直接影响曲线 |
| 随机 | `mulberry32` 确定性 PRNG：同 seed + 同选择 ⇒ 同一条命 |

当前 3000 局基线（`npm run test:engine` 会重新验证）：

- 平均寿命 **79.7** 岁，最高 **116**
- 一次一生平均 **53.6** 次点击（曾经「点几下就结束」的问题已修复）
- 结局分布：`ordinary 42% / wanderer 14% / wealthy 12% / beloved 8% / sage 7% /
  tycoon 6% / strong 6% / idol 2% / burnout 1% / legend 1% / hexagon 1% / ironman 0.3%`
- 评级分布近似钟形：`C 28% / B 24% / D 20% / A 14% / S 6% / F 5% / SS 3% / SSS 1%`

---

## 目录结构

```
life-restart-simulator/
├── index.html               # 唯一 HTML：三个 <link> + 一个 <script type="module">
├── server.js                # 零依赖静态服务器（ES modules 需要 http 源）
├── package.json             # 只有 scripts，没有 dependencies
├── src/
│   ├── core/                # 纯逻辑，绝不碰 DOM
│   │   ├── rng.js           # mulberry32 + seed 工具
│   │   ├── stats.js         # 属性定义、clamp、applyEffects
│   │   └── engine.js        # 全部规则：advance / resolveChoice / rollDeath /
│   │                        #   naturalDeath / applyBodyCurve / applyMoodDrift /
│   │                        #   yearlyUpkeep / careerOptions / summary
│   ├── content/             # 纯数据，只带 id 与效果，不含任何文案
│   │   ├── events.js        # 108 个事件（其中 14 个带 choices）
│   │   ├── talents.js       # 18 个天赋
│   │   ├── careers.js       # 12 种职业（收入区间 + 门槛）
│   │   ├── deaths.js        # 死因表 + 自然死亡曲线参数
│   │   ├── endings.js       # 12 个结局、评级阈值、lifeScore
│   │   └── achievements.js  # 20 个成就
│   ├── i18n/
│   │   ├── zh.js  en.js     # 全量文案，key 与占位符必须一一对应
│   │   └── index.js         # t(path, vars) / eventText() / setLang()
│   ├── styles/
│   │   ├── tokens.css       # 设计变量（颜色、圆角、字体、缓动）
│   │   ├── layout.css       # 页面骨架、aurora 背景、面板
│   │   └── components.css   # 按钮、属性块、事件日志、结算、成就……
│   └── ui/
│       ├── app.js           # 单入口状态机：newRun / beginLife / step / choose / render
│       ├── dom.js           # h() / mount() / toast() / animateNumber()
│       ├── state.js         # localStorage：设置、前世记录、成就
│       ├── components.js    # statGrid / updateStatGrid / chip / effectChips
│       └── views/           # talent.js / life.js / summary.js 三页渲染
├── test/                    # 全部零依赖
│   ├── engine.test.js       # 3000 局 + 不变量 + 可达性 + 节奏
│   ├── i18n.test.js         # 双语 key 全集 diff + 占位符一致性
│   └── ui.test.js           # 用本机 Chrome 通过 CDP 真跑一局
└── tools/
    ├── probe.js             # 5 种宽度 × 2 语言 × 4 屏的布局体检
    └── shot.js              # 截图工具（产物在 tools/shots/，已被 gitignore）
```

分层规则很简单：**`core` 不认识 DOM，`content` 不认识文案，`ui` 不认识规则细节。**
想加内容 → 改 `content` + `i18n`；想改规则 → 只改 `core`；想改外观 → 只改 `styles`。

---

## 命令

```bash
npm start              # 起服务（http://localhost:5173）
npm test               # engine + i18n（不需要浏览器）
npm run test:engine    # 3000 局模拟，打印分布并校验所有不变量
npm run test:i18n      # 双语完整性
npm run test:ui        # 起无头 Chrome 真点一局（需要服务已启动）
npm run probe          # 布局体检：1280 / 900 / 700 / 520 / 390px × zh/en
node tools/shot.js summary en   # 截图到 tools/shots/summary-en.png
```

`test:ui` 和 `probe` 都通过 **CDP over global WebSocket** 驱动机器上已安装的
Chrome/Edge，**不下载任何东西**（可用 `CHROME_PATH` 指定浏览器）。

---

## 加内容 / 加语言

### 加一个事件

```js
// src/content/events.js
{
  id: 'mid_sidequest',            // 唯一 id，同时是 i18n 的 key
  age: [40, 58],                  // 出现年龄区间（含）
  weight: 8,                      // 相对权重
  once: true,                     // 一生只出现一次（可选）
  tags: ['story', 'good'],        // lucky / unlucky 天赋会读它
  require: { intellect: 12 },     // 门槛（可选）
  choices: [                      // 可选：有 choices 就会暂停让玩家选
    { id: 'go', effects: { mood: 3, money: -2 }, flag: 'went' },
    { id: 'stay', effects: { mood: 1 } },
  ],
},
```

然后两条文案都要补（`test:i18n` 会强制检查）：

```js
// src/i18n/zh.js
mid_sidequest: {
  text: '……',
  choices: { go: '出发', stay: '留下' },
},
// src/i18n/en.js
mid_sidequest: {
  text: '…',
  choices: { go: 'Go', stay: 'Stay' },
},
```

`npm run test:engine` 会立刻告诉你这个事件是否能被触发 —— 不可达的事件会直接 assert 失败。

### 加一个结局

在 `src/content/endings.js` 的 `ENDINGS` 里按优先级插入（`check(ctx)` 里可用
`stats / money / age / flags / talents / career / history / peak / minMood / peakMood`），
再补 `endings.<id>.{name,desc}` 的中英文案。测试会验证它至少出现一次。

### 加一种语言

1. 复制 `src/i18n/zh.js` 为 `src/i18n/xx.js`，逐条翻译（key 与 `{placeholder}` 不能动）。
2. 在 `src/i18n/index.js` 的 `DICTS` 里注册，并加进 `LANGS`。
3. 在 `src/ui/app.js` 的 `topbar()` 语言切换数组里加一个按钮。

之后 `npm run test:i18n` 会自动把新语言和中文做全量 diff。

---

## 设计说明

- **一次点击一个事件。** `advance()` 内部是一个循环：它会一直转到下一个事件 /
  职业节点 / 死亡为止，把中间的平淡年份折叠成一条 `quiet` 记录。所以每次点击
  都有信息量，同时又保留「一年一年过」的节奏。
- **确定性。** 所有随机都走 `state.rng`，包括死亡检定、体质衰减、心情漂移。
  给定种子和选择序列，重放结果逐字节相同（`test/engine.test.js` 里有复现测试）。
- **可复现的平衡。** 结局阈值、评级切分、成就门槛、职业收入都对着 3000 局模拟标定，
  并且**用测试锁住方向**：任何结局 / 死因 / 成就 / 事件不可达，或寿命与点击次数
  掉出合理区间，测试就会失败。这比一次性「调手感」更耐用。
- **零依赖。** `package.json` 没有任何 `dependencies`；测试用 `node:assert` + 全局
  `WebSocket` 直连 Chrome DevTools Protocol。

## License

MIT
