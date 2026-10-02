"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { LoaderCircle, X, Inbox, Info, CheckCircle2, AlertCircle } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="spin" aria-hidden />}
      {children}
    </button>
  );
}
export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`input ${className}`} {...props} />;
}
export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`input select ${className}`} {...props}>
      {children}
    </select>
  );
}
export function Field({
  label,
  id,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-label="obrigatório"> *</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function Card({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}
export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "info";
}) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
export function Alert({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: "info" | "error" | "success" | "warning";
}) {
  const Icon =
    variant === "error" || variant === "warning"
      ? AlertCircle
      : variant === "success"
        ? CheckCircle2
        : Info;
  return (
    <div className={`alert alert-${variant}`} role={variant === "error" ? "alert" : "status"}>
      <Icon size={18} aria-hidden />
      <div>{children}</div>
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  icon,
  compact = false,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "empty-compact" : ""}`}>
      <div className="empty-icon">{icon || <Inbox size={24} strokeWidth={1.5} aria-hidden />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}
export function Tabs({
  items,
  defaultValue,
}: {
  items: { value: string; label: string; content: ReactNode }[];
  defaultValue?: string;
}) {
  return (
    <TabsPrimitive.Root defaultValue={defaultValue || items[0]?.value}>
      <TabsPrimitive.List className="tabs-list" aria-label="Informações do usuário">
        {items.map((item) => (
          <TabsPrimitive.Trigger className="tab-trigger" key={item.value} value={item.value}>
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content className="tab-content" key={item.value} value={item.value}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="dialog-description">
            {description || "Revise as informações antes de continuar."}
          </Dialog.Description>
          <Dialog.Close className="icon-button dialog-close" aria-label="Fechar janela">
            <X size={18} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  danger,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={loading ? () => {} : onOpenChange}
      title={title}
      description={description}
    >
      <div className="dialog-actions">
        <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancelar
        </Button>
        <Button variant={danger ? "danger" : "primary"} loading={loading} onClick={onConfirm}>
          {loading ? "Salvando..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Checkbox(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="checkbox" {...props} />;
}
export function Table({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-wrap">
      <table {...props}>{children}</table>
    </div>
  );
}
export function FilterBar(props: React.FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} className={`filter-bar ${props.className ?? ""}`} />;
}
export function Tooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="tooltip" sideOffset={6}>
            {label}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
export function Dropdown({
  trigger,
  items,
}: {
  trigger: React.ReactElement;
  items: { label: string; onSelect: () => void; disabled?: boolean }[];
}) {
  return (
    <DropdownPrimitive.Root>
      <DropdownPrimitive.Trigger asChild>{trigger}</DropdownPrimitive.Trigger>
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content className="dropdown" align="end">
          {items.map((item) => (
            <DropdownPrimitive.Item
              key={item.label}
              className="dropdown-item"
              onSelect={item.onSelect}
              disabled={item.disabled}
            >
              {item.label}
            </DropdownPrimitive.Item>
          ))}
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}
export { toast } from "sonner";
