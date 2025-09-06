import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";

interface HousieTicketProps {
  numbers: number[];
  gameId?: string;
  ticketId?: string;
  className?: string;
  drawnNumbers?: number[];
  onWinDetected?: (winType: string) => void;
}

const HousieTicket = ({ 
  numbers, 
  gameId, 
  ticketId, 
  className = "", 
  drawnNumbers = [],
  onWinDetected 
}: HousieTicketProps) => {
  const [struckNumbers, setStruckNumbers] = useState<Set<number>>(new Set());
  
  // Safely handle different data formats and ensure exactly 15 numbers
  let ticketNumbers: number[];
  
  try {
    if (!numbers) {
      ticketNumbers = [];
    } else if (Array.isArray(numbers)) {
      // If it's a flat array, use it directly
      if (typeof numbers[0] === 'number') {
        ticketNumbers = numbers;
      } else {
        // If it's a 2D array, flatten it
        ticketNumbers = numbers.flat();
      }
    } else {
      // If it's a string or other format, try to parse
      const parsed = JSON.parse(String(numbers));
      if (Array.isArray(parsed)) {
        ticketNumbers = Array.isArray(parsed[0]) ? parsed.flat() : parsed;
      } else {
        ticketNumbers = [];
      }
    }
  } catch (error) {
    console.error('Error parsing ticket numbers:', error);
    ticketNumbers = [];
  }
  
  // Ensure we have exactly 15 numbers
  if (ticketNumbers.length !== 15) {
    console.warn(`Ticket should have exactly 15 numbers, got ${ticketNumbers.length}`);
    // Pad with zeros or truncate to 15
    if (ticketNumbers.length < 15) {
      ticketNumbers = [...ticketNumbers, ...Array(15 - ticketNumbers.length).fill(0)];
    } else {
      ticketNumbers = ticketNumbers.slice(0, 15);
    }
  }

  // Arrange numbers in 3 rows of 5 columns each
  const ticketGrid = [
    ticketNumbers.slice(0, 5),
    ticketNumbers.slice(5, 10),
    ticketNumbers.slice(10, 15)
  ];

  // Update struck numbers when drawn numbers change
  useEffect(() => {
    const newStruckNumbers = new Set<number>();
    ticketNumbers.forEach(num => {
      if (num > 0 && drawnNumbers.includes(num)) {
        newStruckNumbers.add(num);
      }
    });
    setStruckNumbers(newStruckNumbers);
    
    // Check for wins
    checkForWins(newStruckNumbers);
  }, [drawnNumbers, ticketNumbers]);

  const checkForWins = (struck: Set<number>) => {
    if (!onWinDetected) return;
    
    const struckCount = struck.size;
    
    // Early Five - first 5 numbers struck
    if (struckCount === 5) {
      onWinDetected('early_five');
    }
    
    // Check for line wins (any complete row)
    ticketGrid.forEach((row, rowIndex) => {
      const rowComplete = row.every(num => num === 0 || struck.has(num));
      if (rowComplete && row.some(num => num > 0)) {
        const lineTypes = ['top_line', 'middle_line', 'bottom_line'];
        onWinDetected(lineTypes[rowIndex]);
      }
    });
    
    // Full House - all 15 numbers struck
    const validNumbers = ticketNumbers.filter(num => num > 0);
    if (validNumbers.length > 0 && validNumbers.every(num => struck.has(num))) {
      onWinDetected('full_house');
    }
  };

  const isNumberStruck = (num: number) => {
    return num > 0 && struckNumbers.has(num);
  };

  return (
    <Card className={`w-full max-w-md mx-auto bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 ${className}`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold text-blue-800">TAMBOLA TICKET</h3>
          {gameId && (
            <p className="text-sm text-blue-600">Game #{gameId.slice(-6)}</p>
          )}
          {ticketId && (
            <p className="text-xs text-gray-500">Ticket #{ticketId.slice(-8)}</p>
          )}
          <p className="text-xs text-blue-600 font-medium">15 Numbers</p>
        </div>

        {/* Ticket Grid - 3 rows, 5 columns each */}
        <div className="space-y-1 mb-4">
          {ticketGrid.map((row, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-5 gap-1">
              {row.map((num, colIndex) => (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    w-12 h-12 flex items-center justify-center text-sm font-bold
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

        {/* Stats */}
        <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
          <span>Numbers: {ticketNumbers.filter(n => n > 0).length}/15</span>
          <span>Struck: {struckNumbers.size}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div 
            className="bg-green-500 h-2 rounded-full transition-all duration-500"
            style={{ 
              width: `${(struckNumbers.size / ticketNumbers.filter(n => n > 0).length) * 100}%` 
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
      </CardContent>
    </Card>
  );
};

export default HousieTicket;