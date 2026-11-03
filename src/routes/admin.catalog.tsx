import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Sailboat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/catalog")({ component: CatalogAdminPage });

type ClassRow = Tables<"classes">;
type EventRow = Tables<"events">;
type Section = "events" | "classes";
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const inputClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ocean/30";

function CatalogAdminPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [section, setSection] = useState<Section>("events");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Dinghy");
  const [crew, setCrew] = useState("1");
  const [sortOrder, setSortOrder] = useState("0");
  const isAdmin = user?.app_metadata?.role === "admin";

  const eventsQuery = useQuery({ queryKey: ["admin-catalog", "events"], enabled: isAdmin, queryFn: async () => {
    const { data, error } = await supabase.from("events").select("*").order("start_date");
    if (error) throw error;
    return data;
  }});
  const classesQuery = useQuery({ queryKey: ["admin-catalog", "classes"], enabled: isAdmin, queryFn: async () => {
    const { data, error } = await supabase.from("classes").select("*").order("sort_order").order("name");
    if (error) throw error;
    return data;
  }});

  const resetForm = () => {
    setEditing(null); setName(""); setSlug(""); setSlugTouched(false); setCity(""); setCountry("");
    setStartDate(""); setEndDate(""); setDescription(""); setCategory("Dinghy"); setCrew("1"); setSortOrder("0");
  };
  const beginEditEvent = (event: EventRow) => {
    setSection("events"); setEditing(event.id); setName(event.name); setSlug(event.slug); setSlugTouched(true);
    setCity(event.city); setCountry(event.country); setStartDate(event.start_date); setEndDate(event.end_date);
    setDescription(event.description ?? ""); setSortOrder(String(event.sort_order));
  };
  const beginEditClass = (boatClass: ClassRow) => {
    setSection("classes"); setEditing(boatClass.id); setName(boatClass.name); setSlug(boatClass.slug); setSlugTouched(true);
    setCategory(boatClass.category); setCrew(String(boatClass.crew)); setSortOrder(String(boatClass.sort_order));
  };

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanSlug = slugify(slug || name);
    if (!cleanSlug) return toast.error("Add a name and URL slug.");
    if (section === "events") {
      if (endDate < startDate) return toast.error("The end date must be on or after the start date.");
      const values = { name: name.trim(), slug: cleanSlug, city: city.trim(), country: country.trim(), start_date: startDate, end_date: endDate, description: description.trim() || null, sort_order: Number(sortOrder) || 0 };
      const result = editing ? await supabase.from("events").update(values).eq("id", editing) : await supabase.from("events").insert(values);
      if (result.error) return toast.error(result.error.message);
    } else {
      const values = { name: name.trim(), slug: cleanSlug, category: category.trim() || "Dinghy", crew: Math.max(1, Number(crew) || 1), sort_order: Number(sortOrder) || 0 };
      const result = editing ? await supabase.from("classes").update(values).eq("id", editing) : await supabase.from("classes").insert(values);
      if (result.error) return toast.error(result.error.message);
    }
    await queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
    await queryClient.invalidateQueries({ queryKey: ["filter-options"] });
    await queryClient.invalidateQueries({ queryKey: ["home"] });
    toast.success(editing ? "Changes saved." : "Added to the catalog."); resetForm();
  };

  const remove = async (kind: Section, id: string) => {
    const confirmed = window.confirm(kind === "events" ? "Delete this event?" : "Delete this class? Boats using the class prevent deletion.");
    if (!confirmed) return;
    const result = kind === "events" ? await supabase.from("events").delete().eq("id", id) : await supabase.from("classes").delete().eq("id", id);
    if (result.error) return toast.error(result.error.message);
    await queryClient.invalidateQueries({ queryKey: ["admin-catalog"] });
    await queryClient.invalidateQueries({ queryKey: ["filter-options"] });
    await queryClient.invalidateQueries({ queryKey: ["home"] });
    toast.success("Removed from the catalog.");
    if (editing === id) resetForm();
  };

  if (loading) return <div className="container-page py-20 text-muted-foreground">Checking your account…</div>;
  if (!user) return <div className="container-page py-20"><h1 className="text-3xl font-semibold">Admin access required</h1><p className="mt-3 text-muted-foreground">Sign in with an administrator account to manage the catalog.</p></div>;
  if (!isAdmin) return <div className="container-page py-20"><h1 className="text-3xl font-semibold">Admin access required</h1><p className="mt-3 text-muted-foreground">This account does not have the administrator role.</p></div>;

  const rows = section === "events" ? eventsQuery.data ?? [] : classesQuery.data ?? [];
  const isLoading = section === "events" ? eventsQuery.isLoading : classesQuery.isLoading;
  const queryError = section === "events" ? eventsQuery.error : classesQuery.error;

  return <div className="container-page py-10 md:py-14">
    <p className="text-sm font-semibold text-ocean">Administration</p>
    <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Catalog management</h1>
    <p className="mt-3 max-w-2xl text-muted-foreground">Add and update the championships and boat classes shown across DinghyCharter.</p>
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <section>
        <div className="mb-4 flex gap-2">
          <Button variant={section === "events" ? "default" : "outline"} onClick={() => { setSection("events"); resetForm(); }}><CalendarDays /> Championships</Button>
          <Button variant={section === "classes" ? "default" : "outline"} onClick={() => { setSection("classes"); resetForm(); }}><Sailboat /> Classes</Button>
        </div>
        {isLoading ? <p className="py-8 text-muted-foreground">Loading catalog…</p> : queryError ? <p className="py-8 text-destructive">Could not load catalog: {queryError.message}</p> : rows.length === 0 ? <p className="rounded-2xl border border-dashed p-8 text-muted-foreground">No {section === "events" ? "championships" : "classes"} yet.</p> : <div className="divide-y rounded-2xl border">
          {section === "events" ? (eventsQuery.data ?? []).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.city}, {item.country} · {item.start_date}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => beginEditEvent(item)}>Edit</Button><Button size="icon" size-sm="sm" variant="ghost" aria-label={`Delete ${item.name}`} onClick={() => void remove("events", item.id)}><Trash2 className="h-4 w-4" /></Button></div></div>) : (classesQuery.data ?? []).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate font-semibold">{item.name}</p><p className="text-sm text-muted-foreground">{item.category} · {item.crew} crew · {item.slug}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => beginEditClass(item)}>Edit</Button><Button size="icon" variant="ghost" aria-label={`Delete ${item.name}`} onClick={() => void remove("classes", item.id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}
        </div>}
      </section>
      <section className="h-fit rounded-2xl border bg-card p-5 md:p-6">
        <div className="flex items-center gap-2"><Plus className="h-5 w-5 text-ocean" /><h2 className="text-xl font-semibold">{editing ? "Edit" : "Add"} {section === "events" ? "championship" : "class"}</h2></div>
        <form className="mt-5 grid gap-4" onSubmit={(e) => void save(e)}>
          <label className="grid gap-1.5 text-sm font-medium">Name<input required className={inputClass} value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} /></label>
          <label className="grid gap-1.5 text-sm font-medium">URL slug<input required className={inputClass} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value); }} placeholder="auto-generated-from-name" /></label>
          {section === "events" ? <>
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">City<input required className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} /></label><label className="grid gap-1.5 text-sm font-medium">Country<input required className={inputClass} value={country} onChange={(e) => setCountry(e.target.value)} /></label></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Start date<input type="date" required className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label><label className="grid gap-1.5 text-sm font-medium">End date<input type="date" required className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label></div>
            <label className="grid gap-1.5 text-sm font-medium">Description (optional)<textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          </> : <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Category<input required className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)} /></label><label className="grid gap-1.5 text-sm font-medium">Crew size<input type="number" min="1" required className={inputClass} value={crew} onChange={(e) => setCrew(e.target.value)} /></label></div>}
          <label className="grid gap-1.5 text-sm font-medium">Display order<input type="number" className={inputClass} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} /></label>
          <div className="flex gap-2 pt-1"><Button type="submit" className="flex-1">{editing ? "Save changes" : "Add to catalog"}</Button>{editing && <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>}</div>
        </form>
      </section>
    </div>
  </div>;
}
