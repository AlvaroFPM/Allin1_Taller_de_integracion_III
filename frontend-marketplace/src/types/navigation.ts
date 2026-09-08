export interface NavItem {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface FooterLink {
  label: string;
  href: string;
  isExternal?: boolean;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface UserSession {
  id: number;
  name: string;
  email: string;
  initials: string;
  role: "CLIENTE" | "PROVEEDOR" | "ADMIN";
  avatarUrl?: string;
  isVerified?: boolean;
}

export interface NavbarProps {
  navItems?: NavItem[];
  user?: UserSession | null;
}

export interface FooterProps {
  sections?: FooterSection[];
}
