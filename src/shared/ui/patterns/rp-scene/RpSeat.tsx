import type { CSSProperties } from "react";
import { Nameplate } from "../../primitives/Nameplate";
import type { ExpressionId } from "../expressions";
import type { RpActor, RpSeat } from "../rp-stage";
import { SeatActor } from "./SeatActor";
import type { DepartingRpActor } from "./useRpSeatLifecycle";
import type { RpCrop } from "./types";

interface RpSeatViewProps {
  seat: RpSeat;
  actorId: string | null;
  actorById: ReadonlyMap<string, RpActor>;
  departing: DepartingRpActor | null;
  activeActorId?: string;
  expressionByActor: ReadonlyMap<string, ExpressionId>;
  crop: RpCrop;
  onActorExited: (seat: RpSeat, token: number) => void;
}

export function RpSeatView({
  seat,
  actorId,
  actorById,
  departing,
  activeActorId,
  expressionByActor,
  crop,
  onActorExited
}: RpSeatViewProps) {
  const actor = actorId ? actorById.get(actorId) : undefined;
  const leavingActor = departing ? actorById.get(departing.actorId) : undefined;

  return (
    <div
      className="abyssa-rp__seat abyssa-frame"
      data-seat={seat}
      style={actor?.accent ? ({ "--abyssa-rp-accent": actor.accent } as CSSProperties) : undefined}
    >
      <span className="abyssa-frame__ornaments" aria-hidden="true">
        <i data-corner="tl" />
        <i data-corner="tr" />
        <i data-corner="bl" />
        <i data-corner="br" />
      </span>
      {departing && leavingActor && (
        <SeatActor
          key={`leave-${departing.token}`}
          actor={leavingActor}
          seat={seat}
          phase="leave"
          active={false}
          expression={expressionByActor.get(leavingActor.id) ?? leavingActor.expression ?? "a"}
          crop={crop}
          onExited={() => onActorExited(seat, departing.token)}
        />
      )}
      {actor && (
        <SeatActor
          key={actor.id}
          actor={actor}
          seat={seat}
          phase="enter"
          active={actor.id === activeActorId}
          expression={expressionByActor.get(actor.id) ?? actor.expression ?? "a"}
          crop={crop}
        />
      )}
      <Nameplate
        className="abyssa-rp__seat-name"
        data-show={actor ? "true" : "false"}
        name={actor?.fullName ?? actor?.name ?? ""}
        secondaryName={actor?.secondaryName}
      />
    </div>
  );
}
