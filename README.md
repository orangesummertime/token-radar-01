# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/orangesummertime/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/orangesummertime/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar (radar-2) ranks every pre-token protocol in DefiLlama's sealed snapshot by the implied value of a token it has not issued yet, and shows how to farm each one. The model prices each category from the snapshot's own live-token market-cap-to-TVL medians, adjusts for seven-day growth, age with no token and chain breadth, and covers the whole 40-protocol watchlist plus 158 early pre-token protocols below the floor. The dashboard is a static page with a sortable, filterable board, a detail view with the full model equation and a seven-step farm plan per protocol, and a live-token view set aside with market caps.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=j6ctznzy&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
