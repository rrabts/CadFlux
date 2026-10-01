"use client";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";
function Toasts() { const { resolvedTheme } = useTheme(); return <Toaster position="bottom-right" richColors closeButton theme={resolvedTheme === "dark" ? "dark" : "light"} />; }
export function Providers({ children }: { children: ReactNode }) { return <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="cadflux-theme" disableTransitionOnChange>{children}<Toasts /></ThemeProvider>; }
