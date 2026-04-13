import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Confirming your account...");

  useEffect(() => {
    const finishAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDescription = url.searchParams.get("error_description");

        if (errorDescription) {
          setMessage(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
          setTimeout(() => navigate("/login"), 2500);
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        setMessage("Account confirmed successfully. Redirecting to login...");
        setTimeout(() => navigate("/login"), 1200);
      } catch (err: any) {
        setMessage(err?.message || "Confirmation failed or link expired. Please request a new confirmation email.");
        setTimeout(() => navigate("/login"), 2500);
      }
    };

    finishAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">OurYatra Auth</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
