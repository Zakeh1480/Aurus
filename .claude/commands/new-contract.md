---
description: Checklist guiado para adicionar um novo DTO, enum ou evento WebSocket em packages/shared, respeitando a regra de ouro "contract-first"
argument-hint: [nome do dto/enum/evento a adicionar]
---

Vou adicionar/alterar um contrato: **$ARGUMENTS**

Siga a regra de ouro #1 do `CLAUDE.md`: todo DTO, enum e evento WebSocket vive em `packages/shared` como schema Zod (schema → tipo inferido via `z.infer`). Nunca crie um tipo equivalente em `apps/web` ou `apps/api`.

Passos:

1. Confirme se já existe algo equivalente em `packages/shared/src/dtos/`, `enums/` ou `events/` antes de criar algo novo (evite duplicar).
2. Crie o schema no arquivo correto:
   - DTO de payload REST/WS → `packages/shared/src/dtos/<nome>.dto.ts`
   - Enum → `packages/shared/src/enums/<nome>.ts` (via `z.enum([...])`)
   - Evento WebSocket → adicione o schema em `packages/shared/src/events/` e registre no mapa único `WsEventSchemas` (`event-map.ts`) — todo evento novo precisa entrar nesse mapa.
3. Exporte o schema e o tipo inferido no barrel (`index.ts`) correspondente.
4. Escreva testes em `packages/shared/test/` cobrindo casos válidos, inválidos e limites (o padrão do projeto é cobertura exaustiva — veja `dtos.test.ts` como referência de estilo).
5. Rode `pnpm --filter @aurafarming/shared test` para validar.
6. Se o contrato for consumido por `services/ai` (ex.: features de scoring/anti-cheat), verifique se `services/ai/app/schemas.py` e/ou `app/constants.py` precisam ser espelhados manualmente — não há import automático entre TS e Python nesse serviço, e há um teste de guarda (`test_constants.py`) que checa essa sincronia.
7. Atualize `apps/web`/`apps/api` para importar o novo tipo de `@aurafarming/shared` — nunca redeclarar.

Ao final, confirme que nenhum tipo foi duplicado fora de `packages/shared` e rode os testes do pacote.
