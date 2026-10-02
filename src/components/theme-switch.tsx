"use client";
import { useTheme } from "next-themes";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Sun, Moon, Monitor, Check } from "lucide-react";
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        className="icon-button theme-trigger"
        aria-label="Selecionar tema"
        title="Selecionar tema"
      >
        <Sun size={18} className="sun-icon" />
        <Moon size={18} className="moon-icon" />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content className="dropdown" sideOffset={8} align="end" aria-label="Tema">
          <Dropdown.Label className="dropdown-label">Aparência</Dropdown.Label>
          {[
            { value: "light", label: "Claro", Icon: Sun },
            { value: "dark", label: "Escuro", Icon: Moon },
            { value: "system", label: "Sistema", Icon: Monitor },
          ].map(({ value, label, Icon }) => (
            <Dropdown.Item key={value} className="dropdown-item" onSelect={() => setTheme(value)}>
              <Icon size={16} />
              {label}
              {theme === value && (
                <Check size={15} className="menu-check" aria-label="Selecionado" />
              )}
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
