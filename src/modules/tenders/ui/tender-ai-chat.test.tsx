import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "../../localization/messages/en.json";
import { TenderAiChat } from "./tender-ai-chat";

describe("TenderAiChat", () => {
  it("renders nothing on the server; it is portalled to <body> on the client", () => {
    expect(
      renderToStaticMarkup(
        <TenderAiChat copy={en.detail.ai} context={{ kind: "authoring" }} />,
      ),
    ).toBe("");
  });
});
