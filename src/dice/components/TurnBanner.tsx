interface TurnBannerProps {
  title: string;
  subtitle: string;
  visible: boolean;
}

export function TurnBanner({ title, subtitle, visible }: TurnBannerProps) {
  return (
    <div className="turn-banner" data-show={visible ? "true" : "false"} aria-live="polite">
      <strong>{title}</strong><small>{subtitle}</small>
    </div>
  );
}
