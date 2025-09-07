import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-[#10051A] p-8">
      <button
        onClick={() => navigate('/')}
        className="mb-8 p-3 bg-gray-900/90 hover:bg-gray-800/90 rounded-lg transition-colors"
      >
        <ArrowLeft className="h-5 w-5 text-gray-400" />
      </button>
      
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Terms of Service</h1>
        <div className="prose prose-invert max-w-none text-gray-300">
          <p className="text-sm text-gray-400 mb-6">Effective Date: September 7, 2025</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>By accessing Spread Checker, you agree to these Terms of Service.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">2. Service Description</h2>
          <p>Spread Checker provides FX spread calculation tools for brokerage firms on a subscription basis.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">3. User Accounts</h2>
          <p>You are responsible for maintaining the confidentiality of your account credentials.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">4. Pricing and Payment</h2>
          <p>Subscription fees are £30 per seat/month with volume discounts. 2-month free trial included.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">5. Data Usage</h2>
          <p>Calculation data is stored for reporting purposes and may be exported to your CRM systems.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">6. Termination</h2>
          <p>Either party may terminate the subscription with 30 days notice.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">7. Contact</h2>
          <p>Email: contact@spreadchecker.co.uk</p>
        </div>
      </div>
    </div>
  );
}