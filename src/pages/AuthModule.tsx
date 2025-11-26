import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { useInitializeAdmin } from "@/hooks/useInitializeAdmin";
import { ArrowLeft } from "lucide-react";

export default function AuthModule() {
  const { module } = useParams<{ module?: "politica" | "futbol" }>();
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
  const [gender, setGender] = useState<"masculino" | "femenino" | "otro">("masculino");
  const [age, setAge] = useState("");
  const [selectedParty, setSelectedParty] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");

  const isPolitica = module === "politica";
  const isGeneral = !module;
  const moduleColor = isPolitica ? "primary" : "secondary";
  const moduleTitle = isPolitica ? "Política" : isGeneral ? "" : "La Liga";
  const moduleIcon = isGeneral ? null : isPolitica ? (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  ) : (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
      />
    </svg>
  );

  useEffect(() => {
    if (user) {
      navigate("/home");
    }
  }, [user, navigate]);

  useEffect(() => {
    loadParties();
    loadTeams();
  }, []);

  const loadParties = async () => {
    const { data } = await supabase.from("parties").select("*").order("name");
    if (data) setParties(data);
  };

  const loadTeams = async () => {
    const { data } = await supabase.from("teams").select("*").order("name");
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
      const { user } = await signIn(loginPhone, loginPassword);

      // Check if user is admin
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      toast({
        title: "¡Bienvenido!",
        description: "Has iniciado sesión correctamente",
      });

      // Redirect based on role
      if (adminRole) {
        navigate("/admin");
      } else {
        navigate("/home");
      }
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

      if (selectedParty) {
        signupData.partyId = selectedParty;
      }
      if (selectedTeam) {
        signupData.teamId = selectedTeam;
      }

      await signUp(signupData);

      toast({
        title: "¡Cuenta creada!",
        description: "Tu cuenta ha sido creada correctamente",
      });
      navigate("/home");
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-elevated bg-card">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        <div className="flex flex-col items-center mb-6 space-y-4">
          {!isGeneral && (
            <div
              className={`w-16 h-16 rounded-2xl ${isPolitica ? "bg-primary/10" : "bg-secondary/10"} flex items-center justify-center ${isPolitica ? "text-primary" : "text-secondary"}`}
            >
              {moduleIcon}
            </div>
          )}
          <div className="text-center">
            <h1 className="text-2xl font-display font-bold text-foreground">
              QUORUM {moduleTitle}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isGeneral 
                ? "Inicia sesión o crea tu cuenta" 
                : isPolitica 
                  ? "Encuestas de política española" 
                  : "Encuestas de fútbol español"}
            </p>
          </div>
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
                  placeholder="Ej: 678555555"
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
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#F4C430] to-[#2D6A4F] text-white hover:opacity-90 transition-opacity"
                disabled={loading}
              >
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

              {(isPolitica || isGeneral) && (
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

              {(!isPolitica || isGeneral) && (
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

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-[#F4C430] to-[#2D6A4F] text-white hover:opacity-90 transition-opacity"
                disabled={loading}
              >
                {loading ? "Creando cuenta..." : "Crear Cuenta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
