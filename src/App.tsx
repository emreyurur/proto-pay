import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Send, 
  Lock, 
  BookUser
} from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider, ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import '@mysten/dapp-kit/dist/index.css';
import './index.css';

// Landing Page bileşenini import et
import { LandingPage } from './components/LandingPage';
import ppLogo from './assets/pplogo.png';

// Diğer bileşenlerinizi import edin (Örn: Dashboard, BatchCreate...)
import { Dashboard } from './components/Dashboard';
import { BatchCreate } from './components/BatchCreate';
import { EscrowCreate } from './components/EscrowCreate';
import { ApprovalPage } from './components/ApprovalPage';
import { AddressBook } from './components/AddressBook';

// --- Config ---
const networks = {
  testnet: { url: getFullnodeUrl('testnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
};
const queryClient = new QueryClient();

type View = 'landing' | 'dashboard' | 'batch-create' | 'escrow-create' | 'approval' | 'address-book';

// --- Navbar Component (İsterseniz bunu da ayrı dosyaya alabilirsiniz: src/components/Navbar.tsx) ---
interface NavbarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  walletConnected: boolean;
}

function Navbar({ currentView, setCurrentView, walletConnected }: NavbarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'batch-create', label: 'Create Batch', icon: Send },
    { id: 'escrow-create', label: 'Create Escrow', icon: Lock },
    { id: 'address-book', label: 'Address Book', icon: BookUser },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#1a2332]/90 backdrop-blur-xl supports-backdrop-filter:bg-[#1a2332]/70">
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex h-20 items-center justify-between">
          <div className="flex items-center gap-8 flex-1">
            <button onClick={() => setCurrentView('dashboard')} className="flex items-center gap-3 group outline-none">
              <img 
                src={ppLogo} 
                alt="ProtoPay" 
                className="h-12 w-12 transition-all group-hover:scale-105"
              />
              <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent tracking-tight">ProtoPay</span>
            </button>

            {walletConnected && (
              <div className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-[#0f1825]/70 p-1.5 backdrop-blur-md absolute left-1/2 transform -translate-x-1/2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setCurrentView(item.id as View)}
                      className={`relative flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-400/30' : 'text-gray-300 hover:text-white hover:bg-white/10'}`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
             {/* Wallet Connect Button */}
             <ConnectButton />
          </div>
        </div>
      </div>
    </nav>
  );
}

// --- Main Content ---
function AppContent() {
  const currentAccount = useCurrentAccount();
  const [currentView, setCurrentView] = useState<View>('landing');
  const [selectedEscrowId, setSelectedEscrowId] = useState<string>('');
  const [selectedContact, setSelectedContact] = useState<{ address: string; name: string } | null>(null);
  const walletConnected = !!currentAccount;
  const walletAddress = currentAccount?.address || '';

  useEffect(() => {
    if (walletConnected && currentView === 'landing') {
      setCurrentView('dashboard');
    } else if (!walletConnected) {
      setCurrentView('landing');
    }
  }, [walletConnected]);

  return (
    <div className="min-h-screen bg-[#1a2332] text-gray-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-50 overflow-x-hidden">
      {/* Background FX */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none z-0 mix-blend-overlay"></div>
      <div className="fixed top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-blue-900/20 via-slate-800/10 to-transparent pointer-events-none z-0" />
      <div className="fixed -top-[200px] left-[20%] w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none z-0 animate-pulse duration-[10s]" />

      <Navbar currentView={currentView} setCurrentView={setCurrentView} walletConnected={walletConnected} />

      <main className="relative z-10 container mx-auto px-4 py-8 lg:px-6 lg:py-10">
        {!walletConnected ? (
          // Connect Logic WalletProvider tarafından yönetildiği için boş fonksiyon geçilebilir
          <LandingPage onConnect={() => {}} /> 
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Router Logic */}
            {currentView === 'dashboard' && (
              <Dashboard 
                key={walletAddress}
                walletConnected={walletConnected} 
                walletAddress={walletAddress}
                onViewEscrow={(escrowId: string) => {
                  setSelectedEscrowId(escrowId);
                  setCurrentView('approval');
                }}
              />
            )}
            {currentView === 'batch-create' && (
              <BatchCreate 
                walletAddress={walletAddress}
              />
            )}
            {currentView === 'escrow-create' && (
              <EscrowCreate 
                walletAddress={walletAddress}
                prefilledReceiver={selectedContact?.address || ''}
              />
            )}
            {currentView === 'approval' && selectedEscrowId && (
              <ApprovalPage 
                escrowId={selectedEscrowId}
                walletAddress={walletAddress}
                onBack={() => setCurrentView('dashboard')}
              />
            )}
            {currentView === 'address-book' && (
              <AddressBook 
                onSendToContact={(contact, type) => {
                  setSelectedContact({ address: contact.address, name: contact.name });
                  setCurrentView(type === 'batch' ? 'batch-create' : 'escrow-create');
                }}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <AppContent />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}