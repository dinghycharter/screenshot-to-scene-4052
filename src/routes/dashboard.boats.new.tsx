import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ArrowLeft, CalendarDays, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getFilterOptions } from "@/lib/catalog.functions";

const conditions = ["Like new", "Excellent", "Very good", "Good", "Fair", "Needs repair"] as const;
const maxPhotoSize = 10 * 1024 * 1024;
const acceptedImageTypes: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif",
};

type CatalogOptions = Awaited<ReturnType<typeof getFilterOptions>>;

export const Route = createFileRoute("/dashboard/boats/new")({ component: NewBoatPage });

function NewBoatPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [optionsError, setOptionsError] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>();
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [classId, setClassId] = useState("");
  const [eventId, setEventId] = useState("");
  const [condition, setCondition] = useState<(typeof conditions)[number] | "">("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [venue, setVenue] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/auth", search: { mode: "signup", type: "owner", redirect: "/dashboard/boats/new" }, replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    getFilterOptions().then(setOptions).catch((error: unknown) => {
      setOptionsError(error instanceof Error ? error.message : "Could not load classes and events.");
    });
  }, [user]);

  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const choosePhoto = (file?: File) => {
    setFeedback("");
    if (!file) { setPhoto(null); return; }
    if (!acceptedImageTypes[file.type]) { setPhoto(null); setFeedback("Choose a JPG, PNG, WebP or AVIF image."); return; }
    if (file.size > maxPhotoSize) { setPhoto(null); setFeedback("The main photo must be 10 MB or smaller."); return; }
    setPhoto(file);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");
    if (!user) {
      await navigate({ to: "/auth", search: { mode: "signin", redirect: "/dashboard/boats/new" } });
      return;
    }
    if (!options || !classId || !condition || !photo || !dateRange?.from || !dateRange.to) {
      setFeedback("Choose a class, condition, photo and complete availability date range.");
      return;
    }
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setBusy(true);
    const boatId = crypto.randomUUID();
    const extension = acceptedImageTypes[photo.type];
    const storagePath = `${user.id}/${boatId}/main.${extension}`;
    let boatCreated = false;
    let uploaded = false;
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
      if (sessionError || !sessionData.user) throw new Error("Your session expired. Sign in again to continue.");
      const upload = await supabase.storage.from("boat-photos").upload(storagePath, photo, { contentType: photo.type, upsert: false });
      if (upload.error) throw upload.error;
      uploaded = true;
      const photoUrl = supabase.storage.from("boat-photos").getPublicUrl(storagePath).data.publicUrl;
      const selectedClass = options.classes.find((item) => item.id === classId);
      if (!selectedClass) throw new Error("Choose a valid boat class.");
      const title = `${selectedClass.name} dinghy in ${city.trim()}`;
      const { error: boatError } = await supabase.from("boats").insert({
        id: boatId,
        owner_id: sessionData.user.id,
        class_id: classId,
        title,
        manufacturer: (form.elements.namedItem("manufacturer") as HTMLInputElement).value.trim(),
        model: (form.elements.namedItem("model") as HTMLInputElement).value.trim() || selectedClass.name,
        year: Number((form.elements.namedItem("year") as HTMLInputElement).value),
        description: (form.elements.namedItem("description") as HTMLTextAreaElement).value.trim(),
        city: city.trim(),
        country: country.trim(),
        pickup_location: venue.trim(),
        daily_price: Number((form.elements.namedItem("dailyPrice") as HTMLInputElement).value),
        security_deposit: Number((form.elements.namedItem("deposit") as HTMLInputElement).value),
        condition,
        cancellation_policy: (form.elements.namedItem("cancellationPolicy") as HTMLTextAreaElement).value.trim(),
      });
      if (boatError) throw boatError;
      boatCreated = true;
      const photoResult = await supabase.from("boat_photos").insert({ boat_id: boatId, url: photoUrl, position: 0 });
      if (photoResult.error) throw photoResult.error;
      const availabilityResult = await supabase.from("availability").insert({
        boat_id: boatId,
        start_date: format(dateRange.from, "yyyy-MM-dd"),
        end_date: format(dateRange.to, "yyyy-MM-dd"),
      });
      if (availabilityResult.error) throw availabilityResult.error;
      if (eventId) {
        const eventResult = await supabase.from("boat_events").insert({ boat_id: boatId, event_id: eventId });
        if (eventResult.error) throw eventResult.error;
      }
      toast.success("Your boat listing is live.");
      window.location.assign(`/boats/${boatId}`);
    } catch (error) {
      if (boatCreated) await supabase.from("boats").delete().eq("id", boatId);
      if (uploaded) await supabase.storage.from("boat-photos").remove([storagePath]);
      setFeedback(error instanceof Error ? error.message : "Could not create the listing. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return <div className="container-page flex min-h-[60vh] items-center justify-center"><LoaderCircle className="h-6 w-6 animate-spin text-ocean" aria-label="Checking sign in" /></div>;
  }

  return (
    <div className="container-page max-w-4xl py-10 md:py-14">
      <Link to="/list-your-boat" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> List your boat</Link>
      <h1 className="mt-5 text-3xl font-semibold md:text-4xl">Create a boat listing</h1>
      <p className="mt-2 text-muted-foreground">All fields below are required to publish your boat, except the optional event, make and model.</p>
      {optionsError && <p role="alert" className="mt-5 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{optionsError}</p>}
      {!options && !optionsError && <p className="mt-5 text-sm text-muted-foreground">Loading boat classes and events…</p>}
      <form className="mt-8 grid gap-7" onSubmit={(e) => void submit(e)}>
        <section className="grid gap-5 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 md:p-7">
          <h2 className="text-xl font-semibold md:col-span-2">Boat details</h2>
          <div className="grid gap-2">
            <Label htmlFor="class">Boat class *</Label>
            <Select value={classId} onValueChange={setClassId} required>
              <SelectTrigger id="class"><SelectValue placeholder="Select a class" /></SelectTrigger>
              <SelectContent>{options?.classes.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event">Regatta / event (optional)</Label>
            <Select value={eventId || "none"} onValueChange={(value) => setEventId(value === "none" ? "" : value)}>
              <SelectTrigger id="event"><SelectValue placeholder="Select an event" /></SelectTrigger>
              <SelectContent><SelectItem value="none">No specific event</SelectItem>{options?.events.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label htmlFor="city">City *</Label><Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Palma de Mallorca" /></div>
          <div className="grid gap-2"><Label htmlFor="country">Country *</Label><Input id="country" required value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Spain" /></div>
          <div className="grid gap-2 md:col-span-2"><Label htmlFor="venue">Marina, club or pickup location *</Label><Input id="venue" required value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Real Club Náutico de Palma" /></div>
          <div className="grid gap-2"><Label htmlFor="manufacturer">Builder / manufacturer (optional)</Label><Input id="manufacturer" name="manufacturer" placeholder="PSA, Mackay, Nautivela…" /></div>
          <div className="grid gap-2"><Label htmlFor="model">Model (optional)</Label><Input id="model" name="model" placeholder="ILCA 6, 420…" /></div>
          <div className="grid gap-2"><Label htmlFor="year">Year built *</Label><Input id="year" name="year" type="number" min="1900" max={new Date().getFullYear()} step="1" required placeholder="2022" /></div>
          <div className="grid gap-2"><Label htmlFor="condition">Boat condition *</Label><Select value={condition} onValueChange={(value) => setCondition(value as (typeof conditions)[number])} required><SelectTrigger id="condition"><SelectValue placeholder="Choose condition" /></SelectTrigger><SelectContent>{conditions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        </section>

        <section className="grid gap-5 rounded-2xl border border-border bg-card p-5 md:grid-cols-2 md:p-7">
          <h2 className="text-xl font-semibold md:col-span-2">Availability and price</h2>
          <div className="grid gap-2 md:col-span-2"><Label>Available dates *</Label><Popover><PopoverTrigger asChild><Button type="button" variant="outline" className="justify-start font-normal"><CalendarDays className="mr-2 h-4 w-4" />{dateRange?.from ? [format(dateRange.from, "d MMM yyyy"), dateRange.to ? format(dateRange.to, "d MMM yyyy") : "Select end date"].join(" – ") : "Choose date range"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={dateRange} onSelect={setDateRange} disabled={{ before: new Date() }} numberOfMonths={2} /></PopoverContent></Popover></div>
          <div className="grid gap-2"><Label htmlFor="dailyPrice">Price per day (€) *</Label><Input id="dailyPrice" name="dailyPrice" type="number" min="0.01" step="0.01" required placeholder="65.00" /></div>
          <div className="grid gap-2"><Label htmlFor="deposit">Refundable security deposit (€) *</Label><Input id="deposit" name="deposit" type="number" min="0" step="0.01" required placeholder="500.00" /></div>
        </section>

        <section className="grid gap-5 rounded-2xl border border-border bg-card p-5 md:p-7">
          <h2 className="text-xl font-semibold">Listing information</h2>
          <div className="grid gap-2"><Label htmlFor="description">Description *</Label><Textarea id="description" name="description" required minLength={20} rows={6} placeholder="Describe the boat, sails, equipment, recent maintenance and anything a sailor should know." /></div>
          <div className="grid gap-2"><Label htmlFor="cancellationPolicy">Cancellation policy *</Label><Textarea id="cancellationPolicy" name="cancellationPolicy" required minLength={10} rows={4} placeholder="Write the cancellation terms, deadlines and refund amount clearly." /></div>
          <div className="grid gap-2"><Label htmlFor="photo">Main listing photo *</Label><Input id="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required onChange={(e) => choosePhoto(e.currentTarget.files?.[0])} /><p className="text-xs text-muted-foreground">JPG, PNG, WebP or AVIF, up to 10 MB.</p>{preview && <img src={preview} alt="Preview of the listing photo" className="mt-2 aspect-[16/9] max-h-80 w-full rounded-xl border border-border object-cover" />}</div>
        </section>

        {feedback && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{feedback}</p>}
        <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-muted-foreground">Your listing is published after all information and the photo are saved.</p><Button type="submit" variant="ocean" size="xl" disabled={busy || !options}>{busy && <LoaderCircle className="animate-spin" />}{busy ? "Publishing…" : <><Upload /> Publish boat listing</>}</Button></div>
      </form>
    </div>
  );
}
