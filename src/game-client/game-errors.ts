export function gameErrorText(code: string) {
  const messages: Record<string, string> = {
    "shop-sold-out": "这件商品已经售罄。",
    "equipment-inapplicable": "请选择一个适用的原生骰面。",
    "insufficient-funds": "银钱不足。",
    "inventory-full": "这件补给已经备足，请减少数量。",
    "airp-capacity": "这份档案的叙事容量已满，进度已保留。请先导出备份；当前版本不能继续扩展这份叙事档案。",
    "online-recovery-required": "这份档案已绑定在线叙事实例，暂不支持复制、升级或新周目。可用完整备份恢复原身份；不会覆盖或复用另一个可写实例。",
    "quote-expired": "货价已经变化，请重新读取。",
    "item-unavailable": "这件物品当前不由小队持有，或不支持此交易。",
    "run-active": "请先结束当前旅程或片段，再回馆整备。",
    "not-found": "没有找到这份档案。",
    conflict: "进度已在另一页面改变，请重新读取。",
    "already-settled": "这次远征已经入账，请重新读取结果。",
    "storage-quota": "存储空间不足，进度尚未确认保存。",
    "storage-blocked": "存档连接正在等待其他页面关闭，请关闭旧页面后重试。",
    "storage-unavailable": "存档暂不可用，请重试。",
    "storage-aborted": "保存被中断，请重试。",
    "internal-error": "操作未完成，已保存的进度保留。请重新读取后重试。",
    "identity-mismatch": "档案定位已失效，请重新选择。",
    "pending-other-command": "还有尚未确认的操作，请先返回洋馆或战斗页面恢复，再调整装备。",
    "content-unavailable": "这份档案所需的内容版本不可用。",
    "content-mismatch": "这份档案所需的内容版本不可用。",
  };
  return messages[code] ?? "操作未完成，已保存的进度保留。请查看详细原因。";
}
export function downloadJson(archive: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([archive], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
