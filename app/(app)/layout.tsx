import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-2 border-blue-600 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-bold text-blue-700">
            みらいや経費精算
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500">{profile?.display_name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
