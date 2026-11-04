import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Check, LoaderCircle, MessageSquareWarning, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/moderation")({ component: ConversationModerationPage });

type Violation = Tables<"contact_violations">;
type Conversation = Tables<"conversations">;
type Message = Tables<"messages">;
type ReopenRequest = Tables<"conversation_reopen_requests">;
type Case = { violation: Violation; conversation: Conversation | null; message: Message | null; boatTitle: string | null; requests: ReopenRequest[] };

function ConversationModerationPage() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.app_metadata?.role === "admin";
  const [notes, setNotes] = useState<Record<string, string>>({});

  const casesQuery = useQuery({
    queryKey: ["admin-conversation-moderation"],
    enabled: !!isAdmin,
    queryFn: async (): Promise<Case[]> => {
      const { data: violations, error } = await supabase.from("contact_violations").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      if (!violations?.length) return [];
      const conversationIds = [...new Set(violations.map((row) => row.conversation_id))];
      const violationIds = violations.map((row) => row.id);
      const messageIds = [...new Set(violations.flatMap((row) => row.message_id ? [row.message_id] : []))];
      const [conversationsResult, messagesResult, requestsResult] = await Promise.all([
        supabase.from("conversations").select("*").in("id", conversationIds),
        messageIds.length ? supabase.from("messages").select("*").in("id", messageIds) : Promise.resolve({ data: [], error: null }),
        supabase.from("conversation_reopen_requests").select("*").in("violation_id", violationIds).order("created_at", { ascending: true }),
      ]);
      if (conversationsResult.error) throw conversationsResult.error;
      if (messagesResult.error) throw messagesResult.error;
      if (requestsResult.error) throw requestsResult.error;
      const conversations = conversationsResult.data ?? [];
      const boatIds = [...new Set(conversations.map((row) => row.boat_id))];
      const boatsResult = boatIds.length ? await supabase.from("boats").select("id, title").in("id", boatIds) : { data: [], error: null };
      if (boatsResult.error) throw boatsResult.error;
      const conversationById = new Map((conversationsResult.data ?? []).map((row) => [row.id, row]));
      const messageById = new Map((messagesResult.data ?? []).map((row) => [row.id, row]));
      const requestsByViolation = new Map<string, ReopenRequest[]>();
      for (const request of requestsResult.data ?? []) requestsByViolation.set(request.violation_id, [...(requestsByViolation.get(request.violation_id) ?? []), request]);
      const boatTitleById = new Map((boatsResult.data ?? []).map((row) => [row.id, row.title]));
      return violations.map((violation) => {
        const conversation = conversationById.get(violation.conversation_id) ?? null;
        return { violation, conversation, message: violation.message_id ? messageById.get(violation.message_id) ?? null : null, boatTitle: conversation ? boatTitleById.get(conversation.boat_id) ?? null : null, requests: requestsByViolation.get(violation.id) ?? [] };
      });
    },
  });

  const cases = casesQuery.data ?? [];
  const pendingCount = useMemo(() => cases.reduce((count, item) => count + item.requests.filter((request) => request.status === "pending").length, 0), [cases]);
  const review = useMutation({
    mutationFn: async ({ requestId, decision }: { requestId: string; decision: "approved" | "denied" }) => {
      const { error } = await supabase.rpc("review_conversation_reopen_request", { _request_id: requestId, _decision: decision, _admin_note: notes[requestId]?.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Review saved."); void queryClient.invalidateQueries({ queryKey: ["admin-conversation-moderation"] }); },
    onError: (error: Error) => toast.error(error.message || "Could not save this review."),
  });

  if (loading) return <div className="container-page grid min-h-[60vh] place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-ocean" /></div>;
  if (!user || !isAdmin) return <div className="container-page py-20"><h1 className="text-3xl font-semibold">Admin access required</h1><p className="mt-2 text-muted-foreground">This page is available to DinghyCharter administrators only.</p></div>;

  return (
    <main className="container-page py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="flex items-center gap-2 text-ocean"><ShieldCheck className="h-5 w-5" /><span className="text-sm font-semibold">Administrator tools</span></div><h1 className="mt-2 text-3xl font-semibold">Conversation moderation</h1><p className="mt-2 max-w-2xl text-muted-foreground">Review the sanitized message and participants’ explanations before deciding whether to reopen a chat.</p></div>
        <div className="rounded-full bg-ocean-soft px-4 py-2 text-sm font-semibold text-ocean">{pendingCount} pending {pendingCount === 1 ? "request" : "requests"}</div>
      </div>

      {casesQuery.isError ? <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">Could not load moderation cases. <Button variant="outline" size="sm" className="ml-2" onClick={() => void casesQuery.refetch()}>Try again</Button></div> : casesQuery.isLoading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-ocean" /></div> : cases.length ? (
        <div className="mt-8 space-y-5">{cases.map(({ violation, conversation, message, boatTitle, requests }) => (
          <article key={violation.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-4">
              <div><p className="font-semibold">{boatTitle ?? "Boat conversation"}</p><p className="mt-1 text-xs text-muted-foreground">Flagged {format(parseISO(violation.created_at), "d MMM yyyy, HH:mm")} · conversation {violation.conversation_id.slice(0, 8)}</p></div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${conversation?.closed_at ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{conversation?.closed_at ? "Closed" : "Reopened"}</span>
            </header>
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <section><h2 className="flex items-center gap-2 text-sm font-semibold"><MessageSquareWarning className="h-4 w-4 text-amber-600" /> Flagged message (contact details removed)</h2><blockquote className="mt-3 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed">{message?.body ?? "Message unavailable"}</blockquote><p className="mt-2 text-xs text-muted-foreground">Sender: {violation.user_id ?? "unknown"}</p></section>
              <section><h2 className="text-sm font-semibold">Participants’ explanations</h2>{requests.length ? <div className="mt-3 space-y-3">{requests.map((request) => <div key={request.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{request.requester_id === violation.user_id ? "Person who sent the flagged message" : "Other participant"}</span><span className="text-xs capitalize text-muted-foreground">{request.status}</span></div><p className="mt-2 whitespace-pre-wrap break-words text-sm">{request.explanation}</p>{request.admin_note && <p className="mt-2 text-xs text-muted-foreground">Admin note: {request.admin_note}</p>}
                    {request.status === "pending" && <div className="mt-4 space-y-2"><Textarea value={notes[request.id] ?? ""} onChange={(event) => setNotes((old) => ({ ...old, [request.id]: event.target.value }))} maxLength={1000} rows={2} placeholder="Optional note for the decision" aria-label="Admin review note" /><div className="flex flex-wrap gap-2"><Button size="sm" variant="ocean" disabled={review.isPending} onClick={() => review.mutate({ requestId: request.id, decision: "approved" })}><Check /> Approve and reopen</Button><Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ requestId: request.id, decision: "denied" })}><X /> Decline request</Button></div></div>}
                  </div>)}</div> : <p className="mt-3 rounded-xl bg-secondary/50 p-4 text-sm text-muted-foreground">No one has asked to reopen this chat yet.</p>}</section>
            </div>
          </article>
        ))}</div>
      ) : <div className="mt-8 rounded-2xl border border-border bg-card p-10 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-emerald-600" /><h2 className="mt-3 font-semibold">No moderated conversations</h2><p className="mt-1 text-sm text-muted-foreground">Contact-sharing cases will appear here.</p></div>}
    </main>
  );
}

