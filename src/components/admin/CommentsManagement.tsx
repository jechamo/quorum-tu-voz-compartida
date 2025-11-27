import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, MessageCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  profiles: {
    username: string;
  };
  questions: {
    text: string;
    module: string;
  };
}

export const CommentsManagement = () => {
  const [politicaComments, setPoliticaComments] = useState<Comment[]>([]);
  const [futbolComments, setFutbolComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('question_comments')
      .select('*, profiles(username), questions(text, module)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    if (data) {
      setPoliticaComments(data.filter(c => c.questions?.module === 'politica'));
      setFutbolComments(data.filter(c => c.questions?.module === 'futbol'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este comentario?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('question_comments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Comentario eliminado",
        description: "El comentario ha sido eliminado correctamente",
      });
      loadComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el comentario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const CommentsList = ({ comments }: { comments: Comment[] }) => (
    <div className="space-y-3">
      {comments.length === 0 ? (
        <Card className="p-8 text-center bg-card">
          <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No hay comentarios</p>
        </Card>
      ) : (
        comments.map((comment) => (
          <Card key={comment.id} className="p-4 bg-card hover:shadow-card transition-smooth">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {comment.profiles?.username || 'Usuario'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Pregunta: {comment.questions?.text}
                  </p>
                  <p className="text-sm text-foreground">{comment.comment}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(comment.id)}
                disabled={loading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-2">
          Gestión de Comentarios
        </h2>
        <p className="text-muted-foreground">
          Revisa y modera los comentarios de los usuarios
        </p>
      </div>

      <Tabs defaultValue="politica" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="politica">
            Política ({politicaComments.length})
          </TabsTrigger>
          <TabsTrigger value="futbol">
            Fútbol ({futbolComments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="politica" className="mt-6">
          <CommentsList comments={politicaComments} />
        </TabsContent>

        <TabsContent value="futbol" className="mt-6">
          <CommentsList comments={futbolComments} />
        </TabsContent>
      </Tabs>
    </div>
  );
};