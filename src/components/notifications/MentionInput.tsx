import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  autoFocus?: boolean;
}

export function MentionInput({
  value,
  onChange,
  placeholder,
  className,
  rows = 2,
  disabled,
  onKeyDown,
  autoFocus,
}: MentionInputProps) {
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // Fetch all profiles for mention suggestions
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-mentions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .order('full_name');
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });

  // Filter profiles based on search (exclude current user)
  const filteredProfiles = profiles.filter(p => {
    if (p.user_id === user?.id) return false;
    if (!mentionSearch) return true;
    const searchLower = mentionSearch.toLowerCase();
    return (
      p.full_name?.toLowerCase().includes(searchLower) ||
      p.email?.toLowerCase().includes(searchLower)
    );
  }).slice(0, 5);

  // Handle text input changes
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    
    // Check if we should show mention dropdown
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show if @ is at start or after whitespace, and no space after @
      const charBeforeAt = lastAtIndex > 0 ? newValue[lastAtIndex - 1] : ' ';
      
      if ((charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIndex === 0) && !textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        setMentionStartIndex(lastAtIndex);
        setShowDropdown(true);
        setSelectedIndex(0);
        updateDropdownPosition();
        return;
      }
    }
    
    setShowDropdown(false);
    setMentionStartIndex(null);
  };

  // Calculate dropdown position based on cursor
  const updateDropdownPosition = () => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const rect = textarea.getBoundingClientRect();
    
    // Simple positioning below the textarea
    setDropdownPosition({
      top: rect.height + 4,
      left: 0,
    });
  };

  // Insert mention into text
  const insertMention = (profile: Profile) => {
    if (mentionStartIndex === null) return;
    
    const displayName = profile.full_name || profile.email || 'Unknown';
    const mentionText = `@[${displayName}](${profile.user_id})`;
    
    const beforeMention = value.slice(0, mentionStartIndex);
    const afterMention = value.slice(mentionStartIndex + 1 + mentionSearch.length);
    
    const newValue = beforeMention + mentionText + ' ' + afterMention;
    onChange(newValue);
    
    setShowDropdown(false);
    setMentionStartIndex(null);
    setMentionSearch('');
    
    // Focus back on textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  // Handle keyboard navigation in dropdown
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown && filteredProfiles.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredProfiles.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredProfiles[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }
    
    onKeyDown?.(e);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (profile: Profile) => {
    if (profile.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return profile.email?.[0].toUpperCase() || '?';
  };

  // Convert stored format to display format for rendering
  const displayValue = value.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={displayValue}
        onChange={(e) => {
          // When user types, we need to handle the conversion
          // For now, store the raw format
          const newDisplayValue = e.target.value;
          
          // Check if this is editing existing mention or new text
          // Simple approach: just use the display value and parse on submit
          handleChange(e);
        }}
        placeholder={placeholder}
        className={cn("resize-none", className)}
        rows={rows}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
      />
      
      {showDropdown && filteredProfiles.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-popover border rounded-md shadow-lg py-1 w-full max-h-48 overflow-auto"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          {filteredProfiles.map((profile, index) => (
            <button
              key={profile.user_id}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-accent",
                index === selectedIndex && "bg-accent"
              )}
              onClick={() => insertMention(profile)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">{getInitials(profile)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {profile.full_name || 'Unknown'}
                </div>
                {profile.email && (
                  <div className="text-xs text-muted-foreground truncate">
                    {profile.email}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      
      {showDropdown && filteredProfiles.length === 0 && mentionSearch && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-popover border rounded-md shadow-lg py-2 px-3 w-full text-sm text-muted-foreground"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          No users found matching "{mentionSearch}"
        </div>
      )}
    </div>
  );
}

// Component to render text with highlighted mentions
export function MentionText({ text, className }: { text: string; className?: string }) {
  // Parse and highlight @[Name](user_id) mentions
  const parts = text.split(/(@\[[^\]]+\]\([^)]+\))/g);
  
  return (
    <span className={className}>
      {parts.map((part, index) => {
        const mentionMatch = part.match(/@\[([^\]]+)\]\(([^)]+)\)/);
        if (mentionMatch) {
          return (
            <span
              key={index}
              className="text-primary font-medium bg-primary/10 px-0.5 rounded"
            >
              @{mentionMatch[1]}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
}
