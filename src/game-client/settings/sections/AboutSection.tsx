import { useState } from "react";
import { GAME_RELEASE, releaseInformation, releaseLabel } from "../../../shared/release/game-release";

export type SaveReleaseIdentity = {protocolVersion: number; rulesVersion: number; contentVersion: number; catalogDigest: string};

export function AboutSection({saveIdentity}: {saveIdentity?: SaveReleaseIdentity}) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const entries = [
    {term: `ABYSSA · ${GAME_RELEASE.stage.toUpperCase()}`, value: releaseLabel()},
    {term: "SOURCE · 源码提交", value: GAME_RELEASE.revision?.slice(0, 12) ?? "未知"},
    {term: "BUILD · 构建时间（UTC）", value: GAME_RELEASE.builtAt ?? "未知"},
    {term: "CANVAS", value: "固定画布 16:9 · 1600 × 900"},
    {term: "RUNTIME", value: "本地存档 · AIRP 浏览器直连"}
  ];
  const copy = async () => {
    setCopyState("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(releaseInformation());
      setCopyState("copied");
    } catch { setCopyState("failed"); }
  };
  return (
    <div className="settings-grid">
      <div className="settings-list">
        {entries.map((entry) => (
          <div key={entry.term} className="settings-row">
            <span className="settings-row__text">
              <strong>{entry.value}</strong>
              <small>{entry.term}</small>
            </span>
          </div>
        ))}
        <div className="settings-row settings-release-copy">
          <button type="button" className="settings-reset" disabled={copyState === "copying"} onClick={() => void copy()}>复制版本信息</button>
          <span role="status">{copyState === "copied" ? "已复制" : copyState === "failed" ? "复制失败，请在构建详情中手动选择。" : ""}</span>
        </div>
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
        <details className="settings-release-details">
          <summary>构建详情</summary>
          <pre>{releaseInformation()}</pre>
          <p className="settings-note">这里显示当前已加载客户端的身份，不代表远端最新版本。</p>
        </details>
        {saveIdentity && <details className="settings-release-details">
          <summary>当前存档身份</summary>
          <dl>
            <dt>协议</dt><dd>{saveIdentity.protocolVersion}</dd>
            <dt>规则</dt><dd>{saveIdentity.rulesVersion}</dd>
            <dt>内容</dt><dd>{saveIdentity.contentVersion}</dd>
            <dt>Catalog 摘要</dt><dd>{saveIdentity.catalogDigest}</dd>
          </dl>
          <p className="settings-note">存档兼容由协议与 Catalog 校验决定，不由游戏发行号决定。</p>
        </details>}
      </div>

      <aside className="settings-side">
        <span className="settings-side__label">使用说明</span>
        <p className="settings-note">
          正常游玩使用 AIRP，请在 Model 页保存自己的 HTTPS 模型连接；无模型入口仅供独立调试。
          界面动效偏好在本机保存并全局生效，其余演出与显示选项仅用于本页预览。
        </p>
      </aside>
    </div>
  );
}
