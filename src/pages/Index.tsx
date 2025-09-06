import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trophy, Users, Wallet } from "lucide-react";

const Index = () => {
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const { toast } = useToast();

  const handleLogin = async () => {
    if (!pin) {
      toast({
        title: "Error",
        description: "Please enter your PIN",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if admin
      if (pin === "86391") {
        // First, check if a user with this PIN already exists
        let { data: existingUser, error: existingUserError } = await supabase
          .from("users")
          .select("*")
          .eq("pin", pin)
          .single();

        let adminUserId;

        if (existingUserError && existingUserError.code === "PGRST116") {
          // No user with this PIN exists, create one
          const adminId = "550e8400-e29b-41d4-a716-446655440000";
          const { data: newUser, error: createUserError } = await supabase
            .from("users")
            .insert({
              id: adminId,
              pin: pin,
              name: "Super Admin",
              wallet: 0
            })
            .select()
            .single();

          if (createUserError) {
            throw createUserError;
          }
          adminUserId = newUser.id;
        } else if (existingUser) {
          // User with this PIN already exists, use it
          adminUserId = existingUser.id;
        } else {
          throw existingUserError;
        }

        // Now check if admin role exists for this user
        const { data: admin, error: adminError } = await supabase
          .from("admins")
          .select("*")
          .eq("user_id", adminUserId)
          .single();

        if (adminError && adminError.code === "PGRST116") {
          // Create admin role record
          const { error: createAdminError } = await supabase
            .from("admins")
            .insert({
              user_id: adminUserId,
              role: "super",
              commission_earned: 0
            });

          if (createAdminError) {
            throw createAdminError;
          }
        }

        localStorage.setItem("userType", "admin");
        localStorage.setItem("userId", adminUserId);
        window.location.href = "/admin";
        return;
      }

      // Check if user exists
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("pin", pin)
        .single();

      if (error && error.code === "PGRST116") {
        toast({
          title: "User not found",
          description: "Please register first",
          variant: "destructive",
        });
        return;
      }

      if (error) {
        throw error;
      }

      localStorage.setItem("userType", "user");
      localStorage.setItem("userId", user.id);
      localStorage.setItem("userPin", pin);
      window.location.href = "/user";
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!pin || !name) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (pin === "86391") {
      toast({
        title: "Error",
        description: "This PIN is reserved for admin",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Check if PIN already exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("pin", pin)
        .single();

      if (existingUser) {
        toast({
          title: "PIN already exists",
          description: "Please choose a different PIN",
          variant: "destructive",
        });
        return;
      }

      // Create new user
      const { data, error } = await supabase
        .from("users")
        .insert({
          pin,
          name,
          wallet: 0
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      localStorage.setItem("userType", "user");
      localStorage.setItem("userId", data.id);
      localStorage.setItem("userPin", pin);
      
      toast({
        title: "Registration successful!",
        description: "Welcome to Digital Tambola",
      });

      setTimeout(() => {
        window.location.href = "/user";
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/20 to-secondary/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4 shadow-[var(--shadow-glow)]">
            <Trophy className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-warning bg-clip-text text-transparent">
            Digital Tambola
          </h1>
          <p className="text-muted-foreground">Play, Win, Withdraw!</p>
        </div>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-[var(--shadow-card)]">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-secondary/50">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Login
              </TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Register
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Welcome Back
                </CardTitle>
                <CardDescription>
                  Enter your PIN to continue playing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loginPin">PIN</Label>
                  <Input
                    id="loginPin"
                    type="password"
                    placeholder="Enter your PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    className="bg-secondary/30 border-border/50"
                  />
                </div>
                <Button 
                  onClick={handleLogin} 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--shadow-glow)]"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
              </CardContent>
            </TabsContent>

            <TabsContent value="register">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Join the Fun
                </CardTitle>
                <CardDescription>
                  Create your account to start playing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="registerName">Full Name</Label>
                  <Input
                    id="registerName"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-secondary/30 border-border/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registerPin">Create PIN</Label>
                  <Input
                    id="registerPin"
                    type="password"
                    placeholder="Create a 5-digit PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={5}
                    className="bg-secondary/30 border-border/50"
                  />
                </div>
                <Button 
                  onClick={handleRegister} 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[var(--shadow-glow)]"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Register
                </Button>
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Index;