import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowUp, Anchor, LoaderCircle, MessageCircle, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { containsContactInfo } from "@/lib/contact-redaction";
import { initials } from "@/lib/format";

type Conversation = Tables<"conversations">;
type Message = Tables<"messages">;
type ConversationPreview = Conversation & {
  boat: Pick<Tables<"boats">, "id" | "title" | "city" | "country"> | null;
  otherPerson: Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url"> | null;
  lastMessage: Pick<Message, "body" | "sender_id" | "created_at"> | null;
  unreadCount: number;
};

const inboxKey = (userId: string) => ["message-inbox", userId] as const;
const threadKey = (conversationId: string) => ["conversation-messages", conversationId] as const;

export const Route = createFileRoute("/dashboard/messages")({
  validateSearch: (search: Record<string, unknown>) => ({ c: typeof search.c === "string" ? search.c : undefined }),
  head: () => ({ meta: [{ title: "Messages — DinghyCharter" }, { name: "robots", content: "noindex" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { c: requestedId } = Route.useSearch();
  const [draft, setDraft] = useState("");
  const messageListRef = useRef<HTMLDivElement>(null);

  const inboxQuery = useQuery({
    queryKey: inboxKey(user?.id ?? "signed-out"),
    enabled: !!user,
    refetchInterval: 4000,
    queryFn: async (): Promise<ConversationPreview[]> => {
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id, boat_id, owner_id, sailor_id, last_message_at, created_at")
        .or(`owner_id.eq.${user!.id},sailor_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      if (!conversations?.length) return [];

      const boatIds = [...new Set(conversations.map((conversation) => conversation.boat_id))];
      const personIds = [...new Set(conversations.flatMap((conversation) => [conversation.owner_id, conversation.sailor_id]))];
      const conversationIds = conversations.map((conversation) => conversation.id);
      const [boatsResult, profilesResult, messagesResult] = await Promise.all([
        supabase.from("boats").select("id, title, city, country").in("id", boatIds),
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", personIds),
        supabase
          .from("messages")
          .select("id, conversation_id, body, sender_id, created_at, read_at, is_system")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
          .limit(1000),
      ]);
      if (boatsResult.error) throw boatsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (messagesResult.error) throw messagesResult.error;

      const boats = new Map((boatsResult.data ?? []).map((boat) => [boat.id, boat]));
      const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
      const latest = new Map<string, Pick<Message, "body" | "sender_id" | "created_at">>();
      const unread = new Map<string, number>();
      for (const message of messagesResult.data ?? []) {
        if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message);
        if (!message.is_system && message.sender_id && message.sender_id !== user!.id && !message.read_at) {
          unread.set(message.conversation_id, (unread.get(message.conversation_id) ?? 0) + 1);
        }
      }

      return conversations.map((conversation) => {
        const otherId = conversation.owner_id === user!.id ? conversation.sailor_id : conversation.owner_id;
        return {
          ...conversation,
          boat: boats.get(conversation.boat_id) ?? null,
          otherPerson: profiles.get(otherId) ?? null,
          lastMessage: latest.get(conversation.id) ?? null,
          unreadCount: unread.get(conversation.id) ?? 0,
        };
      });
    },
  });

  const conversations = inboxQuery.data ?? [];
  const activeConversation = conversations.find((conversation) => conversation.id === requestedId) ?? conversations[0] ?? null;
  const activeId = activeConversation?.id;

  const messagesQuery = useQuery({
    queryKey: threadKey(activeId ?? "none"),
    enabled: !!user && !!activeId,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, is_system, read_at, created_at")
        .eq("conversation_id", activeId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const messages = messagesQuery.data ?? [];
  const unreadIds = useMemo(
    () => messages.filter((message) => !message.is_system && message.sender_id && message.sender_id !== user?.id && !message.read_at).map((message) => message.id),
    [messages, user?.id],
  );
  const unreadKey = unreadIds.join(",");

  useEffect(() => {
    if (!activeId || !unreadIds.length) return;
    void supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(({ error }) => {
        if (!error) {
          void queryClient.invalidateQueries({ queryKey: threadKey(activeId) });
          void queryClient.invalidateQueries({ queryKey: inboxKey(user!.id) });
        }
      });
  }, [activeId, queryClient, unreadKey, unreadIds, user]);

  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`chat-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, () => {
        void queryClient.invalidateQueries({ queryKey: threadKey(activeId) });
        if (user) void queryClient.invalidateQueries({ queryKey: inboxKey(user.id) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeId, queryClient, user]);

  useEffect(() => {
    messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeId]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user || !activeId) throw new Error("Choose a conversation first.");
      const body = draft.trim();
      if (!body) throw new Error("Write a message first.");
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeId,
        sender_id: user.id,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      if (activeId) void queryClient.invalidateQueries({ queryKey: threadKey(activeId) });
      if (user) void queryClient.invalidateQueries({ queryKey: inboxKey(user.id) });
    },
    onError: (error: Error) => toast.error(error.message || "Couldn't send this message."),
  });

  const selectConversation = (conversationId: string) => {
    setDraft("");
    void navigate({ to: "/dashboard/messages", search: { c: conversationId }, replace: true });
  };

  if (loading) {
    return <div className="container-page grid min-h-[60vh] place-items-center"><LoaderCircle className="h-7 w-7 animate-spin text-ocean" /></div>;
  }

  if (!user) {
    return (
      <div className="container-page grid min-h-[65vh] place-items-center py-16">
        <div className="max-w-md text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ocean-soft text-ocean"><MessageCircle /></div>
          <h1 className="mt-5 text-3xl font-semibold">Your conversations</h1>
          <p className="mt-2 text-muted-foreground">Sign in to message boat owners and manage booking questions.</p>
          <Button asChild className="mt-6"><Link to="/auth" search={{ redirect: "/dashboard/messages" }}>Sign in</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8 md:py-12">
      <Link to="/search" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to boats
      </Link>
      <div className="mb-6 mt-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ocean">DinghyCharter</p>
          <h1 className="mt-1 text-3xl font-semibold">Messages</h1>
        </div>
        <span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4 text-ocean" /> Keep your booking on the platform</span>
      </div>

      {inboxQuery.isError ? (
        <ErrorPanel message="We couldn't load your conversations. Check your connection and try again." onRetry={() => void inboxQuery.refetch()} />
      ) : (
        <div className="grid min-h-[65vh] overflow-hidden rounded-2xl border border-border bg-card shadow-soft md:grid-cols-[310px_minmax(0,1fr)]">
          <aside className="flex max-h-[35vh] flex-col border-b border-border md:max-h-[72vh] md:border-b-0 md:border-r">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold">Inbox</h2>
              <p className="mt-1 text-xs text-muted-foreground">Booking questions and owner replies</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {inboxQuery.isLoading ? (
                <div className="grid h-32 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-ocean" /></div>
              ) : conversations.length ? conversations.map((conversation) => {
                const name = conversation.otherPerson?.full_name || "DinghyCharter member";
                const selected = conversation.id === activeId;
                const preview = conversation.lastMessage?.body ?? "Conversation started";
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => selectConversation(conversation.id)}
                    className={`flex w-full items-start gap-3 border-b border-border/70 px-4 py-4 text-left transition-colors hover:bg-secondary/70 ${selected ? "bg-ocean-soft/70" : ""}`}
                  >
                    <Avatar className="mt-0.5 h-10 w-10 shrink-0">
                      <AvatarImage src={conversation.otherPerson?.avatar_url ?? undefined} alt={name} />
                      <AvatarFallback className="bg-navy text-xs font-semibold text-navy-foreground">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{name}</span>
                        {conversation.lastMessage && <time className="shrink-0 text-[10px] text-muted-foreground">{format(parseISO(conversation.lastMessage.created_at), "d MMM")}</time>}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ocean">{conversation.boat?.title ?? "Boat listing"}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{preview}</span>
                    </span>
                    {conversation.unreadCount > 0 && <span className="mt-1 grid h-5 min-w-5 place-items-center rounded-full bg-ocean px-1 text-[10px] font-bold text-white">{conversation.unreadCount}</span>}
                  </button>
                );
              }) : (
                <div className="px-5 py-10 text-center">
                  <MessageCircle className="mx-auto h-7 w-7 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-semibold">No conversations yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">Open a boat listing and choose “Message the owner” to start.</p>
                  <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/search"><Search /> Find a boat</Link></Button>
                </div>
              )}
            </div>
          </aside>

          <section className="flex min-h-[50vh] flex-col md:min-h-0 md:max-h-[72vh]">
            {activeConversation ? (
              <>
                <header className="flex items-center gap-3 border-b border-border px-4 py-3 md:px-6">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={activeConversation.otherPerson?.avatar_url ?? undefined} alt={activeConversation.otherPerson?.full_name ?? ""} />
                    <AvatarFallback className="bg-navy text-xs font-semibold text-navy-foreground">{initials(activeConversation.otherPerson?.full_name ?? "")}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{activeConversation.otherPerson?.full_name || "DinghyCharter member"}</h2>
                    <Link to="/boats/$boatId" params={{ boatId: activeConversation.boat_id }} className="flex items-center gap-1 truncate text-xs text-muted-foreground hover:text-ocean">
                      <Anchor className="h-3 w-3 shrink-0" /> {activeConversation.boat?.title ?? "View boat listing"}
                    </Link>
                  </div>
                  <span className="hidden rounded-full bg-ocean-soft px-2.5 py-1 text-xs font-medium text-ocean sm:inline">{activeConversation.boat?.city}</span>
                </header>

                <div ref={messageListRef} className="flex-1 space-y-4 overflow-y-auto bg-surface/40 px-4 py-5 md:px-6">
                  {messagesQuery.isError ? (
                    <ErrorPanel message="Messages couldn't be loaded." onRetry={() => void messagesQuery.refetch()} />
                  ) : messagesQuery.isLoading ? (
                    <div className="grid h-40 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-ocean" /></div>
                  ) : messages.length ? messages.map((message) => {
                    const own = message.sender_id === user.id;
                    if (message.is_system) {
                      return <p key={message.id} className="mx-auto max-w-md rounded-full bg-secondary px-4 py-2 text-center text-xs text-muted-foreground">{message.body}</p>;
                    }
                    return (
                      <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm sm:max-w-[75%] ${own ? "rounded-br-md bg-navy text-navy-foreground" : "rounded-bl-md border border-border bg-card"}`}>
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                          <div className={`mt-1.5 flex items-center justify-end gap-2 text-[10px] ${own ? "text-navy-foreground/65" : "text-muted-foreground"}`}>
                            <time>{format(parseISO(message.created_at), "HH:mm · d MMM")}</time>
                            {own && message.read_at && <span>Seen</span>}
                          </div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="grid h-full min-h-40 place-items-center text-center">
                      <div><MessageCircle className="mx-auto h-7 w-7 text-ocean/60" /><p className="mt-2 text-sm text-muted-foreground">Say hello and introduce yourself.</p></div>
                    </div>
                  )}
                </div>

                <form
                  className="border-t border-border bg-card p-4 md:px-6"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (draft.trim()) sendMessage.mutate();
                  }}
                >
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Write a message…"
                      maxLength={2000}
                      rows={2}
                      className="min-h-[48px] max-h-36 resize-y rounded-xl bg-background"
                      aria-label="Message"
                      disabled={sendMessage.isPending}
                    />
                    <Button type="submit" size="icon" variant="ocean" className="h-11 w-11 shrink-0 rounded-xl" disabled={!draft.trim() || sendMessage.isPending} aria-label="Send message">
                      {sendMessage.isPending ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
                    </Button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                    {containsContactInfo(draft) ? <span className="text-warning">Contact details are hidden to keep bookings safe.</span> : <span>Never share payment details outside DinghyCharter.</span>}
                    <span>{draft.length}/2000</span>
                  </div>
                </form>
              </>
            ) : (
              <div className="grid flex-1 place-items-center px-6 py-14 text-center">
                <div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ocean-soft text-ocean"><MessageCircle /></div><h2 className="mt-4 text-xl font-semibold">Your messages stay in one place</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Choose a conversation or message the owner from any boat listing.</p></div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="m-5 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Try again</Button>
    </div>
  );
}
