import { currentUserOrRedirect } from "@/lib/session";
import { TopBar } from "@/components/dashboard/top-bar";
import { env } from "@/lib/env";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUserOrRedirect();
  return (
    <div className="min-h-dvh">
      <TopBar email={user.email} name={user.name} isAdmin={user.role === "ADMIN"} desktop={env.appMode === "desktop"} />
      <main className="mx-auto w-full max-w-[1320px] px-4 pb-20 pt-8 sm:px-6">{children}</main>
    </div>
  );
}
