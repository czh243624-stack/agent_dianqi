import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg(props: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {props.children}
    </svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.8" />
      <rect x="13" y="10.5" width="7.5" height="10" rx="1.8" />
      <rect x="3.5" y="13.5" width="7.5" height="7" rx="1.8" />
    </Svg>
  );
}

export function IconInbox(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7.5h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10Z" />
      <path d="M4 12.5h4.2l1.3 2h5l1.3-2H20" />
      <path d="M8 5.5 12 3.5 16 5.5" />
    </Svg>
  );
}

export function IconSpark(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.6 9H19l-4.4 3.2L16.2 18 12 14.8 7.8 18l1.6-5.8L5 9h5.4L12 3.5Z" />
    </Svg>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 18.5c.6-3 2.6-4.5 5-4.5s4.4 1.5 5 4.5" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M16 14c2 .4 3.4 1.8 3.9 4.5" />
    </Svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16.5H7.8A2.8 2.8 0 0 0 5 22.3V5.5Z" />
      <path d="M8 7h8M8 11h6" />
    </Svg>
  );
}

export function IconSliders(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M4 17h16" />
      <circle cx="9" cy="7" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="2.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconLogs(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 5h11M8 12h11M8 19h11" />
      <circle cx="4.5" cy="5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="19" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export const NAV_ICONS = {
  dashboard: IconDashboard,
  inquiries: IconInbox,
  assistant: IconSpark,
  customers: IconUsers,
  knowledge: IconBook,
  config: IconSliders,
  logs: IconLogs,
} as const;
