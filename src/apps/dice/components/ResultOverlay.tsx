import { useState } from "react";
import type { HandRank, Side } from "../game";
import { DiceActionButton } from "../../../shared/ui/patterns/action-dock/DiceActionButton";
import { WoodCorners } from "./WoodCorners";

interface ResultOverlayProps {
  winner: Side | "tie";
  pot: number;
  playerRank: HandRank;
  opponentRank: HandRank;
  folded: Side | null;
  lumenPriorityWinner: Side | null;
  playerLumenScore: number;
  opponentLumenScore: number;
  playerBankroll: number;
  opponentBankroll: number;
  reportAvailable: boolean;
  reportState: {
    status: "idle" | "running" | "completed" | "failed";
    stage: "outline" | "polish" | "review" | "proposal" | null;
    report: string;
    proposal: string;
    error: string;
  };
  onGenerateReport: (targetLength: number) => void;
  onNextHand: () => void;
}

const stageLabels = {
  outline: "主模型整理大纲",
  polish: "三个文本分支并行润色",
  review: "主模型审核定稿",
  proposal: "生成变量与记忆提案"
} as const;

export function ResultOverlay({ winner, pot, playerRank, opponentRank, folded, lumenPriorityWinner, playerLumenScore, opponentLumenScore, playerBankroll, opponentBankroll, reportAvailable, reportState, onGenerateReport, onNextHand }: ResultOverlayProps) {
  const [targetLength, setTargetLength] = useState(1200);
  const title = winner === "tie" ? "平分底池" : winner === "player" ? "勇者赢得底池" : "缇比赢得底池";
  return (
    <div className="result-overlay">
      <section className="result-panel wood-panel">
        <WoodCorners />
        <div className="section-label">HAND SETTLED</div>
        <h2>{title}</h2>
        <div className="result-panel__pot"><small>POT</small><strong>{pot} G</strong></div>
        {folded ? (
          <p>{folded === "player" ? "你选择了弃牌。对手骰面公示后，本局按弃牌结算。" : "缇比选择了弃牌。她的骰面公示后，本局按弃牌结算。"}</p>
        ) : (
          <>
            <div className="result-panel__hands">
              <div><small>TIBBY</small><strong>{opponentRank.name}</strong><span>{opponentRank.english}</span></div>
              <i>VS</i>
              <div><small>YOU</small><strong>{playerRank.name}</strong><span>{playerRank.english}</span></div>
            </div>
            {lumenPriorityWinner && (
              <p>光显至上 · 明蛊 {opponentLumenScore} : {playerLumenScore}</p>
            )}
          </>
        )}
        <div className="result-panel__balances"><span>TIBBY <b>{opponentBankroll} G</b></span><span>YOU <b>{playerBankroll} G</b></span></div>
        <div className="result-panel__report-actions">
          <label>
            <span>战报篇幅</span>
            <select value={targetLength} onChange={event => setTargetLength(Number(event.target.value))} disabled={reportState.status === "running"}>
              <option value={800}>约 800 字</option>
              <option value={1200}>约 1200 字</option>
              <option value={1800}>约 1800 字</option>
            </select>
          </label>
          <DiceActionButton
            label={reportState.status === "completed" ? "重新生成战报" : "生成本局战报"}
            english="GENERATE REPORT"
            disabled={!reportAvailable || reportState.status === "running"}
            onClick={() => onGenerateReport(targetLength)}
          />
        </div>
        {!reportAvailable && <p className="result-panel__report-note">Runtime 未启用；本地骰局仍可正常进行。</p>}
        {reportState.status === "running" && reportState.stage && (
          <p className="result-panel__report-note">{stageLabels[reportState.stage]}…</p>
        )}
        {reportState.error && <p className="result-panel__report-error">{reportState.error}</p>}
        {reportState.report && (
          <section className="result-panel__report">
            <small>FINAL BATTLE REPORT</small>
            <p>{reportState.report}</p>
            {reportState.proposal && <em>变量与记忆提案已生成，尚未提交。</em>}
          </section>
        )}
        <DiceActionButton label="下一局" english="DEAL NEXT HAND" primary disabled={reportState.status === "running"} onClick={onNextHand} />
      </section>
    </div>
  );
}
