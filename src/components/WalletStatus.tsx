import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { Copy, LogOut, CheckCircle2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

interface WalletStatusProps {
  connected: boolean;
  address: string;
}

export function WalletStatus({ connected, address }: WalletStatusProps) {
  const currentAccount = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  };

  if (!connected || !currentAccount) {
    return (
      <ConnectButton
        className="!bg-gradient-to-r !from-sky-500 !to-blue-600 !text-white !shadow-lg !shadow-blue-500/30 hover:!from-sky-600 hover:!to-blue-700 !border-0 !px-6 !py-2.5 !rounded-lg !font-medium !transition-all"
      />
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className="gap-3 border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50/80 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-xs leading-none">Sui Wallet</span>
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
          onClick={() => disconnect()}
          className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Disconnect Wallet
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
