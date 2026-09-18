// The one place the browser console is written to. Everything else imports `logger` from here,
// the same way everything imports `httpClient` rather than axios: one seam to route through a
// real collector later, and one file the `no-console` exemption has to cover.
//
// The house logging rules hold here as they do on the backend: the function that failed names
// itself in the message, and the identifiers go in the context object — never a bare string.

export type LogContext = Record<string, unknown>;

export const logger = {
    error: (message: string, context: LogContext): void => {
        console.error(message, context);
    },
};
