import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import ka from "../../localization/messages/ka.json";
import ru from "../../localization/messages/ru.json";
import {
  chatScript,
  rich,
  type AnswerSegment,
  type ChatAnswer,
  type TenderAiContext,
} from "./tender-ai-answers";

const copy = en.detail.ai;

const segments = (answer: ChatAnswer) =>
  answer.blocks.flatMap((block) =>
    block.kind === "paragraph" ? [block.segments] : block.items,
  );
const text = (answer: ChatAnswer) =>
  segments(answer)
    .map((line) => line.map((segment) => segment.text).join(""))
    .join("\n");
const strong = (answer: ChatAnswer) =>
  segments(answer)
    .flat()
    .filter((segment: AnswerSegment) => segment.strong)
    .map((segment) => segment.text);
const links = (answer: ChatAnswer) =>
  segments(answer)
    .flat()
    .flatMap((segment) => (segment.href ? [[segment.text, segment.href]] : []));

const tender: TenderAiContext = {
  kind: "tender",
  title: "Warehouse extension",
  budget: "4,800 GEL",
  offerCount: 5,
  lowestOffer: "4,020 GEL",
};

const home: TenderAiContext = {
  kind: "home",
  tenders: [
    {
      title: "Roof repair",
      budget: "2,000 GEL",
      href: "/en/provider/tenders/t1",
    },
    { title: "Kitchen remodel", budget: null, href: "/en/provider/tenders/t2" },
  ],
  partners: [
    { name: "Iveria Build", specialty: "Renovation", href: "/en/profiles/p1" },
  ],
  links: {
    tenders: "/en/provider/tenders",
    partners: "/en/partners",
    post: "/en/client/tenders/new",
  },
};

describe("rich", () => {
  it("marks **bold** runs and filled placeholders as strong", () => {
    expect(rich("**Price**: {amount} total", { amount: "5 GEL" })).toEqual([
      { text: "Price", strong: true },
      { text: ": " },
      { text: "5 GEL", strong: true },
      { text: " total" },
    ]);
  });
});

describe("tender context", () => {
  it("answers the budget chip, and typed questions, with the tender's figures", () => {
    const script = chatScript(copy, tender);
    const [budget, scope, offer] = script.suggestions;
    expect(script.contextTitle).toBe("Warehouse extension");
    expect(script.contextDetail).toBe("4,800 GEL");
    expect(script.mainAnswer).toBe(budget?.answer);
    expect(text(script.mainAnswer)).toContain(
      "The client’s budget is 4,800 GEL. Offers so far: 5. The lowest is 4,020 GEL.",
    );
    expect(strong(script.mainAnswer)).toEqual(["4,800 GEL", "5", "4,020 GEL"]);
    expect(script.mainAnswer.sources).toEqual([
      "budget",
      "scope",
      "competition",
    ]);
    expect(text(scope!.answer)).toContain("“Warehouse extension”");
    expect(offer!.answer.blocks[1]).toMatchObject({ kind: "list" });
  });

  it("omits facts the page could not provide", () => {
    const script = chatScript(copy, {
      ...tender,
      budget: null,
      offerCount: null,
      lowestOffer: null,
    } as TenderAiContext);
    expect(script.contextDetail).toBeNull();
    expect(text(script.mainAnswer).split("\n")[0]).toBe(
      copy.tender.answerNoBudget,
    );
  });

  it("invites the first offer when none are in", () => {
    const script = chatScript(copy, {
      ...tender,
      offerCount: 0,
      lowestOffer: null,
    } as TenderAiContext);
    expect(text(script.mainAnswer)).toContain(copy.tender.answerNoOffers);
  });
});

describe("home context", () => {
  it("lists real tenders with links and bold budgets", () => {
    const script = chatScript(copy, home);
    expect(script.contextDetail).toBeNull();
    expect(script.suggestions.map(({ label }) => label)).toEqual([
      "Find tenders for me",
      "Show VIP partners",
      "How does it work?",
    ]);
    expect(links(script.mainAnswer)).toEqual([
      ["Roof repair", "/en/provider/tenders/t1"],
      ["Kitchen remodel", "/en/provider/tenders/t2"],
      ["See all tenders", "/en/provider/tenders"],
    ]);
    expect(strong(script.mainAnswer)).toEqual(["2,000 GEL"]);
  });

  it("lists VIP partners and links to the partners page", () => {
    const partners = chatScript(copy, home).suggestions[1]!.answer;
    expect(text(partners)).toContain("Iveria Build · Renovation");
    expect(links(partners)).toContainEqual([
      "See all VIP partners",
      "/en/partners",
    ]);
  });

  it("falls back gracefully without tenders or partners", () => {
    const script = chatScript(copy, { ...home, tenders: [], partners: [] });
    expect(text(script.mainAnswer)).toContain(copy.home.findEmpty);
    expect(text(script.suggestions[1]!.answer)).toContain(
      copy.home.partnersEmpty,
    );
  });
});

describe("authoring context", () => {
  it("answers typed questions with the publishing checklist", () => {
    const script = chatScript(copy, { kind: "authoring" });
    expect(script.contextTitle).toBe("Drafting a new tender");
    expect(script.mainAnswer).toBe(script.suggestions[1]?.answer);
    expect(strong(script.mainAnswer)).toEqual([
      "title",
      "budget",
      "bidding deadline",
      "location",
      "photos or plans",
      "work quantities",
    ]);
    expect(script.mainAnswer.sources).toBeUndefined();
  });

  it("builds every context in every language", () => {
    for (const messages of [en, ka, ru]) {
      for (const context of [tender, home, { kind: "authoring" } as const]) {
        const script = chatScript(messages.detail.ai, context);
        expect(script.suggestions).toHaveLength(3);
        for (const { label, answer } of script.suggestions) {
          expect(label).not.toBe("");
          expect(text(answer)).not.toMatch(/\{\w+\}|\*\*/);
        }
      }
    }
  });
});
