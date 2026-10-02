"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  AlertCircle,
  ArrowLeftToLine,
  ArrowRightFromLine,
  Building2,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileText,
  Folder,
  Gift,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { ThemeSwitch } from "./theme-switch";
import { api, errorMessage } from "@/lib/api-client";
import { profileLabels, type SafeUser } from "@/lib/contracts";
import { getNavigation, type IconName } from "@/lib/navigation";
import { toast } from "sonner";

const subscribeMobile = (callback: () => void) => {
  const query = window.matchMedia("(max-width: 700px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const mobileSnapshot = () => window.matchMedia("(max-width: 700px)").matches;
const icons = {
  home: Home,
  users: Users,
  building: Building2,
  clipboard: ClipboardList,
  send: Send,
  calendar: CalendarDays,
  folder: Folder,
  alert: AlertCircle,
  profile: UserRound,
  shield: ShieldCheck,
  settings: Settings,
  categories: LayoutGrid,
  benefits: Gift,
  plus: Plus,
};
export function NavIcon({ name }: { name: IconName }) {
  const Icon = icons[name];
  return <Icon size={18} strokeWidth={1.7} aria-hidden />;
}

export function AppShell({ user, children }: { user: SafeUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useSyncExternalStore(subscribeMobile, mobileSnapshot, () => false);
  const sidebarRef = useRef<HTMLElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    if (!mobileOpen || !isMobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>("a, button:not([disabled])") || [],
      ).filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [mobileOpen, isMobile]);
  async function logout() {
    setLoggingOut(true);
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setLoggingOut(false);
    }
  }
  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      {mobileOpen && isMobile && (
        <button
          className="drawer-backdrop"
          aria-label="Fechar navegação"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        className="sidebar"
        id="app-navigation"
        aria-label="Menu principal"
        inert={isMobile && !mobileOpen}
        role={isMobile && mobileOpen ? "dialog" : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        aria-hidden={isMobile && !mobileOpen}
      >
        <div className="sidebar-brand">
          <Link
            href="/dashboard"
            aria-label="CadFlux, visão geral"
            onClick={() => setMobileOpen(false)}
          >
            <Brand compact={collapsed && !isMobile} light />
          </Link>
          <button
            className="icon-button mobile-close"
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="sidebar-context">
          <span className="context-dot" />
          <span>Ambiente de demonstração</span>
        </div>
        <nav aria-label="Navegação principal">
          {getNavigation(user.accessProfile).map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href === "/users" && pathname.startsWith("/users/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? "active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    onClick={() => setMobileOpen(false)}
                  >
                    <NavIcon name={item.icon} />
                    <span className="nav-text">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="nav-text">CadFlux V1.1 · Fase 1</span>
          <button
            className="icon-button collapse-button"
            aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ArrowRightFromLine size={18} /> : <ArrowLeftToLine size={18} />}
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-context">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              aria-controls="app-navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <Building2 size={17} aria-hidden />
            <span>{user.primaryUnit.name}</span>
          </div>
          <div className="topbar-actions">
            <span
              className="pending-indicator"
              title="Pendências estarão disponíveis em uma próxima fase"
            >
              <span />
              Sem pendências nesta fase
            </span>
            <ThemeSwitch />
            <Dropdown.Root>
              <Dropdown.Trigger className="profile-trigger" aria-label="Menu do perfil">
                <span className="avatar">{user.name.slice(0, 1)}</span>
                <span className="topbar-user">
                  <strong>{user.name}</strong>
                  <small>Matrícula {user.registrationNumber}</small>
                </span>
                <ChevronDown size={15} aria-hidden />
              </Dropdown.Trigger>
              <Dropdown.Portal>
                <Dropdown.Content className="dropdown" align="end" sideOffset={8}>
                  <Dropdown.Label className="dropdown-label">
                    {profileLabels[user.accessProfile]}
                  </Dropdown.Label>
                  <Dropdown.Item asChild className="dropdown-item">
                    <Link href="/profile">
                      <UserRound size={16} />
                      Meu perfil
                    </Link>
                  </Dropdown.Item>
                  <Dropdown.Item asChild className="dropdown-item">
                    <Link href="/change-password">
                      <FileText size={16} />
                      Alterar senha
                    </Link>
                  </Dropdown.Item>
                  <Dropdown.Separator className="dropdown-separator" />
                  <Dropdown.Item
                    className="dropdown-item"
                    disabled={loggingOut}
                    onSelect={() => void logout()}
                  >
                    <LogOut size={16} />
                    {loggingOut ? "Saindo..." : "Sair"}
                  </Dropdown.Item>
                </Dropdown.Content>
              </Dropdown.Portal>
            </Dropdown.Root>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="page-content">
          {children}
        </main>
        <footer className="app-footer">
          CadFlux · Gestão institucional <span>Dados fictícios de desenvolvimento</span>
        </footer>
      </div>
    </div>
  );
}
