import { redirect } from "next/navigation";
import { getAccountAuthDetails } from "@/lib/auth/account-details";
import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AccountAuthDetails, AuthUser } from "@/types/auth";

export interface AccountPageContext {
  user: AuthUser;
  authDetails: AccountAuthDetails;
}

export async function getAccountPageContext(
  redirectTo = "/login",
): Promise<AccountPageContext> {
  const user = await requireAuth(redirectTo);
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect(redirectTo);
  }

  return {
    user,
    authDetails: getAccountAuthDetails(authUser),
  };
}
