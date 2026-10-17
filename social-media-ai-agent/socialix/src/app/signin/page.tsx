import { redirect } from "next/navigation";
import { checkLogin, createSession, getSession } from "@/lib/auth";
import { Logo } from "@/components/logo";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!checkLogin(email, password)) redirect("/signin?error=1");
  await createSession();
  redirect("/dashboard");
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form action={signIn} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl shadow-indigo-100">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to brief your AI team.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">Wrong email or password.</p>}
        <label className="mt-6 block text-sm font-medium">
          Email
          <input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-brand-500" />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 outline-none focus:border-brand-500" />
        </label>
        <button className="mt-6 w-full rounded-xl bg-brand-600 py-2.5 font-medium text-white hover:bg-brand-700">Sign in</button>
        <p className="mt-4 text-xs text-gray-400">The login is set in this project&apos;s .env file (APP_LOGIN_EMAIL, APP_LOGIN_PASSWORD).</p>
      </form>
    </main>
  );
}
