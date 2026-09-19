# Architecture decision records

One file per decision that could be relitigated later: the context that forced it, what was
chosen and why, what it made easier and harder. Newest last.

| ADR | Decision | Story |
|---|---|---|
| [0001](adr-0001-stack.md) | FastAPI + SQLAlchemy 2 on Postgres, sync throughout; Vite + React 19. Outbox, DLQ and stale-update guards stated N/A: no queue. | S1 |
| [0002](adr-0002-persist-the-catalog.md) | Persist the HIBP catalogue in our own table rather than proxy it per request; refreshed stale-while-revalidate once a day old (S2b amendment). | S2 |
| [0003](adr-0003-server-side-stored-assignment.md) | Assign variants on the server and store the result; a weight change moves new visitors only. | S3 |
| [0004](adr-0004-result-screen-decisions.md) | The result screen fails open to the calm control when the flag cannot be read; reflow is CSS-only, one DOM tree for every width. | S5 |
| [0005](adr-0005-password-handling.md) | Argon2id for the stored credential; SHA-1 only as the k-anonymity lookup key, through our proxy. | S6 |
| [0006](adr-0006-frequentist-read.md) | Fixed-sample two-proportion z-test; significance alone does not earn a call, the powered sample must be in. | S7 |
