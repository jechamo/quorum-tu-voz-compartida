import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, BarChart3, Users, MessageSquare, Flag, Shirt, Shield, FileQuestion, Sparkles } from "lucide-react";
import { AdminsManagement } from "@/components/admin/AdminsManagement";
import { PartiesManagement } from "@/components/admin/PartiesManagement";
import { TeamsManagement } from "@/components/admin/TeamsManagement";
import { QuestionsManagement } from "@/components/admin/QuestionsManagement";
import { CommentsManagement } from "@/components/admin/CommentsManagement";
import { SurveyStats } from "@/components/admin/SurveyStats";
import { AIQuestionGenerator } from "@/components/admin/AIQuestionGenerator";

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has admin role using the secure function
      const { data: hasRole } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });

      if (!hasRole) {
        toast({
          title: "Acceso denegado",
          description: "No tienes permisos de administrador",
          variant: "destructive",
        });
        navigate("/home");
        return;
      }

      setIsAdmin(true);
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/home");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Panel de Administración</h1>
            <p className="text-muted-foreground">Gestiona usuarios, encuestas y contenido</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden md:inline">Cerrar Sesión</span>
          </Button>
        </div>

        <Tabs defaultValue="stats" className="w-full">
          {/* CONTENEDOR CON SCROLL HORIZONTAL PARA MÓVIL */}
          <div className="w-full overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
            <TabsList className="flex w-max h-auto p-1 space-x-1 bg-muted/50">
              <TabsTrigger value="stats" className="gap-2 py-2 px-4">
                <BarChart3 className="w-4 h-4 shrink-0" />
                <span>Estadísticas</span>
              </TabsTrigger>

              <TabsTrigger
                value="ai-generator"
                className="gap-2 py-2 px-4 bg-purple-500/10 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-700"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-purple-600" />
                <span className="font-semibold text-purple-700">Generador IA</span>
              </TabsTrigger>

              <TabsTrigger value="questions" className="gap-2 py-2 px-4">
                <FileQuestion className="w-4 h-4 shrink-0" />
                <span>Preguntas</span>
              </TabsTrigger>
              <TabsTrigger value="comments" className="gap-2 py-2 px-4">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>Comentarios</span>
              </TabsTrigger>
              <TabsTrigger value="parties" className="gap-2 py-2 px-4">
                <Flag className="w-4 h-4 shrink-0" />
                <span>Partidos</span>
              </TabsTrigger>
              <TabsTrigger value="teams" className="gap-2 py-2 px-4">
                <Shirt className="w-4 h-4 shrink-0" />
                <span>Equipos</span>
              </TabsTrigger>
              <TabsTrigger value="admins" className="gap-2 py-2 px-4">
                <Shield className="w-4 h-4 shrink-0" />
                <span>Admins</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="stats" className="mt-6">
            <SurveyStats />
          </TabsContent>

          <TabsContent value="ai-generator" className="mt-6">
            <AIQuestionGenerator />
          </TabsContent>

          <TabsContent value="questions" className="mt-6">
            <QuestionsManagement />
          </TabsContent>

          <TabsContent value="comments" className="mt-6">
            <CommentsManagement />
          </TabsContent>

          <TabsContent value="parties" className="mt-6">
            <PartiesManagement />
          </TabsContent>

          <TabsContent value="teams" className="mt-6">
            <TeamsManagement />
          </TabsContent>

          <TabsContent value="admins" className="mt-6">
            <AdminsManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
