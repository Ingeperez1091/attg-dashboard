"use client";

import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

interface LogoutButtonWrapperProps {
  isDev: boolean;
}

export function LogoutButtonWrapper({ isDev }: LogoutButtonWrapperProps) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return null;
  }

  return <LogoutButton isDev={isDev} />;
}
