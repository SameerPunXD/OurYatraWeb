import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Plus, Trash2, Shield, Lock } from "lucide-react";
import RatingDisplay from "@/components/RatingDisplay";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

const ProfilePage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const userMetadata = user?.user_metadata as Record<string, unknown> | undefined;
  const verifiedAuthPhone = user?.phone?.trim()
    || (typeof userMetadata?.phone === "string" ? userMetadata.phone.trim() : "");
  const isVerified = profile?.account_status === "approved";
  const isPhoneLocked = isVerified || !!verifiedAuthPhone;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);

  // Emergency contacts
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");
  const [ecSaving, setEcSaving] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(verifiedAuthPhone || profile.phone || "");
      setCity(profile.city || "");
    }
  }, [profile, verifiedAuthPhone]);

  const fetchEmergencyContacts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("emergency_contacts").select("*").eq("user_id", user.id);
    setEmergencyContacts(data || []);
  }, [user]);

  useEffect(() => {
    if (user) fetchEmergencyContacts();
  }, [user, fetchEmergencyContacts]);

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const nextPhone = isPhoneLocked ? (verifiedAuthPhone || profile?.phone || "").trim() : phone.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: nextPhone || null, city })
      .eq("id", user.id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Profile updated!" }); await refreshProfile(); }
    setLoading(false);
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("uploads").upload(path, file);
    if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setUploading(false); return; }
    const { data } = supabase.storage.from("uploads").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
    toast({ title: "Avatar updated!" });
    await refreshProfile();
    setUploading(false);
  };

  const handleAddEmergencyContact = async () => {
    if (!user || !ecName.trim() || !ecPhone.trim()) return;
    setEcSaving(true);
    const { error } = await supabase.from("emergency_contacts").insert({ user_id: user.id, name: ecName, phone: ecPhone, relationship: ecRelationship || null });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Emergency contact added!" }); setEcName(""); setEcPhone(""); setEcRelationship(""); fetchEmergencyContacts(); }
    setEcSaving(false);
  };

  const handleDeleteEC = async (id: string) => {
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Contact removed" }); fetchEmergencyContacts(); }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) { toast({ title: "Password must be at least 6 characters", variant: "destructive" }); return; }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Password updated!" }); setNewPassword(""); }
    setChangingPw(false);
  };

  const initials = (fullName || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-foreground">Profile</h2>

      {/* Profile Info Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">{initials}</AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Upload className="h-5 w-5 text-white" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])} />
            </div>
            <div>
              <CardTitle>{fullName || "Your Name"}</CardTitle>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {uploading && <p className="text-xs text-primary">Uploading...</p>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <RatingDisplay userId={user?.id} />
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <div className="relative">
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+977 98XXXXXXXX"
                  disabled={isPhoneLocked}
                />
                {isPhoneLocked && <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
              </div>
              {isPhoneLocked && (
                <p className="text-xs text-muted-foreground">
                  Verified phone numbers are locked and cannot be changed from profile.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Kathmandu" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Input value={user?.email || ""} disabled />
                <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Emergency Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Emergency Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {emergencyContacts.map(ec => (
            <div key={ec.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <p className="font-medium text-foreground">{ec.name}</p>
                <p className="text-sm text-muted-foreground">{ec.phone}{ec.relationship ? ` • ${ec.relationship}` : ""}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDeleteEC(ec.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input placeholder="Name" value={ecName} onChange={e => setEcName(e.target.value)} />
            <Input placeholder="Phone" value={ecPhone} onChange={e => setEcPhone(e.target.value)} />
            <Input placeholder="Relationship (optional)" value={ecRelationship} onChange={e => setEcRelationship(e.target.value)} />
          </div>
          <Button variant="outline" size="sm" onClick={handleAddEmergencyContact} disabled={ecSaving || !ecName.trim() || !ecPhone.trim()}>
            <Plus className="h-4 w-4 mr-1" /> {ecSaving ? "Adding..." : "Add Contact"}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input type="password" placeholder="New password (min 6 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="max-w-sm" />
            <Button onClick={handleChangePassword} disabled={changingPw || !newPassword}>
              {changingPw ? "Updating..." : "Update"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
