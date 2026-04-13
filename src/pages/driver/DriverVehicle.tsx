import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, CheckCircle, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getVehicleBrands, normalizeVehicleTypeValue, OTHER_BRAND_OPTION, VEHICLE_TYPES } from "@/lib/vehicleBrands";

const riderPartnerVehicleTypes = ["Bike", "Scooter"];
const driverVehicleTypes = ["Auto", "Car", "Van", "Truck"];

const statusDisplay: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  approved: { label: "Verified", icon: CheckCircle, color: "text-green-600" },
  pending: { label: "Pending Verification", icon: Clock, color: "text-yellow-600" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600" },
  blocked: { label: "Blocked", icon: XCircle, color: "text-red-600" },
};

interface DocField {
  key: string;
  label: string;
}

const docFields: DocField[] = [
  { key: "profile_photo_url", label: "Profile Photo" },
  { key: "vehicle_photo_url", label: "Vehicle Photo" },
  { key: "vehicle_registration_url", label: "Vehicle Registration" },
  { key: "national_id_url", label: "National ID" },
];

const DriverVehicle = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [driverProfile, setDriverProfile] = useState<any>(null);
  const [vehicleType, setVehicleType] = useState("Bike");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [customVehicleBrand, setCustomVehicleBrand] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [allowedVehicleTypes, setAllowedVehicleTypes] = useState<string[]>(driverVehicleTypes);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const brandOptions = getVehicleBrands(vehicleType);
  const isCustomBrand = vehicleBrand === OTHER_BRAND_OPTION;
  const resolvedVehicleBrand = isCustomBrand ? customVehicleBrand.trim() : vehicleBrand;

  const fetchProfile = async () => {
    if (!user) return;
    const [profileRes, customRoleRes] = await Promise.all([
      supabase.from("driver_profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_custom_roles" as any).select("role_slug").eq("user_id", user.id),
    ]);

    const data = profileRes.data;
    if (data) {
      const normalizedType = normalizeVehicleTypeValue(data.vehicle_type || "Bike");
      const knownBrands = getVehicleBrands(normalizedType);
      const brand = data.vehicle_brand || "";
      const custom = brand && !knownBrands.includes(brand) ? brand : "";
      const customSlugs = ((customRoleRes.data as any[]) || []).map((row) => row.role_slug);
      const nextAllowedTypes = customSlugs.includes("auto_driver")
        ? ["Auto"]
        : customSlugs.includes("rider_partner") || riderPartnerVehicleTypes.includes(normalizedType)
          ? riderPartnerVehicleTypes
          : driverVehicleTypes;

      setDriverProfile(data);
      setAllowedVehicleTypes(nextAllowedTypes);
      setVehicleType(normalizedType);
      setVehicleBrand(custom ? OTHER_BRAND_OPTION : (brand || knownBrands[0] || ""));
      setCustomVehicleBrand(custom);
      setLicenseNumber(data.license_number || "");
    } else {
      setAllowedVehicleTypes(driverVehicleTypes);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);

  useEffect(() => {
    if (allowedVehicleTypes.length > 0 && !allowedVehicleTypes.includes(vehicleType)) {
      setVehicleType(allowedVehicleTypes[0]);
    }
  }, [allowedVehicleTypes, vehicleType]);

  useEffect(() => {
    const brands = getVehicleBrands(vehicleType);
    if (!brands.includes(vehicleBrand)) {
      setVehicleBrand(brands[0] || OTHER_BRAND_OPTION);
      setCustomVehicleBrand("");
    }
  }, [vehicleType, vehicleBrand]);

  const handleSave = async () => {
    if (!user) return;
    if (!resolvedVehicleBrand) {
      toast({ title: "Vehicle brand required", description: "Please select or enter your vehicle brand.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("driver_profiles")
      .upsert({ id: user.id, vehicle_type: vehicleType, vehicle_brand: resolvedVehicleBrand, license_number: licenseNumber }, { onConflict: "id" });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Vehicle info updated!" }); fetchProfile(); }
    setSaving(false);
  };

  const handleDocUpload = async (field: string, file: File) => {
    if (!user) return;
    setUploading(field);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/docs/${field}_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("uploads").upload(path, file);
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setUploading(null); return; }
    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    const { error } = await supabase.from("driver_profiles").upsert({ id: user.id, [field]: data.publicUrl }, { onConflict: "id" });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Document uploaded!" }); fetchProfile(); }
    setUploading(null);
  };

  const accountStatus = profile?.account_status || "pending";
  const statusInfo = statusDisplay[accountStatus] || statusDisplay.pending;
  const StatusIcon = statusInfo.icon;

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold text-foreground">Vehicle & Documents</h2>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <StatusIcon className={`h-6 w-6 ${statusInfo.color}`} />
          <div>
            <p className="font-medium text-foreground">{statusInfo.label}</p>
            <p className="text-sm text-muted-foreground">Account verification status</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Vehicle Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {allowedVehicleTypes.some((type) => riderPartnerVehicleTypes.includes(type))
              ? "This account is configured for rider services (bike or scooter)."
              : "This account is configured for driver services (auto, car, van, or truck)."}
          </p>
          <div className="space-y-2">
            <Label>Vehicle Type</Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.filter((type) => allowedVehicleTypes.includes(type)).map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Vehicle Brand</Label>
            <Select value={vehicleBrand} onValueChange={setVehicleBrand}>
              <SelectTrigger><SelectValue placeholder="Select a vehicle brand" /></SelectTrigger>
              <SelectContent>
                {brandOptions.map((brand) => (
                  <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isCustomBrand && (
            <div className="space-y-2">
              <Label>Custom Vehicle Brand</Label>
              <Input value={customVehicleBrand} onChange={e => setCustomVehicleBrand(e.target.value)} placeholder="Type your vehicle brand" />
            </div>
          )}
          <div className="space-y-2">
            <Label>License Number</Label>
            <Input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} placeholder="e.g. BA 1 PA 1234" />
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Vehicle Info"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Documents</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {docFields.map(doc => {
            const url = driverProfile?.[doc.key];
            return (
              <div key={doc.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{doc.label}</p>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View uploaded</a>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not uploaded</p>
                    )}
                  </div>
                </div>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading === doc.key}
                    onClick={() => fileRefs.current[doc.key]?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    {uploading === doc.key ? "Uploading..." : url ? "Replace" : "Upload"}
                  </Button>
                  <input
                    ref={el => { fileRefs.current[doc.key] = el; }}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleDocUpload(doc.key, e.target.files[0])}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default DriverVehicle;
