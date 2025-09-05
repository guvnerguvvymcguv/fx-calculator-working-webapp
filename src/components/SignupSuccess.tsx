import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Mail } from 'lucide-react';

export default function SignupSuccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#10051A' }}>
      <Card className="w-full max-w-md bg-gray-900/90 border-gray-800">
        <CardHeader className="text-center">
          <Mail className="h-16 w-16 text-purple-500 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold text-white">
            Check Your Email
          </CardTitle>
          <CardDescription className="text-gray-400 mt-2">
            We've sent a verification link to your email address
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-purple-300 text-center">
              Please click the link in your email to activate your account and start your 2-month free trial
            </p>
          </div>
          
          <div className="space-y-2 text-gray-300">
            <p>✓ Company account created</p>
            <p>✓ Admin profile set up</p>
            <p>⏳ Awaiting email verification</p>
          </div>
          
          <Button 
            onClick={() => navigate('/login')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            Go to Login
          </Button>
          
          <p className="text-xs text-gray-500 text-center">
            Didn't receive an email? Check your spam folder or contact support
          </p>
        </CardContent>
      </Card>
    </div>
  );
}