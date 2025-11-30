import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, BarChart3, Users, MessageSquare, Flag, Shirt, Shield, FileQuestion, Sparkles } from "lucide-react"; // <--- Añadido Sparkles
import { AdminsManagement } from "@/components/admin/AdminsManagement";
import { PartiesManagement } from "@/components/admin/PartiesManagement";
import { TeamsManagement } from "@/components/admin/TeamsManagement";
import { QuestionsManagement } from "@/components/admin/QuestionsManagement";
import { CommentsManagement } from "@/components/admin/CommentsManagement";
import { SurveyStats } from "@/components/admin/SurveyStats";
import { AIQuestionGenerator } from "@/components/admin/AIQuestionGenerator"; // <--- Nueva importación

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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user has admin role using the secure function
      const { data: hasRole } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
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
            Cerrar Sesión
          </Button>
        </div>

        <Tabs defaultValue="stats" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-7 h-auto p-1">
            <TabsTrigger value="stats" className="gap-2 py-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden md:inline">Estadísticas</span>
            </TabsTrigger>
            
            {/* NUEVA PESTAÑA DE IA */}
            <TabsTrigger value="ai-generator" className="gap-2 py-2 bg-purple-500/10 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-700">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="hidden md:inline font-semibold text-purple-700">Generador IA</span>
            </TabsTrigger>

            <TabsTrigger value="questions" className="gap-2 py-2">
              <FileQuestion className="w-4 h-4" />
              <span className="hidden md:inline">Preguntas</span>
            </TabsTrigger>
            <TabsTrigger value="comments" className="gap-2 py-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden md:inline">Comentarios</span>
            </TabsTrigger>
            <TabsTrigger value="parties" className="gap-2 py-2">
              <Flag className="w-4 h-4" />
              <span className="hidden md:inline">Partidos</span>
            </TabsTrigger>
            <TabsTrigger value="teams" className="gap-2 py-2">
              <Shirt className="w-4 h-4" />
              <span className="hidden md:inline">Equipos</span>
            </TabsTrigger>
            <TabsTrigger value="admins" className="gap-2 py-2">
              <Shield className="w-4 h-4" />
              <span className="hidden md:inline">Admins</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-6">
            <SurveyStats />
          </TabsContent>

          {/* CONTENIDO DE LA PESTAÑA IA */}
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
