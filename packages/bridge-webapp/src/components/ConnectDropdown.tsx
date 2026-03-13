import { useCallback, useRef, useState } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';

export interface ConnectOption {
  label: string;
  icon?: string;
  onSelect: () => void;
}

interface ConnectDropdownProps {
  label: string;
  error: string | null;
  options: ConnectOption[];
}

export function ConnectDropdown({ label, error, options }: ConnectDropdownProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => setMenuOpen(false), []);
  const handleToggle = useCallback(() => setMenuOpen((prev) => !prev), []);
  const handleSelect = useCallback((option: ConnectOption) => {
    setMenuOpen(false);
    option.onSelect();
  }, []);

  useClickOutside(menuRef, handleClose, menuOpen);

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleToggle} className="btn">
          Connect {label} Wallet
        </button>
        {error && <p className="text-red-400 text-xs max-w-xs">{error}</p>}
      </div>
      {menuOpen && (
        <div className="absolute right-0 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-10 min-w-48">
          {options.map((option, i) => (
            <DropdownItem
              key={option.label}
              option={option}
              isFirst={i === 0}
              isLast={i === options.length - 1}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  option,
  isFirst,
  isLast,
  onSelect,
}: {
  option: ConnectOption;
  isFirst: boolean;
  isLast: boolean;
  onSelect: (option: ConnectOption) => void;
}) {
  const handleClick = useCallback(() => onSelect(option), [option, onSelect]);

  return (
    <button
      type="button"
      className={`w-full text-left px-4 py-2 text-sm text-dark-200 hover:bg-dark-700 ${
        isFirst ? 'rounded-t-lg' : ''
      } ${isLast ? 'rounded-b-lg' : ''}`}
      onClick={handleClick}
    >
      {option.icon && <img src={option.icon} alt="" className="inline-block w-4 h-4 mr-2" />}
      {option.label}
    </button>
  );
}
