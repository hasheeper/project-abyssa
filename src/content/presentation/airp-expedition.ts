import manor from "../../assets/backgrounds/old-manor/service-corridor.jpg";
import shore from "../../assets/backgrounds/tide-reef/bg.tide-reef.shore.jpg";

/** Live AIRP and read-only recollections use the same route presentation. */
export const airpExpeditionBackground = (routeId: string) => routeId.includes("tide-reef") ? shore : manor;
