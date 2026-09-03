import type { CSSProperties } from "react";
import { AvatarFrame } from "../../../shared/ui/primitives/AvatarFrame";
import { IconButton } from "../../../shared/ui/primitives/IconButton";
import { RpgFrame } from "../../../shared/ui/primitives/RpgFrame";
import { RibbonButton } from "../../../shared/ui/primitives/RibbonButton";
import { getCalibration } from "../../../shared/ui/patterns/spriteCalibration";
import { SORTIE_ACTION_ICONS, SORTIE_SPOIL_ICONS, maskStyle } from "./sortie-icons";
import { findQuestBrief } from "./sortie-quests";
import type { QuestYieldGrade } from "./sortie-quests";
import { SORTIE_COMMAND_LABELS, SORTIE_SLOT_COUNT, composeParty } from "./sortie-model";
import type { SortieLeader, SortieMember, SortieParty } from "./sortie-model";
import type { MapLocationConfig } from "../types";

/* ============ 委托侧板 ============
 *
 * 点地标弹出。回答「这地方是什么、带谁去、走不走」，
 * 不回答「难度几星、胜率多少」—— 编队即难度，数字会替玩家把牌读完。
 *
 * 风味 / 威胁 / 收益三块目前是占位：地标只有 id、名字与贴图
 * （src/apps/map/types.ts），委托内容层尚未建立。这里画出骨架并
 * 标明缺口，而不是编三段假文案冒充已定稿的设定。 */

export interface SortieQuestPanelProps {
  location: MapLocationConfig;
  side: "left" | "right";
  roster: readonly SortieMember[];
  leader: SortieLeader;
  party: SortieParty;
  /** 出击令被规则层拒绝的理由；null 即可出发。 */
  rejection: string | null;
  onEditParty: () => void;
  onDepart: () => void;
  onClose: () => void;
}

/* 凯尔没有头像素材（src/assets/avatar/ 只有九人，缺他），
   所以这一格退回立绘，靠 RP 那套逐角色校准取景。
   只取 scale 与 x：校准表的 y 是为「站地」设计的（origin 在脚底），
   这里锚定顶部，套用会把头切掉。 */
function leaderFraming(characterId: string): CSSProperties {
  const { scale, x } = getCalibration(characterId);
  return {
    width: `calc(var(--sortie-slot-w) * var(--sortie-slot-zoom) * ${scale})`,
    transform: `translateX(calc(-50% + ${x * 100}%))`
  };
}

/** 收益只表达相对档位。星形由 CSS 绘制，不依赖字体里的 ★ 字形。 */
function QuestYieldStars({ grade }: { grade: QuestYieldGrade }) {
  return (
    <span className="abyssa-sortie-quest__grade" role="img" aria-label={`${grade} 星收益`}>
      {[1, 2, 3].map((star) => (
        <i key={star} data-active={star <= grade || undefined} aria-hidden="true" />
      ))}
    </span>
  );
}

/** 三人站位图标：按钮仍由共享 IconButton 负责边框、状态与命中区。 */
function PartyFormationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7" r="2.55" />
      <circle cx="5.4" cy="9.2" r="1.85" />
      <circle cx="18.6" cy="9.2" r="1.85" />
      <path d="M7.7 18.2c.35-3.45 1.8-5.2 4.3-5.2s3.95 1.75 4.3 5.2" />
      <path d="M1.9 17.7c.24-2.65 1.4-4.05 3.5-4.05 1.15 0 2.05.42 2.67 1.25" />
      <path d="M22.1 17.7c-.24-2.65-1.4-4.05-3.5-4.05-1.15 0-2.05.42-2.67 1.25" />
    </svg>
  );
}

