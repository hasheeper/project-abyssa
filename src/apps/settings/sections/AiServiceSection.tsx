/**
 * AI 服务 —— 空白占位。
 *
 * ============ 为什么这里只有骨架,没有表单 ============
 * 后端(rp-style-lab)的模型链路是四层:
 *     AI Role → Logical Model Slot → Model Target → Provider Connection
 * 且明确规定 Provider 密钥与本机 Slot Binding **不进入** Release 或 Archive。
 * 这意味着"填一个 API Key"这种单层心智模型与真实契约不符 —— 密钥属于
 * Provider Connection,是本机作用域的东西,和应用内容是两回事。
 *
 * 契约既然没对齐,这里就不长出具体形状。画一组猜出来的输入框(模型名、
 * API Key、温度、最大 token)的坏处不是"白做",而是它会把错的心智模型
 * 固化下来:一旦有人照着实现,就得先把这套结构推翻。
 *
 * 所以本栏是禁用态骨架:标出**将会有哪几类东西**、各自的层级关系与归属。
 * 字段名、表单形状、校验规则全部留空,等后端契约进来。
 */

const PLACEHOLDERS: { title: string; scope: string; detail: string }[] = [
  {
    title: "Provider 连接",
    scope: "本机",
    detail: "服务商端点与凭据。凭据仅存于本机，不随应用内容一同导出。"
  },
  {
    title: "模型目标",
    scope: "本机",
    detail: "连接之上的具体模型与编解码配置，由连接再解析得到。"
  },
  {
    title: "逻辑模型槽",
    scope: "应用",
    detail: "应用声明的抽象槽位，绑定到本机模型目标后才可运行。"
  },
  {
    title: "AI 角色与管线任务",
    scope: "应用",
    detail: "消费逻辑模型槽的运行单元，随应用版本一同冻结。"
  }
];

export function AiServiceSection() {
  return (
    <div className="settings-grid">
      <div className="settings-list">
        {PLACEHOLDERS.map((item) => (
          <div key={item.title} className="settings-row" data-disabled aria-disabled="true">
            <span className="settings-row__text">
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </span>
            <div className="settings-row__control">
              <span className="settings-scope" data-scope={item.scope}>
                {item.scope}
              </span>
            </div>
          </div>
        ))}
      </div>

      <aside className="settings-side">
        <span className="settings-side__label">CONNECTION</span>

        <span className="settings-status" data-state="offline">
          <i aria-hidden="true" />
          未连接
        </span>

        {/* 两道空槽:示意此处将来会有可填内容,但不预设它是什么形状。 */}
        <span className="settings-slot" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>

        <p className="settings-note" data-tone="pending">
          后端运行时接口尚未对齐，本栏为占位骨架，暂不可配置。
        </p>
      </aside>
    </div>
  );
}
