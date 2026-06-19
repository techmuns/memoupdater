import type { CurrentPriceInput, SelectedCompany } from "@shared/types";
import { api } from "./api";

// Fetch the day's live price for the selected company via the Worker quote
// route (which scrapes Google Finance / Yahoo Finance / Screener). Returns
// null on any failure — the orchestrator continues without the injected
// price and the LLM falls back to its own search behaviour. Never throws.
export async function fetchCurrentPrice(
  company: SelectedCompany | null,
  signal?: AbortSignal,
): Promise<CurrentPriceInput | null> {
  if (!company || !company.ticker) return null;
  try {
    const res = await api.stockQuote(
      {
        ticker: company.ticker,
        country: company.country,
        companyName: company.companyName,
      },
      signal,
    );
    if (!res.ok) return null;
    return {
      value: res.price,
      currency: res.currency,
      asOf: res.asOf,
      source: res.source,
      display: res.display,
    };
  } catch {
    return null;
  }
}
