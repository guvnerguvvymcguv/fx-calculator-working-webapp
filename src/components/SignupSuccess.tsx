import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle, Calendar, AlertCircle, BookOpen } from 'lucide-react';

export default function SignupSuccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#10051A' }}>
      <Card className="w-full max-w-md bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border-white/30 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_16px_48px_rgba(168,85,247,0.2),0_24px_64px_rgba(59,130,246,0.1)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_20px_56px_rgba(168,85,247,0.3),0_28px_72px_rgba(59,130,246,0.15)] transition-all duration-300 hover:-translate-y-1 border-t-white/20">
        <CardHeader className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold text-white">
            Account Successfully Created!
          </CardTitle>
          <CardDescription className="text-gray-400 mt-2">
            Welcome to SpreadChecker
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(34,197,94,0.1),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(34,197,94,0.15),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:border-green-500/40 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-5 w-5 text-green-400" />
              <p className="text-green-300 font-semibold">2-Month Free Trial Active</p>
            </div>
            <p className="text-gray-300 text-sm">
              Your trial includes full access to all features until {new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </p>
          </div>
          
          <div className="space-y-2 text-gray-300">
            <p className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Company account created
            </p>
            <p className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Admin profile set up
            </p>
            <p className="flex items-center gap-2">
              <span className="text-green-400">✓</span> Team seats configured
            </p>
          </div>

          {/* Documentation Link */}
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4 shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(168,85,247,0.1),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(168,85,247,0.15),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:border-purple-500/40 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start gap-2">
              <BookOpen className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-gray-300 text-sm">
                  New to SpreadChecker? Visit our{' '}
                  <a 
                    href="https://spreadchecker.notion.site/2845045c15cc802e976bfd236ad9179c?v=2845045c15cc80e4a823000c53b37e34"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 font-semibold underline"
                  >
                    SpreadChecker Docs
                  </a>{' '}
                  for setup guides and product documentation.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.05),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:border-gray-600 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-400 font-semibold text-sm mb-1">What happens after your trial?</p>
                <p className="text-gray-400 text-sm">
                  After 2 months, if you haven't upgraded to a paid plan, your account will be paused. 
                  Don't worry - all your data will be safely stored and you can reactivate anytime by subscribing.
                </p>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={() => navigate('/admin')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded-lg shadow-[0_4px_14px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.2),inset_0_-1px_1px_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_1px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
          >
            Go to Dashboard
          </Button>
          
          <p className="text-xs text-gray-500 text-center">
            Need help getting started? Contact us at contact@spreadchecker.co.uk
          </p>
        </CardContent>
      </Card>
    </div>
  );
}