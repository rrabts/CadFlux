import { Skeleton } from "@/components/ui";
export default function Loading() {
  return (
    <div role="status" className="page-content">
      Carregando...
      <Skeleton className="loading-block" />
    </div>
  );
}
