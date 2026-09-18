# 洋馆 UI 入场与功能窗动效收口

日期：2026-09-17。范围：洋馆 UI、仓库／日志／整备进入与退出，以及相应渲染开销。延续现有木质／灰绿实体面板，不重做布局、美术、字体、槽位或世界镜头；不恢复已回退的 U3 全局推广。

## 实际 UI 清单与本轮处理

| UI | 本轮处理 |
| --- | --- |
| 左上身份牌、中上时间牌、右上领地账簿 | 依次从各自挂靠方向进入；时间牌从上方缓落 |
| 仓库、日志、整备三个入口 | 错开 40ms，作为三个完整小组件进入，图标与标签不拆开 |
| 左侧旅途菜单、左右浏览箭头、天气调试入口 | 短距离移动／淡入；不变更点击范围、fixed 定位或原 hover |
| 房间里的驻在角色头像 | 在原房间锚点处轻移显现；保留原头像环、气泡、悬浮和房间聚焦缩放 |
| 房间详情抽屉 | 从所在侧 28px 进入，560ms；正文延后 100ms 淡入 |
| 人物日常对话 | 整个 ADV 组合 12px 轻移、460ms；取消文字缩放和整幅背景模糊，保留原暗幕／打字／关闭逻辑 |
| 仓库（新旧数据入口）、日志、整备 | 显式使用同一 `manor` 功能窗预设 |
| 时间／天气切换幕 | 继续上一批独立演出；不会触发常驻 UI 再入场 |
| 剧情、同伴事件、提示与未开放的设施标记 | 保留原独立流程或短反馈；不强加新一轮全屏、逐行或循环动画 |

## 进入节奏与生命周期

### 洋馆常驻 UI

`useMansionIntro` 等待真实场景 `ready`、路由遮幕 `idle`、且没有剧情占用，再从 `waiting` 进入 `playing`。每次页面挂载只播放一次，不因 hover、库存开关、日志内容、天气或数据更新重播。

- 身份／时间／账簿延迟为 0／60／120ms，移动 22／30／22px。
- 三个功能入口延迟 200／240／280ms；菜单 220ms；浏览箭头 180ms。
- 常驻挂件 680ms，缓启动曲线 `cubic-bezier(.28,.08,.24,1)`。
- 驻在头像 620ms，局部错峰；42px 为世界坐标，最终受现有世界缩放影响。
- 最后一组结束于 960ms，1000ms 将状态收束为 `ready`，移除入场声明。不逐帧更新 React state。
- 提前点击、键盘操作可直接就位，不吞操作；不会跳过真实资源准备。后台、离场和减弱动态时收束。

只给 `.game-menu` 本身添加入场，不动画其父容器，避免祖先 transform 改变菜单内部 fixed 元素的定位。

### 三个功能窗

使用现有 `motion/react`，未增加依赖。`RpgModal`／`UiModal` 新增可选 `motionPreset="manor"`；默认 `surface` 仍为原 220ms／160ms／8px，其他窗口不自动迁移。

- 框体、关闭键、招牌一起从上方 30px 缓落，760ms；面板自身淡入 240ms。
- 暗幕独立淡入 180ms，背景不再做整幅 `backdrop-filter`。
- 正文延迟 140ms 后用 380ms 淡入＋8px 轻移；头部、导航、底栏延迟 100ms。
- 每个区域只播放一次，不给每个格子、条目建立动画实例。切换详情不重播窗体。
- 退出 200ms、向上 8px；减弱模式无位移，仅 80ms 淡变。
- 保留 Motion presence、同帧接焦、退出期输入隔离、快速重开以及卸载后焦点归还。三窗仍在 Stage 内联，不 portal。
- 面板临时 `will-change` 在完成后还原 `auto`；正文使用 `backwards`，结束不持续持有位移合成层。

## 卡顿来源与收敛

原仓库对整幅洋馆做 `blur(3px) saturate(.86)`。此外，弹窗开关与 `onPresentChange` 更新会带来第二次父组件更新，原不稳定数据／回调让世界房间、角色、SVG 子树及日志查询一起重新执行。

本轮措施：

