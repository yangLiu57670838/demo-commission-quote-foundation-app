# Edge cases

- The same loan details can return a new `quoteId` today. Do not retry a vendor call until the vendor agrees a repeat is safe.
- Assumption for this demo, until a real vendor contract replaces it: maximum loan amount is `10000000` in one currency, maximum term is `360` months (a 30-year cap, not a vendor rule), commission rate is at most `1` (100% of the loan), and total commission cannot exceed that maximum loan amount.
