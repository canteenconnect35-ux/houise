import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BottomNavigation from "@/components/BottomNavigation";
import { initializeRazorpayPayment } from "@/lib/razorpay";
import { 
  Trophy, 
  Wallet, 
  Clock, 
  Play, 
  Ticket,
  Plus,
  History,
  Send,
  CreditCard
} from "lucide-react";

const User = () => {
  const [activeTab, setActiveTab] = useState("games");
  const [user, setUser] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [upiId, setUpiId] = useState("");
  const [addMoneyAmount, setAddMoneyAmount] = useState("");
  const [isAddMoneyDialogOpen, setIsAddMoneyDialogOpen] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is logged in
    const userType = localStorage.getItem("userType");
    const userId = localStorage.getItem("userId");
    
    if (userType !== "user" || !userId) {
      window.location.href = "/";
      return;
    }

    loadUserData();
    
    // Setup real-time subscriptions
    const gamesSub = supabase
      .channel('user-games')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
        loadGames();
      })
      .subscribe();

    const ticketsSub = supabase
      .channel('user-tickets')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        loadTickets();
      })
      .subscribe();

    const userSub = supabase
      .channel('user-data')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
        if (payload.new.id === userId) {
          setUser(payload.new);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gamesSub);
      supabase.removeChannel(ticketsSub);
      supabase.removeChannel(userSub);
    };
  }, []);

  const loadUserData = async () => {
    const userId = localStorage.getItem("userId");
    
    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

      if (userError) throw userError;
      setUser(userData);

      await Promise.all([loadGames(), loadTickets(), loadTransactions()]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load user data",
        variant: "destructive",
      });
    }
  };

  const loadGames = async () => {
    console.log('Loading games for user...');
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .in("status", ["waiting", "running"])  // Show both waiting and running games
      .order("start_time", { ascending: true });
    
    if (data) {
      console.log('Games loaded for user:', data);
      setGames(data);
    }
    if (error) {
      console.error("Error loading games:", error);
      toast({
        title: "Error",
        description: "Failed to load games",
        variant: "destructive",
      });
    }
  };

  const loadTickets = async () => {
    const userId = localStorage.getItem("userId");
    console.log('Loading tickets for user:', userId);
    
    const { data, error } = await supabase
      .from("tickets")
      .select(`
        *,
        games!inner(*)
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (data) {
      console.log('Tickets loaded for user:', data);
      setTickets(data);
    }
    if (error) {
      console.error("Error loading tickets:", error);
      toast({
        title: "Error",
        description: "Failed to load tickets",
        variant: "destructive",
      });
    }
  };

  const loadTransactions = async () => {
    const userId = localStorage.getItem("userId");
    
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (data) setTransactions(data);
    if (error) console.error("Error loading transactions:", error);
  };

  const buyTicket = async (gameId: string, ticketPrice: number) => {
    if (user.wallet < ticketPrice) {
      toast({
        title: "Insufficient Balance",
        description: "Please add money to your wallet",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('buy-ticket', {
        body: { 
          gameId,
          userId: user.id,
          ticketPrice 
        }
      });

      if (error) throw error;

      toast({
        title: "Ticket Purchased!",
        description: "Your ticket has been purchased successfully",
      });

      loadUserData(); // Refresh all data
    } catch (error: any) {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to purchase ticket",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const requestWithdrawal = async () => {
    if (!withdrawAmount || !upiId) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    const amount = Number(withdrawAmount);
    if (amount < 10) {
      toast({
        title: "Error",
        description: "Minimum withdrawal amount is ₹10",
        variant: "destructive",
      });
      return;
    }

    if (amount > user.wallet) {
      toast({
        title: "Error",
        description: "Insufficient wallet balance",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("withdrawals")
        .insert({
          user_id: user.id,
          amount,
          upi_id: upiId,
          status: "pending"
        });

      if (error) throw error;

      // Deduct from wallet
      const { error: walletError } = await supabase
        .from("users")
        .update({ wallet: user.wallet - amount })
        .eq("id", user.id);

      if (walletError) throw walletError;

      // Add transaction record
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "debit",
          amount,
          reason: "Withdrawal request"
        });

      if (transactionError) throw transactionError;

      setWithdrawAmount("");
      setUpiId("");
      
      toast({
        title: "Withdrawal Requested",
        description: "Your withdrawal request has been submitted for approval",
      });

      loadUserData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request withdrawal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addMoneyToWallet = async () => {
    if (!addMoneyAmount) {
      toast({
        title: "Error",
        description: "Please enter an amount",
        variant: "destructive",
      });
      return;
    }

    const amount = Number(addMoneyAmount);
    if (amount < 10) {
      toast({
        title: "Error",
        description: "Minimum amount is ₹10",
        variant: "destructive",
      });
      return;
    }

    if (amount > 10000) {
      toast({
        title: "Error",
        description: "Maximum amount is ₹10,000",
        variant: "destructive",
      });
      return;
    }

    setIsPaymentLoading(true);
    try {
      console.log('Initializing Razorpay payment for amount:', amount);
      
      // Initialize normal Razorpay payment
      await initializeRazorpayPayment(
        amount,
        async (paymentId) => {
          console.log('Payment successful with ID:', paymentId);
          
          // Payment successful - update wallet in Supabase
          try {
            const { error: walletError } = await supabase
              .from("users")
              .update({ wallet: user.wallet + amount })
              .eq("id", user.id);

            if (walletError) throw walletError;

            // Add transaction record
            const { error: transactionError } = await supabase
              .from("transactions")
              .insert({
                user_id: user.id,
                type: "credit",
                amount,
                reason: `Wallet top-up via Razorpay (Payment: ${paymentId})`
              });

            if (transactionError) throw transactionError;

            toast({
              title: "Payment Successful!",
              description: `₹${amount} added to your wallet`,
            });

            setAddMoneyAmount("");
            setIsAddMoneyDialogOpen(false);
            loadUserData(); // Refresh user data
          } catch (error: any) {
            console.error('Error updating wallet:', error);
            toast({
              title: "Error",
              description: "Payment successful but failed to update wallet. Please contact support.",
              variant: "destructive",
            });
          }
        },
        (error) => {
          console.error('Payment failed:', error);
          toast({
            title: "Payment Failed",
            description: error,
            variant: "destructive",
          });
        }
      );
    } catch (error: any) {
      console.error('Error in addMoneyToWallet:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsPaymentLoading(false);
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

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Welcome, {user.name}!</h1>
          <div className="flex items-center justify-between mt-2">
            <p className="text-muted-foreground">PIN: {localStorage.getItem("userPin")}</p>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Wallet Balance</p>
              <p className="text-2xl font-bold text-success">₹{user.wallet.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Content based on active tab */}
        {activeTab === "games" && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Available Games
                  </CardTitle>
                  <CardDescription>Join games and win prizes! Buy tickets for waiting and running games.</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadGames}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {games.map((game) => (
                  <Card key={game.id} className="bg-secondary/20 border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Game #{game.id.slice(-6)}</CardTitle>
                        <Badge className={getStatusColor(game.status)}>
                          {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Ticket Price</p>
                          <p className="font-bold text-primary">₹{game.ticket_price}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tickets Left</p>
                          <p className="font-bold">{game.max_tickets - game.total_tickets}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Prize Pool</p>
                          <p className="font-bold text-success">₹{game.prize_pool || 0}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-bold text-xs">
                            {game.status === "running" ? "🎮 Running" : "⏳ Waiting"}
                          </p>
                        </div>
                        {game.status === "running" && game.game_data?.drawn_numbers && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Numbers Drawn</p>
                            <p className="font-bold text-success">
                              {game.game_data.drawn_numbers.length}/90
                            </p>
                          </div>
                        )}
                        <div className="col-span-2">
                          <p className="text-muted-foreground">
                            {game.status === "running" ? "Started" : "Starts"}
                          </p>
                          <p className="font-medium text-xs">
                            {new Date(game.start_time).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <Button 
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={() => buyTicket(game.id, game.ticket_price)}
                        disabled={loading || game.total_tickets >= game.max_tickets || user.wallet < game.ticket_price}
                      >
                        {loading ? (
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />
                        ) : (
                          <Ticket className="w-4 h-4 mr-2" />
                        )}
                        {game.total_tickets >= game.max_tickets 
                          ? "Sold Out" 
                          : user.wallet < game.ticket_price 
                            ? "Insufficient Balance" 
                            : game.status === "running" 
                              ? "Join Game" 
                              : "Buy Ticket"
                        }
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                
                {games.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No games available right now. Check back soon!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "tickets" && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="w-5 h-5" />
                    My Tickets
                  </CardTitle>
                  <CardDescription>View all your purchased tickets</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTickets}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />
                  ) : (
                    <Clock className="w-4 h-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="bg-secondary/20 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">Game #{ticket.games?.id.slice(-6)}</h3>
                            <Badge className={getStatusColor(ticket.games?.status)}>
                              {ticket.games?.status?.charAt(0).toUpperCase() + ticket.games?.status?.slice(1)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p>Purchased: {new Date(ticket.created_at).toLocaleString()}</p>
                            <p>Start Time: {new Date(ticket.games?.start_time).toLocaleString()}</p>
                            <p>Ticket Price: ₹{ticket.games?.ticket_price}</p>
                           <p className="font-medium text-blue-600">15-Number Ticket</p>
                            {ticket.games?.status === "running" && ticket.games?.game_data?.drawn_numbers && (
                              <p className="text-success font-medium">
                                Numbers Drawn: {ticket.games.game_data.drawn_numbers.length}/90
                              </p>
                            )}
                           <p className="font-medium text-blue-600">3×9 Tambola Ticket</p>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = `/game/${ticket.games?.id}?ticket=${ticket.id}`}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          {ticket.games?.status === "running" ? "Play" : "View"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {tickets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No tickets purchased yet. Buy your first ticket!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "wallet" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Wallet Balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-success">₹{user.wallet.toFixed(2)}</p>
                  <p className="text-muted-foreground">Available Balance</p>
                </div>
                
                <Dialog open={isAddMoneyDialogOpen} onOpenChange={setIsAddMoneyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Money
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Add Money to Wallet
                      </DialogTitle>
                      <DialogDescription>
                        Add money to your wallet using Razorpay. Minimum ₹10, Maximum ₹10,000.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="addMoneyAmount">Amount (₹)</Label>
                        <Input
                          id="addMoneyAmount"
                          type="number"
                          placeholder="Enter amount (₹10 - ₹10,000)"
                          value={addMoneyAmount}
                          onChange={(e) => setAddMoneyAmount(e.target.value)}
                          className="bg-secondary/30 border-border/50"
                          min="10"
                          max="10000"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsAddMoneyDialogOpen(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={addMoneyToWallet}
                          disabled={isPaymentLoading || !addMoneyAmount}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {isPaymentLoading ? (
                            <>
                              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="w-4 h-4 mr-2" />
                              Pay with Razorpay
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Withdraw Money
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdrawAmount">Amount (₹)</Label>
                  <Input
                    id="withdrawAmount"
                    type="number"
                    placeholder="Minimum ₹10"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="bg-secondary/30 border-border/50"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="upiId">UPI ID</Label>
                  <Input
                    id="upiId"
                    type="text"
                    placeholder="your@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="bg-secondary/30 border-border/50"
                  />
                </div>
                
                <Button 
                  onClick={requestWithdrawal}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  disabled={loading}
                >
                  {loading && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />}
                  Request Withdrawal
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "history" && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Transaction History
              </CardTitle>
              <CardDescription>Recent wallet transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex justify-between items-center p-3 border border-border/50 rounded-lg bg-secondary/20">
                    <div>
                      <p className="font-medium">{transaction.reason}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className={`text-lg font-bold ${
                      transaction.type === "credit" ? "text-success" : "text-destructive"
                    }`}>
                      {transaction.type === "credit" ? "+" : "-"}₹{transaction.amount}
                    </div>
                  </div>
                ))}
                
                {transactions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      <BottomNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userType="user"
        onLogout={logout}
      />
    </div>
  );
};

export default User;