/**
 * 关于。
 *
 * 版本号刻意不从 package.json 读 —— 那是组件库(@abyssa/ui)的版本,
 * 不是游戏的发行版本。游戏版本以正式发布记录为准。
 */
const ENTRIES: { term: string; value: string }[] = [
  { term: "GAME", value: "ABYSSA · ALPHA" },
  { term: "CANVAS", value: "固定画布 16:9 · 1600 × 900" },
  { term: "RUNTIME", value: "本地存档 · AIRP 浏览器直连" }
];

export function AboutSection({ embedded = false }: { embedded?: boolean }) {
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
        <a
          className="settings-row settings-repository"
          href="https://github.com/hasheeper/project-abyssa"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="在 GitHub 查看 ABYSSA 项目仓库（新标签页）"
        >
          <span className="settings-row__text">
            <strong>GitHub · 项目仓库</strong>
            <small>SOURCE</small>
          </span>
          <span className="settings-repository__arrow" aria-hidden="true">↗</span>
        </a>
      </div>

      <aside className="settings-side">
        <span className="settings-side__label">{embedded ? "使用说明" : "NOTES"}</span>
        <p className="settings-note">
          在 Model 页保存模型连接，供 AIRP 使用。普通模式无需连接模型。
          界面动效偏好在本机保存并全局生效，其余演出与显示选项仅用于本页预览。
        </p>
      </aside>
    </div>
  );
}
