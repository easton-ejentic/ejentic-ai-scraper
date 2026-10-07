import { Container, Eyebrow } from "@/components/marketing/primitives";

interface PageHeroProps {
  eyebrow: string;
  title: React.ReactNode;
  description: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHero({ eyebrow, title, description, children }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--border)] bg-white">
      <div className="mk-grid-lines" aria-hidden="true" />
      <div
        className="mk-glow"
        aria-hidden="true"
        style={{
          width: 520,
          height: 520,
          left: "50%",
          top: -280,
          transform: "translateX(-50%)",
          background: "rgba(37, 99, 235, 0.13)",
        }}
      />
      <Container className="py-[64px] text-center sm:py-[88px]">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mk-h1 mx-auto mt-5 max-w-[820px]">{title}</h1>
        <p className="mk-lead mx-auto mt-6 max-w-[660px]">{description}</p>
        {children ? <div className="mt-9">{children}</div> : null}
      </Container>
    </section>
  );
}
