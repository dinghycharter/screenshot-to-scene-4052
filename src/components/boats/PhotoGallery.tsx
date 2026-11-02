import { useState } from "react";
import { Grid2X2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

export function PhotoGallery({ photos, title }: { photos: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  if (photos.length === 0) {
    return <div className="grid aspect-[16/9] place-items-center rounded-3xl bg-muted text-muted-foreground">No photos yet</div>;
  }
  const [main, ...rest] = photos;
  const side = rest.slice(0, 4);

  return (
    <>
      {/* Mobile carousel */}
      <div className="-mx-5 md:hidden">
        <Carousel>
          <CarouselContent className="ml-0">
            {photos.map((p, i) => (
              <CarouselItem key={p + i} className="pl-0">
                <img src={p} alt={`${title} photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" width={1280} height={960} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Desktop grid */}
      <div className="relative hidden h-[460px] gap-2 overflow-hidden rounded-3xl md:grid md:grid-cols-4 md:grid-rows-2">
        <button onClick={() => setOpen(true)} className={`group overflow-hidden ${side.length ? "col-span-2 row-span-2" : "col-span-4 row-span-2"}`}>
          <img src={main} alt={title} width={1280} height={960} className="h-full w-full object-cover transition duration-500 group-hover:brightness-95" />
        </button>
        {side.map((p, i) => (
          <button
            key={p + i}
            onClick={() => setOpen(true)}
            className={`group overflow-hidden ${side.length === 1 ? "col-span-2 row-span-2" : side.length === 2 ? "col-span-2" : side.length === 3 && i === 0 ? "col-span-2" : ""}`}
          >
            <img src={p} alt={`${title} photo ${i + 2}`} loading="lazy" width={1280} height={960} className="h-full w-full object-cover transition duration-500 group-hover:brightness-95" />
          </button>
        ))}
        <Button variant="hero" size="sm" className="absolute bottom-4 right-4" onClick={() => setOpen(true)}>
          <Grid2X2 /> Show all photos
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl border-0 bg-background p-4 sm:p-8">
          <DialogTitle className="sr-only">{title} photos</DialogTitle>
          <Carousel className="mx-auto w-full max-w-4xl">
            <CarouselContent>
              {photos.map((p, i) => (
                <CarouselItem key={p + i}>
                  <img src={p} alt={`${title} photo ${i + 1}`} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-2" />
            <CarouselNext className="right-2" />
          </Carousel>
        </DialogContent>
      </Dialog>
    </>
  );
}
