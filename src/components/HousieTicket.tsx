import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";

interface HousieTicketProps {
  numbers: number[][] | number[];
  gameId?: string;
  ticketId?: string;
  className?: string;
  drawnNumbers?: number[];
  onWinDetected?: (winType: string) => void;
  showHeader?: boolean;
}

const HousieTicket = ({ 
  numbers, 
  gameId, 
  ticketId, 
  className = "", 
  drawnNumbers = [],
  onWinDetected,
  showHeader = true
}: HousieTicketProps) => {
  const [struckNumbers, setStruckNumbers] = useState<Set<number>>(new Set());
  
  // Convert numbers to proper 3x9 grid format
  let ticketGrid: number[][];
  
  try {
    if (!numbers) {
      // Create empty 3x9 grid
      ticketGrid = Array(3).fill(null).map(() => Array(9).fill(0));
    } else if (Array.isArray(numbers)) {
      if (Array.isArray(numbers[0])) {
        // Already in 2D format
        ticketGrid = numbers as number[][];
        // Ensure it's 3x9
        if (ticketGrid.length !== 3) {
          ticketGrid = Array(3).fill(null).map(() => Array(9).fill(0));
        } else {
          // Ensure each row has 9 columns
          ticketGrid = ticketGrid.map(row => {
            if (Array.isArray(row) && row.length === 9) {
              return row;
            }
            return Array(9).fill(0);
          });
        }
      } else {
        // Flat array - convert to 3x9 grid (legacy support)
        const flatNumbers = numbers as number[];
        ticketGrid = Array(3).fill(null).map(() => Array(9).fill(0));
        
        // Distribute 15 numbers across 3 rows with 5 numbers each
        if (flatNumbers.length === 15) {
          let numberIndex = 0;
          for (let row = 0; row < 3; row++) {
            let numbersInRow = 0;
            for (let col = 0; col < 9 && numbersInRow < 5 && numberIndex < 15; col++) {
              if (Math.random() > 0.4) { // Randomly place numbers
                ticketGrid[row][col] = flatNumbers[numberIndex++];
                numbersInRow++;
              }
            }
            // Fill remaining slots if needed
            while (numbersInRow < 5 && numberIndex < 15) {
              for (let col = 0; col < 9 && numbersInRow < 5; col++) {
                if (ticketGrid[row][col] === 0) {
                  ticketGrid[row][col] = flatNumbers[numberIndex++];
                  numbersInRow++;
                  break;
                }
              }
            }
          }
        }
      }
    } else {
      // Invalid format
      ticketGrid = Array(3).fill(null).map(() => Array(9).fill(0));
    }
  } catch (error) {
    console.error('Error parsing ticket numbers:', error);
    ticketGrid = Array(3).fill(null).map(() => Array(9).fill(0));
  }

  // Update struck numbers when drawn numbers change
  useEffect(() => {
    const newStruckNumbers = new Set<number>();
    ticketGrid.flat().forEach(num => {
      if (num > 0 && drawnNumbers.includes(num)) {
        newStruckNumbers.add(num);
      }
    });
    setStruckNumbers(newStruckNumbers);
    
    // Check for wins
    checkForWins(newStruckNumbers);
  }, [drawnNumbers, ticketGrid]);

  const checkForWins = (struck: Set<number>) => {
    if (!onWinDetected) return;
    
    const struckCount = struck.size;
    
    // Early Five - first 5 numbers struck
    if (struckCount === 5) {
      onWinDetected('early_five');
    }
    
    // Check for line wins
    for (let row = 0; row < 3; row++) {
      const rowNumbers = ticketGrid[row].filter(num => num > 0);
      const rowMatches = rowNumbers.filter(num => struck.has(num));
      
      if (rowMatches.length === rowNumbers.length && rowNumbers.length === 5) {
        const lineTypes = ['top_line', 'middle_line', 'bottom_line'];
        onWinDetected(lineTypes[row]);
      }
    }
    
    // Full House - all 15 numbers struck
    const allNumbers = ticketGrid.flat().filter(num => num > 0);
    if (allNumbers.length === 15 && allNumbers.every(num => struck.has(num))) {
      onWinDetected('full_house');
    }
  };

  const isNumberStruck = (num: number) => {
    return num > 0 && struckNumbers.has(num);
  };

  const totalNumbers = ticketGrid.flat().filter(n => n > 0).length;

  return (
    <Card className={`w-full max-w-2xl mx-auto bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 ${className}`}>
      <CardContent className="p-4">
        {/* Header */}
        {showHeader && (
          <div className="text-center mb-4">
            <h3 className="text-lg font-bold text-blue-800">TAMBOLA TICKET</h3>
            {gameId && (
              <p className="text-sm text-blue-600">Game #{gameId.slice(-6)}</p>
            )}
            {ticketId && (
              <p className="text-xs text-gray-500">Ticket #{ticketId.slice(-8)}</p>
            )}
            <p className="text-xs text-blue-600 font-medium">3 Rows × 9 Columns</p>
          </div>
        )}

        {/* Ticket Grid - 3 rows, 9 columns */}
        <div className="space-y-1 mb-4">
          {ticketGrid.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-9 gap-1">
              {row.map((num, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    w-10 h-10 flex items-center justify-center text-xs font-bold
                    border-2 rounded transition-all duration-300
                    ${num === 0 
                      ? 'bg-gray-100 text-gray-300 border-gray-200' 
                      : isNumberStruck(num)
                        ? 'bg-green-500 text-white border-green-600 shadow-lg transform scale-105 line-through'
                        : 'bg-white text-blue-800 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
                    }
                  `}
                >
                  {num > 0 ? num : ''}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Column headers for reference */}
        <div className="grid grid-cols-9 gap-1 mb-4 text-xs text-gray-500">
          <div className="text-center">1-9</div>
          <div className="text-center">10-19</div>
          <div className="text-center">20-29</div>
          <div className="text-center">30-39</div>
          <div className="text-center">40-49</div>
          <div className="text-center">50-59</div>
          <div className="text-center">60-69</div>
          <div className="text-center">70-79</div>
          <div className="text-center">80-90</div>
        </div>

        {/* Stats */}
        {showHeader && (
          <>
            <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
              <span>Numbers: {totalNumbers}/15</span>
              <span>Struck: {struckNumbers.size}</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ 
                  width: `${totalNumbers > 0 ? (struckNumbers.size / totalNumbers) * 100 : 0}%` 
                }}
              ></div>
            </div>

            {/* Footer */}
            <div className="text-center">
              <div className="text-xs text-gray-500 space-y-1">
                <p>Good Luck!</p>
                <p className="text-blue-600 font-semibold">Play Responsibly</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HousieTicket;