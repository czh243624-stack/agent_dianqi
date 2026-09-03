import type { WorkbenchUser } from "../auth";

export function UserAvatar(props: { user?: WorkbenchUser | null; className?: string }) {
  const className = props.className || "ry-avatar";
  if (props.user?.avatarUrl) {
    return <img className={className} src={props.user.avatarUrl} alt="" />;
  }
  return <div className={className}>{props.user?.avatarText || "业"}</div>;
}