1. 取消三窗及人物对话的整幅背景模糊，保留暗幕、面板材质、图标和原布局。
2. `useMansionEstate` 稳定静态设施、集合、时间查询与开关回调；`useMansionViewport` 稳定交互回调；世界镜头、灯光及报告入口参数 memo 化。
3. `MansionWorld` 使用 memo，内部图景子树另行 memo。仅输入隔离、镜头／拖动更新不会重建所有房间与头像；真正的美术、房间 hover／选择、角色位置变化仍正常刷新。
4. 洋馆局部 memo 化报告与库存入口。`CampaignReport` 的旅程、成长、记忆、剧情、引导查询按 `record/session` 缓存，条目／补给选择不重复全部查询；真实存档变化仍更新。
5. 覆盖窗口整个存在期（包括退出）暂停云、雨、夜间微光和标记循环。关闭恢复原动画进度，不拆装天空或重新生成纹理。

### 本机开发模式采样（不是全设备帧率保证）

在独立 QA 存档中用临时 React Profiler＋点击后 1300ms 的 rAF 采样对照仓库打开。记录的是 React `actualDuration` 与 rAF 间隔，不是完整 GPU 绘制耗时，也不是严格受控的统计基准。

| 仓库打开 | 清理前样本 | 清理后样本 |
| --- | ---: | ---: |
| 两次世界层 React 更新合计 | 14.2ms | 0.1ms |
| 两次洋馆 React 更新合计 | 61.8ms | 24.4ms |
| 最大 rAF 间隔 | 121ms | 53ms |
| 大于 34ms 的间隔数 | 3 | 1 |

清理后仓库移动采到 46 个不同位置，从 `-30px` 连续到 `0px`。关闭样本最大间隔 18ms，14 个退出位置，焦点归还正常。

恢复验收环境后的追加样本：日志最大间隔 83ms（2 个 >34ms）、整备 93ms（3 个 >34ms）；对应世界更新分别约 0.1ms／0.2ms。这说明本轮消除了明显的世界重复重算，但首次打开仍存在长帧，不能宣称全页已经稳定满帧。后续若继续优化，应分开测量窗口首建、图片解码／栅格与背景合成，不能继续只靠延长动画时间掩盖。

## 验收与回归

浏览器使用独立 QA 档，不推进时间、不结束远征、不调整携带物：

- 初次进入捕获 10 个挂件＋9 个驻在头像入场，均在真实场景 `ready`、UI `playing` 时开始。
- 仓库／日志／整备实际调用 `manor`；完成后面板位置为 0、`will-change:auto`，背景不模糊、装饰暂停。
- 日志切换“把剑暂时放下”、整备切换药水详情，正文／常驻 UI 入场次数不增加；关闭日志／整备后焦点回各自入口。
- 大厅详情实际使用 560ms 侧入；完成后 `translate:none`，保留原纵向居中 transform，没有定位偏移。
- 艾比希斯日常对白使用 460ms 轻移，打字到完整文本和关闭正常。
- 晴天切雨天结束后 `data-ui-intro=ready`，常驻 UI 入场次数未增加；未改变存档时间。最终冷刷新恢复晴天预览默认值。
- 临时 `MansionUiProbe.tsx`、Profiler 包装与 DOM output 已移除。删除探针时的旧 HMR 日志不计为冷刷新后的运行错误；冷刷新验收未出现新的错误。

自动验证通过：

- 16 个 app 测试文件，共 102 项：MansionPage、useMansionIntro、useMansionEstate、RpgModal、ResourceInventoryDialog、CampaignJournal、CampaignReport、DeparturePreparation、JournalBrowser、useDepartureLoadout、MansionTimeLoading、useMansionPresentation、mansion-image-readiness、TransitionProvider、GameShell、style-entry-boundaries。
- `typecheck:app`、`boundaries:check`、`motion:check`。
- `build:game`、`build:ui`。
- `tests/build/route-styles.test.mjs`（1 项）。
- `git diff --check`。

同时修正 `CampaignReport.test.tsx` 过期的固定 4 格断言，改为读取当前旅程规则的 `itemLimit`；现有生产规则为 6 格，本轮没有修改容量规则。
