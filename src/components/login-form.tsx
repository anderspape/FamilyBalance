"use client";

import { useState, type FormEvent } from "react";
import { Button, InlineNotification, TextInput } from "@carbon/react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      setStatus("error");
      setMessage("Supabase mangler miljøvariabler. Tilføj dem i .env.local.");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Tjek din mail for login-linket.");
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <TextInput
        id="email"
        labelText="Email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="din@email.dk"
        required
        type="email"
        value={email}
      />
      <Button disabled={status === "loading"} type="submit">
        {status === "loading" ? "Sender..." : "Send login-link"}
      </Button>
      {message ? (
        <InlineNotification
          hideCloseButton
          kind={status === "error" ? "error" : "success"}
          lowContrast
          subtitle={message}
          title={status === "error" ? "Login fejlede" : "Login-link sendt"}
        />
      ) : null}
    </form>
  );
}
