import { ReactElement, ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="page-main-content">
      <div className="page-content-inner">
        {children}
      </div>
    </div>
  );
}
