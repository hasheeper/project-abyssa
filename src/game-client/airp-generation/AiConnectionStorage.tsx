import { useRef, useState, useSyncExternalStore } from "react";
import { aiConfiguration } from "../../game-runtime/airp-configuration";
import { RpgHexButton } from "../../shared/ui/primitives/RpgHexButton";
import { ConfirmationDialog } from "../../shared/ui/patterns/ConfirmationDialog";
import { InlineFeedback } from "../../shared/ui/patterns/SceneFeedback";
import { SceneLayer } from "../SceneLayer";

type Props = { store?: typeof aiConfiguration };
/** One quiet action row, shared with the Settings footer. No independent panel. */
export function AiConnectionStorage({ store = aiConfiguration }: Props) {
  const storage = useSyncExternalStore(store.subscribe, store.persistence.getSnapshot);
  const status = !storage.initialized ? "读取中…" : storage.dirty ? "有未保存修改" : storage.saved ? "已保存" : "尚未保存";
  return <section className="airp-settings-storage" aria-label="连接保存">
    <div className="airp-settings-storage-state">
      <span className="settings-config-state" data-modified={storage.dirty || undefined} role="status">{status}</span>
      {storage.error && <span className="airp-settings-storage-error" role="alert">{storage.error}</span>}
    </div>
    <RpgHexButton className="airp-settings-save" variant="teal" size="sm" disabled={storage.busy || (storage.saved && !storage.dirty)} onClick={() => void store.persistence.save()}>{storage.busy && storage.initialized ? "处理中…" : "保存"}</RpgHexButton>
  </section>;
}
export function AiConnectionHelp({ store = aiConfiguration }: Props) {
  const storage = useSyncExternalStore(store.subscribe, store.persistence.getSnapshot);
  const [deleting, setDeleting] = useState(false), [present, setPresent] = useState(false), [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null), locked = useRef(false);
  const forget = async () => {
    if (locked.current || storage.busy) return;
    locked.current = true; setError("");
    try {
      if (await store.persistence.forget()) setDeleting(false);
      else setError(store.persistence.getSnapshot().error ?? "删除未完成，请重试。");
    } finally { locked.current = false; }
  };
  return <details className="airp-settings-help"><summary>保存说明</summary>
    <p>保存地址、Key 和模型，下次自动恢复。未保存的修改仅本次有效，不会自动调用模型。</p>
    <p>配置仅存此浏览器；本机加密不能防御恶意扩展或被篡改的页面。</p>
    {storage.saved && <button ref={trigger} className="airp-settings-action" type="button" disabled={storage.busy} onClick={() => {setError(""); setDeleting(true);}}>删除本机配置</button>}
    <SceneLayer active={deleting || present}><ConfirmationDialog open={deleting} title="删除本机配置？" description="删除此浏览器保存的连接，不影响游戏存档。"
      confirmLabel="删除配置" tone="danger" busy={storage.busy} onConfirm={() => void forget()} onCancel={() => setDeleting(false)} returnFocusRef={trigger} onPresentChange={setPresent}>
      {error && <InlineFeedback message={error}/>}
    </ConfirmationDialog></SceneLayer>
  </details>;
}