export function SortieQuestPanel({
  location,
  side,
  roster,
  leader,
  party,
  rejection,
  onEditParty,
  onDepart,
  onClose
}: SortieQuestPanelProps) {
  const brief = findQuestBrief(location.id);
  const members = party.memberIds
    .map((id) => roster.find((member) => member.id === id))
    .filter((member): member is SortieMember => Boolean(member));
  const composition = composeParty([
    ...members.map((member) => ({
      faces: member.faces,
      primarySuit: member.primarySuit,
      faction: member.faction
    })),
    ...(party.command === "personal" ? [{ faces: leader.faces }] : [])
  ]);
  const heroStyle = brief?.sceneImageUrl
    ? ({ "--sortie-quest-scene-image": `url("${brief.sceneImageUrl}")` } as CSSProperties)
    : undefined;

  return (
    /* 外框与名单抽屉同源。 */
    <RpgFrame
      className="abyssa-sortie-quest"
      variant="dark"
      padding="none"
      data-side={side}
      role="complementary"
      aria-label={`${location.name} 委托`}
    >
      <IconButton
        className="abyssa-sortie-quest__close"
        label="关闭委托"
        icon="close"
        size="sm"
        onClick={onClose}
      />

      <div
        className="abyssa-sortie-quest__hero"
        data-placeholder={brief?.sceneImageUrl ? undefined : true}
        style={heroStyle}
      >
        <header className="abyssa-sortie-quest__hd">
          <div className="abyssa-sortie-quest__title">
            <span>{location.englishName}</span>
            <h2>{location.name}</h2>
          </div>
        </header>
      </div>

      {brief ? (
        <>
          <p className="abyssa-sortie-quest__flavor">{brief.flavor}</p>

          <div className="abyssa-sortie-quest__intel">
            <section className="abyssa-sortie-quest__block">
              <h3>威胁</h3>
              <ul className="abyssa-sortie-quest__threats">
                {brief.threats.map((threat) => (
                  <li key={threat}>
                    <i style={maskStyle(SORTIE_ACTION_ICONS.attack)} aria-hidden="true" />
                    <span>{threat}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="abyssa-sortie-quest__block">
              <h3>收益</h3>
              <ul className="abyssa-sortie-quest__yields">
                {brief.yields.map((entry) => (
                  <li key={entry.spoil} data-spoil={entry.spoil}>
                    {/* 金币与晶石沿用全仓库统一的货币形制；素材走 mask 图标。 */}
                    {entry.spoil === "material" ? (
                      <i
                        className="abyssa-sortie-quest__spoil"
                        style={maskStyle(SORTIE_SPOIL_ICONS.material)}
                        aria-hidden="true"
                      />
                    ) : (
                      <span
                        className="abyssa-currency-amount abyssa-sortie-quest__coin"
                        data-currency={entry.spoil === "coin" ? "lira" : "crystal"}
                        aria-hidden="true"
                      >
                        <i>
                          <span data-part="ring" />
                          <span data-part="mark" />
                        </i>
                      </span>
                    )}
                    <span>{entry.label}</span>
                    <QuestYieldStars grade={entry.grade} />
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {brief.event && <p className="abyssa-sortie-quest__event">{brief.event}</p>}
        </>
      ) : (
        <p className="abyssa-sortie-quest__flavor" data-pending="true">
          这处地点还没有委托简报。
        </p>
      )}

      <section className="abyssa-sortie-quest__pt">
        <div className="abyssa-sortie-quest__party-head">
          <h3>出战队伍</h3>

          <div className="abyssa-sortie-quest__party-tools">
            <dl className="abyssa-sortie-quest__kv">
              <div>
                <dt>骰数</dt>
                <dd>
                  {composition.diceCount} · {SORTIE_COMMAND_LABELS[party.command]}
                </dd>
              </div>
            </dl>

            <IconButton
              className="abyssa-sortie-quest__edit-party"
              label="调整队伍"
              variant="dark"
              size="sm"
              shape="diamond"
              onClick={onEditParty}
            >
              <PartyFormationIcon />
            </IconButton>
          </div>
        </div>

        {/* 四个可选槽恒定画出，空位也要占地 —— 玩家得看见还剩几个孔。
            第五席是凯尔，托管时仍在位但压暗，不是消失。 */}
        <ul className="abyssa-sortie-quest__mini">
          {Array.from({ length: SORTIE_SLOT_COUNT }, (_, index) => {
            const member = members[index];
            if (!member) {
              return (
                /* 空位也用同一个框，只是不放照片 —— 形状一致才看得出
                   「这里还能放人」，换个形状会读成另一种东西。 */
                <li className="abyssa-sortie-slot" key={`empty-${index}`} data-empty="true">
                  <AvatarFrame className="abyssa-sortie-slot__art" />
                  <span className="abyssa-sortie-slot__nm">空位</span>
                </li>
              );
            }
            return (
              <li className="abyssa-sortie-slot" key={member.id} data-faction={member.faction}>
                {/* 头像框与 RP 对话共用同一个件（切角六边形 + 五层描边）。
                    素材用 avatar（1:1 裁好的脸），不用立绘：
                    格子只有 68 见方，塞 704x1472 的全身图要放大两倍
                    再裁掉 99.5% 的像素，既费解码又不如现成头像清楚。 */}
                <AvatarFrame
                  className="abyssa-sortie-slot__art"
                  src={member.thumbnailUrl}
                  fallback={member.shortName.slice(0, 1)}
                />
                <span className="abyssa-sortie-slot__nm">{member.shortName}</span>
              </li>
            );
          })}

          <li
            className="abyssa-sortie-slot"
            data-leader="true"
            data-enlisted={party.command === "personal" || undefined}
          >
            {/* 凯尔缺 avatar 素材（src/assets/avatar/ 只有九人），
                所以照片区放立绘并自己取景。框还是同一个 —— 形制统一，
                只是里面那张图的来源不同。 */}
            <AvatarFrame className="abyssa-sortie-slot__art" data-kind="portrait">
              {leader.portraitUrl && (
                <img src={leader.portraitUrl} alt="" style={leaderFraming(leader.id)} />
              )}
            </AvatarFrame>
            <span className="abyssa-sortie-slot__nm">
              {party.command === "personal" ? leader.shortName : "托管"}
            </span>
          </li>
        </ul>
      </section>

      <RibbonButton
        className="abyssa-sortie-quest__go"
        variant="dark"
        size="sm"
        fullWidth
        watermark={{ size: 34, outerOpacity: 0.5, innerOpacity: 0.24 }}
        disabled={rejection !== null}
        title={rejection ?? undefined}
        onClick={onDepart}
      >
        出发
      </RibbonButton>
      {rejection && <p className="abyssa-sortie-quest__reject" role="status">{rejection}</p>}
    </RpgFrame>
  );
}
