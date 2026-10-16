import { BrandLoadingHold } from "@/components/shell/brand-loading-hold";
// Rota pesada: a vinheta do loading.tsx fica no mínimo 1,2 s quando aparece.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <BrandLoadingHold>{children}</BrandLoadingHold>;
}
