# Catalog runtime loading measurement

- Date: 9 September 2026
- Environment: local API at `http://localhost:8080`
- Cold request: 3.431718 seconds
- Response size: 544 bytes
- Unique indicator count: 5

## Key terms, 10 September 2026

Checked through nginx at `http://localhost:8080`.

- Before: clicking the Key terms tab waited 20.1 seconds for page data, with no loading feedback.
- A separate API trace took 31.8 seconds. One Annual Maximum Temperature request across all regions took 18.6 seconds, only to find scenario year ranges.
- After removing those lookups: the scenario API took 4.3 seconds. It returned 25 scenarios: 10 ending in 2100 and 15 ending in 2300.
- Clicking the tab opened the page with a loading spinner in 48 milliseconds. The glossary and scenario section load separately.

The timeframe choices are fixed at 2100 and 2300. Chart dates come from the temperature curves already requested for display. These are single local checks, not timing guarantees.
