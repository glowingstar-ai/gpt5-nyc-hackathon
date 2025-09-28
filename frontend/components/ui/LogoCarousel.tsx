"use client";

import React from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

interface Logo {
  src: string;
  alt: string;
  className?: string;
}

interface LogoCarouselProps {
  logos: Logo[];
}

export default function LogoCarousel({ logos }: LogoCarouselProps) {
  const [emblaRef] = useEmblaCarousel({ loop: true, align: "center" }, [
    Autoplay({ delay: 850, stopOnInteraction: false }),
  ]);

  return (
    <div className="overflow-hidden w-full max-w-3xl mx-auto" ref={emblaRef}>
      <div className="flex">
        {logos.map((logo, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 flex items-center justify-center h-16 w-32 px-4"
          >
            <Image
              src={logo.src}
              alt={logo.alt}
              width={96}
              height={40}
              className={`max-h-10 max-w-24 object-contain mx-auto ${
                logo.className || ""
              }`}
              style={{ filter: "grayscale(0.2)" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
