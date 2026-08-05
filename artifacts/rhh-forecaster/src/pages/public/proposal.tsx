import { useGetPublicProposal, useSubmitProposalAction } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Home, Phone, Mail, FileText, CheckCircle2, MessageSquare, TrendingUp, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function PublicProposal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const { data: proposal, isLoading, error } = useGetPublicProposal(token || "");
  const submitAction = useSubmitProposalAction();
  
  const [actionType, setActionType] = useState<"accept" | "request_call" | "ask_question" | null>(null);
  const [comment, setComment] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  if (isLoading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#FAFAF8]">
      <div className="animate-pulse flex flex-col items-center">
        <div className="h-12 w-12 rounded bg-[#C9963B] text-white flex items-center justify-center font-serif text-2xl font-bold mb-4">R</div>
        <p className="text-gray-500 font-serif">Preparing your presentation...</p>
      </div>
    </div>
  );

  if (error || !proposal) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#FAFAF8] p-4">
      <Card className="max-w-md w-full border-none shadow-xl">
        <CardContent className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-serif font-bold text-gray-900 mb-2">Proposal Unavailable</h2>
          <p className="text-gray-500 mb-6">This proposal link has expired or is invalid. Please contact your Royal Holiday Homes representative for a new link.</p>
        </CardContent>
      </Card>
    </div>
  );

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return "AED 0";
    return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(val);
  };

  const handleActionSubmit = async () => {
    if (!actionType) return;
    
    try {
      await submitAction.mutateAsync({
        token: token!,
        data: {
          actionType: actionType,
          comments: comment,
          ownerPhone: contactPhone,
          acceptedScenarioId: proposal.scenarios?.find(s => s.isRecommended)?.id,
        }
      });
      
      toast({
        title: "Request Submitted",
        description: "Thank you. Your representative will be in touch shortly.",
      });
      setActionType(null);
    } catch (err) {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    }
  };

  // Luxury dark header, warm beige background
  return (
    <div className="min-h-[100dvh] bg-[#FAFAF8] text-[#1C1C1E] font-sans overflow-x-hidden selection:bg-[#B8860B]/20 selection:text-[#B8860B]">
      
      {/* Hero Header */}
      <header className="bg-[#111111] text-white py-16 px-6 md:px-12 relative overflow-hidden">
        {/* Subtle gold glow behind */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#B8860B]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded bg-[#B8860B] flex items-center justify-center text-white font-serif font-bold text-xl">R</div>
              <span className="font-serif font-semibold text-xl tracking-wide">Royal Holiday Homes</span>
            </div>
            <div className="text-sm text-gray-400 font-medium tracking-wider uppercase hidden md:block">
              Ref: {proposal.referenceNumber}
            </div>
          </div>
          
          <div className="max-w-3xl">
            <p className="text-[#B8860B] font-medium tracking-wider uppercase mb-4 text-sm">Revenue Projection & Proposal</p>
            <h1 className="text-4xl md:text-6xl font-serif font-bold leading-tight mb-6">
              Unlocking the true potential of your property.
            </h1>
            <p className="text-xl text-gray-300 font-serif italic">Prepared exclusively for {proposal.ownerTitle ? proposal.ownerTitle + ' ' : ''}{proposal.ownerName}</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 md:px-12 -mt-12 relative z-20 space-y-12 pb-24">
        
        {/* Intro Card */}
        <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-5 h-full">
            <div className="md:col-span-3 p-8 md:p-12 flex flex-col justify-center">
              <h2 className="text-2xl font-serif font-bold mb-6">The Opportunity</h2>
              <div className="prose prose-gray text-gray-600 leading-relaxed">
                {proposal.narrativeText ? (
                  <p>{proposal.narrativeText}</p>
                ) : (
                  <p>
                    By transitioning your asset to the premium short-term rental market with Royal Holiday Homes, 
                    you open the door to significantly higher yields, unparalleled flexibility, and meticulous asset protection. 
                    Our analysis indicates strong demand for this property profile in {proposal.propertyAddress.split(',')[0]}.
                  </p>
                )}
              </div>
            </div>
            <div className="md:col-span-2 bg-[#1C1C1E] text-white p-8 md:p-12 flex flex-col justify-center">
              <h3 className="text-lg font-serif font-semibold mb-6 text-[#B8860B]">Asset Profile</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <div className="text-gray-400 mb-1 flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</div>
                  <div className="font-medium text-lg">{proposal.propertyAddress}</div>
                </div>
                <div>
                  <div className="text-gray-400 mb-1 flex items-center gap-2"><Home className="h-4 w-4" /> Details</div>
                  <div className="font-medium capitalize">{proposal.bedrooms} Bed {proposal.propertyType}</div>
                  <div className="text-gray-300 mt-0.5">{proposal.internalArea} sqft • {proposal.furnishingStatus?.replace('_', ' ')}</div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Executive Summary KPIs */}
        <div className="space-y-6">
          <h2 className="text-3xl font-serif font-bold text-center">Projected Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-lg bg-white p-8 text-center rounded-xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-[#111111]"></div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Annual Gross Revenue</div>
              <div className="text-4xl font-bold text-[#111111]">{formatCurrency(proposal.grossAnnualRevenue)}</div>
              <div className="mt-3 text-sm text-gray-500">Based on {proposal.recommendedOccupancy}% occupancy</div>
            </Card>

            <Card className="border-none shadow-xl bg-[#111111] text-white p-8 text-center rounded-xl relative overflow-hidden transform md:-translate-y-4">
              <div className="absolute top-0 inset-x-0 h-1 bg-[#B8860B]"></div>
              <div className="text-sm font-medium text-[#B8860B] uppercase tracking-wider mb-2">Net Owner Income</div>
              <div className="text-5xl font-bold">{formatCurrency(proposal.netOwnerIncome)}</div>
              <div className="mt-3 text-sm text-gray-400">After management fees & standard expenses</div>
            </Card>

            <Card className="border-none shadow-lg bg-white p-8 text-center rounded-xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-green-500"></div>
              <div className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">vs. Traditional Rental</div>
              <div className="text-4xl font-bold text-green-600">+{proposal.increaseVsLtrPct}%</div>
              <div className="mt-3 text-sm text-gray-500">Expected net increase in yield</div>
            </Card>
          </div>
        </div>

        {/* Scenarios Chart */}
        {proposal.scenarios && proposal.scenarios.length > 0 && (
          <Card className="border-none shadow-lg bg-white p-8 rounded-xl">
            <div className="mb-8">
              <h3 className="text-2xl font-serif font-bold mb-2">Performance Scenarios</h3>
              <p className="text-gray-500">How your property performs across different market conditions.</p>
            </div>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={proposal.scenarios} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 13 }} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `AED ${val/1000}k`} tick={{ fill: '#6B7280', fontSize: 13 }} />
                  <RechartsTooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{fill: '#F3F4F6'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="netOwnerIncome" radius={[6, 6, 0, 0]} maxBarSize={80}>
                    {proposal.scenarios.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.isRecommended ? '#B8860B' : '#1C1C1E'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#1C1C1E]"></div> Baseline Estimates</div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#B8860B]"></div> Recommended Target</div>
            </div>
          </Card>
        )}

        {/* Next Steps / CTA */}
        <div className="bg-white border border-gray-100 shadow-xl rounded-2xl p-8 md:p-12 text-center mt-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#B8860B]/5 rounded-full blur-[60px] pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#B8860B]/5 rounded-full blur-[60px] pointer-events-none"></div>
          
          <h2 className="text-3xl font-serif font-bold mb-4 relative z-10">Ready to maximize your yield?</h2>
          <p className="text-gray-500 mb-10 max-w-2xl mx-auto relative z-10">
            Select how you would like to proceed. Your dedicated representative, {proposal.advisorName || 'our team'}, is ready to assist.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 relative z-10">
            <Dialog>
              <DialogTrigger asChild>
                <Button onClick={() => setActionType("accept")} className="h-14 px-8 bg-[#111111] hover:bg-[#1C1C1E] text-white text-lg w-full sm:w-auto shadow-lg">
                  <CheckCircle2 className="mr-2 h-5 w-5 text-[#B8860B]" /> Accept Proposal
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">Accept Proposal</DialogTitle>
                  <DialogDescription>
                    Excellent choice. Let us know the best number to reach you to finalize the management agreement.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Phone Number</label>
                    <Input 
                      placeholder="+971 50 123 4567" 
                      value={contactPhone} 
                      onChange={e => setContactPhone(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Any final questions? (Optional)</label>
                    <Textarea 
                      placeholder="e.g. When can we start?" 
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleActionSubmit} className="w-full bg-[#111111] text-white">Submit Acceptance</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button onClick={() => setActionType("request_call")} variant="outline" className="h-14 px-8 text-lg border-gray-300 w-full sm:w-auto bg-white">
                  <Phone className="mr-2 h-5 w-5 text-gray-500" /> Request a Call
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="font-serif text-xl">Request a Call</DialogTitle>
                  <DialogDescription>
                    We'll call you to discuss the numbers in detail.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Phone Number</label>
                    <Input 
                      placeholder="+971 50 123 4567" 
                      value={contactPhone} 
                      onChange={e => setContactPhone(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Preferred Time (Optional)</label>
                    <Input 
                      placeholder="e.g. Tomorrow afternoon" 
                      value={comment}
                      onChange={e => setComment(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleActionSubmit} className="w-full bg-[#111111] text-white">Request Call</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-sm text-gray-400 pt-8 pb-12">
          {proposal.disclaimer ? (
            <p className="max-w-3xl mx-auto mb-4 text-xs">{proposal.disclaimer}</p>
          ) : (
            <p className="max-w-3xl mx-auto mb-4 text-xs">
              Disclaimer: The figures presented in this proposal are estimates based on historical market data, comparable properties, and current market conditions. Actual revenue may vary and is not guaranteed.
            </p>
          )}
          <p>Prepared on {new Date(proposal.proposalDate || new Date()).toLocaleDateString()} • Valid until {new Date(proposal.expiresAt).toLocaleDateString()}</p>
        </div>
      </main>
    </div>
  );
}
