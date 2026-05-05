"use client";

import { useState, type FormEvent } from "react";
import { Button, InlineNotification, TextInput } from "@carbon/react";
import { createSupabaseBrowserClient } from "@/lib/supabase";

const renderOrigin = "https://familybalance.onrender.com";

function getLocalOrigin() {
  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }

  if (window.location.hostname === "localhost") {
    return window.location.origin;
  }

  return "http://localhost:3001";
}

function getCallbackUrl(origin: string) {
  const url = new URL("/auth/callback", origin);
  const next = new URLSearchParams(window.location.search).get("next");

  url.searchParams.set("next", next ?? "/overblik");

  return url.toString();
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState<"local" | "render">("local");
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

    const targetOrigin = target === "local" ? getLocalOrigin() : renderOrigin;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: getCallbackUrl(targetOrigin),
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage(
      target === "local"
        ? "Tjek din mail for login-linket til den lokale app."
        : "Tjek din mail for login-linket til Render.",
    );
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
      <fieldset className="login-target">
        <legend>Hvor skal login-linket åbne?</legend>
        <div className="login-target__options">
          <button
            aria-pressed={target === "local"}
            className="login-target__option"
            onClick={() => setTarget("local")}
            type="button"
          >
            Lokal app
            <span>{getLocalOrigin()}</span>
          </button>
          <button
            aria-pressed={target === "render"}
            className="login-target__option"
            onClick={() => setTarget("render")}
            type="button"
          >
            Render
            <span>{renderOrigin}</span>
          </button>
        </div>
      </fieldset>
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
