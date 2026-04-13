import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, EyeOff, KeyRound, RotateCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { EMAIL_OTP_DIGIT_LABEL, EMAIL_OTP_LENGTH } from "@/lib/authOtp";

const getEmailDeliveryErrorMessage = (error: { message?: string; code?: string }) => {
  const raw = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();

  if (raw.includes("over_email_send_rate_limit")) {
    return "Password reset emails are being rate-limited right now. Please wait and try again.";
  }

  if (raw.includes("email address not authorized")) {
    return "This Supabase project is still using restricted SMTP settings.";
  }

  return error?.message || "Could not send the reset code.";
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

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const sendResetCode = async () => {
    setSendingCode(true);

    try {
      const emailStatus = await checkAuthEmailStatus(email);

      if (!emailStatus.exists || !emailStatus.emailConfirmed) {
        toast({
          title: "Email not available for reset",
          description: emailStatus.exists
            ? "This email has not completed account verification yet."
            : "No verified account was found for this email.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) {
        throw error;
      }

      setCodeSent(true);
      toast({
        title: "Reset code sent",
        description: `Enter the code sent to ${email}.`,
      });
    } catch (error: any) {
      toast({
        title: "Could not send reset code",
        description: getEmailDeliveryErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSendingCode(false);
    }
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendResetCode();
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetCode.length !== EMAIL_OTP_LENGTH) {
      toast({
        title: "Invalid code",
        description: `Enter the ${EMAIL_OTP_DIGIT_LABEL} reset code from your email.`,
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Use at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        description: "Re-enter the same password in both fields.",
        variant: "destructive",
      });
      return;
    }

    setResettingPassword(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: resetCode,
        type: "recovery",
      });

      if (verifyError) {
        throw verifyError;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();
      toast({
        title: "Password updated",
        description: "You can now sign in with your new password.",
      });
      navigate("/login");
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-foreground">
            Our<span className="text-primary">Yatra</span>
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-foreground">Reset password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {codeSent ? "Enter the reset code and choose a new password" : `Request a ${EMAIL_OTP_DIGIT_LABEL} password reset code`}
          </p>
        </div>

        {!codeSent ? (
          <form onSubmit={handleRequestSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={sendingCode}>
              {sendingCode ? "Sending code..." : "Send Reset Code"}
            </Button>
          </form>
        ) : (
          <Card>
            <CardContent className="space-y-5 p-6">
              <div className="space-y-2 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <KeyRound className="h-6 w-6" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Enter the {EMAIL_OTP_DIGIT_LABEL} reset code sent to <span className="font-medium text-foreground">{email}</span>.
                </p>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="reset-code">Reset Code</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      id="reset-code"
                      maxLength={EMAIL_OTP_LENGTH}
                      value={resetCode}
                      onChange={setResetCode}
                      disabled={resettingPassword}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: EMAIL_OTP_LENGTH }, (_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={resettingPassword}>
                  {resettingPassword ? "Updating password..." : "Update Password"}
                </Button>
              </form>

              <Button type="button" variant="ghost" className="w-full" onClick={sendResetCode} disabled={sendingCode}>
                <RotateCw className="mr-2 h-4 w-4" />
                {sendingCode ? "Sending new code..." : "Resend Reset Code"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
      </div>
    </div>
  );
};

export default ForgotPassword;
