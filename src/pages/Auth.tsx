import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { signIn, signUp, SignUpData } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useInitializeAdmin } from "@/hooks/useInitializeAdmin";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { initialized: adminInitialized } = useInitializeAdmin();
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);

  // Login form
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState<'masculino' | 'femenino' | 'otro'>('masculino');
  const [age, setAge] = useState("");
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [module, setModule] = useState<'politica' | 'futbol'>('politica');

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    loadParties();
    loadTeams();
  }, []);

  const loadParties = async () => {
    const { data } = await supabase.from('parties').select('*').order('name');
    if (data) setParties(data);
  };

  const loadTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    if (data) setTeams(data);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginPhone || !loginPassword) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await signIn(loginPhone, loginPassword);
      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error al iniciar sesión",
        description: error.message || "Verifica tus credenciales",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupPhone || !signupPassword || !username || !age) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos obligatorios",
        variant: "destructive",
      });
      return;
    }

    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 13 || ageNum > 120) {
      toast({
        title: "Error",
        description: "La edad debe estar entre 13 y 120 años",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const signupData: SignUpData = {
        phone: signupPhone,
        password: signupPassword,
        username,
        gender,
        age: ageNum,
      };

      if (module === 'politica' && selectedParty) {
        signupData.partyId = selectedParty;
      } else if (module === 'futbol' && selectedTeam) {
        signupData.teamId = selectedTeam;
      }

      await signUp(signupData);
      
      toast({
        title: "¡Cuenta creada!",
        description: "Tu cuenta ha sido creada correctamente",
      });
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Error al registrarse",
        description: error.message || "Intenta con otros datos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-elevated">
        <div className="flex justify-center mb-6">
          <Logo />
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
            <TabsTrigger value="signup">Registrarse</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-phone">Teléfono</Label>
                <Input
                  id="login-phone"
                  type="tel"
                  placeholder="Ej: 679656914"
                  value={loginPhone}
                  onChange={(e) => setLoginPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-phone">Teléfono *</Label>
                <Input
                  id="signup-phone"
                  type="tel"
                  placeholder="Ej: 679656914"
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario *</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Tu nombre de usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Contraseña *</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Sexo *</Label>
                  <Select value={gender} onValueChange={(v: any) => setGender(v)} disabled={loading}>
                    <SelectTrigger id="gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                      <SelectItem value="otro">Otro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Edad *</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="18"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    disabled={loading}
                    min="13"
                    max="120"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="module">Módulo preferido</Label>
                <Select value={module} onValueChange={(v: any) => setModule(v)} disabled={loading}>
                  <SelectTrigger id="module">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="politica">QUORUM Política</SelectItem>
                    <SelectItem value="futbol">QUORUM La Liga</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {module === 'politica' && (
                <div className="space-y-2">
                  <Label htmlFor="party">Partido político (opcional)</Label>
                  <Select value={selectedParty} onValueChange={setSelectedParty} disabled={loading}>
                    <SelectTrigger id="party">
                      <SelectValue placeholder="Selecciona un partido" />
                    </SelectTrigger>
                    <SelectContent>
                      {parties.map((party) => (
                        <SelectItem key={party.id} value={party.id}>
                          {party.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {module === 'futbol' && (
                <div className="space-y-2">
                  <Label htmlFor="team">Equipo (opcional)</Label>
                  <Select value={selectedTeam} onValueChange={setSelectedTeam} disabled={loading}>
                    <SelectTrigger id="team">
                      <SelectValue placeholder="Selecciona un equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando cuenta..." : "Crear Cuenta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
