import { FC, ReactNode } from "react";

export const PublicLayout: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-[100dvh] w-full bg-white text-gray-900 font-sans selection:bg-primary/20 selection:text-primary">
      {children}
    </div>
  );
};
