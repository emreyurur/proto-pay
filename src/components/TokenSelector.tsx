import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import suiLogo from '../assets/sui-logo.png';
import { Button } from '../ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui/popover';

export type TokenType = 'SUI' | 'USDC' | 'OTHER';

interface Token {
  symbol: TokenType;
  name: string;
  color: string;
  bgColor: string;
}

const tokens: Token[] = [
  { symbol: 'SUI', name: 'Sui', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  { symbol: 'USDC', name: 'USD Coin', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  { symbol: 'OTHER', name: 'Custom Token', color: 'text-purple-400', bgColor: 'bg-purple-500/20' }
];

interface TokenSelectorProps {
  value: TokenType;
  onChange: (token: TokenType) => void;
}

export function TokenSelector({ value, onChange }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedToken = tokens.find(t => t.symbol === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100"
        >
          {selectedToken && (
            <div className="flex items-center gap-2">
              {selectedToken.symbol === 'SUI' ? (
                <img src={suiLogo} alt="SUI" className="h-6 w-6" />
              ) : (
                <div className={`flex h-6 w-6 items-center justify-center rounded-full ${selectedToken.bgColor}`}>
                  <span className={`text-xs ${selectedToken.color}`}>${selectedToken.symbol[0]}</span>
                </div>
              )}
              <span className="text-slate-100">${selectedToken.symbol}</span>
              <span className="text-slate-400">- {selectedToken.name}</span>
            </div>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0 bg-slate-900 border-slate-700 shadow-xl" align="start">
        <Command className="bg-slate-900 border-0">
          <CommandInput placeholder="Search token..." className="border-0 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:ring-0 focus:outline-none [&>svg]:text-slate-500" />
          <CommandList className="bg-slate-900">
            <CommandEmpty className="text-slate-400 py-6 text-center text-sm">No token found.</CommandEmpty>
            <CommandGroup className="bg-slate-900">
              {tokens.map((token) => (
                <CommandItem
                  key={token.symbol}
                  value={token.symbol}
                  onSelect={() => {
                    onChange(token.symbol);
                    setOpen(false);
                  }}
                  className="cursor-pointer hover:bg-slate-800 data-[selected=true]:bg-cyan-500/20 aria-selected:bg-cyan-500/20"
                >
                  <div className="flex flex-1 items-center gap-3">
                    {token.symbol === 'SUI' ? (
                      <img src={suiLogo} alt="SUI" className="h-8 w-8" />
                    ) : (
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${token.bgColor}`}>
                        <span className={`${token.color}`}>${token.symbol[0]}</span>
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-slate-100">${token.symbol}</span>
                      <span className="text-xs text-slate-400">{token.name}</span>
                    </div>
                  </div>
                  <Check
                    className={`ml-auto h-4 w-4 ${
                      value === token.symbol ? 'opacity-100 text-cyan-400' : 'opacity-0'
                    }`}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}