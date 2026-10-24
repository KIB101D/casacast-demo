import { AdminLanguageSwitcher } from "@/components/admin/language-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdminI18n } from "@/i18n/admin/server";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "../login/actions";

export async function UserPanel() {
  const [user, { t }] = await Promise.all([requireUser(), getAdminI18n()]);

  return (
    <div className="border-line bg-canvas flex flex-col gap-3 rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{user.name}</span>
        <Badge tone={user.role === "demo" ? "warn" : "accent"}>{t.shell.roles[user.role]}</Badge>
      </div>
      {user.role === "demo" ? (
        <p className="text-muted hidden text-xs md:block">{t.shell.demoNote}</p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <form action={logout}>
          <Button type="submit" variant="ghost" className="justify-start px-2">
            {t.shell.signOut}
          </Button>
        </form>
        <AdminLanguageSwitcher className="hidden md:inline-flex" />
      </div>
    </div>
  );
}
