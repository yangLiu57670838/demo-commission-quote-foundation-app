# Edge cases

- The same loan details can return a new `quoteId` today. Do not retry a vendor call until the vendor agrees a repeat is safe.
- Assumption for this demo, until a real vendor contract replaces it: maximum loan amount is `10000000` in one currency, maximum term is `360` months (a 30-year cap, not a vendor rule), commission rate is at most `1` (100% of the loan), and total commission cannot exceed that maximum loan amount.
- Mock formula, not from the challenge: `LOW` is `0.005`, `MEDIUM` is `0.0075`, `HIGH` is `0.01`. Commission is the loan amount times that rate, rounded half up to 2 decimals. The term is checked and does not change the rate.
- Assumption: the commission rate grows with the risk band. A real vendor may instead use one fixed percentage for every band.
