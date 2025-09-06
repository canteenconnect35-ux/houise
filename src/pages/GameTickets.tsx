import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import HousieTicket from "@/components/HousieTicket";
import { 
  ArrowLeft,
  Users,
  Ticket,
  Trophy,
  CheckCircle,
  XCircle
} from "lucide-react";

const GameTickets = () => {
  const { gameId } = useParams();
  const [game, setGame] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!gameId) return;

    loadGameAndTickets();
    
    // Setup real-time subscription for game updates
    const gamesSub = supabase
      .channel('game-tickets-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, 
        (payload) => {
          console.log('Game update received:', payload);
          setGame(payload.new);
          
          // Handle drawn numbers update
          if (payload.new.game_data && typeof payload.new.game_data === 'object' && 'drawn_numbers' in payload.new.game_data) {
            const newNumbers = (payload.new.game_data as any).drawn_numbers;
            if (Array.isArray(newNumbers)) {
              setDrawnNumbers(newNumbers);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gamesSub);
    };
  }, [gameId]);

  const loadGameAndTickets = async () => {
    try {
      setLoading(true);
      
      // Load game
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) throw gameError;
      setGame(gameData);

      // Load drawn numbers if game is active
      if (gameData.game_data && typeof gameData.game_data === 'object' && 'drawn_numbers' in gameData.game_data) {
        const numbers = (gameData.game_data as any).drawn_numbers;
        if (Array.isArray(numbers)) {
          setDrawnNumbers(numbers);
        }
      }

      // Load all tickets for this game
      const { data: ticketsData, error: ticketsError } = await supabase
        .from("tickets")
        .select(`
          *,
          users!inner(name)
        `)
        .eq("game_id", gameId)
        .order("created_at", { ascending: true });

      if (ticketsError) throw ticketsError;
      setTickets(ticketsData || []);

    } catch (error: any) {
      console.error('Error loading game and tickets:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load game data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkTicketWins = (ticketNumbers: number[][], drawnNumbers: number[]) => {
    if (!Array.isArray(ticketNumbers) || ticketNumbers.length !== 3) {
      return { lines: [], fullHouse: false, earlyFive: false };
    }

    const allNumbers = ticketNumbers.flat().filter(num => num > 0);
    const matchedNumbers = allNumbers.filter(num => drawnNumbers.includes(num));
    
    const wins = {
      lines: [] as string[],
      fullHouse: false,
      earlyFive: matchedNumbers.length >= 5
    };

    // Check each line
    const lineNames = ['Top Line', 'Middle Line', 'Bottom Line'];
    for (let row = 0; row < 3; row++) {
      const rowNumbers = ticketNumbers[row].filter(num => num > 0);
      const rowMatches = rowNumbers.filter(num => drawnNumbers.includes(num));
      
      if (rowMatches.length === rowNumbers.length && rowNumbers.length === 5) {
        wins.lines.push(lineNames[row]);
      }
    }

    // Check full house
    if (matchedNumbers.length === allNumbers.length && allNumbers.length === 15) {
      wins.fullHouse = true;
    }

    return wins;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "bg-warning text-warning-foreground";
      case "running": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading tickets...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Game Not Found</h1>
          <p className="text-muted-foreground mb-4">The game you're looking for doesn't exist.</p>
          <Button onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Game Tickets</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Game #{game.id.slice(-8)}</span>
                <span>Ticket Price: ₹{game.ticket_price}</span>
                <span>Prize Pool: ₹{game.prize_pool}</span>
                <Badge className={getStatusColor(game.status)}>
                  {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Game Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <Ticket className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{tickets.length}</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Players</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {new Set(tickets.map(t => t.user_id)).size}
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Numbers Drawn</CardTitle>
              <Trophy className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{drawnNumbers.length}/90</div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prize Pool</CardTitle>
              <Trophy className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">₹{game.prize_pool}</div>
            </CardContent>
          </Card>
        </div>

        {/* Drawn Numbers */}
        {drawnNumbers.length > 0 && (
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle>Drawn Numbers ({drawnNumbers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-10 gap-2 max-h-40 overflow-y-auto">
                {drawnNumbers.map((num, index) => (
                  <div
                    key={index}
                    className="aspect-square flex items-center justify-center text-sm font-bold rounded border bg-success text-success-foreground border-success"
                  >
                    {num}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tickets Grid */}
        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>All Tickets</CardTitle>
            <CardDescription>
              View all purchased tickets and their win status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tickets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tickets purchased for this game yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {tickets.map((ticket) => {
                  const wins = checkTicketWins(ticket.numbers, drawnNumbers);
                  const hasWins = wins.lines.length > 0 || wins.fullHouse || wins.earlyFive;
                  
                  return (
                    <div key={ticket.id} className="space-y-3">
                      {/* Ticket Info */}
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold">{ticket.users?.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            Ticket #{ticket.id.slice(-8)}
                          </p>
                        </div>
                        <div className="text-right">
                          {hasWins ? (
                            <CheckCircle className="w-5 h-5 text-success" />
                          ) : (
                            <XCircle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Win Status */}
                      {hasWins && (
                        <div className="space-y-1">
                          {wins.earlyFive && (
                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                              Early Five
                            </Badge>
                          )}
                          {wins.lines.map((line, index) => (
                            <Badge key={index} variant="outline" className="text-xs bg-green-100 text-green-800 mr-1">
                              {line}
                            </Badge>
                          ))}
                          {wins.fullHouse && (
                            <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-800">
                              Full House
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Ticket Display */}
                      <HousieTicket 
                        numbers={ticket.numbers}
                        drawnNumbers={drawnNumbers}
                        showHeader={false}
                        className="scale-90 origin-top"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GameTickets;