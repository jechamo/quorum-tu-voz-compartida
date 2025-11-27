import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Trash2, Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
  };
}

interface QuestionCommentsProps {
  questionId: string;
}

export const QuestionComments = ({ questionId }: QuestionCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    loadComments();
  }, [questionId]);

  const loadComments = async () => {
    const { data, error } = await supabase
      .from('question_comments')
      .select('*, profiles(username)')
      .eq('question_id', questionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    setComments(data || []);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Error",
        description: "El comentario no puede estar vacío",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para comentar",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('question_comments').insert({
        question_id: questionId,
        user_id: user.id,
        comment: newComment.trim(),
      });

      if (error) throw error;

      toast({
        title: "Comentario añadido",
        description: "Tu comentario ha sido publicado",
      });
      setNewComment("");
      loadComments();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo añadir el comentario",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("¿Eliminar este comentario?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('question_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      toast({
        title: "Comentario eliminado",
        description: "El comentario ha sido eliminado",
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

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageCircle className="w-4 h-4" />
        Comentarios ({comments.length})
      </div>

      {/* Add comment form */}
      {user && (
        <Card className="p-3 bg-card">
          <Textarea
            placeholder="Escribe tu comentario..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={loading}
            className="min-h-[80px] mb-2"
          />
          <Button
            onClick={handleAddComment}
            disabled={loading || !newComment.trim()}
            size="sm"
            className="w-full"
          >
            <Send className="w-4 h-4 mr-2" />
            Publicar comentario
          </Button>
        </Card>
      )}

      {/* Comments list */}
      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay comentarios aún. ¡Sé el primero en comentar!
          </p>
        ) : (
          comments.map((comment) => (
            <Card key={comment.id} className="p-3 bg-card">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {comment.profiles?.username || 'Usuario'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {comment.comment}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(comment.created_at).toLocaleString('es-ES')}
                  </p>
                </div>
                {(user?.id === comment.user_id || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteComment(comment.id)}
                    disabled={loading}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};