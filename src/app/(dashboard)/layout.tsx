import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BudgetShell } from "@/components/budget-shell";
import { getCurrentUser } from "@/lib/supabase-server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getCurrentUser();

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !user
  ) {
    redirect("/login");
  }

  return <BudgetShell userEmail={user?.email}>{children}</BudgetShell>;
}
