// Catalog queries are server-only; importing them via `.server` makes a client-bundle leak a build error.
export * from "@tcg/core";
