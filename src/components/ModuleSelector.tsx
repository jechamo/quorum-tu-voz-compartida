import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const ModuleSelector = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground">
            Elige tu módulo
          </h1>
          <p className="text-muted-foreground text-lg">
            Participa en encuestas sobre política o fútbol
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="p-8 space-y-6 hover:shadow-elevated transition-smooth cursor-pointer group"
            onClick={() => navigate('/politica')}
          >
            <div className="w-16 h-16 rounded-2xl gradient-politica flex items-center justify-center mx-auto shadow-politica group-hover:scale-110 transition-smooth">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-bold text-foreground">
                QUORUM Política
              </h2>
              <p className="text-muted-foreground">
                Comparte tu opinión sobre temas políticos y tendencias actuales
              </p>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Acceder a Política
            </Button>
          </Card>

          <Card 
            className="p-8 space-y-6 hover:shadow-elevated transition-smooth cursor-pointer group"
            onClick={() => navigate('/futbol')}
          >
            <div className="w-16 h-16 rounded-2xl gradient-futbol flex items-center justify-center mx-auto shadow-futbol group-hover:scale-110 transition-smooth">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-display font-bold text-foreground">
                QUORUM La Liga
              </h2>
              <p className="text-muted-foreground">
                Opina sobre tu equipo favorito y el fútbol español
              </p>
            </div>
            <Button className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground">
              Acceder a La Liga
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};
