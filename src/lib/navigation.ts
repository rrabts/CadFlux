import type { AccessProfile } from "./contracts";
export type IconName =
  | "home"
  | "users"
  | "building"
  | "clipboard"
  | "send"
  | "calendar"
  | "folder"
  | "alert"
  | "profile"
  | "shield"
  | "settings"
  | "categories"
  | "benefits"
  | "plus";
export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  future?: boolean;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}
const overview: NavGroup = {
  label: "Início",
  items: [{ label: "Visão geral", href: "/dashboard", icon: "home" }],
};
const account: NavGroup = {
  label: "Conta",
  items: [{ label: "Meu perfil", href: "/profile", icon: "profile" }],
};
const future = (label: string, slug: string, icon: IconName): NavItem => ({
  label,
  href: `/workspace/${slug}`,
  icon,
  future: true,
});
const navigation: Record<AccessProfile, NavGroup[]> = {
  INTERVIEWER: [
    overview,
    {
      label: "Atendimentos",
      items: [
        future("Novo atendimento", "new-service", "plus"),
        future("Meus atendimentos", "my-services", "clipboard"),
      ],
    },
    {
      label: "Fechamento",
      items: [
        future("Semana atual", "current-week", "calendar"),
        future("Histórico", "closing-history", "folder"),
      ],
    },
    { label: "Documentos", items: [future("Documentos gerados", "documents", "folder")] },
    { label: "Pendências", items: [future("Minhas pendências", "my-pending", "alert")] },
    account,
  ],
  REFERRAL_OPERATOR: [
    overview,
    {
      label: "Encaminhamentos",
      items: [
        future("Novo encaminhamento", "new-referral", "plus"),
        future("Meus encaminhamentos", "my-referrals", "send"),
      ],
    },
    { label: "Pendências", items: [future("Minhas pendências", "my-pending", "alert")] },
    account,
  ],
  DIRECTION: [
    overview,
    {
      label: "Operação",
      items: [
        future("Atendimentos", "services", "clipboard"),
        future("Encaminhamentos", "referrals", "send"),
        future("Fechamentos", "closings", "calendar"),
        future("Pendências", "pending", "alert"),
      ],
    },
    {
      label: "Gestão",
      items: [
        { label: "Gestão de usuários", href: "/users", icon: "users" },
        { label: "Unidades", href: "/units", icon: "building" },
        future("Benefícios", "benefits", "benefits"),
        future("Tipos de atendimento", "service-types", "clipboard"),
        { label: "Categorias profissionais", href: "/categories", icon: "categories" },
      ],
    },
    {
      label: "Administração",
      items: [
        { label: "Auditoria", href: "/audit", icon: "shield" },
        future("Configurações", "settings", "settings"),
      ],
    },
    account,
  ],
};
export function getNavigation(profile: AccessProfile) {
  return navigation[profile];
}
export function getWorkspacePage(profile: AccessProfile, slug: string) {
  return getNavigation(profile)
    .flatMap((group) => group.items)
    .find((item) => item.href === `/workspace/${slug}`);
}
