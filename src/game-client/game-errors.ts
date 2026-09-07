export function gameErrorText(code: string) {
  const messages: Record<string, string> = {
    "insufficient-funds": "小队金币不足。",
    "inventory-full": "这件补给已经备足，请减少数量。",
    "quote-expired": "货价已经变化，请重新读取。",
    "item-unavailable": "这件补给尚未购入或当前不出售。",
    "run-active": "请先结束当前旅程或片段，再回馆整备。",
    "not-found": "没有找到这份档案。",
    conflict: "进度已在另一页面改变，请重新读取。",
    "already-settled": "这次远征已经入账，请重新读取结果。",
    "storage-quota": "存储空间不足，进度尚未确认保存。",
    "storage-blocked": "存档连接正在等待其他页面关闭，请关闭旧页面后重试。",
    "storage-unavailable": "存档暂不可用，请重试。",
    "storage-aborted": "保存被中断，请重试。",
    "identity-mismatch": "档案定位已失效，请重新选择。",
    "pending-other-command": "还有尚未确认的操作，请先返回洋馆或战斗页面恢复，再调整装备。",
    "content-unavailable": "这份档案所需的内容版本不可用。",
    "content-mismatch": "这份档案所需的内容版本不可用。",
  };
  return messages[code] ?? `无法继续此操作（${code}），原档案已保留。`;
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
