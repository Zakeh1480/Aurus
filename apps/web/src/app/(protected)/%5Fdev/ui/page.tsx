import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const TOKENS = [
  { name: "background", className: "bg-background" },
  { name: "surface", className: "bg-surface" },
  { name: "primary", className: "bg-primary" },
  { name: "secondary", className: "bg-secondary" },
  { name: "muted", className: "bg-muted" },
  { name: "success", className: "bg-success" },
  { name: "destructive", className: "bg-destructive" },
  { name: "border", className: "bg-border" },
] as const;

const BUTTON_VARIANTS = ["default", "secondary", "outline", "ghost", "destructive", "link"] as const;
const BUTTON_SIZES = ["sm", "default", "lg"] as const;
const BADGE_VARIANTS = ["default", "secondary", "success", "destructive", "outline"] as const;

export default function DevUiShowcasePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-16 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Badge variant="outline" className="w-fit text-muted-foreground">
          /_dev/ui
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Design system — AuraFarming</h1>
        <p className="text-muted-foreground">
          Tokens, tipografia e componentes base disponíveis para as próximas telas.
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Cores</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TOKENS.map((token) => (
            <div key={token.name} className="flex flex-col gap-2">
              <div className={`h-16 rounded-lg border border-border ${token.className}`} />
              <span className="font-mono text-xs text-muted-foreground">--{token.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Tipografia</h2>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight">Heading 1</h1>
          <h2 className="text-3xl font-semibold tracking-tight">Heading 2</h2>
          <h3 className="text-2xl font-semibold tracking-tight">Heading 3</h3>
          <h4 className="text-xl font-medium tracking-tight">Heading 4</h4>
          <p>Texto de corpo padrão, usado no conteúdo principal das telas.</p>
          <p className="text-muted-foreground">Texto secundário (muted-foreground), para legendas e metadados.</p>
          <p className="font-mono text-5xl text-primary">87</p>
          <span className="font-mono text-xs text-muted-foreground">font-mono — usado em Aura Score, rating, timers</span>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Button</h2>
        <div className="flex flex-col gap-3">
          {BUTTON_SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-center gap-3">
              {BUTTON_VARIANTS.map((variant) => (
                <Button key={variant} variant={variant} size={size}>
                  {variant}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Badge</h2>
        <div className="flex flex-wrap gap-3">
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Card</h2>
        <Card className="max-w-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" alt="Avatar do jogador" />
                <AvatarFallback>AF</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle>zakeh</CardTitle>
                <CardDescription>rating 1420</CardDescription>
              </div>
              <Badge variant="success" className="ml-auto">
                vitória
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Última partida: Aura Score 87, +18 rating.
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm">
              Ver perfil
            </Button>
          </CardFooter>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Dialog</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Abrir diálogo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Entrar na fila?</DialogTitle>
              <DialogDescription>
                Você será pareado com outro jogador assim que uma partida estiver disponível.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Cancelar</Button>
              <Button>Confirmar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Avatar</h2>
        <div className="flex gap-3">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="Avatar com imagem" />
            <AvatarFallback>AF</AvatarFallback>
          </Avatar>
          <Avatar>
            <AvatarFallback>ZK</AvatarFallback>
          </Avatar>
        </div>
      </section>

      <section className="flex flex-col gap-4 pb-16">
        <h2 className="text-lg font-medium">Input</h2>
        <div className="flex max-w-sm flex-col gap-3">
          <Input placeholder="Nome de exibição" />
          <Input placeholder="Desabilitado" disabled />
        </div>
      </section>
    </main>
  );
}
