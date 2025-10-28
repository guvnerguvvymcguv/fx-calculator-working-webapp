import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "How does the 2-month free trial work?",
    answer: "Your 2-month free trial gives you full access to all features with no credit card required. During this period, you can onboard your team, integrate with Salesforce, and start closing deals. After the trial, your subscription begins based on your selected plan."
  },
  {
    question: "Can I export calculation results?",
    answer: "Yes, all calculations are automatically saved to your dashboard and can be accessed anytime. Admin users can export data via our Salesforce integration, allowing you to sync client interactions directly with your CRM workflow."
  },
  {
    question: "Do you integrate with Salesforce?",
    answer: "Yes! SpreadChecker offers seamless Salesforce integration for admin users. You can schedule automated weekly exports of your team's activity, ensuring your CRM stays up-to-date with all client interactions and calculations."
  },
  {
    question: "What happens after my trial ends?",
    answer: "After your 2-month trial ends, you'll need to select a subscription plan to continue using SpreadChecker. All your data, calculations, and team settings will be preserved. You can choose monthly or annual billing based on your team size."
  },
  {
    question: "How many team members can I add?",
    answer: "You can add unlimited team members based on your subscription. Our pricing scales with your team size: £30/seat/month for 1-5 seats, £27/seat/month for 6-12 seats (10% discount), and £24/seat/month for 13+ seats (20% discount). Annual plans receive an additional 10% discount."
  }
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold mb-6 bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-purple-200/80">Everything you need to know about SpreadChecker</p>
        </div>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white/5 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden transition-all duration-300"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors duration-200"
              >
                <span className="text-lg font-semibold text-purple-200 pr-8">
                  {faq.question}
                </span>
                <div className="flex-shrink-0">
                  {openIndex === index ? (
                    <X className="h-6 w-6 text-purple-400 transition-transform duration-300" />
                  ) : (
                    <Plus className="h-6 w-6 text-purple-400 transition-transform duration-300" />
                  )}
                </div>
              </button>
              
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="px-6 pb-5 pt-2 text-purple-200/80 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
