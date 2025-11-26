import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-12">
        <div className="text-center space-y-4">
          <Logo />
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mt-8">
            Bienvenido a QUORUM
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            La plataforma de encuestas para política y fútbol español. 
            Elige tu módulo para comenzar.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="p-8 space-y-6 hover:shadow-politica hover:border-primary/50 transition-smooth cursor-pointer group bg-card"
            onClick={() => navigate('/auth/politica')}
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-smooth">
              <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-display font-bold text-foreground">
                Política
              </h2>
              <p className="text-muted-foreground text-sm">
                Comparte tu opinión sobre temas políticos y tendencias actuales de España
              </p>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              Acceder
            </Button>
          </Card>

          <Card 
            className="p-8 space-y-6 hover:shadow-futbol hover:border-secondary/50 transition-smooth cursor-pointer group bg-card"
            onClick={() => navigate('/auth/futbol')}
          >
            <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto group-hover:bg-secondary/20 transition-smooth">
              <svg className="w-10 h-10 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-display font-bold text-foreground">
                La Liga
              </h2>
              <p className="text-muted-foreground text-sm">
                Opina sobre tu equipo favorito y el fútbol español de primera división
              </p>
            </div>
            <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold">
              Acceder
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
