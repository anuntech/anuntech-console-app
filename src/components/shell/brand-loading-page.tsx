import { BrandLoading } from "@/components/shell/brand-loading";
// Fallback das rotas pesadas (painel, financeiro, jornadas). As demais usam
// o esqueleto de `workspace-loading`.
export default function Loading() {
  return <BrandLoading />;
}
