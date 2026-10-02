"use client";
import { Button, Alert } from "@/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-content">
      <Alert variant="error">Não foi possível carregar esta página.</Alert>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
