import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <p className="budget-kicker">FamilyBalance</p>
        <h1 id="login-title">Log ind på din husstandsøkonomi.</h1>
        <p>
          Få et sikkert login-link på mail. Når du er inde, kan dine konti,
          kategorier og bankforbindelser knyttes til din egen bruger.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
