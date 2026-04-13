import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Car,
  CheckCircle2,
  Eye,
  EyeOff,
  MailCheck,
  RotateCw,
  Upload,
  User,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { EMAIL_OTP_DIGIT_LABEL, EMAIL_OTP_LENGTH } from "@/lib/authOtp";
import { getVehicleBrands, OTHER_BRAND_OPTION, VEHICLE_TYPES } from "@/lib/vehicleBrands";

type SignupRole = "rider" | "rider_partner" | "driver" | "restaurant" | "garage";

const roleOptions: { value: SignupRole; label: string; description: string; icon: React.ReactNode }[] = [
  { value: "rider", label: "User", description: "Book rides, send parcels, order food", icon: <User className="h-6 w-6" /> },
  { value: "rider_partner", label: "Rider", description: "Accept bike and scooter ride or parcel requests", icon: <Bike className="h-6 w-6" /> },
  { value: "driver", label: "Driver", description: "Accept taxi, cab, auto, van, and four-wheeler jobs", icon: <Car className="h-6 w-6" /> },
  { value: "restaurant", label: "Restaurant", description: "List your restaurant & menu", icon: <UtensilsCrossed className="h-6 w-6" /> },
  { value: "garage", label: "Garage", description: "Provide repair and maintenance services", icon: <Wrench className="h-6 w-6" /> },
];

const riderPartnerVehicleTypes = ["Bike", "Scooter"] as const;
const driverVehicleTypes = ["Auto", "Car", "Van", "Truck"] as const;

const TOTAL_STEPS = 4;

const requiresManualApproval = (role: SignupRole) =>
  role === "driver" || role === "rider_partner" || role === "restaurant" || role === "garage";

