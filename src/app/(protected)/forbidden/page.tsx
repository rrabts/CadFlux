import { EmptyState } from "@/components/ui";
export default function Forbidden() {
  return (
    <EmptyState
      title="Acesso não permitido"
      description="Seu perfil não possui permissão para acessar esta área."
    />
  );
}
