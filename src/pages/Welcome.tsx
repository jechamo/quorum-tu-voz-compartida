import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      navigate('/home');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-12">
        <div className="text-center space-y-8">
          <div className="flex justify-center">
            <img 
              src="/quorum-logo.png" 
              alt="QUORUM Logo" 
              className="w-full max-w-md h-auto"
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground">
            Bienvenido a QUORUM
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            La plataforma de encuestas para política y fútbol español
          </p>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => navigate('/auth')}
            className="relative group overflow-hidden rounded-lg font-semibold text-lg px-12 py-4 transition-all hover:scale-105"
          >
            <div className="absolute inset-0 flex">
              <div className="w-1/2 bg-[#F4C430]" />
              <div className="w-1/2 bg-[#2D6A4F]" />
            </div>
            <span className="relative z-10 text-background font-display font-bold">
              Acceder
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
