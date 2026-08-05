---
description: Inicia o fluxo de um novo "Prompt N" (uma tarefa = um PR), seguindo a convenção de escopo do projeto
argument-hint: [descrição curta do escopo do próximo prompt]
---

Escopo proposto: **$ARGUMENTS**

O projeto segue a convenção "um prompt = um PR" (regra de ouro #2 do `CLAUDE.md`): cada tarefa entrega código + testes + critérios de aceite, sem misturar escopos.

1. Rode `git log --oneline -15` para confirmar qual foi o último Prompt concluído (veja a seção "Estado atual do projeto" em `CLAUDE.md` para a lista até aqui) e qual é o próximo número.
2. Confirme com o usuário se o escopo descrito cabe em um único prompt/PR. Se parecer grande demais (toca frontend + backend + IA + infra ao mesmo tempo sem relação direta), sinalize e sugira quebrar.
3. Verifique se o escopo esbarra em alguma decisão da "Trilha humana" (fairness do score, política de moderação, sign-off de LGPD, precificação, ops de produção) — se sim, pare e pergunte antes de implementar.
4. Monte um plano com critérios de aceite explícitos: o que precisa funcionar, quais testes cobrem a lógica de negócio nova, e se contratos novos precisam ir para `packages/shared` (use `/new-contract` se for o caso).
5. Ao terminar a implementação, rode `/check` antes de abrir o PR.
6. Atualize a seção "Estado atual do projeto" do `CLAUDE.md` com uma linha para o novo prompt, e qualquer outra seção afetada (Arquitetura implementada, Lacunas conhecidas, etc.) — mantendo o resto do arquivo intacto.
7. Escreva a mensagem de commit/PR em português, descritiva, referenciando o número do prompt.
