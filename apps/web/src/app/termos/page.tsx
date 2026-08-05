import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITE_TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos de Uso e Política de Privacidade — AuraFarming",
};

// PLACEHOLDER — este texto é um esqueleto de seções, não redação jurídica
// final. Precisa de revisão/sign-off humano antes do lançamento público
// (CLAUDE.md, "Trilha humana": LGPD e política de moderação são decisão do
// humano). Ver docs/security-checklist.md.
export default function TermosPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">Termos de Uso e Política de Privacidade</h1>
          <Badge variant="secondary">versão {SITE_TERMS_VERSION}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Este texto é um rascunho estrutural, pendente de revisão jurídica. Não constitui a versão final publicada
          antes do lançamento.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. O que é o AuraFarming</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Plataforma de partidas 1x1 com câmera, em que um sistema de IA analisa postura, contato visual, expressão,
          presença e movimento para gerar um Aura Score. Ver{" "}
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            página inicial
          </Link>
          .
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Dados coletados e uso da câmera</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Landmarks faciais/corporais são extraídos no seu navegador (nunca enviamos vídeo bruto ao nosso servidor).
          Apenas vetores de features numéricas trafegam para o serviço de pontuação. Um único quadro comprimido pode
          ser usado, de forma pontual e não persistida, para verificação anti-fraude durante a partida.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. Seus direitos (LGPD)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Você pode exportar seus dados ou solicitar a anonimização da sua conta a qualquer momento em{" "}
          <Link href="/configuracoes" className="text-primary underline-offset-4 hover:underline">
            Configurações
          </Link>
          .
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Moderação e denúncias</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Partidas e usuários podem ser denunciados por comportamento inadequado. Denúncias são revisadas por um
          moderador humano antes de qualquer ação sobre a conta.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">5. Aura Score e contestação</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          O Aura Score é calculado por uma função determinística e versionada. Você pode consultar o detalhamento do
          seu resultado (peso e contribuição de cada métrica) e contestar um resultado através do canal de denúncia.
        </CardContent>
      </Card>
    </main>
  );
}
