import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { initializeRazorpayPayment, verifyPayment } from '@/lib/razorpay';
import { CreditCard, TestTube } from 'lucide-react';

const RazorpayTest = () => {
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const { toast } = useToast();

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testRazorpayConfig = async () => {
    setLoading(true);
    addTestResult('🧪 Testing Razorpay configuration...');
    
    try {
      // Test if Razorpay script can be loaded
      const { loadRazorpayScript } = await import('@/lib/razorpay');
      const scriptLoaded = await loadRazorpayScript();
      
      if (scriptLoaded) {
        addTestResult(`✅ Razorpay script loaded successfully`);
        addTestResult(`✅ Configuration test passed`);
      } else {
        addTestResult(`❌ Failed to load Razorpay script`);
      }
    } catch (error: any) {
      addTestResult(`❌ Configuration test failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testPayment = async () => {
    setLoading(true);
    addTestResult('💳 Testing payment flow...');
    
    try {
      await initializeRazorpayPayment(
        parseInt(amount),
        (paymentId, orderId) => {
          addTestResult(`✅ Payment successful! ID: ${paymentId}`);
          toast({
            title: "Payment Successful!",
            description: `Payment ID: ${paymentId}`,
          });
        },
        (error) => {
          addTestResult(`❌ Payment failed: ${error}`);
          toast({
            title: "Payment Failed",
            description: error,
            variant: "destructive",
          });
        }
      );
    } catch (error: any) {
      addTestResult(`❌ Payment initialization failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="w-5 h-5" />
          Razorpay Integration Test
        </CardTitle>
        <CardDescription>
          Test the Razorpay Orders API integration with axios
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Test Amount (₹)</Label>
          <Input
            id="amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount to test"
            min="10"
            max="10000"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={testRazorpayConfig}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Testing...' : 'Test Config'}
          </Button>
          
          <Button
            onClick={testPayment}
            disabled={loading}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            {loading ? 'Testing...' : 'Test Payment'}
          </Button>
          
          <Button
            onClick={clearResults}
            variant="outline"
          >
            Clear Results
          </Button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Test Results:</h4>
            <div className="bg-muted p-3 rounded-md max-h-60 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          <p><strong>Note:</strong> This test uses live Razorpay credentials.</p>
          <p>• Config test: Tests Razorpay script loading and configuration</p>
          <p>• Payment test: Opens Razorpay checkout for actual payment</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default RazorpayTest;