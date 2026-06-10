import logo from "../assets/logo.png";

interface Props {
  size?: "sm" | "md";
}

export function AppLogo({ size = "md" }: Props) {
  return (
    <div className={`app-logo app-logo-${size}`}>
      <img src={logo} alt="" className="app-logo-mark" />
      <span className="app-logo-text">FixPlease</span>
    </div>
  );
}
