import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        <div className="prose prose-invert max-w-none text-gray-300">
          <p className="text-sm text-gray-400 mb-6">Effective Date: September 7, 2025</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect email addresses, company information, and FX calculation data.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">2. How We Use Information</h2>
          <p>Data is used to provide the service, generate reports, and improve functionality.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">3. Data Storage</h2>
          <p>Data is stored securely on Supabase servers with encryption at rest.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">4. Data Sharing</h2>
          <p>We do not sell or share your data with third parties except as required for service operation.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">5. Your Rights</h2>
          <p>You can request data export or deletion by contacting us.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">6. Cookies</h2>
          <p>We use essential cookies for authentication and session management.</p>
          
          <h2 className="text-2xl text-white mt-8 mb-4">7. Contact</h2>
          <p>Email: contact@spreadchecker.co.uk</p>
        </div>
      </div>
    </div>
  );
}