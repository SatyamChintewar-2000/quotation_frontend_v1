import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={false}
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          fontSize: '14px',
          padding: '14px 18px',
          borderRadius: '12px',
          fontWeight: '500',
          minWidth: '320px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          border: 'none',
        },
        classNames: {
          toast: 'group toast',
          title: 'font-semibold text-[14px]',
          description: 'text-[13px] opacity-90 mt-0.5',
          success: '!bg-emerald-500 !text-white',
          error: '!bg-red-500 !text-white',
          warning: '!bg-amber-500 !text-white',
          info: '!bg-blue-500 !text-white',
          closeButton: '!bg-white/20 !text-white !border-0 hover:!bg-white/30',
          actionButton: '!bg-white/20 !text-white hover:!bg-white/30',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
