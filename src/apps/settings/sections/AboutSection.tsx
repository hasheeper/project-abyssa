/**
 * 关于。
 *
 * 版本号刻意不从 package.json 读 —— 那是组件库(@abyssa/ui)的版本,
 * 不是这个概念预览的版本,显示出来是错的信息。等真有发行版本再接。
 */
const ENTRIES: { term: string; value: string }[] = [
  { term: "INTERFACE", value: "Abyssa UI · 概念预览" },
  { term: "CANVAS", value: "固定画布 16:9 · 1600 × 900" },
  { term: "RUNTIME", value: "本地优先，单用户研发验证阶段" }
];

export function AboutSection() {
  return (
    <div className="settings-grid">
      <div className="settings-list">
        {ENTRIES.map((entry) => (
          <div key={entry.term} className="settings-row">
            <span className="settings-row__text">
              <strong>{entry.value}</strong>
              <small>{entry.term}</small>
            </span>
          </div>
        ))}
      </div>

      <aside className="settings-side">
        <span className="settings-side__label">NOTES</span>
        <p className="settings-note">
          本页为设置界面的概念预览。演出与显示两栏的条目均对应既有的实现旋钮，
          AI 服务一栏待后端接口对齐后再行接入。
        </p>
      </aside>
    </div>
  );
}
