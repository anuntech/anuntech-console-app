"use client";
// Adapted from the shadcn.io Sonner registry component; Console uses a fixed light theme and its own CSS.
import {
  CircleCheck,
  Info,
  TriangleAlert,
  OctagonX,
  LoaderCircle,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      closeButton
      visibleToasts={4}
      duration={7000}
      gap={10}
      offset={24}
      mobileOffset={16}
      containerAriaLabel="Notificações"
      icons={{
        success: <CircleCheck size={18} />,
        info: <Info size={18} />,
        warning: <TriangleAlert size={18} />,
        error: <OctagonX size={18} />,
        loading: <LoaderCircle size={18} className="toast-spinner" />,
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
