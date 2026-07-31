import base from "@aurafarming/config/eslint";

export default [
  ...base,
  {
    rules: {
      // Nest injeta dependências via emitDecoratorMetadata, que precisa da
      // classe como valor real em runtime — `import type` faria o TS emitir
      // `Object` no design:paramtypes e quebraria a resolução de DI.
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
  {
    // Script de CLI (prisma db seed) — console.log é a saída esperada.
    files: ["prisma/seed.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
