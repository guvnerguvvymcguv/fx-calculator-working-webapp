import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function SignupSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect to calculator after 5 seconds
    const timer = setTimeout(() => {
      navigate('/calculator');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#10051A' }}>
      <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
        <CardHeader className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold text-white">
            Welcome to Spread Checker!
          </CardTitle>
          <CardDescription className="text-gray-400 mt-2">
            Your company account has been created successfully
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
            <p className="text-green-400 text-center font-semibold">
              ✨ Your 2-month free trial has started
            </p>
          </div>
          
          <div className="space-y-2 text-gray-300">
            <p>✓ Company account created</p>
            <p>✓ Admin access granted</p>
            <p>✓ Team seats allocated</p>
          </div>
          
          <Button 
            onClick={() => navigate('/calculator')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            Go to Calculator
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          
          <p className="text-xs text-gray-500 text-center">
            Redirecting to calculator in 5 seconds...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}