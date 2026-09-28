"use client";
// Shared notifications follow the selected Console appearance.
import {
  CircleCheck,
  Info,
  TriangleAlert,
  OctagonX,
  LoaderCircle,
} from "lucide-react";
import { useAppearance } from "@/components/shell/appearance-provider";
import { Toaster as Sonner, type ToasterProps } from "sonner";
export function Toaster(props: ToasterProps) {
  const { theme } = useAppearance();
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      richColors
      closeButton
      visibleToasts={4}
      duration={7000}
      gap={10}
      offset={{ bottom: 88, right: 24 }}
      mobileOffset={{ bottom: 88, left: 16, right: 16 }}
      containerAriaLabel="Notificações"
      icons={{
        success: <CircleCheck size={18} aria-hidden="true" />,
        info: <Info size={18} aria-hidden="true" />,
        warning: <TriangleAlert size={18} aria-hidden="true" />,
        error: <OctagonX size={18} aria-hidden="true" />,
        loading: (
          <LoaderCircle
            size={18}
            className="toast-spinner"
            aria-hidden="true"
          />
        ),
      }}
      toastOptions={{
        className: "console-toast",
        classNames: { description: "console-toast-description" },
        closeButtonAriaLabel: "Fechar notificação",
      }}
      {...props}
    />
  );
}
