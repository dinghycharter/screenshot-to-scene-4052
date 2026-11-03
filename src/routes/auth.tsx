import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Anchor, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const authSearchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  type: z.enum(["owner", "sailor"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: authSearchSchema,
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const isSignup = search.mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"sailor" | "owner">(search.type ?? "sailor");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "error" | "success"; message: string } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim(), account_type: accountType } },
        });
        if (error) throw error;

        if (data.session) {
          await navigate({ to: "/" });
        } else {
          setFeedback({ kind: "success", message: "Account created. Check your email for a confirmation link, then sign in." });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const target = search.redirect?.startsWith("/") && !search.redirect.startsWith("//") ? search.redirect : "/";
        window.location.assign(target);
      }
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "Authentication failed. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-page flex min-h-[calc(100vh-72px)] items-center justify-center py-12">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-ocean-soft text-ocean">
          <Anchor className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-ocean">DinghyCharter</p>
        <h1 className="mt-2 text-3xl font-semibold">{isSignup ? "Create your account" : "Welcome back"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isSignup ? "Join sailors and boat owners preparing for their next regatta." : "Sign in to manage your boats, bookings and messages."}
        </p>

        <form className="mt-7 grid gap-4" onSubmit={(event) => void submit(event)}>
          {isSignup && <>
            <div className="grid gap-2">
              <Label htmlFor="full-name">Full name</Label>
              <Input id="full-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium">I want to</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["sailor", "owner"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setAccountType(type)}
                    aria-pressed={accountType === type}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium capitalize transition-colors ${accountType === type ? "border-ocean bg-ocean-soft text-ocean" : "border-border text-muted-foreground hover:bg-secondary"}`}
                  >
                    {type === "sailor" ? "Charter a boat" : "List my boat"}
                  </button>
                ))}
              </div>
            </fieldset>
          </>}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
            {isSignup && <p className="text-xs text-muted-foreground">Use at least 6 characters.</p>}
          </div>

          {feedback && <p role="status" className={`rounded-xl px-3 py-2.5 text-sm ${feedback.kind === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>{feedback.message}</p>}

          <Button type="submit" className="mt-1 w-full" disabled={busy}>
            {busy && <LoaderCircle className="animate-spin" />}
            {busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account?" : "New to DinghyCharter?"}{" "}
          <Link to="/auth" search={isSignup ? { mode: "signin" } : { mode: "signup" }} className="font-semibold text-ocean hover:underline">
            {isSignup ? "Sign in" : "Create account"}
          </Link>
        </p>
      </section>
    </div>
  );
}
