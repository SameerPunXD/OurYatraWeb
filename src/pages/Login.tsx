import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { EMAIL_OTP_DIGIT_LABEL, EMAIL_OTP_LENGTH } from "@/lib/authOtp";
import { CheckCircle2, Eye, EyeOff, MailCheck, RotateCw } from "lucide-react";

const maskEmailAddress = (value: string) => {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  if (local.length <= 2) return `${local[0] || ""}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
};

const getEmailDeliveryErrorMessage = (error: { message?: string; code?: string }) => {
  const raw = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();

  if (raw.includes("over_email_send_rate_limit")) {
    return "Email sending is being rate-limited right now. Wait a bit and try sending the code again.";
  }

  if (raw.includes("email address not authorized")) {
    return "This Supabase project is still on restricted SMTP settings. Configure custom SMTP before using real customer emails.";
  }

  return error?.message || "Could not send the verification email.";
};

const checkAuthEmailStatus = async (email: string) => {
  const { data, error } = await supabase.functions.invoke("check-auth-email-status", {
    body: { email },
  });

  if (error) {
    throw error;
  }

  return data as {
    exists: boolean;
    userId: string | null;
    emailConfirmed: boolean;
    roles: string[];
    accountStatus: string | null;
  };
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verificationMode, setVerificationMode] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    const mode = searchParams.get("mode");
    const emailParam = searchParams.get("email");

    if (emailParam) {
      setEmail(emailParam);
      setVerificationEmail(emailParam);
    }

    if (mode === "verify-email") {
      setVerificationMode(true);
    }
  }, [searchParams]);

  const hasLegacySignupRecords = async (userId: string) => {
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roleNames = (roles || []).map((roleRow) => roleRow.role);

    if (roleNames.includes("driver")) {
      const { data } = await supabase.from("driver_profiles").select("id").eq("id", userId).maybeSingle();
      if (!data) return false;
    }

    if (roleNames.includes("restaurant")) {
      const { data } = await supabase.from("restaurants").select("id").eq("owner_id", userId).limit(1);
      if (!data || data.length === 0) return false;
    }

    if (roleNames.includes("garage")) {
      const { data } = await (supabase as any).from("garages").select("id").eq("owner_id", userId).limit(1);
      if (!data || data.length === 0) return false;
    }

    return true;
  };

  const finishAuthenticatedSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .single();

    if (profile) {
      const status = profile.account_status;

      if (status === "pending") {
        toast({
          title: "Account pending",
          description: "Your email is verified. Your account is now waiting for admin approval.",
        });
        await supabase.auth.signOut();
        navigate("/login");
        return;
      }

      if (status === "rejected") {
        toast({
          title: "Account rejected",
          description: "Your account application was rejected. Contact support for help.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }

      if (status === "blocked") {
        toast({
          title: "Account blocked",
          description: "Your account has been blocked. Contact support for assistance.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        return;
      }
    }

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles || roles.length === 0) {
      toast({
        title: "No role assigned",
        description: "Your account has no role. Contact support.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      return;
    }

    const roleNames = roles.map((roleRow) => roleRow.role);
    const primaryRole = roleNames.includes("admin") ? "admin" : roleNames[0];
    const redirectMap: Record<string, string> = {
      rider: "/rider",
      driver: "/driver",
      restaurant: "/restaurant",
      garage: "/garage",
      admin: "/admin",
    };
    const requestedNext = searchParams.get("next");
    const safeNext = requestedNext && requestedNext.startsWith("/") ? requestedNext : null;
    navigate(safeNext || redirectMap[primaryRole] || "/");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const raw = `${(error as any)?.message || ""} ${(error as any)?.code || ""}`.toLowerCase();

      if (raw.includes("email not confirmed")) {
        setVerificationMode(true);
        setVerificationEmail(email);
        toast({
          title: "Email not verified",
          description: `Enter the ${EMAIL_OTP_DIGIT_LABEL} code to verify this existing signup.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      }

      setLoading(false);
      return;
    }

    await finishAuthenticatedSession();
    setLoading(false);
  };

  const handleSendVerificationCode = async () => {
    if (!verificationEmail) return;
    setSendingCode(true);

    try {
      const emailStatus = await checkAuthEmailStatus(verificationEmail);

      if (!emailStatus.exists) {
        toast({
          title: "No signup found",
          description: "There is no account signup record for this email address.",
          variant: "destructive",
        });
        return;
      }

      if (emailStatus.emailConfirmed) {
        toast({
          title: "Email already verified",
          description: "This email is already verified. Use the normal login form.",
        });
        setVerificationMode(false);
        return;
      }

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: verificationEmail,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Verification code sent",
        description: `Enter the code sent to ${verificationEmail}.`,
      });
    } catch (error: any) {
      toast({
        title: "Could not send code",
        description: getEmailDeliveryErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== EMAIL_OTP_LENGTH || !verificationEmail) return;
    setVerifyingCode(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: verificationEmail,
        token: verificationCode,
        type: "email",
      });

      if (error) {
        throw error;
      }

      const userId = data.user?.id || data.session?.user.id;
      if (!userId) {
        throw new Error("No verified user returned");
      }

      const hasRequiredRows = await hasLegacySignupRecords(userId);
      if (!hasRequiredRows) {
        await supabase.auth.signOut();
        toast({
          title: "Email verified, signup incomplete",
          description: "This account does not have its role setup records yet. Finish signup from the original signup tab or contact support.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Email verified",
        description: "Your signup email is verified.",
      });
      await finishAuthenticatedSession();
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-foreground">
            Our<span className="text-primary">Yatra</span>
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => {
                setVerificationMode((current) => !current);
                setVerificationEmail(email || verificationEmail);
              }}
            >
              Verify existing signup
            </button>
            <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {verificationMode && (
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MailCheck className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Resume email verification</h2>
                <p className="text-sm text-muted-foreground">
                  Use this if the account was created earlier but the old link flow was never finished.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verification-email">Signup Email</Label>
                <Input
                  id="verification-email"
                  type="email"
                  placeholder="you@example.com"
                  value={verificationEmail}
                  onChange={(e) => setVerificationEmail(e.target.value)}
                />
              </div>

              <Button type="button" variant="outline" className="w-full" onClick={handleSendVerificationCode} disabled={sendingCode || !verificationEmail}>
                <RotateCw className="mr-2 h-4 w-4" />
                {sendingCode ? "Sending code..." : "Send verification code"}
              </Button>

              <div className="space-y-2">
                <Label htmlFor="verification-code">{EMAIL_OTP_DIGIT_LABEL} Code</Label>
                <div className="flex justify-center">
                  <InputOTP
                    id="verification-code"
                    maxLength={EMAIL_OTP_LENGTH}
                    value={verificationCode}
                    onChange={setVerificationCode}
                    disabled={verifyingCode}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: EMAIL_OTP_LENGTH }, (_, index) => (
                        <InputOTPSlot key={index} index={index} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {verificationEmail && (
                  <p className="text-center text-xs text-muted-foreground">
                    Code will be sent to {maskEmailAddress(verificationEmail)}.
                  </p>
                )}
              </div>

              <Button type="button" className="w-full" onClick={handleVerifyCode} disabled={verifyingCode || verificationCode.length !== EMAIL_OTP_LENGTH || !verificationEmail}>
                {verifyingCode ? "Verifying..." : "Verify Email Code"}
              </Button>

              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                  <p>
                    This verifies older unconfirmed signups without making the user run the full signup form again.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link to="/signup" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
