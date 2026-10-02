"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Home,
  Users,
  Building2,
  ClipboardList,
  Send,
  Calendar,
  Folder,
  Bell,
  User,
  Shield,
  Settings,
  Tags,
  Gift,
  Plus,
  PanelLeft,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { Tooltip } from "@/components/ui";
import { Brand } from "@/components/brand";
import { ThemeSwitch } from "@/components/theme-switch";
import { getNavigation } from "@/lib/navigation";
import type { SafeUser } from "@/lib/contracts";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
const icons = {
  home: Home,
  users: Users,
  building: Building2,
  clipboard: ClipboardList,
  send: Send,
  calendar: Calendar,
  folder: Folder,
  alert: Bell,
  profile: User,
  shield: Shield,
  settings: Settings,
  categories: Tags,
  benefits: Gift,
  plus: Plus,
};
export function Shell({ user, children }: { user: SafeUser; children: React.ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [busy, setBusy] = useState(false);
  const pathname = usePathname();
  const navigation = (
    <nav aria-label="Menu principal">
      {getNavigation(user.accessProfile).map((group) => (
        <div className="nav-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map((item) => {
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                aria-current={pathname === item.href ? "page" : undefined}
                onClick={() => setMobile(false)}
              >
                <Icon size={19} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
  async function signOut() {
    setBusy(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Falha ao sair. Tente novamente.");
      setBusy(false);
    }
  }
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      <a className="skip-link" href="#main">
        Ir para conteúdo
      </a>
      <aside className="sidebar">
        <Link className="brand-link" href="/dashboard">
          <Brand compact={collapsed} />
        </Link>
        {navigation}
        <Tooltip label={collapsed ? "Expandir menu" : "Recolher menu"}>
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!collapsed}
          >
            <PanelLeft size={19} />
            <span>Recolher menu</span>
          </button>
        </Tooltip>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <Dialog.Root open={mobile} onOpenChange={setMobile}>
            <Dialog.Trigger className="icon-button mobile-toggle" aria-label="Abrir menu">
              <Menu size={20} />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content className="mobile-drawer">
                <Dialog.Title>
                  <Brand />
                </Dialog.Title>
                <Dialog.Description className="sr-only">Navegação principal</Dialog.Description>
                <Dialog.Close className="icon-button" aria-label="Fechar menu">
                  <X size={20} />
                </Dialog.Close>
                {navigation}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <div className="unit-label">
            <Building2 size={17} />
            {user.primaryUnit.name}
          </div>
          <div className="topbar-actions">
            <span className="pending-indicator" title="Módulo em desenvolvimento">
              <Bell size={17} />
              <span>Pendências —</span>
            </span>
            <ThemeSwitch />
            <Dropdown.Root>
              <Dropdown.Trigger className="profile-trigger" aria-label="Menu do perfil">
                <span className="avatar">{user.name.slice(0, 1)}</span>
                <span className="profile-copy">
                  {user.name}
                  <small>Matrícula {user.registrationNumber}</small>
                </span>
                <ChevronDown size={16} />
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content className="dropdown" align="end">
                  <Dropdown.Item asChild className="dropdown-item">
                    <Link href="/profile">Meu perfil</Link>
                  </Dropdown.Item>
                  <Dropdown.Item
                    className="dropdown-item"
                    disabled={busy}
                    onSelect={() => void signOut()}
                  >
                    {busy ? "Saindo..." : "Sair"}
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </header>
        <main id="main" className="page-content">
          {children}
        </main>
        <footer className="app-footer">CadFlux V1.1 · Fundação institucional</footer>
      </div>
    </div>
  );
}
