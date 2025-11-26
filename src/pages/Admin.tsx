import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { signOut } from "@/lib/auth";
import { PartiesManagement } from "@/components/admin/PartiesManagement";
import { TeamsManagement } from "@/components/admin/TeamsManagement";
import { QuestionsManagement } from "@/components/admin/QuestionsManagement";
import { AdminsManagement } from "@/components/admin/AdminsManagement";

export default function Admin() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    } else if (!loading && user && !isAdmin) {
      navigate('/home');
    }
  }, [user, loading, isAdmin, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">
          <Logo />
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/home')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Panel Admin</span>
            <Button variant="outline" onClick={handleSignOut}>
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="p-6 shadow-elevated bg-card">
          <h1 className="text-3xl font-display font-bold text-foreground mb-6">
            Panel de Administración
          </h1>

          <Tabs defaultValue="questions" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="questions">Encuestas</TabsTrigger>
              <TabsTrigger value="parties">Partidos</TabsTrigger>
              <TabsTrigger value="teams">Equipos</TabsTrigger>
              <TabsTrigger value="admins">Administradores</TabsTrigger>
            </TabsList>

            <TabsContent value="questions">
              <QuestionsManagement />
            </TabsContent>

            <TabsContent value="parties">
              <PartiesManagement />
            </TabsContent>

            <TabsContent value="teams">
              <TeamsManagement />
            </TabsContent>

            <TabsContent value="admins">
              <AdminsManagement />
            </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}
