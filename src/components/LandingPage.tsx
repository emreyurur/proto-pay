import { ExternalLink, ArrowRight, Lock, Users, Clock, Shield, Zap, CheckCircle } from 'lucide-react';
import ppLogo from '../assets/pplogo.png';

interface LandingPageProps {
  onConnect: () => void;
}

export function LandingPage({ onConnect }: LandingPageProps) {
  return (
    <div className="flex min-h-[75vh] flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-700">
      <div className="relative mb-10">
        <div className="absolute -inset-12 rounded-full bg-cyan-500/20 blur-3xl animate-pulse"></div>
        <div className="absolute -inset-4 rounded-full bg-blue-600/20 blur-xl"></div>
        <img 
          src={ppLogo} 
          alt="ProtoPay" 
          className="relative h-36 w-36 rounded-3xl drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"
        />
      </div>
      
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-5xl font-extrabold text-white tracking-tight sm:text-6xl lg:text-7xl">
           <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 animate-gradient-x">ProtoPay</span>
        </h1>
        <p className="text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
          Next generation batch transactions and trustless escrow management on Sui Network. 
          <span className="text-slate-300 font-medium"> Secure, atomic, and instant settlement.</span>
        </p>
      </div>

      <div className="mt-12 flex flex-col sm:flex-row gap-5 items-center justify-center w-full max-w-md mx-auto">
        <button 
          onClick={onConnect} 
          className="w-full sm:w-auto group relative rounded-xl bg-white text-slate-950 px-8 py-4 font-bold text-lg shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all hover:bg-cyan-50 hover:scale-[1.02] hover:shadow-[0_0_60px_-15px_rgba(34,211,238,0.6)]"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            Launch App <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
        <button className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-8 py-4 font-semibold text-white transition-all hover:bg-white/10 hover:border-white/20 backdrop-blur-sm">
          Documentation <ExternalLink className="h-4 w-4 opacity-50" />
        </button>
      </div>
      
      {/* Feature Cards */}
      <div className="mt-24 w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Batch Payments */}
        <div className="group relative rounded-2xl bg-slate-900/50 border border-slate-800/50 p-8 backdrop-blur-sm hover:border-cyan-500/50 transition-all hover:shadow-[0_0_30px_-5px_rgba(34,211,238,0.3)]">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 mb-6">
              <Users className="h-7 w-7 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Batch Payments</h3>
            <p className="text-slate-400 leading-relaxed">
              Send tokens to multiple recipients in a single transaction. Upload CSV files or manually add addresses. Save time and reduce fees.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-xs font-medium">Multi-recipient</span>
              <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">CSV Import</span>
            </div>
          </div>
        </div>

        {/* Conditional Escrow */}
        <div className="group relative rounded-2xl bg-slate-900/50 border border-slate-800/50 p-8 backdrop-blur-sm hover:border-purple-500/50 transition-all hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.3)]">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-6">
              <Lock className="h-7 w-7 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Conditional Escrow</h3>
            <p className="text-slate-400 leading-relaxed">
              Lock funds until specific conditions are met. Set custom rules, deadlines, and approval requirements for trustless transactions.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">Rule-based</span>
              <span className="px-3 py-1 rounded-full bg-pink-500/10 text-pink-400 text-xs font-medium">Trustless</span>
            </div>
          </div>
        </div>

        {/* Time-Lock Release */}
        <div className="group relative rounded-2xl bg-slate-900/50 border border-slate-800/50 p-8 backdrop-blur-sm hover:border-emerald-500/50 transition-all hover:shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 mb-6">
              <Clock className="h-7 w-7 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Time-Lock Release</h3>
            <p className="text-slate-400 leading-relaxed">
              Schedule token releases for future dates. Perfect for vesting schedules, recurring payments, and timed distributions.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium">Scheduled</span>
              <span className="px-3 py-1 rounded-full bg-teal-500/10 text-teal-400 text-xs font-medium">Automated</span>
            </div>
          </div>
        </div>
      </div>

      {/* Why Choose Section */}
      <div className="mt-24 w-full max-w-5xl">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Why Choose Sui Protocol?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: Shield, title: 'Fully On-Chain', desc: 'All transactions executed on Sui blockchain with complete transparency' },
            { icon: Zap, title: 'Instant Settlement', desc: 'Sub-second finality with parallel transaction processing' },
            { icon: CheckCircle, title: 'Zero Intermediaries', desc: 'Direct peer-to-peer transfers without third-party custody' },
            { icon: Lock, title: 'Programmable Security', desc: 'Smart contract enforcement with customizable conditions' }
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-4 p-6 rounded-xl bg-slate-900/30 border border-slate-800/30 hover:border-slate-700/50 transition-colors">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                <item.icon className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h4 className="text-white font-semibold mb-1">{item.title}</h4>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Strip */}
      <div className="mt-24 w-full max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 border-t border-white/5 pt-8">
        {[
          { label: 'Total Volume', value: '$42M+' },
          { label: 'Transactions', value: '1.2M' },
          { label: 'Active Users', value: '85k+' },
          { label: 'Network Fee', value: '<$0.01' }
        ].map((stat, i) => (
          <div key={i} className="text-center group cursor-default">
            <div className="text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors">{stat.value}</div>
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1 group-hover:text-slate-400">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}