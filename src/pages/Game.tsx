import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import HousieTicket from "@/components/HousieTicket";
import { 
  Trophy, 
  Clock, 
  ArrowLeft,
  Volume2,
  VolumeX,
  Users,
  Gift,
  Star,
  Award
} from "lucide-react";

const Game = () => {
  const { gameId } = useParams();
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get("ticket");
  
  const [game, setGame] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<number[]>([]);
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimedPrizes, setClaimedPrizes] = useState<Set<string>>(new Set());
  const { toast } = useToast();


  useEffect(() => {
    if (!gameId) return;

    loadGameData();
    
    // Setup real-time subscription for game updates
    const gamesSub = supabase
      .channel('game-updates')
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
              
              // Set current number (last drawn)
              if (newNumbers.length > drawnNumbers.length) {
                const newNumber = newNumbers[newNumbers.length - 1];
                setCurrentNumber(newNumber);
                
                // Announce number if voice is enabled
                if (voiceEnabled && 'speechSynthesis' in window) {
                  const utterance = new SpeechSynthesisUtterance(`Number ${newNumber}`);
                  speechSynthesis.speak(utterance);
                }
                
                // Clear current number after 3 seconds
                setTimeout(() => setCurrentNumber(null), 3000);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(gamesSub);
    };
  }, [gameId, drawnNumbers.length, voiceEnabled]);

  const loadGameData = async () => {
    try {
      setError(null);
      console.log('Loading game data for gameId:', gameId, 'ticketId:', ticketId);
      
      // Load game
      const { data: gameData, error: gameError } = await supabase
        .from("games")
        .select("*")
        .eq("id", gameId)
        .single();

      if (gameError) {
        console.error('Game loading error:', gameError);
        throw gameError;
      }
      
      console.log('Game data loaded:', gameData);
      setGame(gameData);

      // Load drawn numbers if game is active
      if (gameData.game_data && typeof gameData.game_data === 'object' && 'drawn_numbers' in gameData.game_data) {
        const numbers = (gameData.game_data as any).drawn_numbers;
        if (Array.isArray(numbers)) {
          setDrawnNumbers(numbers);
          console.log('Drawn numbers loaded:', numbers);
        }
      }

      // Load ticket if specified
      if (ticketId) {
        console.log('Loading ticket:', ticketId);
        const { data: ticketData, error: ticketError } = await supabase
          .from("tickets")
          .select("*")
          .eq("id", ticketId)
          .single();

        if (ticketError) {
          console.error('Ticket loading error:', ticketError);
          throw ticketError;
        }
        
        console.log('Ticket data loaded:', ticketData);
        
        // Ensure ticket numbers is in correct format (flat array of 15 numbers)
        if (ticketData.numbers) {
          let numbers = ticketData.numbers;
          
          // If it's a string, parse it
          if (typeof numbers === 'string') {
            try {
              numbers = JSON.parse(numbers);
            } catch (e) {
              console.error('Failed to parse ticket numbers:', e);
              numbers = [];
            }
          }
          
          // If it's a 2D array, flatten it
          if (Array.isArray(numbers) && Array.isArray(numbers[0])) {
            numbers = numbers.flat();
          }
          
          // Ensure we have exactly 15 numbers
          if (!Array.isArray(numbers) || numbers.length !== 15) {
            console.warn('Ticket numbers format invalid, using empty ticket');
            numbers = Array(15).fill(0);
          }
          
          ticketData.numbers = numbers;
        } else {
          ticketData.numbers = Array(15).fill(0);
        }
        
        // Set claimed prizes
        if (ticketData.claimed_prizes) {
          setClaimedPrizes(new Set(Object.keys(ticketData.claimed_prizes).filter(key => ticketData.claimed_prizes[key])));
        }
        
        setTicket(ticketData);
      }
    } catch (error: any) {
      console.error('Error loading game data:', error);
      setError(error.message || "Failed to load game data");
      toast({
        title: "Error",
        description: error.message || "Failed to load game data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWinDetected = (winType: string) => {
    // Only show notification if this prize hasn't been claimed yet
    if (!claimedPrizes.has(winType)) {
      toast({
        title: "Potential Win Detected!",
        description: `You may have won ${winType.replace('_', ' ').toUpperCase()}! Click to claim your prize.`,
      });
    }
  };

  const claimPrize = async (prizeType: string) => {
    if (!ticket || !game) return;

    // Check if already claimed
    if (claimedPrizes.has(prizeType)) {
      toast({
        title: "Already Claimed",
        description: "You have already claimed this prize",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('claim-prize', {
        body: { 
          ticketId: ticket.id,
          gameId: game.id,
          prizeType,
          drawnNumbers
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Prize Claimed!",
          description: `You won ₹${data.amount} for ${prizeType}!`,
        });
        
        // Update claimed prizes
        setClaimedPrizes(prev => new Set([...prev, prizeType]));
        loadGameData(); // Refresh data
      } else {
        toast({
          title: "Invalid Claim",
          description: data.message || "Prize claim is not valid",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to claim prize",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "bg-warning text-warning-foreground";
      case "running": return "bg-success text-success-foreground";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-secondary text-secondary-foreground";
    }
  };

  const calculatePrizeAmount = (prizeType: string) => {
    if (!game) return 0;
    const prizePool = game.prize_pool || 0;
    
    switch (prizeType) {
      case "early_five": return Math.floor(prizePool * 0.20);
      case "top_line": return Math.floor(prizePool * 0.15);
      case "middle_line": return Math.floor(prizePool * 0.15);
      case "bottom_line": return Math.floor(prizePool * 0.15);
      case "full_house": return Math.floor(prizePool * 0.35);
      default: return 0;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Error Loading Game</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
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
      <div className="max-w-6xl mx-auto space-y-6">
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
              <h1 className="text-3xl font-bold text-foreground">Game #{game.id.slice(-8)}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Ticket Price: ₹{game.ticket_price}</span>
                <span>Prize Pool: ₹{game.prize_pool}</span>
                <Badge className={getStatusColor(game.status)}>
                  {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                </Badge>
              </div>
            </div>
          </div>
          
          {game.status === "active" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
          )}
        </div>

        {/* Current Number Display */}
        {game.status === "running" && (
          <Card className="bg-gradient-to-r from-primary/20 to-warning/20 border-primary/50">
            <CardContent className="p-6 text-center">
              <h2 className="text-lg font-semibold mb-2">Current Number</h2>
              {currentNumber ? (
                <div className="text-6xl font-bold text-primary animate-pulse">
                  {currentNumber}
                </div>
              ) : drawnNumbers.length > 0 ? (
                <div className="text-4xl font-bold text-foreground">
                  Last: {drawnNumbers[drawnNumbers.length - 1]}
                </div>
              ) : (
                <div className="text-2xl text-muted-foreground">
                  Waiting for first number...
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                Numbers drawn: {drawnNumbers.length}/90
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Display */}
          {ticket ? (
            <div className="lg:col-span-2">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Your Ticket
                  </CardTitle>
                  <CardDescription>
                    Mark off numbers as they are called
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <HousieTicket 
                    numbers={ticket.numbers} 
                    gameId={game.id}
                    ticketId={ticket.id}
                   drawnNumbers={drawnNumbers}
                   onWinDetected={handleWinDetected}
                    className="mb-6"
                  />
                  
                  {/* Prize Claim Buttons */}
                 {game.status === "running" && (
                    <div className="mt-6 space-y-3">
                      <h3 className="font-semibold text-center">Claim Prizes</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          variant="outline"
                          className="flex items-center justify-between p-3 h-auto"
                          onClick={() => claimPrize("early_five")}
                          disabled={claimedPrizes.has("early_five")}
                        >
                          <div>
                            <div className="font-medium">Early Five</div>
                            <div className="text-sm text-muted-foreground">₹{calculatePrizeAmount("early_five")}</div>
                          </div>
                          <Star className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="flex items-center justify-between p-3 h-auto"
                          onClick={() => claimPrize("top_line")}
                          disabled={claimedPrizes.has("top_line")}
                        >
                          <div>
                            <div className="font-medium">Top Line</div>
                            <div className="text-sm text-muted-foreground">₹{calculatePrizeAmount("top_line")}</div>
                          </div>
                          <Award className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="flex items-center justify-between p-3 h-auto"
                          onClick={() => claimPrize("middle_line")}
                          disabled={claimedPrizes.has("middle_line")}
                        >
                          <div>
                            <div className="font-medium">Middle Line</div>
                            <div className="text-sm text-muted-foreground">₹{calculatePrizeAmount("middle_line")}</div>
                          </div>
                          <Award className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          variant="outline"
                          className="flex items-center justify-between p-3 h-auto"
                          onClick={() => claimPrize("bottom_line")}
                          disabled={claimedPrizes.has("bottom_line")}
                        >
                          <div>
                            <div className="font-medium">Bottom Line</div>
                            <div className="text-sm text-muted-foreground">₹{calculatePrizeAmount("bottom_line")}</div>
                          </div>
                          <Award className="w-4 h-4" />
                        </Button>
                        
                        <Button
                          className="col-span-2 flex items-center justify-between p-4 h-auto bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => claimPrize("full_house")}
                          disabled={claimedPrizes.has("full_house")}
                        >
                          <div>
                            <div className="font-medium text-lg">Full House</div>
                            <div className="text-sm">₹{calculatePrizeAmount("full_house")}</div>
                          </div>
                          <Trophy className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="lg:col-span-2">
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    No Ticket
                  </CardTitle>
                  <CardDescription>
                    You don't have a ticket for this game
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    To participate in this game, you need to purchase a ticket first.
                  </p>
                  <Button onClick={() => window.history.back()}>
                    Go Back to Buy Ticket
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Game Info & Drawn Numbers */}
          <div className="space-y-6">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Game Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Start Time</p>
                    <p className="font-medium">
                      {new Date(game.start_time).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Tickets</p>
                    <p className="font-medium">{game.total_tickets}/{game.max_tickets}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prize Pool</p>
                    <p className="font-medium text-success">₹{game.prize_pool}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={`${getStatusColor(game.status)} text-xs`}>
                      {game.status.charAt(0).toUpperCase() + game.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {drawnNumbers.length > 0 && (
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Drawn Numbers ({drawnNumbers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2 max-h-60 overflow-y-auto">
                    {Array.isArray(drawnNumbers) && drawnNumbers.map((num, index) => (
                      <div
                        key={index}
                        className={`
                          aspect-square flex items-center justify-center text-sm font-bold rounded border
                          ${num === currentNumber 
                            ? 'bg-primary text-primary-foreground border-primary shadow-[var(--shadow-glow)]' 
                            : 'bg-success text-success-foreground border-success'
                          }
                        `}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;