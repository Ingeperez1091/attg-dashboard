import "@/app/components/dashboard/dashboard.css";
import { DashboardClient } from "@/app/components/dashboard/DashboardClient";

export const metadata = {
  title: "ATTG Analytics Dashboard | Application Usage"
};

export default function DashboardPage() {
  return <DashboardClient />;
}