import type { Messages } from "../../localization/get-messages";

// Demo only: there is no model behind Tender AI. Each context offers three
// suggestion chips with a prepared answer each, filled in with facts the
// page already shows; typed questions get the context's main answer.

export type TenderAiCopy = Messages["detail"]["ai"];

export type AnswerSegment = Readonly<{
  text: string;
  strong?: boolean;
  href?: string;
}>;

export type AnswerBlock = Readonly<
  | { kind: "paragraph"; segments: readonly AnswerSegment[] }
  | { kind: "list"; items: readonly (readonly AnswerSegment[])[] }
>;

export type SourceKey = "budget" | "scope" | "competition";

export type ChatAnswer = Readonly<{
  blocks: readonly AnswerBlock[];
  sources?: readonly SourceKey[];
}>;

/** Plain, serializable facts a server page hands to the chat. */
export type TenderAiContext = Readonly<
  | {
      kind: "tender";
      title: string;
      budget: string | null;
      // `null` when the competition summary could not be read.
      offerCount: number | null;
      lowestOffer: string | null;
    }
  | {
      kind: "home";
      tenders: readonly Readonly<{
        title: string;
        budget: string | null;
        href: string;
      }>[];
      partners: readonly Readonly<{
        name: string;
        specialty: string;
        href: string;
      }>[];
      links: Readonly<{ tenders: string; partners: string; post: string }>;
    }
  | { kind: "authoring" }
>;

export type ChatScript = Readonly<{
  contextLabel: string;
  contextTitle: string;
  contextDetail: string | null;
  placeholder: string;
  suggestions: readonly Readonly<{ label: string; answer: ChatAnswer }>[];
  /** The answer every typed question gets. */
  mainAnswer: ChatAnswer;
}>;

/**
 * Parses `**bold**` and `{name}` placeholders; filled values are bold too.
 */
export function rich(
  template: string,
  values: Readonly<Record<string, string>> = {},
): AnswerSegment[] {
  return template
    .split(/(\*\*[^*]+\*\*|\{\w+\})/)
    .filter((part) => part !== "")
    .map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return { text: part.slice(2, -2), strong: true };
      }
      const key = /^\{(\w+)\}$/.exec(part)?.[1];
      const value = key === undefined ? undefined : values[key];
      return value === undefined
        ? { text: part }
        : { text: value, strong: true };
    });
}

const paragraph = (...segments: AnswerSegment[]): AnswerBlock => ({
  kind: "paragraph",
  segments,
});
const list = (...items: AnswerSegment[][]): AnswerBlock => ({
  kind: "list",
  items,
});
const link = (text: string, href: string): AnswerSegment => ({ text, href });

function tenderScript(
  copy: TenderAiCopy["tender"],
  context: Extract<TenderAiContext, { kind: "tender" }>,
): ChatScript {
  const opening =
    context.budget === null
      ? [{ text: copy.answerNoBudget }]
      : rich(copy.answerBudget, { budget: context.budget });
  if (
    context.offerCount !== null &&
    context.offerCount > 0 &&
    context.lowestOffer
  ) {
    opening.push(
      { text: " " },
      ...rich(copy.answerOffers, {
        count: String(context.offerCount),
        lowest: context.lowestOffer,
      }),
    );
  } else if (context.offerCount === 0) {
    opening.push({ text: ` ${copy.answerNoOffers}` });
  }
  const budget: ChatAnswer = {
    blocks: [paragraph(...opening), paragraph(...rich(copy.answerPricing))],
    sources: ["budget", "scope", "competition"],
  };

  return {
    contextLabel: copy.contextLabel,
    contextTitle: context.title,
    contextDetail: context.budget,
    placeholder: copy.placeholder,
    mainAnswer: budget,
    suggestions: [
      { label: copy.suggestBudget, answer: budget },
      {
        label: copy.suggestScope,
        answer: {
          blocks: [
            paragraph(...rich(copy.scopeSummary, { title: context.title })),
          ],
          sources: ["scope"],
        },
      },
      {
        label: copy.suggestOffer,
        answer: {
          blocks: [
            paragraph({ text: copy.offerIntro }),
            list(
              rich(copy.offerPrice),
              rich(copy.offerTimeline),
              rich(copy.offerIncluded),
            ),
          ],
        },
      },
    ],
  };
}

function homeScript(
  copy: TenderAiCopy["home"],
  context: Extract<TenderAiContext, { kind: "home" }>,
): ChatScript {
  const tenders = context.tenders.slice(0, 3);
  const partners = context.partners.slice(0, 3);
  const find: ChatAnswer = {
    blocks:
      tenders.length === 0
        ? [
            paragraph({ text: copy.findEmpty }),
            paragraph(link(copy.postLink, context.links.post)),
          ]
        : [
            paragraph({ text: copy.findIntro }),
            list(
              ...tenders.map((tender) => [
                link(tender.title, tender.href),
                ...(tender.budget === null
                  ? []
                  : [{ text: " · " }, { text: tender.budget, strong: true }]),
              ]),
            ),
            paragraph(link(copy.seeAllTenders, context.links.tenders)),
          ],
  };

  return {
    contextLabel: copy.contextLabel,
    contextTitle: copy.contextLabel,
    contextDetail: null,
    placeholder: copy.placeholder,
    mainAnswer: find,
    suggestions: [
      { label: copy.suggestFind, answer: find },
      {
        label: copy.suggestPartners,
        answer: {
          blocks: [
            ...(partners.length === 0
              ? [paragraph({ text: copy.partnersEmpty })]
              : [
                  paragraph({ text: copy.partnersIntro }),
                  list(
                    ...partners.map((partner) => [
                      link(partner.name, partner.href),
                      { text: ` · ${partner.specialty}` },
                    ]),
                  ),
                ]),
            paragraph(link(copy.seeAllPartners, context.links.partners)),
          ],
        },
      },
      {
        label: copy.suggestHow,
        answer: {
          blocks: [
            list(rich(copy.howStep1), rich(copy.howStep2), rich(copy.howStep3)),
            paragraph(
              link(copy.discoverLink, context.links.tenders),
              { text: " · " },
              link(copy.postLink, context.links.post),
            ),
          ],
        },
      },
    ],
  };
}

function authoringScript(copy: TenderAiCopy["authoring"]): ChatScript {
  const check: ChatAnswer = {
    blocks: [
      paragraph({ text: copy.checkIntro }),
      list(
        rich(copy.checkTitle),
        rich(copy.checkBudget),
        rich(copy.checkDeadline),
        rich(copy.checkLocation),
        rich(copy.checkPhotos),
        rich(copy.checkQuantities),
      ),
    ],
  };

  return {
    contextLabel: copy.contextLabel,
    contextTitle: copy.contextLabel,
    contextDetail: null,
    placeholder: copy.placeholder,
    mainAnswer: check,
    suggestions: [
      {
        label: copy.suggestDescription,
        answer: {
          blocks: [
            paragraph({ text: copy.descriptionIntro }),
            paragraph({ text: copy.descriptionSample }),
          ],
        },
      },
      { label: copy.suggestCheck, answer: check },
      {
        label: copy.suggestBudget,
        answer: { blocks: [paragraph(...rich(copy.budgetTip))] },
      },
    ],
  };
}

export function chatScript(
  copy: TenderAiCopy,
  context: TenderAiContext,
): ChatScript {
  switch (context.kind) {
    case "tender":
      return tenderScript(copy.tender, context);
    case "home":
      return homeScript(copy.home, context);
    case "authoring":
      return authoringScript(copy.authoring);
  }
}
