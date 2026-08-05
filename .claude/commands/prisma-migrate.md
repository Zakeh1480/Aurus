---
description: Cria e aplica uma migration Prisma em apps/api, lembrando de manter o schema alinhado com os enums de packages/shared
argument-hint: [nome da migration]
---

Nome da migration: **$ARGUMENTS**

1. Antes de gerar a migration, releia `apps/api/prisma/schema.prisma` e confirme se algum enum do Prisma que você vai tocar já tem um equivalente Zod em `packages/shared/src/enums/` — o schema do Prisma é um espelho desses enums, não a fonte de verdade.
2. Rode `pnpm --filter @aurafarming/api exec prisma migrate dev --name $ARGUMENTS`.
3. Depois de aplicada, confira o SQL gerado em `apps/api/prisma/migrations/` e garanta que é reversível/aditivo sempre que possível.
4. Se a migration adicionar/alterar um model usado em lógica de negócio, atualize os testes (`*.spec.ts`) do service correspondente.
5. **Nunca** rode `prisma migrate reset`, `db push --force-reset` ou qualquer comando destrutivo sem confirmação explícita do usuário — isso apaga dados locais.
6. Se a mudança afeta LGPD (dados pessoais, exportação, anonimização), pare e sinalize — é trilha humana conforme `CLAUDE.md`.
