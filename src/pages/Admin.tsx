import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/BottomNavigation";
import { 
  Trophy, 
  Users, 
  Wallet, 
  Clock, 
  Plus, 
  Eye,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Calendar,
  Timer
} from "lucide-react";

const Admin = () => {
  const [activeTab, setActiveTab] = useState("games");
  const [games, setGames] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalGames: 0,
    totalUsers: 0,
    totalCommission: 0,
    pendingWithdrawals: 0
  });
  const [loading, setLoading] = useState(false);
  const [autoDrawInterval, setAutoDrawInterval] = useState<NodeJS.Timeout | null>(null);
  const [newGame, setNewGame] = useState({
    ticket_price: "",
    max_tickets: "",
    start_time: "",
    start_immediately: false
  });
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is admin
    const userType = localStorage.getItem("userType");
    if (userType !== "admin") {
      window.location.href = "/";
      return;
    }

    loadData();
    
    // Setup real-time subscriptions
    const gamesSub = supabase
      .channel('games-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        loadGames();
      })
      .subscribe();

    const withdrawalsSub = supabase
      .channel('withdrawals-changes') 
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, () => {
        loadWithdrawals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gamesSub);
      supabase.removeChannel(withdrawalsSub);
      if (autoDrawInterval) {
        clearInterval(autoDrawInterval);
      }
    };
  }, []);

  const loadData = async () => {
    await Promise.all([loadGames(), loadWithdrawals(), loadStats()]);
  };

  const loadGames = async () => {
    console.log('Loading games...');
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (data) {
      console.log('Games loaded:', data);
      setGames(data);
    }
    if (error) {
      console.error("Error loading games:", error);
    }
  };

  const loadWithdrawals = async () => {
    const { data, error } = await supabase
      .from("withdrawals")
      .select(`
        *,
        users!withdrawals_user_id_fkey(name)
      `)
      .order("created_at", { ascending: false });
    
    if (data) setWithdrawals(data);
    if (error) console.error("Error loading withdrawals:", error);
  };

  const loadStats = async () => {
    try {
      const [gamesRes, usersRes, adminsRes, withdrawalsRes] = await Promise.all([
        supabase.from("games").select("id, admin_commission").eq("status", "completed"),
        supabase.from("users").select("id"),
        supabase.from("admins").select("commission_earned"),
        supabase.from("withdrawals").select("amount").eq("status", "pending")
      ]);

      const totalCommission = adminsRes.data?.reduce((sum, admin) => sum + Number(admin.commission_earned), 0) || 0;
      const pendingAmount = withdrawalsRes.data?.reduce((sum, w) => sum + Number(w.amount), 0) || 0;

      setStats({
        totalGames: gamesRes.data?.length || 0,
        totalUsers: usersRes.data?.length || 0,
        totalCommission,
        pendingWithdrawals: pendingAmount
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const createGame = async () => {
    if (!newGame.ticket_price || !newGame.max_tickets || (!newGame.start_time && !newGame.start_immediately)) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Determine start time and status
      const startTimeISO = newGame.start_immediately 
        ? new Date().toISOString() 
        : new Date(newGame.start_time).toISOString();
      
      const status = newGame.start_immediately ? "running" : "waiting";
      
      const gameData: any = {
        created_by: localStorage.getItem("userId"),
        ticket_price: Number(newGame.ticket_price),
        max_tickets: Number(newGame.max_tickets),
        start_time: startTimeISO,
        status: status as "waiting" | "running" | "completed"
      };

      // If starting immediately, add game data
      if (newGame.start_immediately) {
        gameData.started_at = startTimeISO;
        gameData.game_data = {
          drawn_numbers: [],
          current_number: null,
          game_started: true
        };
      }

      const { error } = await supabase
        .from("games")
        .insert(gameData);

      if (error) throw error;

      setNewGame({ ticket_price: "", max_tickets: "", start_time: "", start_immediately: false });
      toast({
        title: "Game created!",
        description: newGame.start_immediately 
          ? "New game has been created and started immediately" 
          : "New game has been created successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (withdrawalId: string, action: "approved" | "rejected") => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("withdrawals")
        .update({
          status: action,
          approved_at: new Date().toISOString(),
          approved_by: localStorage.getItem("userId")
        })
        .eq("id", withdrawalId);

      if (error) throw error;

      toast({
        title: `Withdrawal ${action}`,
        description: `Withdrawal request has been ${action}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startGame = async (gameId: string) => {
    console.log('Starting game with ID:', gameId);
    setLoading(true);
    try {
      // First, try to update just the status
      const { error: statusError } = await supabase
        .from("games")
        .update({ status: "running" })
        .eq("id", gameId);

      if (statusError) {
        console.error('Status update error:', statusError);
        throw statusError;
      }

      // Then try to update additional fields
      const { error: additionalError } = await supabase
        .from("games")
        .update({
          started_at: new Date().toISOString(),
          game_data: {
            drawn_numbers: [],
            current_number: null,
            game_started: true
          }
        })
        .eq("id", gameId);

      if (additionalError) {
        console.warn('Additional fields update failed:', additionalError);
        // Don't throw error here, status update was successful
      }

      console.log('Game started successfully');
      toast({
        title: "Game Started!",
        description: "The game has been started manually",
      });
    } catch (error: any) {
      console.error('Error starting game:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to start game",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const drawNumber = async (gameId: string) => {
    console.log('Drawing number for game:', gameId);
    setLoading(true);
    try {
      // Get current game data
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("game_data")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;

      const currentGameData = game.game_data as any || {};
      const drawnNumbers = currentGameData.drawn_numbers || [];
      
      // Check if all numbers have been drawn
      if (drawnNumbers.length >= 90) {
        toast({
          title: "Game Complete",
          description: "All numbers have been drawn!",
          variant: "destructive",
        });
        return;
      }
      
      // Generate a random number between 1-90 that hasn't been drawn
      let newNumber;
      do {
        newNumber = Math.floor(Math.random() * 90) + 1;
      } while (drawnNumbers.includes(newNumber));

      // Add the new number to the list
      const updatedDrawnNumbers = [...drawnNumbers, newNumber];
      
      // Update the game with the new number
      const { error: updateError } = await supabase
        .from("games")
        .update({
          game_data: {
            ...(currentGameData as object),
            drawn_numbers: updatedDrawnNumbers,
            current_number: newNumber,
            last_drawn_at: new Date().toISOString()
          }
        })
        .eq("id", gameId);

      if (updateError) throw updateError;

      console.log('Number drawn successfully:', newNumber);
      toast({
        title: "Number Drawn!",
        description: `Number ${newNumber} has been drawn`,
      });
    } catch (error: any) {
      console.error('Error drawing number:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to draw number",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startAutoDraw = (gameId: string) => {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
    }
    
    const interval = setInterval(() => {
      drawNumber(gameId);
    }, 3000); // Draw a number every 3 seconds
    
    setAutoDrawInterval(interval);
    toast({
      title: "Auto Draw Started",
      description: "Numbers will be drawn automatically every 3 seconds",
    });
  };

  const stopAutoDraw = () => {
    if (autoDrawInterval) {
      clearInterval(autoDrawInterval);
      setAutoDrawInterval(null);
      toast({
        title: "Auto Draw Stopped",
        description: "Automatic number drawing has been stopped",
      });
    }
  };

  const pauseGame = async (gameId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          status: "waiting",
          game_data: {
            drawn_numbers: [],
            current_number: null,
            game_paused: true
          }
        })
        .eq("id", gameId);

      if (error) throw error;

      toast({
        title: "Game Paused!",
        description: "The game has been paused",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const completeGame = async (gameId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("games")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          game_data: {
            game_completed: true,
            final_prize_distribution: true
          }
        })
        .eq("id", gameId);

      if (error) throw error;

      toast({
        title: "Game Completed!",
        description: "The game has been marked as completed",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      console.log('Testing Supabase connection...');
      const { data, error } = await supabase
        .from("games")
        .select("id, status")
        .limit(1);
      
      if (error) {
        console.error('Connection test failed:', error);
        toast({
          title: "Connection Test Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Connection test successful:', data);
        toast({
          title: "Connection Test Successful",
          description: "Supabase connection is working",
        });
      }
    } catch (error: any) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Test Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const testUpdate = async () => {
    if (games.length === 0) {
      toast({
        title: "No Games",
        description: "No games available to test update",
        variant: "destructive",
      });
      return;
    }

    const testGame = games[0];
    console.log('Testing update on game:', testGame.id);
    
    try {
      const { error } = await supabase
        .from("games")
        .update({ status: "waiting" })
        .eq("id", testGame.id);
      
      if (error) {
        console.error('Update test failed:', error);
        toast({
          title: "Update Test Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Update test successful');
        toast({
          title: "Update Test Successful",
          description: "Game update is working",
        });
        loadGames(); // Refresh games
      }
    } catch (error: any) {
      console.error('Update test error:', error);
      toast({
        title: "Update Test Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const logout = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "bg-warning text-warning-foreground";
      case "running": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage games, users, and withdrawals</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                className="text-xs"
              >
                Test Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={testUpdate}
                className="text-xs"
              >
                Test Update
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Games</CardTitle>
              <Trophy className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalGames}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats.totalUsers}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Commission</CardTitle>
              <Wallet className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₹{stats.totalCommission.toFixed(2)}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">₹{stats.pendingWithdrawals.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Content based on active tab */}
        {activeTab === "games" && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Game Management</CardTitle>
              <CardDescription>View and manage all games</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {games.map((game) => (
                  <div key={game.id} className="p-4 border border-border/50 rounded-lg bg-secondary/20">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Game #{game.id.slice(-8)}</h3>
                          <Badge className={getStatusColor(game.status)}>
                            {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p>Ticket Price</p>
                            <p className="text-foreground font-medium">₹{game.ticket_price}</p>
                          </div>
                          <div>
                            <p>Tickets</p>
                            <p className="text-foreground font-medium">{game.total_tickets}/{game.max_tickets}</p>
                          </div>
                          <div>
                            <p>Prize Pool</p>
                            <p className="text-foreground font-medium">₹{game.prize_pool}</p>
                          </div>
                          <div>
                            <p>Start Time</p>
                            <p className="text-foreground font-medium text-xs">
                              {new Date(game.start_time).toLocaleString()}
                            </p>
                          </div>
                          {game.status === "running" && game.game_data?.drawn_numbers && (
                            <div className="col-span-2 md:col-span-1">
                              <p>Numbers Drawn</p>
                              <p className="text-foreground font-medium text-lg text-success">
                                {game.game_data.drawn_numbers.length}/90
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/game/${game.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        
                        {game.status === "waiting" && (
                          <Button
                            size="sm"
                            className="bg-success hover:bg-success/90 text-success-foreground"
                            onClick={() => {
                              console.log('Start button clicked for game:', game.id);
                              startGame(game.id);
                            }}
                            disabled={loading}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start
                          </Button>
                        )}
                        
                        {game.status === "running" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-success hover:bg-success/90 text-success-foreground"
                              onClick={() => drawNumber(game.id)}
                              disabled={loading}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Draw Number
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-blue-foreground"
                              onClick={() => startAutoDraw(game.id)}
                              disabled={loading || autoDrawInterval !== null}
                            >
                              <Timer className="w-4 h-4 mr-2" />
                              Auto Draw
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-600 text-red-600 hover:bg-red-600 hover:text-red-foreground"
                              onClick={stopAutoDraw}
                              disabled={autoDrawInterval === null}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Stop Auto
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-warning text-warning hover:bg-warning hover:text-warning-foreground"
                              onClick={() => pauseGame(game.id)}
                              disabled={loading}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              Pause
                            </Button>
                            <Button
                              size="sm"
                              className="bg-primary hover:bg-primary/90 text-primary-foreground"
                              onClick={() => completeGame(game.id)}
                              disabled={loading}
                            >
                              <Trophy className="w-4 h-4 mr-2" />
                              Complete
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {games.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No games created yet. Create your first game!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "withdrawals" && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Withdrawal Requests</CardTitle>
              <CardDescription>Approve or reject withdrawal requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {withdrawals.map((withdrawal) => (
                  <div key={withdrawal.id} className="p-4 border border-border/50 rounded-lg bg-secondary/20">
                    <div className="flex justify-between items-center">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{withdrawal.users?.name}</h3>
                          <Badge className={
                            withdrawal.status === "pending" ? "bg-warning text-warning-foreground" :
                            withdrawal.status === "approved" ? "bg-success text-success-foreground" :
                            "bg-destructive text-destructive-foreground"
                          }>
                            {withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1)}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p>Amount</p>
                            <p className="text-foreground font-medium text-lg">₹{withdrawal.amount}</p>
                          </div>
                          <div>
                            <p>UPI ID</p>
                            <p className="text-foreground font-medium">{withdrawal.upi_id}</p>
                          </div>
                          <div>
                            <p>Requested</p>
                            <p className="text-foreground font-medium text-xs">
                              {new Date(withdrawal.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {withdrawal.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => handleWithdrawal(withdrawal.id, "rejected")}
                            disabled={loading}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            className="bg-success hover:bg-success/90 text-success-foreground"
                            onClick={() => handleWithdrawal(withdrawal.id, "approved")}
                            disabled={loading}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {withdrawals.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No withdrawal requests yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "create" && (
          <Card className="bg-card/50 border-border/50 max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Create New Game
              </CardTitle>
              <CardDescription>Set up a new Tambola game</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticketPrice">Ticket Price (₹)</Label>
                <Input
                  id="ticketPrice"
                  type="number"
                  placeholder="e.g. 10"
                  value={newGame.ticket_price}
                  onChange={(e) => setNewGame(prev => ({ ...prev, ticket_price: e.target.value }))}
                  className="bg-secondary/30 border-border/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="maxTickets">Maximum Tickets</Label>
                <Input
                  id="maxTickets"
                  type="number"
                  placeholder="e.g. 100"
                  value={newGame.max_tickets}
                  onChange={(e) => setNewGame(prev => ({ ...prev, max_tickets: e.target.value }))}
                  className="bg-secondary/30 border-border/50"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={newGame.start_time}
                  onChange={(e) => setNewGame(prev => ({ ...prev, start_time: e.target.value }))}
                  className="bg-secondary/30 border-border/50"
                  min={new Date().toISOString().slice(0, 16)} // Prevent past dates
                  disabled={newGame.start_immediately}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="startImmediately"
                  checked={newGame.start_immediately}
                  onChange={(e) => setNewGame(prev => ({ 
                    ...prev, 
                    start_immediately: e.target.checked,
                    start_time: e.target.checked ? "" : prev.start_time
                  }))}
                  className="rounded border-border"
                />
                <Label htmlFor="startImmediately" className="text-sm">
                  Start immediately
                </Label>
              </div>
              
              <Button 
                onClick={createGame} 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={loading}
              >
                {loading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />}
                Create Game
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === "scheduled" && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Scheduled Games
              </CardTitle>
              <CardDescription>Games scheduled to start in the future</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {games.filter(game => game.status === "waiting" && new Date(game.start_time) > new Date()).map((game) => (
                  <div key={game.id} className="p-4 border border-border/50 rounded-lg bg-secondary/20">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">Game #{game.id.slice(-8)}</h3>
                          <Badge className={getStatusColor(game.status)}>
                            {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                          </Badge>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            <Timer className="w-3 h-3 mr-1" />
                            Scheduled
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div>
                            <p>Ticket Price</p>
                            <p className="text-foreground font-medium">₹{game.ticket_price}</p>
                          </div>
                          <div>
                            <p>Tickets</p>
                            <p className="text-foreground font-medium">{game.total_tickets}/{game.max_tickets}</p>
                          </div>
                          <div>
                            <p>Prize Pool</p>
                            <p className="text-foreground font-medium">₹{game.prize_pool}</p>
                          </div>
                          <div>
                            <p>Start Time</p>
                            <p className="text-foreground font-medium text-xs">
                              {new Date(game.start_time).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>Time until start: {Math.ceil((new Date(game.start_time).getTime() - new Date().getTime()) / (1000 * 60))} minutes</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/game/${game.id}`}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90 text-success-foreground"
                          onClick={() => startGame(game.id)}
                          disabled={loading}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Now
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {games.filter(game => game.status === "waiting" && new Date(game.start_time) > new Date()).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No scheduled games found.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "settings" && (
          <Card className="bg-card/50 border-border/50 max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Admin Settings</CardTitle>
              <CardDescription>Configure platform settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8 text-muted-foreground">
                Settings panel coming soon...
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userType="admin"
        onLogout={logout}
      />
    </div>
  );
};

export default Admin;