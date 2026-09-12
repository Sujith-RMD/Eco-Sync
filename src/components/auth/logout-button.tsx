import { LogOut } from "lucide-react";
import { logout } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";

/** Server-component form that destroys the current session. */
export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost" size="sm">
        <LogOut className="h-3.5 w-3.5" />
        Disconnect
      </Button>
    </form>
  );
}
