"use client";

import { use } from "react";
import { DenominatorFiltersContent } from "../DenominatorFiltersContent";

export default function DenominatorFiltersByAppPage({
  params,
}: Readonly<{
  params: Promise<{ appId: string }>;
}>) {
  const { appId } = use(params);
  return <DenominatorFiltersContent initialAppId={appId} initialEditing />;
}
