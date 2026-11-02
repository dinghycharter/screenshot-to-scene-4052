import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function useSavedBoatIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["saved-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("saved_boats").select("boat_id");
      if (error) throw error;
      return new Set(data.map((d) => d.boat_id));
    },
  });
}

export function SaveButton({ boatId, className, variant = "overlay" }: { boatId: string; className?: string; variant?: "overlay" | "inline" }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: saved } = useSavedBoatIds();
  const isSaved = saved?.has(boatId) ?? false;

  const mutation = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        const { error } = await supabase.from("saved_boats").delete().eq("boat_id", boatId).eq("user_id", user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("saved_boats").insert({ boat_id: boatId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-ids"] });
      queryClient.invalidateQueries({ queryKey: ["saved-boats"] });
      toast.success(isSaved ? "Removed from saved boats" : "Saved to your wishlist");
    },
    onError: () => toast.error("Couldn't update your saved boats"),
  });

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      navigate({ to: "/auth", search: { redirect: location.href } });
      return;
    }
    mutation.mutate();
  };

  if (variant === "inline") {
    return (
      <button
        onClick={onClick}
        className={cn("inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold underline-offset-4 hover:bg-secondary", className)}
      >
        <Heart className={cn("h-4 w-4", isSaved && "fill-ocean text-ocean")} />
        {isSaved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={isSaved ? "Remove from saved" : "Save boat"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-full bg-background/90 shadow-soft backdrop-blur transition-transform hover:scale-110 active:scale-95",
        className,
      )}
    >
      <Heart className={cn("h-[18px] w-[18px] text-foreground", isSaved && "fill-ocean text-ocean")} />
    </button>
  );
}
