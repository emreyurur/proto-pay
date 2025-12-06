import { Button } from '../ui/button';
import { Wallet, CheckCircle2, AlertCircle, LogOut, Copy } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type WalletState = 'disconnected' | 'slush' | 'other';

interface WalletStatusProps {
  state: WalletState;
  address: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletStatus({ state, address, onConnect, onDisconnect }: WalletStatusProps) {
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
  };

  if (state === 'disconnected') {
    return (
      <Button 
        onClick={onConnect}
        size="lg"
        className="gap-2 bg-linear-to-r from-sky-500 to-blue-600 shadow-lg shadow-blue-500/30 hover:from-sky-600 hover:to-blue-700"
      >
        <Wallet className="h-5 w-5" />
        <span className="hidden sm:inline">Connect Slush Wallet</span>
        <span className="sm:hidden">Connect</span>
      </Button>
    );
  }

  const statusConfig = {
    slush: {
      icon: CheckCircle2,
      text: 'Slush Wallet',
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
      dotColor: 'bg-emerald-500',
    },
    other: {
      icon: AlertCircle,
      text: 'Other Wallet',
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      dotColor: 'bg-amber-500',
    },
  };

  const config = statusConfig[state];
  const Icon = config.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={`gap-3 border-2 ${config.borderColor} ${config.bgColor} ${config.color} hover:${config.bgColor}/80 shadow-sm`}
        >
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${config.dotColor} animate-pulse`} />
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs leading-none">{config.text}</span>
            <span className="font-mono text-xs leading-none opacity-70">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-white border-slate-200">
        <div className="px-3 py-2">
          <p className="text-xs text-slate-500 mb-1">Connected Address</p>
          <p className="font-mono text-xs text-slate-900 break-all">{address}</p>
        </div>
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem 
          onClick={copyAddress}
          className="gap-2 text-slate-700 focus:text-slate-900 focus:bg-slate-100 cursor-pointer"
        >
          <Copy className="h-4 w-4" />
          Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={onDisconnect}
          className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Disconnect Wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
