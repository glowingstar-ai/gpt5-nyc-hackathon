# Frontend application

This Next.js application is configured for rapid UI development with Tailwind CSS, Radix Themes, shadcn-style primitives, and Framer Motion animations.

## Available scripts

```bash
pnpm dev      # Start the development server
pnpm build    # Create a production build
pnpm start    # Serve the production build
pnpm lint     # Run ESLint
pnpm format   # Format with Prettier
```

## Project layout

```
frontend/
├── app/              # App Router routes
├── components/       # Reusable UI primitives and providers
├── lib/              # Shared utilities (e.g., fonts, helpers)
├── public/           # Static assets
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

Fonts from Inter, Manrope, and IBM Plex Sans are preloaded via `next/font`. To use additional brand fonts, add the assets to `public/` and update `lib/fonts.ts` accordingly.
