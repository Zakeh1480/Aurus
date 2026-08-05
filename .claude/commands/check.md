---
description: Roda localmente a mesma bateria do pipeline GitLab CI (lint, typecheck, test, build) antes de abrir ou atualizar um PR
---

Execute, nesta ordem, a paridade local do `.gitlab-ci.yml`:

1. `pnpm turbo run lint`
2. `pnpm turbo run typecheck`
3. `pnpm turbo run test`
4. `pnpm turbo run build`
5. `cd services/ai && uv run ruff check .`
6. `cd services/ai && uv run pytest -v`

Se algum passo já foi rodado recentemente e nada mudou nos arquivos relevantes, ainda assim rode — não confie em execuções anteriores fora desta sessão.

Se algo falhar:

- Não tente "consertar" reexecutando sem entender a causa.
- Leia o erro completo, identifique a causa raiz (não só o sintoma) e proponha a correção mínima.
- Depois de corrigir, rode novamente **apenas o passo que falhou** para confirmar, e então a lista inteira uma última vez.

Ao final, resuma em poucas linhas: o que passou, o que foi corrigido (se algo foi) e se o branch está pronto para PR.
