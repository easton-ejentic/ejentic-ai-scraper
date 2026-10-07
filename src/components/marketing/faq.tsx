"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

function AccordionRow({ item, defaultOpen }: { item: FaqItem; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="mk-accordion-item">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="mk-accordion-trigger"
      >
        <span>{item.question}</span>
        <Plus
          size={20}
          strokeWidth={2}
          className={["mk-accordion-icon", open ? "mk-accordion-icon-open" : ""].filter(Boolean).join(" ")}
        />
      </button>
      {/* Height is animated in CSS (grid-template-rows 0fr -> 1fr) rather than
          measured in JS: reading `scrollHeight` off a ref during render is
          exactly what the React compiler rejects, and it also gets the height
          wrong on the very first paint. */}
      <div className="mk-accordion-panel" data-open={open} aria-hidden={!open}>
        <div className="mk-accordion-panel-inner">
          <div className="pb-6 pr-10">
            <p className="mk-body">{item.answer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div>
      {items.map((item, index) => (
        <AccordionRow key={item.question} item={item} defaultOpen={index === 0} />
      ))}
    </div>
  );
}