const isPartnerSignupRole = (role: SignupRole) => role === "driver" || role === "rider_partner";

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const maskEmailAddress = (value: string) => {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  if (local.length <= 2) return `${local[0] || ""}*@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
};

const getEmailDeliveryErrorMessage = (error: { message?: string; code?: string }) => {
  const raw = `${error?.message || ""} ${error?.code || ""}`.toLowerCase();

  if (raw.includes("over_email_send_rate_limit")) {
    return "Supabase email sending is rate-limited right now. Please wait a while or configure custom SMTP for production.";
  }

  if (raw.includes("email address not authorized")) {
    return "Your Supabase project is still using the default SMTP restrictions. Configure custom SMTP to send verification emails to real users.";
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

interface FileUploadProps {
  label: string;
  file: File | null;
  onSelect: (f: File) => void;
  accept?: string;
}

const FileUploadButton = ({ label, file, onSelect, accept = "image/*" }: FileUploadProps) => {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0];
          if (!selectedFile) return;

          onSelect(selectedFile);
          e.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 overflow-hidden"
        onClick={() => ref.current?.click()}
      >
        {file ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Upload className="h-4 w-4" />}
        <span className="min-w-0 truncate">{file ? file.name : `Upload ${label}`}</span>
      </Button>
    </div>
  );
};

const Signup = () => {
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<SignupRole>("rider");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [vehicleType, setVehicleType] = useState("Bike");
  const [vehicleBrand, setVehicleBrand] = useState(getVehicleBrands("Bike")[0] || OTHER_BRAND_OPTION);
  const [customVehicleBrand, setCustomVehicleBrand] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [nationalId, setNationalId] = useState<File | null>(null);
  const [vehicleRegistration, setVehicleRegistration] = useState<File | null>(null);
  const [driverPhoto, setDriverPhoto] = useState<File | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);
  const [availability, setAvailability] = useState("both");
  const [restaurantName, setRestaurantName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [businessLicense, setBusinessLicense] = useState<File | null>(null);
  const [cuisineType, setCuisineType] = useState("");
  const [openingTime, setOpeningTime] = useState("09:00");
  const [closingTime, setClosingTime] = useState("21:00");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [garageName, setGarageName] = useState("");
  const [garageAddress, setGarageAddress] = useState("");
  const [garageDescription, setGarageDescription] = useState("");
  const [garageLogo, setGarageLogo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState<{ userId: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const brandOptions = getVehicleBrands(vehicleType);
  const isCustomBrand = vehicleBrand === OTHER_BRAND_OPTION;
  const resolvedVehicleBrand = isCustomBrand ? customVehicleBrand.trim() : vehicleBrand;
  const currentStep = pendingVerification ? TOTAL_STEPS : step;

  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam === "rider" || roleParam === "rider_partner" || roleParam === "driver" || roleParam === "restaurant" || roleParam === "garage") {
      setRole(roleParam);
      return;
    }

    if (roleParam === "auto_driver") {
      setRole("driver");
      setVehicleType("Auto");
    }
  }, [searchParams]);

  useEffect(() => {
    if (role === "rider_partner") {
      setVehicleType((current) => (riderPartnerVehicleTypes.includes(current as (typeof riderPartnerVehicleTypes)[number]) ? current : "Bike"));
      return;
    }

    if (role === "driver") {
      setVehicleType((current) => (driverVehicleTypes.includes(current as (typeof driverVehicleTypes)[number]) ? current : "Car"));
      return;
    }

    if (!VEHICLE_TYPES.includes(vehicleType as (typeof VEHICLE_TYPES)[number])) {
      setVehicleType("Bike");
      setVehicleBrand(getVehicleBrands("Bike")[0] || OTHER_BRAND_OPTION);
      setCustomVehicleBrand("");
    }
  }, [role]);

  useEffect(() => {
    const brands = getVehicleBrands(vehicleType);
    if (!brands.includes(vehicleBrand)) {
      setVehicleBrand(brands[0] || OTHER_BRAND_OPTION);
      setCustomVehicleBrand("");
    }
  }, [vehicleType, vehicleBrand]);

  const uploadFile = async (file: File, userId: string, folder: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${userId}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);

    if (error) {
      console.error("Upload error:", error);
      return null;
    }

    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    return data.publicUrl;
  };

  const buildFinalizePayload = async (userId: string) => {
    const payload: Record<string, unknown> = {
      fullName,
      phone,
      city: normalizeText(city),
    };

    if (role === "rider") {
      payload.avatarUrl = profilePhoto ? await uploadFile(profilePhoto, userId, "avatar") : null;
      return payload;
    }

    if (isPartnerSignupRole(role)) {
      const [nationalIdUrl, vehicleRegistrationUrl, profilePhotoUrl, vehiclePhotoUrl] = await Promise.all([
        nationalId ? uploadFile(nationalId, userId, "national-id") : Promise.resolve(null),
        vehicleRegistration ? uploadFile(vehicleRegistration, userId, "vehicle-reg") : Promise.resolve(null),
        driverPhoto ? uploadFile(driverPhoto, userId, "profile-photo") : Promise.resolve(null),
        vehiclePhoto ? uploadFile(vehiclePhoto, userId, "vehicle-photo") : Promise.resolve(null),
      ]);

      payload.avatarUrl = profilePhotoUrl;
      payload.driverProfile = {
        vehicleType,
        vehicleBrand: resolvedVehicleBrand,
        licenseNumber,
        availability,
        nationalIdUrl,
        vehicleRegistrationUrl,
        profilePhotoUrl,
        vehiclePhotoUrl,
      };
      return payload;
    }

    if (role === "restaurant") {
      const [businessLicenseUrl, imageUrl] = await Promise.all([
        businessLicense ? uploadFile(businessLicense, userId, "business-license") : Promise.resolve(null),
        logoFile ? uploadFile(logoFile, userId, "logo") : Promise.resolve(null),
      ]);

      payload.restaurant = {
        name: restaurantName,
        address: restaurantAddress,
        cuisineType: normalizeText(cuisineType),
        openingTime,
        closingTime,
        businessLicenseUrl,
        imageUrl,
      };
      return payload;
    }

    payload.garage = {
      name: garageName,
      address: garageAddress,
      description: normalizeText(garageDescription),
      imageUrl: garageLogo ? await uploadFile(garageLogo, userId, "garage-logo") : null,
    };

    return payload;
  };

  const completeVerifiedSignup = async (userId: string) => {
    const payload = await buildFinalizePayload(userId);
    const { error } = await supabase.functions.invoke("finalize-signup", { body: payload });

    if (error) {
      throw error;
    }

    setPendingVerification(null);
    setVerificationCode("");
    setEmailVerified(false);

    if (requiresManualApproval(role)) {
      await supabase.auth.signOut();
      toast({
        title: "Email verified",
        description: "Your email is verified. Your account is now waiting for admin approval.",
      });
      navigate("/login");
      return;
    }

    toast({
      title: "Account ready",
      description: "Your email has been verified and your account is ready to use.",
    });
    navigate("/rider");
  };

  const handleSignup = async () => {
    setLoading(true);

    try {
      const existingEmailStatus = await checkAuthEmailStatus(email);
      if (existingEmailStatus.exists && existingEmailStatus.emailConfirmed) {
        toast({
          title: "Email already registered",
          description: "This email is already verified. Please sign in instead of creating another account.",
          variant: "destructive",
        });
        navigate("/login");
        return;
      }

      if (existingEmailStatus.exists && !existingEmailStatus.emailConfirmed) {
        toast({
          title: "Existing signup found",
          description: "This email already has a pending signup. Finish email verification instead of signing up again.",
        });
        navigate(`/login?mode=verify-email&email=${encodeURIComponent(email)}`);
        return;
      }

      const authRole = role === "rider_partner" ? "driver" : role;
      const selectedVehicleBrand = resolvedVehicleBrand;

      if (isPartnerSignupRole(role) && !selectedVehicleBrand) {
        toast({
          title: "Vehicle brand required",
          description: "Please select or enter your vehicle brand.",
          variant: "destructive",
        });
        return;
      }

      const meta: Record<string, string> = {
        full_name: fullName,
        role: authRole,
        requested_role: role,
        phone,
        city,
      };

      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: meta },
      });

      if (error) {
        const raw = `${(error as any)?.message || ""} ${(error as any)?.code || ""}`.toLowerCase();

        if (raw.includes("user already registered") || raw.includes("email_exists")) {
          toast({
            title: "Existing signup found",
            description: "That email already has a signup record. Finish verification from the login page instead of creating it again.",
          });
          navigate(`/login?mode=verify-email&email=${encodeURIComponent(email)}`);
          return;
        }

        toast({
          title: "Signup failed",
          description: getEmailDeliveryErrorMessage(error),
          variant: "destructive",
        });
        return;
      }

      const userId = authData.user?.id;
      if (!userId) {
        throw new Error("No user ID returned from signup");
      }

      if (authData.session) {
        await completeVerifiedSignup(userId);
        return;
      }

      setPendingVerification({ userId });
      setEmailVerified(false);
      setVerificationCode("");
      toast({
        title: "Verification code sent",
        description: `Enter the ${EMAIL_OTP_DIGIT_LABEL} code sent to ${email}.`,
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!pendingVerification) return;
    if (!emailVerified && verificationCode.length !== EMAIL_OTP_LENGTH) return;

    setVerifyingCode(true);

    try {
      let userId = pendingVerification.userId;

      if (!emailVerified) {
        const { data, error } = await supabase.auth.verifyOtp({
          email,
          token: verificationCode,
          type: "email",
        });

        if (error) {
          throw error;
        }

        userId = data.user?.id || data.session?.user.id || pendingVerification.userId;
        setPendingVerification({ userId });
        setEmailVerified(true);
      }

      await completeVerifiedSignup(userId);
    } catch (err: any) {
      toast({
        title: emailVerified ? "Account setup failed" : "Verification failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    setResendingCode(true);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Verification code resent",
        description: `A new code was sent to ${email}.`,
      });
    } catch (err: any) {
      toast({
        title: "Could not resend code",
        description: getEmailDeliveryErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setResendingCode(false);
    }
  };

  const canProceedStep2 = Boolean(fullName && email && password.length >= 6 && phone);
  const canCreateAccount = Boolean(
    !loading &&
    !(
      isPartnerSignupRole(role) &&
      (!licenseNumber || !resolvedVehicleBrand)
    ) &&
    !(role === "restaurant" && (!restaurantName || !ownerName || !restaurantAddress)) &&
    !(role === "garage" && (!garageName || !garageAddress)),
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:py-12">
      <div className="mx-auto w-full max-w-lg space-y-6">
        <div className="text-center">
          <Link to="/" className="text-2xl font-extrabold tracking-tight text-foreground">
            Our<span className="text-primary">Yatra</span>
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-foreground">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Step {currentStep} of {TOTAL_STEPS}</p>
        </div>

        <div className="flex gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((progressStep) => (
            <div
              key={progressStep}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                progressStep <= currentStep ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {!pendingVerification && step === 1 && (
          <div className="space-y-4">
            <Label className="text-base font-semibold">I want to join as</Label>
            <div className="grid gap-3">
              {roleOptions.map((opt) => (
                <Card
                  key={opt.value}
                  className={cn(
                    "cursor-pointer transition-all",
                    role === opt.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40",
                  )}
                  onClick={() => setRole(opt.value)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className={cn("rounded-lg p-2.5", role === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {opt.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{opt.label}</p>
                      <p className="text-sm text-muted-foreground">{opt.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {!pendingVerification && step === 2 && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input id="fullName" placeholder="Your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" type="tel" placeholder="+977 98XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="e.g. Kathmandu" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
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
            <Button className="w-full" disabled={!canProceedStep2} onClick={() => setStep(3)}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {!pendingVerification && step === 3 && (
          <div className="space-y-4 pb-24">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            {role === "rider" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Almost done! Optionally add a profile photo.</p>
                <FileUploadButton label="Profile Photo (optional)" file={profilePhoto} onSelect={setProfilePhoto} />
              </div>
            )}

            {isPartnerSignupRole(role) && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We need some documents to verify your {role === "rider_partner" ? "rider" : "driver"} account.
                </p>
                <div className="space-y-2">
                  <Label>Vehicle Type *</Label>
                  <div className="flex flex-wrap gap-2">
                    {(role === "rider_partner" ? riderPartnerVehicleTypes : driverVehicleTypes).map((vehicle) => (
                      <Button
                        key={vehicle}
                        type="button"
                        size="sm"
                        variant={vehicleType === vehicle ? "default" : "outline"}
                        onClick={() => setVehicleType(vehicle)}
                      >
                        {vehicle}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehicle-brand">Vehicle Brand *</Label>
                  <div className="flex flex-wrap gap-2">
                    {brandOptions.map((brand) => (
                      <Button
                        key={brand}
                        type="button"
                        size="sm"
                        variant={vehicleBrand === brand ? "default" : "outline"}
                        onClick={() => setVehicleBrand(brand)}
                      >
                        {brand}
                      </Button>
                    ))}
                  </div>
                </div>
                {isCustomBrand && (
                  <div className="space-y-2">
                    <Label htmlFor="customVehicleBrand">Custom Vehicle Brand *</Label>
                    <Input
                      id="customVehicleBrand"
                      placeholder="Type your vehicle brand"
                      value={customVehicleBrand}
                      onChange={(e) => setCustomVehicleBrand(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="license">License Number *</Label>
                  <Input id="license" placeholder="e.g. DL-12345" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Availability *</Label>
                  <div className="flex gap-2">
                    {[{ v: "ride", l: "Rides" }, { v: "parcel", l: "Parcels" }, { v: "both", l: "Both" }].map((item) => (
                      <Button
                        key={item.v}
                        type="button"
                        size="sm"
                        variant={availability === item.v ? "default" : "outline"}
                        onClick={() => setAvailability(item.v)}
                      >
                        {item.l}
                      </Button>
                    ))}
                  </div>
                </div>
                <FileUploadButton label="National ID / Citizenship" file={nationalId} onSelect={setNationalId} accept="image/*,.pdf" />
                <FileUploadButton label="Vehicle Registration" file={vehicleRegistration} onSelect={setVehicleRegistration} accept="image/*,.pdf" />
                <FileUploadButton label="Profile Photo" file={driverPhoto} onSelect={setDriverPhoto} />
                <FileUploadButton label="Vehicle Photo" file={vehiclePhoto} onSelect={setVehiclePhoto} />
              </div>
            )}

            {role === "restaurant" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Tell us about your restaurant.</p>
                <div className="space-y-2">
                  <Label>Restaurant Name *</Label>
                  <Input placeholder="e.g. Nepali Kitchen" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Owner Name *</Label>
                  <Input placeholder="Restaurant owner name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Restaurant Address *</Label>
                  <Input placeholder="Full address" value={restaurantAddress} onChange={(e) => setRestaurantAddress(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Cuisine Type</Label>
                  <Input placeholder="e.g. Nepali, Indian, Chinese" value={cuisineType} onChange={(e) => setCuisineType(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Opening Time</Label>
                    <Input type="time" value={openingTime} onChange={(e) => setOpeningTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Closing Time</Label>
                    <Input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
                  </div>
                </div>
                <FileUploadButton label="Business License" file={businessLicense} onSelect={setBusinessLicense} accept="image/*,.pdf" />
                <FileUploadButton label="Restaurant Logo" file={logoFile} onSelect={setLogoFile} />
              </div>
            )}

            {role === "garage" && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Tell us about your garage.</p>
                <div className="space-y-2">
                  <Label>Garage Name *</Label>
                  <Input placeholder="e.g. KTM Auto Care" value={garageName} onChange={(e) => setGarageName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Garage Address *</Label>
                  <Input placeholder="Full address" value={garageAddress} onChange={(e) => setGarageAddress(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input placeholder="Services you provide" value={garageDescription} onChange={(e) => setGarageDescription(e.target.value)} />
                </div>
                <FileUploadButton label="Garage Logo" file={garageLogo} onSelect={setGarageLogo} />
              </div>
            )}

            <div className="sticky bottom-0 z-10 border-t bg-background/95 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <Button className="w-full" onClick={handleSignup} disabled={!canCreateAccount}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </div>
          </div>
        )}

        {pendingVerification && (
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <MailCheck className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-semibold text-foreground">Verify your email</h2>
                  <p className="text-sm text-muted-foreground">
                    Enter the {EMAIL_OTP_DIGIT_LABEL} verification code sent to <span className="font-medium text-foreground">{maskEmailAddress(email)}</span>.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <div className="flex justify-center">
                    <InputOTP
                      id="verification-code"
                      maxLength={EMAIL_OTP_LENGTH}
                      value={verificationCode}
                      onChange={setVerificationCode}
                      disabled={verifyingCode || emailVerified}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: EMAIL_OTP_LENGTH }, (_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                {emailVerified && (
                  <p className="text-center text-sm text-muted-foreground">
                    Email verified. Finishing your account setup now.
                  </p>
                )}

                <Button
                  className="w-full"
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || (!emailVerified && verificationCode.length !== EMAIL_OTP_LENGTH)}
                >
                  {verifyingCode
                    ? emailVerified
                      ? "Completing setup..."
                      : "Verifying code..."
                    : emailVerified
                      ? "Complete Account Setup"
                      : "Verify Email Code"}
                </Button>

                {!emailVerified && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={handleResendCode}
                    disabled={resendingCode}
                  >
                    <RotateCw className={cn("mr-2 h-4 w-4", resendingCode && "animate-spin")} />
                    {resendingCode ? "Sending new code..." : "Resend code"}
                  </Button>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {!pendingVerification ? (
          <div className="space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
            </p>
            <p>
              Signed up earlier but never verified your email?{" "}
              <Link
                to={email ? `/login?mode=verify-email&email=${encodeURIComponent(email)}` : "/login?mode=verify-email"}
                className="font-medium text-primary hover:underline"
              >
                Resume email verification
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t close this page until the verification step finishes.
          </p>
        )}
      </div>
    </div>
  );
};

export default Signup;
