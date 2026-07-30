# services/ai

Placeholder. Este serviço vai receber vetores de features (nunca vídeo cru —
CLAUDE.md, regra 5) e rodar o scoring/verificação em Python + FastAPI +
MediaPipe + OpenCV + PyTorch.

O app FastAPI real (dependências, rotas, testes) entra em um prompt futuro.
Como ainda não existe `package.json` aqui, este diretório fica fora do grafo
de workspaces do pnpm/Turborepo — `pnpm build`/`lint`/`test` na raiz não o
tocam.
