export function mapAgreementError(error: string): Response {
  const status =
    error === "AGREEMENT_NOT_FOUND"
      ? 404
      : error === "NOT_PARTICIPANT"
        ? 403
        : error === "INVALID_EXPLANATION"
          ? 422
          : 409;
  const key =
    error === "AGREEMENT_NOT_FOUND"
      ? "notFound"
      : error === "NOT_PARTICIPANT"
        ? "notParticipant"
        : error === "INVALID_EXPLANATION"
          ? "invalidExplanation"
          : error === "CONFIRMATION_EXPIRED"
            ? "confirmationExpired"
            : "invalidState";
  return Response.json(
    { code: error, messageKey: `agreements.errors.${key}` },
    { status },
  );
}
